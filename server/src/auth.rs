//! Inicio de sesión con email (o «admin») y contraseña.
//! Cada dispositivo recibe su propio token de sesión, que se guarda hasheado.

use std::time::{Duration, Instant};

use axum::{
    extract::{FromRequestParts, State},
    http::{header, request::Parts},
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use cookie::time::Duration as CookieDuration;
use rand::RngCore;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use sqlx::Row;

use crate::{
    users,
    error::{ApiError, ApiResult},
    AppState,
};

pub const COOKIE: &str = "an_session";
const MAX_FAILURES: usize = 10;
const FAILURE_WINDOW: Duration = Duration::from_secs(15 * 60);

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
}

fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}


#[derive(Deserialize)]
struct LoginBody {
    #[serde(default)]
    email: String,
    password: String,
    #[serde(default)]
    device: String,
}

async fn login(State(st): State<AppState>, jar: CookieJar, Json(body): Json<LoginBody>) -> ApiResult<(CookieJar, Json<Value>)> {
    {
        let mut f = st.login_failures.lock().unwrap();
        while f.front().is_some_and(|t| t.elapsed() > FAILURE_WINDOW) {
            f.pop_front();
        }
        if f.len() >= MAX_FAILURES {
            return Err(ApiError::Status(
                axum::http::StatusCode::TOO_MANY_REQUESTS,
                "Demasiados intentos. Prueba en unos minutos.".into(),
            ));
        }
    }

    let email = users::normalize_email(&body.email);
    let row = sqlx::query("SELECT id, password_hash FROM users WHERE email = $1").bind(&email).fetch_optional(&st.db).await?;
    // Se comprueba la contraseña aunque el usuario no exista, para no dar pistas por el tiempo de respuesta
    let (user_id, hash) = match row {
        Some(r) => (Some(r.get::<String, _>("id")), r.get::<String, _>("password_hash")),
        None => (None, DUMMY_HASH.clone()),
    };
    let password = body.password.clone();
    let valid = tokio::task::spawn_blocking(move || users::verify_password(&password, &hash)).await.unwrap_or(false);
    let Some(user_id) = user_id.filter(|_| valid) else {
        st.login_failures.lock().unwrap().push_back(Instant::now());
        tokio::time::sleep(Duration::from_millis(600)).await;
        return Err(ApiError::Status(axum::http::StatusCode::UNAUTHORIZED, "Email o contraseña incorrectos".into()));
    };

    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    sqlx::query("INSERT INTO sessions (token_hash, device, user_id) VALUES ($1, $2, $3)")
        .bind(hash_token(&token))
        .bind(body.device.chars().take(100).collect::<String>())
        .bind(&user_id)
        .execute(&st.db)
        .await?;

    let cookie = Cookie::build((COOKIE, token.clone()))
        .path("/")
        .http_only(true)
        .secure(st.secure_cookies)
        .same_site(SameSite::Lax)
        .max_age(time_years(5));
    // El token también se devuelve para las apps de escritorio (cabecera Authorization)
    Ok((jar.add(cookie), Json(json!({ "ok": true, "token": token }))))
}

fn time_years(n: i64) -> CookieDuration {
    CookieDuration::days(365 * n)
}

async fn logout(State(st): State<AppState>, jar: CookieJar, Auth(u): Auth) -> ApiResult<(CookieJar, Json<Value>)> {
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1").bind(&u.token_hash).execute(&st.db).await?;
    Ok((jar.remove(Cookie::build(COOKIE).path("/")), Json(json!({ "ok": true }))))
}

async fn me(Auth(u): Auth) -> Json<Value> {
    Json(users::user_json(&u))
}

/// Hash de una contraseña cualquiera: se usa cuando el email no existe
static DUMMY_HASH: std::sync::LazyLock<String> =
    std::sync::LazyLock::new(|| users::hash_password("contraseña-que-no-existe").unwrap_or_default());

#[derive(Clone)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub is_admin: bool,
    pub token_hash: String,
}

/// Extractor: exige una sesión válida (cookie, `Authorization: Bearer` o `?token=`)
/// y devuelve el usuario al que pertenece.
pub struct Auth(pub User);

impl FromRequestParts<AppState> for Auth {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, st: &AppState) -> Result<Self, Self::Rejection> {
        let from_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(str::to_string);
        let from_cookie = || CookieJar::from_headers(&parts.headers).get(COOKIE).map(|c| c.value().to_string());
        let from_query = || {
            parts.uri.query().and_then(|q| {
                q.split('&').find_map(|kv| kv.strip_prefix("token=").map(str::to_string))
            })
        };
        let token = from_header.or_else(from_cookie).or_else(from_query).ok_or_else(ApiError::unauthorized)?;

        let token_hash = hash_token(&token);
        let row = sqlx::query(
            "UPDATE sessions s SET last_seen_at = now() FROM users u
             WHERE s.token_hash = $1 AND u.id = s.user_id
             RETURNING u.id, u.email, u.name, u.is_admin",
        )
        .bind(&token_hash)
        .fetch_optional(&st.db)
        .await?
        .ok_or_else(ApiError::unauthorized)?;
        Ok(Auth(User {
            id: row.get("id"),
            email: row.get("email"),
            name: row.get("name"),
            is_admin: row.get("is_admin"),
            token_hash,
        }))
    }
}

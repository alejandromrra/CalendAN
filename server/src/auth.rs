//! Inicio de sesión de un único usuario (tú) con la contraseña de AN_PASSWORD.
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

use crate::{
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

/// Comparación en tiempo constante
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[derive(Deserialize)]
struct LoginBody {
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

    let given: [u8; 32] = Sha256::digest(body.password.as_bytes()).into();
    if !ct_eq(&given, &st.password_hash) {
        st.login_failures.lock().unwrap().push_back(Instant::now());
        tokio::time::sleep(Duration::from_millis(800)).await;
        return Err(ApiError::Status(axum::http::StatusCode::UNAUTHORIZED, "Contraseña incorrecta".into()));
    }

    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    sqlx::query("INSERT INTO sessions (token_hash, device) VALUES ($1, $2)")
        .bind(hash_token(&token))
        .bind(body.device.chars().take(100).collect::<String>())
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

async fn logout(State(st): State<AppState>, jar: CookieJar, auth: Auth) -> ApiResult<(CookieJar, Json<Value>)> {
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1").bind(&auth.token_hash).execute(&st.db).await?;
    Ok((jar.remove(Cookie::build(COOKIE).path("/")), Json(json!({ "ok": true }))))
}

async fn me(_auth: Auth) -> Json<Value> {
    Json(json!({ "ok": true }))
}

/// Extractor: exige una sesión válida (cookie, `Authorization: Bearer` o `?token=`)
pub struct Auth {
    pub token_hash: String,
}

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
        let found = sqlx::query("UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1")
            .bind(&token_hash)
            .execute(&st.db)
            .await?
            .rows_affected();
        if found == 0 {
            return Err(ApiError::unauthorized());
        }
        Ok(Auth { token_hash })
    }
}

//! Cuentas de usuario. Solo el administrador puede crear cuentas (no hay registro público).

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, State},
    routing::{get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;

use crate::{
    auth::{Auth, User},
    error::{ApiError, ApiResult},
    AppState,
};

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| anyhow::anyhow!("hash: {e}"))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|h| Argon2::default().verify_password(password.as_bytes(), &h).is_ok())
}

fn new_id() -> String {
    use rand::RngCore;
    let mut b = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut b);
    hex::encode(b)
}

pub fn normalize_email(e: &str) -> String {
    e.trim().to_lowercase()
}

fn check_password(p: &str) -> ApiResult<()> {
    if p.chars().count() < 8 {
        return Err(ApiError::bad_request("La contraseña debe tener al menos 8 caracteres"));
    }
    Ok(())
}

fn valid_email(e: &str) -> bool {
    e == "admin" || (e.len() <= 200 && e.contains('@') && !e.contains(char::is_whitespace))
}

/// Si no hay ninguna cuenta, crea el administrador con ADMIN_EMAIL (por defecto "admin")
/// y AN_PASSWORD, y le asigna todos los datos que ya existían.
pub async fn bootstrap(db: &sqlx::PgPool) -> anyhow::Result<()> {
    let count: i64 = sqlx::query("SELECT count(*) AS n FROM users").fetch_one(db).await?.get("n");
    if count > 0 {
        return recover_admin(db).await;
    }
    let password = std::env::var("AN_PASSWORD").unwrap_or_default();
    if password.chars().count() < 8 {
        anyhow::bail!("Primera vez: define AN_PASSWORD (mínimo 8 caracteres) para crear la cuenta de administrador");
    }
    let email = normalize_email(&std::env::var("ADMIN_EMAIL").unwrap_or_else(|_| "admin".into()));
    let id = new_id();
    let mut tx = db.begin().await?;
    sqlx::query("INSERT INTO users (id, email, name, password_hash, is_admin) VALUES ($1,$2,'Administrador',$3,true)")
        .bind(&id)
        .bind(&email)
        .bind(hash_password(&password)?)
        .execute(&mut *tx)
        .await?;
    for table in ["sessions", "tasks", "projects", "files", "push_subscriptions"] {
        sqlx::query(&format!("UPDATE {table} SET user_id = $1 WHERE user_id IS NULL")).bind(&id).execute(&mut *tx).await?;
    }
    // Los ajustes que eran globales pasan a ser del administrador
    sqlx::query(
        "INSERT INTO user_settings (user_id, key, value)
         SELECT $1, key, value FROM settings WHERE key IN ('whatsapp', 'appearance')",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM settings WHERE key IN ('whatsapp', 'appearance')").execute(&mut *tx).await?;
    tx.commit().await?;
    tracing::info!("Cuenta de administrador creada: «{email}» (contraseña: la de AN_PASSWORD)");
    Ok(())
}

/// Recuperación: con RESET_ADMIN_PASSWORD=true, al arrancar se pone AN_PASSWORD como
/// contraseña del administrador más antiguo (y se cierran sus sesiones).
/// Pensado para quitar la variable en cuanto se haya vuelto a entrar.
async fn recover_admin(db: &sqlx::PgPool) -> anyhow::Result<()> {
    if std::env::var("RESET_ADMIN_PASSWORD").map(|v| v.trim().eq_ignore_ascii_case("true")).unwrap_or(false) {
        let password = std::env::var("AN_PASSWORD").unwrap_or_default();
        if password.chars().count() < 8 {
            anyhow::bail!("RESET_ADMIN_PASSWORD necesita AN_PASSWORD (mínimo 8 caracteres)");
        }
        let row = sqlx::query("SELECT id, email FROM users WHERE is_admin ORDER BY created_at LIMIT 1").fetch_optional(db).await?;
        if let Some(r) = row {
            let id: String = r.get("id");
            let email: String = r.get("email");
            sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1").bind(&id).bind(hash_password(&password)?).execute(db).await?;
            sqlx::query("DELETE FROM sessions WHERE user_id = $1").bind(&id).execute(db).await?;
            tracing::warn!("Contraseña del administrador «{email}» restablecida a AN_PASSWORD. Quita RESET_ADMIN_PASSWORD de las variables.");
        }
    }
    Ok(())
}

// ---------------------------------------------------------------- ajustes por usuario

pub async fn get_setting(db: &sqlx::PgPool, user: &str, key: &str) -> anyhow::Result<Option<Value>> {
    Ok(sqlx::query("SELECT value FROM user_settings WHERE user_id = $1 AND key = $2")
        .bind(user)
        .bind(key)
        .fetch_optional(db)
        .await?
        .map(|r| r.get("value")))
}

pub async fn set_setting(db: &sqlx::PgPool, user: &str, key: &str, value: &Value) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO user_settings (user_id, key, value) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, key) DO UPDATE SET value = $3",
    )
    .bind(user)
    .bind(key)
    .bind(value)
    .execute(db)
    .await?;
    Ok(())
}

// ---------------------------------------------------------------- rutas

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/account", put(update_account))
        .route("/api/account/password", put(change_password))
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/{id}", axum::routing::delete(delete_user))
        .route("/api/users/{id}/password", put(reset_password))
}

pub fn user_json(u: &User) -> Value {
    json!({ "id": u.id, "email": u.email, "name": u.name, "isAdmin": u.is_admin })
}

#[derive(Deserialize)]
struct AccountBody {
    name: String,
}

async fn update_account(Auth(u): Auth, State(st): State<AppState>, Json(b): Json<AccountBody>) -> ApiResult<Json<Value>> {
    let name: String = b.name.trim().chars().take(80).collect();
    sqlx::query("UPDATE users SET name = $2 WHERE id = $1").bind(&u.id).bind(&name).execute(&st.db).await?;
    Ok(Json(user_json(&User { name, ..u })))
}

#[derive(Deserialize)]
struct PasswordBody {
    current: String,
    new: String,
}

async fn change_password(Auth(u): Auth, State(st): State<AppState>, Json(b): Json<PasswordBody>) -> ApiResult<Json<Value>> {
    let hash: String = sqlx::query("SELECT password_hash FROM users WHERE id = $1").bind(&u.id).fetch_one(&st.db).await?.get(0);
    if !verify_password(&b.current, &hash) {
        return Err(ApiError::bad_request("La contraseña actual no es correcta"));
    }
    check_password(&b.new)?;
    sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1").bind(&u.id).bind(hash_password(&b.new)?).execute(&st.db).await?;
    // Cierra la sesión del resto de dispositivos
    sqlx::query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2").bind(&u.id).bind(&u.token_hash).execute(&st.db).await?;
    Ok(Json(json!({ "ok": true })))
}

fn require_admin(u: &User) -> ApiResult<()> {
    if !u.is_admin {
        return Err(ApiError::Status(axum::http::StatusCode::FORBIDDEN, "Solo el administrador puede hacer esto".into()));
    }
    Ok(())
}

async fn list_users(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    require_admin(&u)?;
    let rows = sqlx::query(
        "SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
                (SELECT count(*) FROM tasks t WHERE t.user_id = u.id) AS tasks,
                (SELECT count(*) FROM projects p WHERE p.user_id = u.id) AS projects,
                (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen
         FROM users u ORDER BY u.is_admin DESC, u.created_at",
    )
    .fetch_all(&st.db)
    .await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<String, _>("id"),
                "email": r.get::<String, _>("email"),
                "name": r.get::<String, _>("name"),
                "isAdmin": r.get::<bool, _>("is_admin"),
                "tasks": r.get::<i64, _>("tasks"),
                "projects": r.get::<i64, _>("projects"),
                "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").timestamp_millis(),
                "lastSeen": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_seen").map(|d| d.timestamp_millis()),
            })
        })
        .collect();
    Ok(Json(json!(list)))
}

#[derive(Deserialize)]
struct NewUser {
    email: String,
    #[serde(default)]
    name: String,
    password: String,
    #[serde(default)]
    is_admin: bool,
}

async fn create_user(Auth(u): Auth, State(st): State<AppState>, Json(b): Json<NewUser>) -> ApiResult<Json<Value>> {
    require_admin(&u)?;
    let email = normalize_email(&b.email);
    if !valid_email(&email) {
        return Err(ApiError::bad_request("El email no es válido"));
    }
    check_password(&b.password)?;
    let id = new_id();
    let res = sqlx::query("INSERT INTO users (id, email, name, password_hash, is_admin) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING")
        .bind(&id)
        .bind(&email)
        .bind(b.name.trim().chars().take(80).collect::<String>())
        .bind(hash_password(&b.password)?)
        .bind(b.is_admin)
        .execute(&st.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError::bad_request("Ya existe una cuenta con ese email"));
    }
    Ok(Json(json!({ "ok": true, "id": id })))
}

async fn delete_user(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    require_admin(&u)?;
    if id == u.id {
        return Err(ApiError::bad_request("No puedes borrar tu propia cuenta"));
    }
    sqlx::query("DELETE FROM users WHERE id = $1").bind(&id).execute(&st.db).await?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct ResetBody {
    password: String,
}

async fn reset_password(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>, Json(b): Json<ResetBody>) -> ApiResult<Json<Value>> {
    require_admin(&u)?;
    check_password(&b.password)?;
    let n = sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
        .bind(&id)
        .bind(hash_password(&b.password)?)
        .execute(&st.db)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(ApiError::not_found());
    }
    // Sus dispositivos tendrán que entrar con la contraseña nueva
    if id != u.id {
        sqlx::query("DELETE FROM sessions WHERE user_id = $1").bind(&id).execute(&st.db).await?;
    }
    Ok(Json(json!({ "ok": true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashing() {
        let h = hash_password("una-contraseña").unwrap();
        assert!(verify_password("una-contraseña", &h));
        assert!(!verify_password("otra", &h));
        assert!(!verify_password("x", "no-es-un-hash"));
    }
}

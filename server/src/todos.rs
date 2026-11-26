//! Lista de tareas (to-do) con prioridades y resumen diario por WhatsApp.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{DateTime, NaiveTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;

use crate::{
    auth::Auth,
    error::{ApiError, ApiResult},
    users, whatsapp, AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/todos", get(list).delete(clear_done))
        .route("/api/todos/{id}", put(upsert).delete(remove))
        .route("/api/settings/digest", get(get_digest).put(put_digest))
        .route("/api/digest/test", post(test_digest))
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    #[serde(default)]
    id: String,
    title: String,
    #[serde(default)]
    notes: String,
    /// 0 sin prioridad · 1 baja · 2 media · 3 alta
    #[serde(default)]
    priority: i16,
    #[serde(default)]
    done: bool,
    #[serde(default)]
    done_at: Option<i64>,
    #[serde(default)]
    created_at: i64,
}

fn from_row(r: &sqlx::postgres::PgRow) -> Todo {
    Todo {
        id: r.get("id"),
        title: r.get("title"),
        notes: r.get("notes"),
        priority: r.get("priority"),
        done: r.get("done"),
        done_at: r.get::<Option<DateTime<Utc>>, _>("done_at").map(|d| d.timestamp_millis()),
        created_at: r.get::<DateTime<Utc>, _>("created_at").timestamp_millis(),
    }
}

fn valid_id(id: &str) -> ApiResult<()> {
    if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(ApiError::bad_request("id no válido"));
    }
    Ok(())
}

async fn list(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Vec<Todo>>> {
    let rows = sqlx::query("SELECT * FROM todos WHERE user_id = $1 ORDER BY done, priority DESC, created_at")
        .bind(&u.id)
        .fetch_all(&st.db)
        .await?;
    Ok(Json(rows.iter().map(from_row).collect()))
}

async fn upsert(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>, Json(t): Json<Todo>) -> ApiResult<Json<Todo>> {
    valid_id(&id)?;
    let title: String = t.title.trim().chars().take(300).collect();
    if title.is_empty() {
        return Err(ApiError::bad_request("La tarea necesita un título"));
    }
    let created = DateTime::from_timestamp_millis(t.created_at).filter(|_| t.created_at > 0).unwrap_or_else(Utc::now);
    let row = sqlx::query(
        "INSERT INTO todos (id, user_id, title, notes, priority, done, done_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $6 THEN now() END, $7, now())
         ON CONFLICT (id) DO UPDATE SET title=$3, notes=$4, priority=$5, done=$6,
           done_at = CASE WHEN $6 THEN COALESCE(todos.done_at, now()) END, updated_at=now()
         WHERE todos.user_id = $2
         RETURNING *",
    )
    .bind(&id)
    .bind(&u.id)
    .bind(&title)
    .bind(t.notes.trim())
    .bind(t.priority.clamp(0, 3))
    .bind(t.done)
    .bind(created)
    .fetch_optional(&st.db)
    .await?
    .ok_or_else(ApiError::not_found)?;
    st.notify(&u.id, "todos");
    Ok(Json(from_row(&row)))
}

async fn remove(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    sqlx::query("DELETE FROM todos WHERE id = $1 AND user_id = $2").bind(&id).bind(&u.id).execute(&st.db).await?;
    st.notify(&u.id, "todos");
    Ok(Json(json!({ "ok": true })))
}

/// Borra todas las completadas
async fn clear_done(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    let n = sqlx::query("DELETE FROM todos WHERE user_id = $1 AND done").bind(&u.id).execute(&st.db).await?.rows_affected();
    st.notify(&u.id, "todos");
    Ok(Json(json!({ "ok": true, "deleted": n })))
}

// ---------------------------------------------------------------- resumen diario

#[derive(Serialize, Deserialize, Clone)]
pub struct Digest {
    enabled: bool,
    /// Hora local "HH:MM"
    time: String,
}

impl Default for Digest {
    fn default() -> Self {
        Self { enabled: true, time: "08:00".into() }
    }
}

async fn digest_settings(db: &sqlx::PgPool, user: &str) -> anyhow::Result<Digest> {
    Ok(users::get_setting(db, user, "digest")
        .await?
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

async fn get_digest(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Digest>> {
    Ok(Json(digest_settings(&st.db, &u.id).await?))
}

async fn put_digest(Auth(u): Auth, State(st): State<AppState>, Json(d): Json<Digest>) -> ApiResult<Json<Digest>> {
    if NaiveTime::parse_from_str(&d.time, "%H:%M").is_err() {
        return Err(ApiError::bad_request("Hora no válida (HH:MM)"));
    }
    users::set_setting(&st.db, &u.id, "digest", &serde_json::to_value(&d)?).await?;
    Ok(Json(d))
}

const PRIORITY_ICON: [&str; 4] = ["⚪", "🔵", "🟠", "🔴"];

/// Mensaje de buenos días con las tareas pendientes (None si no hay ninguna)
async fn digest_message(db: &sqlx::PgPool, user: &str, name: &str) -> anyhow::Result<Option<String>> {
    let rows = sqlx::query("SELECT title, priority FROM todos WHERE user_id = $1 AND NOT done ORDER BY priority DESC, created_at")
        .bind(user)
        .fetch_all(db)
        .await?;
    if rows.is_empty() {
        return Ok(None);
    }
    let first = name.split_whitespace().next().unwrap_or_default();
    let hello = if first.is_empty() || first.contains('@') { "☀️ *¡Buenos días!*".to_string() } else { format!("☀️ *¡Buenos días, {first}!*") };
    let n = rows.len();
    let mut msg = format!(
        "{hello}\nHoy toca hacer todo esto ({n} {}):\n",
        if n == 1 { "tarea" } else { "tareas" }
    );
    for r in rows.iter() {
        let p: i16 = r.get("priority");
        let title: String = r.get("title");
        msg.push_str(&format!("\n{} {title}", PRIORITY_ICON[p.clamp(0, 3) as usize]));
    }
    msg.push_str("\n\n¡A por ello! 💪");
    Ok(Some(msg))
}

async fn test_digest(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    let msg = digest_message(&st.db, &u.id, &u.name)
        .await?
        .ok_or_else(|| ApiError::bad_request("No tienes tareas pendientes"))?;
    whatsapp::send(&st, &u.id, &msg).await.map_err(|e| ApiError::Status(StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(Json(json!({ "ok": true })))
}

/// Se llama cada 30 s: envía el resumen a quien le toque (una vez al día, a su hora).
pub async fn send_due_digests(st: &AppState) -> anyhow::Result<()> {
    let now = Utc::now().with_timezone(&st.tz);
    let today = now.date_naive();
    let minutes_now = (now.hour() * 60 + now.minute()) as i64;

    // Usuarios con WhatsApp configurado que aún no han recibido el resumen de hoy
    let users = sqlx::query(
        "SELECT u.id, u.name FROM users u
         WHERE EXISTS (SELECT 1 FROM user_settings s WHERE s.user_id = u.id AND s.key = 'whatsapp')
           AND NOT EXISTS (SELECT 1 FROM daily_digests d WHERE d.user_id = u.id AND d.day = $1)",
    )
    .bind(today)
    .fetch_all(&st.db)
    .await?;

    for row in users {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let cfg = digest_settings(&st.db, &id).await?;
        let Ok(at) = NaiveTime::parse_from_str(&cfg.time, "%H:%M") else { continue };
        let due = (at.hour() * 60 + at.minute()) as i64;
        // Solo dentro de la hora siguiente (si el servidor estuvo apagado, no se manda tarde)
        if !cfg.enabled || minutes_now < due || minutes_now > due + 60 {
            continue;
        }
        let claimed = sqlx::query("INSERT INTO daily_digests (user_id, day) VALUES ($1,$2) ON CONFLICT DO NOTHING")
            .bind(&id)
            .bind(today)
            .execute(&st.db)
            .await?
            .rows_affected();
        if claimed == 0 {
            continue;
        }
        let Some(msg) = digest_message(&st.db, &id, &name).await? else { continue };
        if let Err(e) = whatsapp::send(st, &id, &msg).await {
            tracing::warn!("resumen diario falló ({e:#}); se reintentará");
            sqlx::query("DELETE FROM daily_digests WHERE user_id = $1 AND day = $2").bind(&id).bind(today).execute(&st.db).await?;
        } else {
            tracing::info!("resumen diario enviado");
        }
    }
    Ok(())
}

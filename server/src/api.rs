//! API REST: tareas, proyectos (con sus diseños/notas/enlaces), archivos y ajustes.

use std::convert::Infallible;

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{get, post, put},
    Json, Router,
};
use base64::Engine;
use chrono::{DateTime, Utc};
use futures_util::Stream;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};

use crate::{
    auth::Auth,
    error::{ApiError, ApiResult},
    whatsapp, AppState,
};

const MAX_FILE: usize = 15 * 1024 * 1024;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/events", get(events))
        .route("/api/tasks", get(list_tasks))
        .route("/api/tasks/{id}", put(put_task).delete(delete_task))
        .route("/api/projects", get(list_projects))
        .route("/api/projects/{id}", put(put_project).delete(delete_project))
        .route("/api/files", post(upload_file))
        .route("/api/files/{id}", get(get_file))
        .route("/api/settings/whatsapp", get(get_whatsapp).put(put_whatsapp))
        .route("/api/whatsapp/test", post(test_whatsapp))
}

fn new_id() -> String {
    use rand::RngCore;
    let mut b = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut b);
    hex::encode(b)
}

fn valid_id(id: &str) -> ApiResult<()> {
    if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(ApiError::bad_request("id no válido"));
    }
    Ok(())
}

// ---------------------------------------------------------------- eventos

/// Los clientes escuchan aquí y recargan cuando otro dispositivo cambia algo
async fn events(_a: Auth, State(st): State<AppState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = BroadcastStream::new(st.events.subscribe())
        .filter_map(|m| m.ok())
        .map(|what| Ok(Event::default().event("change").data(what)));
    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ---------------------------------------------------------------- tareas

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    #[serde(default)]
    id: String,
    title: String,
    #[serde(default)]
    description: String,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    #[serde(default)]
    all_day: bool,
    #[serde(default = "brand")]
    color: String,
    /// Minutos antes de la tarea; null = sin aviso
    #[serde(default)]
    reminder: Option<i32>,
    #[serde(default)]
    done: bool,
}

fn brand() -> String {
    "brand".into()
}

fn task_from_row(r: &sqlx::postgres::PgRow) -> Task {
    Task {
        id: r.get("id"),
        title: r.get("title"),
        description: r.get("description"),
        start: r.get("start_at"),
        end: r.get("end_at"),
        all_day: r.get("all_day"),
        color: r.get("color"),
        reminder: r.get("reminder"),
        done: r.get("done"),
    }
}

async fn list_tasks(_a: Auth, State(st): State<AppState>) -> ApiResult<Json<Vec<Task>>> {
    let rows = sqlx::query("SELECT * FROM tasks ORDER BY start_at").fetch_all(&st.db).await?;
    Ok(Json(rows.iter().map(task_from_row).collect()))
}

async fn put_task(_a: Auth, State(st): State<AppState>, Path(id): Path<String>, Json(t): Json<Task>) -> ApiResult<Json<Task>> {
    valid_id(&id)?;
    let title = t.title.trim();
    if title.is_empty() {
        return Err(ApiError::bad_request("La tarea necesita un título"));
    }
    let end = if t.end <= t.start { t.start + chrono::Duration::minutes(30) } else { t.end };
    let reminder = t.reminder.filter(|m| (0..=60 * 24 * 30).contains(m));
    let row = sqlx::query(
        "INSERT INTO tasks (id, title, description, start_at, end_at, all_day, color, reminder, done, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
         ON CONFLICT (id) DO UPDATE SET title=$2, description=$3, start_at=$4, end_at=$5, all_day=$6,
           color=$7, reminder=$8, done=$9, updated_at=now()
         RETURNING *",
    )
    .bind(&id)
    .bind(title)
    .bind(t.description.trim())
    .bind(t.start)
    .bind(end)
    .bind(t.all_day)
    .bind(&t.color)
    .bind(reminder)
    .bind(t.done)
    .fetch_one(&st.db)
    .await?;
    st.notify("tasks");
    Ok(Json(task_from_row(&row)))
}

async fn delete_task(_a: Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    sqlx::query("DELETE FROM tasks WHERE id = $1").bind(&id).execute(&st.db).await?;
    st.notify("tasks");
    Ok(Json(json!({ "ok": true })))
}

// ---------------------------------------------------------------- proyectos

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    #[serde(default)]
    id: String,
    name: String,
    #[serde(default = "brand")]
    color: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    report: String,
    #[serde(default)]
    github: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    items: Vec<Item>,
    #[serde(default)]
    created_at: i64,
    #[serde(default)]
    updated_at: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    #[serde(default)]
    id: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    created_at: i64,
}

async fn load_projects(db: &sqlx::PgPool, only: Option<&str>) -> anyhow::Result<Vec<Project>> {
    let rows = sqlx::query("SELECT * FROM projects WHERE ($1::text IS NULL OR id = $1) ORDER BY updated_at DESC")
        .bind(only)
        .fetch_all(db)
        .await?;
    let items = sqlx::query("SELECT * FROM project_items WHERE ($1::text IS NULL OR project_id = $1) ORDER BY position")
        .bind(only)
        .fetch_all(db)
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let id: String = r.get("id");
            Project {
                items: items
                    .iter()
                    .filter(|i| i.get::<String, _>("project_id") == id)
                    .map(|i| Item {
                        id: i.get("id"),
                        kind: i.get("kind"),
                        title: i.get("title"),
                        content: i.get("content"),
                        created_at: i.get::<DateTime<Utc>, _>("created_at").timestamp_millis(),
                    })
                    .collect(),
                id,
                name: r.get("name"),
                color: r.get("color"),
                description: r.get("description"),
                report: r.get("report"),
                github: r.get("github"),
                url: r.get("url"),
                created_at: r.get::<DateTime<Utc>, _>("created_at").timestamp_millis(),
                updated_at: r.get::<DateTime<Utc>, _>("updated_at").timestamp_millis(),
            }
        })
        .collect())
}

async fn list_projects(_a: Auth, State(st): State<AppState>) -> ApiResult<Json<Vec<Project>>> {
    Ok(Json(load_projects(&st.db, None).await?))
}

fn file_url(id: &str) -> String {
    format!("/api/files/{id}")
}

/// Convierte "data:image/png;base64,...." en (mime, bytes)
fn parse_data_url(s: &str) -> Option<(String, Vec<u8>)> {
    let rest = s.strip_prefix("data:")?;
    let (meta, data) = rest.split_once(',')?;
    let mime = meta.strip_suffix(";base64")?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(data.trim()).ok()?;
    Some((mime.to_string(), bytes))
}

async fn put_project(_a: Auth, State(st): State<AppState>, Path(id): Path<String>, Json(p): Json<Project>) -> ApiResult<Json<Project>> {
    valid_id(&id)?;
    let name = p.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("El proyecto necesita un nombre"));
    }
    let created = DateTime::from_timestamp_millis(p.created_at).filter(|_| p.created_at > 0).unwrap_or_else(Utc::now);

    let mut tx = st.db.begin().await?;
    sqlx::query(
        "INSERT INTO projects (id, name, color, description, report, github, url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
         ON CONFLICT (id) DO UPDATE SET name=$2, color=$3, description=$4, report=$5, github=$6, url=$7, updated_at=now()",
    )
    .bind(&id)
    .bind(name)
    .bind(&p.color)
    .bind(&p.description)
    .bind(&p.report)
    .bind(&p.github)
    .bind(&p.url)
    .bind(created)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM project_items WHERE project_id = $1").bind(&id).execute(&mut *tx).await?;
    for (pos, mut it) in p.items.into_iter().enumerate() {
        if !matches!(it.kind.as_str(), "image" | "note" | "link") {
            continue;
        }
        // Imágenes antiguas guardadas en el navegador (data URL): se pasan a archivo
        if it.kind == "image" {
            if let Some((mime, bytes)) = parse_data_url(&it.content) {
                if bytes.len() > MAX_FILE {
                    return Err(ApiError::bad_request("Imagen demasiado grande"));
                }
                let fid = new_id();
                sqlx::query("INSERT INTO files (id, project_id, mime, data) VALUES ($1,$2,$3,$4)")
                    .bind(&fid)
                    .bind(&id)
                    .bind(&mime)
                    .bind(&bytes)
                    .execute(&mut *tx)
                    .await?;
                it.content = file_url(&fid);
            }
        }
        if it.id.is_empty() || valid_id(&it.id).is_err() {
            it.id = new_id();
        }
        let created = DateTime::from_timestamp_millis(it.created_at).filter(|_| it.created_at > 0).unwrap_or_else(Utc::now);
        sqlx::query(
            "INSERT INTO project_items (id, project_id, position, kind, title, content, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&it.id)
        .bind(&id)
        .bind(pos as i32)
        .bind(&it.kind)
        .bind(&it.title)
        .bind(&it.content)
        .bind(created)
        .execute(&mut *tx)
        .await?;
    }

    // Archivos recién subidos pasan a pertenecer al proyecto; los que ya no se usan se borran
    sqlx::query(
        "UPDATE files SET project_id = $1 WHERE project_id IS NULL
           AND '/api/files/' || id IN (SELECT content FROM project_items WHERE project_id = $1)",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "DELETE FROM files WHERE project_id = $1
           AND '/api/files/' || id NOT IN (SELECT content FROM project_items WHERE project_id = $1)",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    st.notify("projects");
    let saved = load_projects(&st.db, Some(&id)).await?.pop().ok_or_else(ApiError::not_found)?;
    Ok(Json(saved))
}

async fn delete_project(_a: Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    sqlx::query("DELETE FROM projects WHERE id = $1").bind(&id).execute(&st.db).await?;
    st.notify("projects");
    Ok(Json(json!({ "ok": true })))
}

// ---------------------------------------------------------------- archivos

async fn upload_file(_a: Auth, State(st): State<AppState>, headers: HeaderMap, body: Bytes) -> ApiResult<Json<Value>> {
    let mime = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    if !mime.starts_with("image/") {
        return Err(ApiError::bad_request("Solo se admiten imágenes"));
    }
    if body.is_empty() || body.len() > MAX_FILE {
        return Err(ApiError::bad_request("Archivo vacío o demasiado grande (máx. 15 MB)"));
    }
    let id = new_id();
    sqlx::query("INSERT INTO files (id, mime, data) VALUES ($1,$2,$3)")
        .bind(&id)
        .bind(&mime)
        .bind(body.as_ref())
        .execute(&st.db)
        .await?;
    Ok(Json(json!({ "id": id, "url": file_url(&id) })))
}

async fn get_file(_a: Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<impl IntoResponse> {
    let row = sqlx::query("SELECT mime, data FROM files WHERE id = $1")
        .bind(&id)
        .fetch_optional(&st.db)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let mime: String = row.get("mime");
    // Nunca servir SVG/HTML como documento activo
    let mime = if mime.starts_with("image/") && mime != "image/svg+xml" { mime } else { "application/octet-stream".into() };
    let data: Vec<u8> = row.get("data");
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, mime),
            (header::CACHE_CONTROL, "private, max-age=31536000, immutable".into()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".into()),
        ],
        data,
    ))
}

// ---------------------------------------------------------------- WhatsApp

async fn get_whatsapp(_a: Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    Ok(Json(whatsapp::status(&st).await?))
}

#[derive(Deserialize)]
struct WhatsappBody {
    phone: String,
    apikey: String,
}

async fn put_whatsapp(_a: Auth, State(st): State<AppState>, Json(b): Json<WhatsappBody>) -> ApiResult<Json<Value>> {
    let phone = whatsapp::normalize_phone(&b.phone);
    let apikey = b.apikey.trim();
    if phone.len() < 8 || apikey.is_empty() {
        return Err(ApiError::bad_request("Revisa el número y la apikey"));
    }
    sqlx::query("INSERT INTO settings (key, value) VALUES ('whatsapp', $1) ON CONFLICT (key) DO UPDATE SET value = $1")
        .bind(json!({ "phone": phone, "apikey": apikey }))
        .execute(&st.db)
        .await?;
    Ok(Json(whatsapp::status(&st).await?))
}

async fn test_whatsapp(_a: Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    whatsapp::send(&st, "✅ AN: las notificaciones de WhatsApp funcionan correctamente.")
        .await
        .map_err(|e| ApiError::Status(StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(Json(json!({ "ok": true })))
}

//! API REST: tareas, proyectos (con sus diseños/notas/enlaces), archivos y ajustes.

use std::convert::Infallible;

use axum::{
    body::Bytes,
    extract::{Path, Query, State},
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
    push, users, whatsapp, AppState, Live,
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
        .route("/api/settings/appearance", get(get_appearance).put(put_appearance))
        .route("/api/push", get(push_status).post(push_subscribe).delete(push_unsubscribe))
        .route("/api/push/test", post(push_test))
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

#[derive(Deserialize)]
struct EventsQuery {
    #[serde(default)]
    client: String,
}

/// Resta una app de escritorio conectada cuando se cierra su conexión
struct DesktopGuard(AppState, String);
impl Drop for DesktopGuard {
    fn drop(&mut self) {
        let mut d = self.0.desktops.lock().unwrap();
        if let Some(n) = d.get_mut(&self.1) {
            *n = n.saturating_sub(1);
            if *n == 0 {
                d.remove(&self.1);
            }
        }
    }
}

/// Los clientes escuchan aquí: recargan cuando otro dispositivo cambia algo y
/// las apps de escritorio reciben los avisos de las tareas.
async fn events(
    Auth(u): Auth,
    State(st): State<AppState>,
    Query(q): Query<EventsQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let desktop = q.client == "desktop";
    let guard = desktop.then(|| {
        *st.desktops.lock().unwrap().entry(u.id.clone()).or_default() += 1;
        DesktopGuard(st.clone(), u.id.clone())
    });
    let me = u.id;
    // Cada dispositivo solo recibe los eventos de su propio usuario
    let stream = BroadcastStream::new(st.events.subscribe()).filter_map(move |m| {
        let _keep = &guard;
        match m.ok()? {
            Live::Change(user, what) if user == me => Some(Ok(Event::default().event("change").data(what))),
            Live::Reminder(user, v) if desktop && user == me => Some(Ok(Event::default().event("reminder").data(v.to_string()))),
            _ => None,
        }
    });
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

async fn list_tasks(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Vec<Task>>> {
    let rows = sqlx::query("SELECT * FROM tasks WHERE user_id = $1 ORDER BY start_at").bind(&u.id).fetch_all(&st.db).await?;
    Ok(Json(rows.iter().map(task_from_row).collect()))
}

async fn put_task(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>, Json(t): Json<Task>) -> ApiResult<Json<Task>> {
    valid_id(&id)?;
    let title = t.title.trim();
    if title.is_empty() {
        return Err(ApiError::bad_request("La tarea necesita un título"));
    }
    let end = if t.end <= t.start { t.start + chrono::Duration::minutes(30) } else { t.end };
    let reminder = t.reminder.filter(|m| (0..=60 * 24 * 30).contains(m));
    let row = sqlx::query(
        "INSERT INTO tasks (id, title, description, start_at, end_at, all_day, color, reminder, done, updated_at, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), $10)
         ON CONFLICT (id) DO UPDATE SET title=$2, description=$3, start_at=$4, end_at=$5, all_day=$6,
           color=$7, reminder=$8, done=$9, updated_at=now()
         WHERE tasks.user_id = $10
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
    .bind(&u.id)
    .fetch_optional(&st.db)
    .await?
    // Ese id ya es de otra persona: no se toca
    .ok_or_else(ApiError::not_found)?;
    st.notify(&u.id, "tasks");
    Ok(Json(task_from_row(&row)))
}

async fn delete_task(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    sqlx::query("DELETE FROM tasks WHERE id = $1 AND user_id = $2").bind(&id).bind(&u.id).execute(&st.db).await?;
    st.notify(&u.id, "tasks");
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

async fn load_projects(db: &sqlx::PgPool, user: &str, only: Option<&str>) -> anyhow::Result<Vec<Project>> {
    let rows = sqlx::query("SELECT * FROM projects WHERE user_id = $1 AND ($2::text IS NULL OR id = $2) ORDER BY updated_at DESC")
        .bind(user)
        .bind(only)
        .fetch_all(db)
        .await?;
    let items = sqlx::query(
        "SELECT i.* FROM project_items i JOIN projects p ON p.id = i.project_id
         WHERE p.user_id = $1 AND ($2::text IS NULL OR i.project_id = $2) ORDER BY i.position",
    )
    .bind(user)
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

async fn list_projects(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Vec<Project>>> {
    Ok(Json(load_projects(&st.db, &u.id, None).await?))
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

async fn put_project(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>, Json(p): Json<Project>) -> ApiResult<Json<Project>> {
    valid_id(&id)?;
    let name = p.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("El proyecto necesita un nombre"));
    }
    let created = DateTime::from_timestamp_millis(p.created_at).filter(|_| p.created_at > 0).unwrap_or_else(Utc::now);

    let mut tx = st.db.begin().await?;
    let owned = sqlx::query(
        "INSERT INTO projects (id, name, color, description, report, github, url, created_at, updated_at, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), $9)
         ON CONFLICT (id) DO UPDATE SET name=$2, color=$3, description=$4, report=$5, github=$6, url=$7, updated_at=now()
         WHERE projects.user_id = $9",
    )
    .bind(&id)
    .bind(name)
    .bind(&p.color)
    .bind(&p.description)
    .bind(&p.report)
    .bind(&p.github)
    .bind(&p.url)
    .bind(created)
    .bind(&u.id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    // Ese id ya es de otra persona: no se toca
    if owned == 0 {
        return Err(ApiError::not_found());
    }

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
                sqlx::query("INSERT INTO files (id, project_id, mime, data, user_id) VALUES ($1,$2,$3,$4,$5)")
                    .bind(&fid)
                    .bind(&id)
                    .bind(&mime)
                    .bind(&bytes)
                    .bind(&u.id)
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
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (project_id, id) DO NOTHING",
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
        "UPDATE files SET project_id = $1 WHERE project_id IS NULL AND user_id = $2
           AND '/api/files/' || id IN (SELECT content FROM project_items WHERE project_id = $1)",
    )
    .bind(&id)
    .bind(&u.id)
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

    st.notify(&u.id, "projects");
    let saved = load_projects(&st.db, &u.id, Some(&id)).await?.pop().ok_or_else(ApiError::not_found)?;
    Ok(Json(saved))
}

async fn delete_project(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    sqlx::query("DELETE FROM projects WHERE id = $1 AND user_id = $2").bind(&id).bind(&u.id).execute(&st.db).await?;
    st.notify(&u.id, "projects");
    Ok(Json(json!({ "ok": true })))
}

// ---------------------------------------------------------------- archivos

async fn upload_file(Auth(u): Auth, State(st): State<AppState>, headers: HeaderMap, body: Bytes) -> ApiResult<Json<Value>> {
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
    sqlx::query("INSERT INTO files (id, mime, data, user_id) VALUES ($1,$2,$3,$4)")
        .bind(&id)
        .bind(&mime)
        .bind(body.as_ref())
        .bind(&u.id)
        .execute(&st.db)
        .await?;
    Ok(Json(json!({ "id": id, "url": file_url(&id) })))
}

async fn get_file(Auth(u): Auth, State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<impl IntoResponse> {
    let row = sqlx::query("SELECT mime, data FROM files WHERE id = $1 AND user_id = $2")
        .bind(&id)
        .bind(&u.id)
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

async fn get_whatsapp(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    Ok(Json(whatsapp::status(&st, &u.id).await?))
}

#[derive(Deserialize)]
struct WhatsappBody {
    phone: String,
    apikey: String,
}

async fn put_whatsapp(Auth(u): Auth, State(st): State<AppState>, Json(b): Json<WhatsappBody>) -> ApiResult<Json<Value>> {
    let phone = whatsapp::normalize_phone(&b.phone);
    let apikey = b.apikey.trim();
    if phone.len() < 8 || apikey.is_empty() {
        return Err(ApiError::bad_request("Revisa el número y la apikey"));
    }
    users::set_setting(&st.db, &u.id, "whatsapp", &json!({ "phone": phone, "apikey": apikey })).await?;
    Ok(Json(whatsapp::status(&st, &u.id).await?))
}

async fn test_whatsapp(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    whatsapp::send(&st, &u.id, "✅ CalendAN: las notificaciones de WhatsApp funcionan correctamente.")
        .await
        .map_err(|e| ApiError::Status(StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(Json(json!({ "ok": true })))
}

// ---------------------------------------------------------------- notificaciones push

async fn push_status(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    Ok(Json(json!({
        "publicKey": st.vapid.public,
        "devices": push::subscription_count(&st.db, &u.id).await?,
        "desktops": st.desktop_count(&u.id),
    })))
}

#[derive(Deserialize)]
struct SubKeys {
    p256dh: String,
    auth: String,
}

#[derive(Deserialize)]
struct Subscription {
    endpoint: String,
    keys: Option<SubKeys>,
    #[serde(default)]
    device: String,
}

async fn push_subscribe(Auth(u): Auth, State(st): State<AppState>, Json(s): Json<Subscription>) -> ApiResult<Json<Value>> {
    let keys = s.keys.ok_or_else(|| ApiError::bad_request("Suscripción incompleta"))?;
    let url = reqwest::Url::parse(&s.endpoint).map_err(|_| ApiError::bad_request("endpoint no válido"))?;
    // Solo servicios push reales (https), nunca direcciones internas
    let allow_http = std::env::var("PUSH_ALLOW_HTTP").is_ok_and(|v| v == "true");
    if url.scheme() != "https" && !allow_http {
        return Err(ApiError::bad_request("endpoint no válido"));
    }
    if push::encrypt(&keys.p256dh, &keys.auth, b"").is_err() {
        return Err(ApiError::bad_request("Claves de suscripción no válidas"));
    }
    sqlx::query(
        "INSERT INTO push_subscriptions (endpoint, p256dh, auth, device, user_id) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh=$2, auth=$3, device=$4, user_id=$5",
    )
    .bind(&s.endpoint)
    .bind(&keys.p256dh)
    .bind(&keys.auth)
    .bind(s.device.chars().take(100).collect::<String>())
    .bind(&u.id)
    .execute(&st.db)
    .await?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct Unsubscribe {
    endpoint: String,
}

async fn push_unsubscribe(Auth(u): Auth, State(st): State<AppState>, Json(b): Json<Unsubscribe>) -> ApiResult<Json<Value>> {
    sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2").bind(&b.endpoint).bind(&u.id).execute(&st.db).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn push_test(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    let payload = json!({ "title": "Notificación", "body": "✅ Así te llegarán los avisos de tus tareas.", "tag": "test", "url": "/" });
    let desktops = st.desktop_count(&u.id);
    if desktops > 0 {
        let _ = st.events.send(Live::Reminder(u.id.clone(), payload.clone()));
    }
    match push::send_all(&st, &u.id, payload).await? {
        (0, _) if desktops > 0 => Ok(Json(json!({ "ok": true, "sent": desktops }))),
        (0, Some(e)) => Err(ApiError::Status(StatusCode::BAD_GATEWAY, format!("No se pudo enviar: {e}"))),
        (0, None) => Err(ApiError::bad_request("No hay ningún dispositivo con notificaciones activadas")),
        (n, _) => Ok(Json(json!({ "ok": true, "sent": n + desktops }))),
    }
}

// ---------------------------------------------------------------- apariencia

/// Color principal de la app, compartido entre todos tus dispositivos
async fn get_appearance(Auth(u): Auth, State(st): State<AppState>) -> ApiResult<Json<Value>> {
    Ok(Json(users::get_setting(&st.db, &u.id, "appearance").await?.unwrap_or_else(|| json!({ "accent": null }))))
}

#[derive(Deserialize)]
struct Appearance {
    accent: String,
}

async fn put_appearance(Auth(u): Auth, State(st): State<AppState>, Json(b): Json<Appearance>) -> ApiResult<Json<Value>> {
    let ok = b.accent.len() == 7 && b.accent.starts_with('#') && b.accent[1..].chars().all(|c| c.is_ascii_hexdigit());
    if !ok {
        return Err(ApiError::bad_request("Color no válido (formato #rrggbb)"));
    }
    let value = json!({ "accent": b.accent.to_lowercase() });
    users::set_setting(&st.db, &u.id, "appearance", &value).await?;
    st.notify(&u.id, "settings");
    Ok(Json(value))
}

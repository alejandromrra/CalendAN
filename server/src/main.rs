//! Servidor AN: guarda calendario y proyectos en Postgres, sincroniza los
//! dispositivos y envía los recordatorios por WhatsApp.

mod api;
mod auth;
mod error;
mod push;
mod reminders;
mod todos;
mod users;
mod whatsapp;

use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{extract::DefaultBodyLimit, routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use tokio::sync::broadcast;
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

#[derive(Clone)]
pub struct AppState(Arc<Inner>);

pub struct Inner {
    pub db: sqlx::PgPool,
    pub secure_cookies: bool,
    pub tz: chrono_tz::Tz,
    pub http: reqwest::Client,
    pub vapid: push::Vapid,
    /// Avisa a los dispositivos conectados de que algo ha cambiado
    pub events: broadcast::Sender<Live>,
    /// Apps de escritorio conectadas ahora mismo, por usuario (reciben los avisos en directo)
    pub desktops: std::sync::Mutex<std::collections::HashMap<String, usize>>,
    /// Intentos fallidos de login recientes (freno contra fuerza bruta)
    pub login_failures: std::sync::Mutex<std::collections::VecDeque<std::time::Instant>>,
}

impl std::ops::Deref for AppState {
    type Target = Inner;
    fn deref(&self) -> &Inner {
        &self.0
    }
}

impl AppState {
    /// Avisa a los dispositivos de ese usuario de que algo ha cambiado
    pub fn notify(&self, user: &str, what: &'static str) {
        let _ = self.events.send(Live::Change(user.to_string(), what));
    }

    pub fn desktop_count(&self, user: &str) -> usize {
        self.desktops.lock().unwrap().get(user).copied().unwrap_or(0)
    }
}

/// Mensajes que se envían en directo a los dispositivos conectados
#[derive(Clone)]
pub enum Live {
    /// Algo ha cambiado (usuario, qué): el cliente recarga tareas o proyectos
    Change(String, &'static str),
    /// Aviso de una tarea para un usuario (lo muestran las apps de escritorio)
    Reminder(String, serde_json::Value),
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(env_or("RUST_LOG", "an_server=info,tower_http=warn"))
        .init();

    let database_url = env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("Falta DATABASE_URL"))?;
    let db = PgPoolOptions::new().max_connections(10).connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&db).await?;
    // Primera vez: crea la cuenta de administrador y le asigna los datos existentes
    users::bootstrap(&db).await?;

    let tz: chrono_tz::Tz = env_or("TIMEZONE", "Europe/Madrid").parse().map_err(|_| anyhow::anyhow!("TIMEZONE no válida"))?;

    let vapid = push::Vapid::load(&db).await?;

    let state = AppState(Arc::new(Inner {
        db,
        secure_cookies: env_or("SECURE_COOKIES", "true") != "false",
        tz,
        http: reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build()?,
        vapid,
        events: broadcast::channel(64).0,
        desktops: Default::default(),
        login_failures: Default::default(),
    }));

    tokio::spawn(reminders::run(state.clone()));

    let static_dir = PathBuf::from(env_or("STATIC_DIR", "dist"));
    let spa = ServeDir::new(&static_dir).fallback(ServeFile::new(static_dir.join("index.html")));

    let app = Router::new()
        .route("/api/health", get(|| async { axum::Json(serde_json::json!({ "ok": true })) }))
        .merge(auth::routes())
        .merge(users::routes())
        .merge(todos::routes())
        .merge(api::routes())
        .layer(DefaultBodyLimit::max(25 * 1024 * 1024))
        .layer(cors())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
        .fallback_service(spa);

    let port: u16 = env_or("PORT", "3001").parse()?;
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("AN server escuchando en http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).with_graceful_shutdown(shutdown()).await?;
    Ok(())
}

/// Las apps de escritorio (Tauri) cargan la interfaz desde su propio origen
/// y llaman a la API con token: solo se permiten esos orígenes.
fn cors() -> tower_http::cors::CorsLayer {
    use axum::http::{header, HeaderValue, Method};
    let origins = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]
        .map(|o| HeaderValue::from_static(o));
    tower_http::cors::CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
        .max_age(std::time::Duration::from_secs(3600))
}

async fn shutdown() {
    let ctrl_c = async { tokio::signal::ctrl_c().await.ok(); };
    #[cfg(unix)]
    let term = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).unwrap().recv().await;
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = term => {} }
}

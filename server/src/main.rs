//! Servidor AN: guarda calendario y proyectos en Postgres, sincroniza los
//! dispositivos y envía los recordatorios por WhatsApp.

mod api;
mod auth;
mod error;
mod push;
mod reminders;
mod whatsapp;

use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{extract::DefaultBodyLimit, routing::get, Router};
use sha2::{Digest, Sha256};
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
    pub password_hash: [u8; 32],
    pub secure_cookies: bool,
    pub tz: chrono_tz::Tz,
    pub http: reqwest::Client,
    pub vapid: push::Vapid,
    /// Avisa a los dispositivos conectados de que algo ha cambiado
    pub events: broadcast::Sender<&'static str>,
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
    pub fn notify(&self, what: &'static str) {
        let _ = self.events.send(what);
    }
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
    let password = env::var("AN_PASSWORD").unwrap_or_default();
    if password.len() < 8 {
        anyhow::bail!("AN_PASSWORD debe tener al menos 8 caracteres");
    }

    let db = PgPoolOptions::new().max_connections(10).connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&db).await?;

    let tz: chrono_tz::Tz = env_or("TIMEZONE", "Europe/Madrid").parse().map_err(|_| anyhow::anyhow!("TIMEZONE no válida"))?;

    let vapid = push::Vapid::load(&db).await?;

    let state = AppState(Arc::new(Inner {
        db,
        password_hash: Sha256::digest(password.as_bytes()).into(),
        secure_cookies: env_or("SECURE_COOKIES", "true") != "false",
        tz,
        http: reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build()?,
        vapid,
        events: broadcast::channel(64).0,
        login_failures: Default::default(),
    }));

    tokio::spawn(reminders::run(state.clone()));

    let static_dir = PathBuf::from(env_or("STATIC_DIR", "dist"));
    let spa = ServeDir::new(&static_dir).fallback(ServeFile::new(static_dir.join("index.html")));

    let app = Router::new()
        .route("/api/health", get(|| async { axum::Json(serde_json::json!({ "ok": true })) }))
        .merge(auth::routes())
        .merge(api::routes())
        .layer(DefaultBodyLimit::max(25 * 1024 * 1024))
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

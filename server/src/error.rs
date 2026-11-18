use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

pub enum ApiError {
    Status(StatusCode, String),
    Internal(anyhow::Error),
}

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::Status(StatusCode::BAD_REQUEST, msg.into())
    }
    pub fn not_found() -> Self {
        Self::Status(StatusCode::NOT_FOUND, "No encontrado".into())
    }
    pub fn unauthorized() -> Self {
        Self::Status(StatusCode::UNAUTHORIZED, "Inicia sesión".into())
    }
}

impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        Self::Internal(e.into())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            Self::Status(s, m) => (s, m),
            Self::Internal(e) => {
                tracing::error!("{e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Error interno del servidor".into())
            }
        };
        (status, Json(serde_json::json!({ "error": msg }))).into_response()
    }
}

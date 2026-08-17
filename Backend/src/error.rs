use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("Error interno del servidor")]
    Internal,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    fn status(&self) -> StatusCode {
        match self {
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("Recurso no encontrado".into()),
            sqlx::Error::Database(db) => match db.code().as_deref() {
                Some("23505") => AppError::Conflict("El registro ya existe".into()),
                Some("23503") => AppError::BadRequest("Referencia inexistente".into()),
                Some("23514") => AppError::BadRequest("Valor no permitido para el campo".into()),
                _ => {
                    tracing::error!("db error: {db}");
                    AppError::Internal
                }
            },
            other => {
                tracing::error!("sqlx error: {other}");
                AppError::Internal
            }
        }
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(_: jsonwebtoken::errors::Error) -> Self {
        AppError::Unauthorized("Token invalido o expirado".into())
    }
}

impl From<argon2::password_hash::Error> for AppError {
    fn from(_: argon2::password_hash::Error) -> Self {
        AppError::Unauthorized("Credenciales invalidas".into())
    }
}

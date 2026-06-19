use actix_web::{error::ResponseError, http::StatusCode, HttpResponse};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("PostgreSQL error: {0}")]
    Postgres(#[from] deadpool_postgres::tokio_postgres::Error),
    
    #[error("Pool error: {0}")]
    Pool(#[from] deadpool::managed::errors::PoolError<deadpool_postgres::tokio_postgres::Error>),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Authorization error: {0}")]
    Authorization(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Encryption error: {0}")]
    Encryption(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Conflict: {0}")]
    Conflict(String),
    
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[error("Internal server error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Postgres(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Pool(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Auth(_) => StatusCode::UNAUTHORIZED,
            AppError::Authorization(_) => StatusCode::FORBIDDEN,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Encryption(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::RateLimitExceeded => StatusCode::TOO_MANY_REQUESTS,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let status_code = self.status_code();
        let error_type = match self {
            AppError::Database(_) => "database_error",
            AppError::Postgres(_) => "database_error",
            AppError::Pool(_) => "database_error",
            AppError::Auth(_) => "authentication_error",
            AppError::Authorization(_) => "authorization_error",
            AppError::Validation(_) => "validation_error",
            AppError::Encryption(_) => "encryption_error",
            AppError::NotFound(_) => "not_found",
            AppError::Conflict(_) => "conflict",
            AppError::RateLimitExceeded => "rate_limit_exceeded",
            AppError::Internal(_) => "internal_error",
        };

        let response = ErrorResponse {
            error: error_type.to_string(),
            message: self.to_string(),
            details: None,
        };

        HttpResponse::build(status_code).json(response)
    }
}

// Helper functions for creating specific errors
pub fn auth_error(message: &str) -> AppError {
    AppError::Auth(message.to_string())
}

pub fn authorization_error(message: &str) -> AppError {
    AppError::Authorization(message.to_string())
}

pub fn validation_error(message: &str) -> AppError {
    AppError::Validation(message.to_string())
}

pub fn not_found_error(resource: &str) -> AppError {
    AppError::NotFound(format!("{} not found", resource))
}

pub fn conflict_error(message: &str) -> AppError {
    AppError::Conflict(message.to_string())
}

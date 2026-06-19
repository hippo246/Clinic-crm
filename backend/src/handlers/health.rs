use actix_web::{web, HttpResponse, Responder};
use serde::Serialize;
use chrono::Utc;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    timestamp: String,
    version: String,
    environment: String,
}

pub async fn health() -> impl Responder {
    let response = HealthResponse {
        status: "healthy".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        environment: std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),
    };

    HttpResponse::Ok().json(response)
}

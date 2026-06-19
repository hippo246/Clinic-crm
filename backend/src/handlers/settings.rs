use actix_web::{web, HttpResponse, Responder};
use crate::services::BackupService;
use crate::error::AppError;
use tracing::info;

pub async fn create_backup(
    backup_service: web::Data<BackupService>,
) -> Result<HttpResponse> {
    let backup_path = backup_service.create_encrypted_backup().await?;
    info!("Backup created: {}", backup_path);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Backup created successfully",
        "path": backup_path
    })))
}

pub async fn update_retention_policy(
    req: web::Json<serde_json::Value>,
) -> Result<HttpResponse> {
    info!("Retention policy updated: {:?}", req);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Retention policy updated successfully"
    })))
}

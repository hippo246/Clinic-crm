use actix_web::{web, HttpResponse, Responder};
use crate::models::{AuditLog, AuditLogQuery};
use crate::services::AuditService;
use crate::error::AppError;
use tracing::info;

pub async fn list_audit_logs(
    query: web::Query<AuditLogQuery>,
    audit_service: web::Data<AuditService>,
) -> Result<HttpResponse> {
    let limit = query.limit.unwrap_or(100);
    let offset = query.offset.unwrap_or(0);

    let logs = audit_service.list_audit_logs(
        query.patient_id.clone(),
        query.user_id,
        query.action.clone(),
        query.start_date,
        query.end_date,
        limit,
        offset,
    ).await?;

    Ok(HttpResponse::Ok().json(logs))
}

pub async fn get_patient_audit(
    path: web::Path<String>,
    audit_service: web::Data<AuditService>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    let logs = audit_service.get_patient_audit_logs(&patient_id).await?;

    Ok(HttpResponse::Ok().json(logs))
}

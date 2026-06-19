use actix_web::{web, HttpResponse, Responder};
use crate::monitoring::{MonitoringService, SecurityEvent, SystemMetrics};
use crate::error::AppError;

pub async fn get_metrics(
    monitoring_service: web::Data<MonitoringService>,
) -> Result<HttpResponse> {
    let metrics = monitoring_service.get_current_metrics();
    Ok(HttpResponse::Ok().json(metrics))
}

pub async fn get_security_events(
    query: web::Query<std::collections::HashMap<String, String>>,
    monitoring_service: web::Data<MonitoringService>,
) -> Result<HttpResponse> {
    let limit = query.get("limit")
        .and_then(|l| l.parse::<usize>().ok())
        .unwrap_or(100);

    let events = monitoring_service.get_security_events(limit);
    Ok(HttpResponse::Ok().json(events))
}

pub async fn health_check(
    monitoring_service: web::Data<MonitoringService>,
) -> Result<HttpResponse> {
    let metrics = monitoring_service.get_current_metrics();

    let health_status = if metrics.cpu_usage < 90.0
        && metrics.memory_usage < 90.0
        && metrics.disk_usage < 90.0 {
        "healthy"
    } else {
        "degraded"
    };

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": health_status,
        "metrics": metrics,
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

pub async fn log_security_event(
    event: web::Json<SecurityEvent>,
    monitoring_service: web::Data<MonitoringService>,
) -> Result<HttpResponse> {
    monitoring_service.log_security_event(event.into_inner());
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Security event logged"
    })))
}

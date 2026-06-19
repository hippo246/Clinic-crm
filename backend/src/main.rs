use actix_web::{web, App, HttpServer, middleware};
use actix_cors::Cors;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::rt::net::TcpListener;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use actix_multipart::Multipart;

mod config;
mod database;
mod models;
mod auth;
mod middleware_custom;
mod handlers;
mod services;
mod encryption;
mod audit;
mod monitoring;
mod error;

use config::Config;
use database::Database;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing with security-focused logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "clinic_crm_backend=debug,actix_web=info".into())
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Clinic CRM Backend - HIPAA Compliant");

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");
    
    // Initialize database connection pool
    let db = Database::new(&config.database_url).await
        .expect("Failed to connect to database");

    // Initialize monitoring service
    let monitoring_service = monitoring::MonitoringService::new(db.clone());
    
    // Start background monitoring
    monitoring_service.start_monitoring().await;

    // Configure rate limiting (100 requests per minute per IP)
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(100)
        .burst_size(10)
        .finish()
        .unwrap();

    // Configure CORS with strict security
    let cors = Cors::permissive()
        .allowed_origin_fn(|origin, _req| {
            if let Ok(bytes) = origin.to_str() {
                bytes.starts_with("http://localhost") || 
                bytes.starts_with("https://")
            } else {
                false
            }
        })
        .allow_any_method()
        .allow_any_header()
        .max_age(3600);

    // Start HTTP server with TLS 1.3
    let bind_address = format!("{}:{}", config.host, config.port);
    info!("Server starting on {}", bind_address);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(db.clone()))
            .app_data(web::Data::new(config.clone()))
            .wrap(cors)
            .wrap(middleware::Logger::new("%a %{User-Agent}i %r %s %b %D"))
            .wrap(middleware::Compress::default())
            .wrap(middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
                .add(("Permissions-Policy", "geolocation=(), microphone=(), camera=()"))
            )
            // Health check endpoint (no auth required)
            .route("/health", web::get().to(handlers::health))
            
            // Authentication endpoints
            .route("/api/auth/login", web::post().to(handlers::auth::login))
            .route("/api/auth/logout", web::post().to(handlers::auth::logout))
            .route("/api/auth/refresh", web::post().to(handlers::auth::refresh))
            .route("/api/auth/verify-mfa", web::post().to(handlers::auth::verify_mfa))
            
            // Patient management endpoints (require authentication)
            .service(
                web::scope("/api/patients")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::get().to(handlers::patients::list_patients))
                    .route("", web::post().to(handlers::patients::create_patient))
                    .route("/{id}", web::get().to(handlers::patients::get_patient))
                    .route("/{id}", web::put().to(handlers::patients::update_patient))
                    .route("/{id}", web::delete().to(handlers::patients::delete_patient))
                    .route("/search", web::get().to(handlers::patients::search_patients))
                    .route("/import", web::post().to(handlers::patients::import_patients))
            )
            
            // Audit log endpoints (admin only)
            .service(
                web::scope("/api/audit")
                    .wrap(middleware_custom::auth::Authentication)
                    .wrap(middleware_custom::rbac::RequireRole::new(vec!["admin"]))
                    .route("", web::get().to(handlers::audit::list_audit_logs))
                    .route("/patient/{patient_id}", web::get().to(handlers::audit::get_patient_audit))
            )
            
            // Settings endpoints (admin only)
            .service(
                web::scope("/api/settings")
                    .wrap(middleware_custom::auth::Authentication)
                    .wrap(middleware_custom::rbac::RequireRole::new(vec!["admin"]))
                    .route("/backup", web::post().to(handlers::settings::create_backup))
                    .route("/retention", web::post().to(handlers::settings::update_retention_policy))
            )
            
            // File upload endpoints (require authentication)
            .service(
                web::scope("/api/files")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("/upload", web::post().to(handlers::files::upload_file))
                    .route("/download/{file_id}", web::get().to(handlers::files::download_file))
                    .route("/delete/{file_id}", web::delete().to(handlers::files::delete_file))
                    .route("", web::get().to(handlers::files::list_files))
            )
            
            // Monitoring endpoints (admin only)
            .service(
                web::scope("/api/monitoring")
                    .wrap(middleware_custom::auth::Authentication)
                    .wrap(middleware_custom::rbac::RequireRole::new(vec!["admin"]))
                    .route("/metrics", web::get().to(handlers::monitoring::get_metrics))
                    .route("/events", web::get().to(handlers::monitoring::get_security_events))
                    .route("/health", web::get().to(handlers::monitoring::health_check))
            )
            
            // Medical workflow endpoints (require authentication)
            .service(
                web::scope("/api/appointments")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::post().to(handlers::medical::create_appointment))
                    .route("", web::get().to(handlers::medical::get_appointments))
                    .route("/{id}", web::put().to(handlers::medical::update_appointment))
                    .route("/{id}/cancel", web::post().to(handlers::medical::cancel_appointment))
            )
            
            .service(
                web::scope("/api/consultations")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::post().to(handlers::medical::create_consultation))
                    .route("", web::get().to(handlers::medical::get_consultations))
                    .route("/{id}", web::put().to(handlers::medical::update_consultation))
                    .route("/{id}/complete", web::post().to(handlers::medical::complete_consultation))
            )
            
            .service(
                web::scope("/api/prescriptions")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::post().to(handlers::medical::create_prescriptions))
                    .route("", web::get().to(handlers::medical::get_prescriptions))
                    .route("/{id}", web::put().to(handlers::medical::update_prescription))
                    .route("/{id}/dispense", web::post().to(handlers::medical::dispense_prescription))
            )
            
            .service(
                web::scope("/api/invoices")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::post().to(handlers::medical::create_invoice))
                    .route("", web::get().to(handlers::medical::get_invoices))
                    .route("/{id}", web::put().to(handlers::medical::update_invoice))
                    .route("/{id}/paid", web::post().to(handlers::medical::mark_invoice_paid))
            )
            
            .service(
                web::scope("/api/communication")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("/send", web::post().to(handlers::medical::send_communication))
                    .route("", web::get().to(handlers::medical::get_communication_history))
            )
            
            .service(
                web::scope("/api/follow-ups")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::post().to(handlers::medical::schedule_follow_up))
                    .route("", web::get().to(handlers::medical::get_follow_ups))
                    .route("/{id}", web::put().to(handlers::medical::update_follow_up))
                    .route("/{id}/complete", web::post().to(handlers::medical::complete_follow_up))
            )
            
            .service(
                web::scope("/api/consents")
                    .wrap(middleware_custom::auth::Authentication)
                    .route("", web::post().to(handlers::medical::create_consent))
                    .route("", web::get().to(handlers::medical::get_consents))
                    .route("/{id}/sign", web::post().to(handlers::medical::sign_consent))
            )
    })
    .bind(&bind_address)
    .unwrap()
    .run()
    .await
}

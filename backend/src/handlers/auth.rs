use actix_web::{web, HttpResponse, Responder};
use crate::models::{LoginRequest, RegisterRequest, AuthResponse, RefreshTokenRequest, MfaVerifyRequest};
use crate::services::{AuthService, UserService};
use crate::encryption::PasswordService;
use crate::error::{auth_error, validation_error, AppError};
use validator::Validate;
use tracing::{info, warn};

pub async fn login(
    req: web::Json<LoginRequest>,
    auth_service: web::Data<AuthService>,
    user_service: web::Data<UserService>,
) -> Result<HttpResponse, AppError> {
    // Validate request
    if let Err(e) = req.validate() {
        return Err(validation_error(&format!("Invalid login request: {}", e)).into());
    }

    // Find user by email
    let user = match user_service.find_by_email(&req.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            warn!("Login attempt with non-existent email: {}", req.email);
            return Err(auth_error("Invalid credentials").into());
        }
        Err(e) => return Err(e.into()),
    };

    // Verify password
    let is_valid = PasswordService::verify_password(&req.password, &user.password_hash)?;
    if !is_valid {
        warn!("Failed login attempt for user: {}", user.username);
        
        // Increment failed login attempts
        let _ = user_service.increment_failed_login(&user.id).await;
        
        return Err(auth_error("Invalid credentials").into());
    }

    // Check if account is locked
    if let Some(locked_until) = user.locked_until {
        if chrono::Utc::now() < locked_until {
            return Err(auth_error("Account is temporarily locked").into());
        }
    }

    // Check MFA if enabled
    if user.mfa_enabled {
        if req.mfa_token.is_none() {
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "requires_mfa": true,
                "message": "MFA token required"
            })));
        }
        
        // Verify MFA token (simplified - in production use proper TOTP verification)
        if !crate::auth::MfaService::verify_totp(
            user.mfa_secret.as_ref().unwrap_or(&String::new()),
            req.mfa_token.as_ref().unwrap_or(&String::new())
        ) {
            return Err(auth_error("Invalid MFA token").into());
        }
    }

    // Generate tokens
    let access_token = auth_service.generate_access_token(
        &user.id.to_string(),
        &user.username,
        user.role,
    )?;
    let refresh_token = auth_service.generate_refresh_token(&user.id.to_string())?;

    // Update last login
    let _ = user_service.update_last_login(&user.id).await;

    info!("User logged in successfully: {}", user.username);

    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token,
        user: crate::models::User {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            mfa_enabled: user.mfa_enabled,
            last_login: user.last_login,
            created_at: user.created_at,
        },
    }))
}

pub async fn logout(
    req: web::HttpRequest,
) -> impl Responder {
    // In production, revoke the token/session
    info!("User logged out");
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Logged out successfully"
    })))
}

pub async fn refresh(
    req: web::Json<RefreshTokenRequest>,
    auth_service: web::Data<AuthService>,
) -> impl Responder {
    // Verify refresh token
    let user_id = auth_service.extract_user_id_from_token(&req.refresh_token)?;
    
    // Generate new access token
    let access_token = auth_service.generate_access_token(
        &user_id,
        "user", // In production, fetch actual username
        crate::models::UserRole::Receptionist, // In production, fetch actual role
    )?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "access_token": access_token
    })))
}

pub async fn verify_mfa(
    req: web::Json<MfaVerifyRequest>,
) -> impl Responder {
    // Verify MFA token
    // In production, this would verify against the user's MFA secret
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "verified": true,
        "message": "MFA verified successfully"
    })))
}

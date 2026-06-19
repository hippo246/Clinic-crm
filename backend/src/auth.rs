use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use chrono::{Utc, Duration};
use uuid::Uuid;
use anyhow::{Result, anyhow};
use hmac::Mac;
use crate::models::{Claims, UserRole};
use crate::config::Config;

pub struct AuthService {
    jwt_secret: String,
    jwt_expiration: i64,
}

impl AuthService {
    pub fn new(config: &Config) -> Self {
        AuthService {
            jwt_secret: config.jwt_secret.clone(),
            jwt_expiration: config.jwt_expiration,
        }
    }

    pub fn generate_access_token(&self, user_id: &str, username: &str, role: UserRole) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::seconds(self.jwt_expiration);
        
        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            role,
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        ).map_err(|_| anyhow!("Failed to generate access token"))
    }

    pub fn generate_refresh_token(&self, user_id: &str) -> Result<String> {
        // Refresh tokens have longer expiration (7 days)
        let now = Utc::now();
        let exp = now + Duration::days(7);
        
        let claims = Claims {
            sub: user_id.to_string(),
            username: "".to_string(),
            role: UserRole::Receptionist, // Placeholder
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        ).map_err(|_| anyhow!("Failed to generate refresh token"))
    }

    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        ).map_err(|_| anyhow!("Invalid token"))?;

        Ok(token_data.claims)
    }

    pub fn extract_user_id_from_token(&self, token: &str) -> Result<String> {
        let claims = self.verify_token(token)?;
        Ok(claims.sub)
    }

    pub fn extract_role_from_token(&self, token: &str) -> Result<UserRole> {
        let claims = self.verify_token(token)?;
        Ok(claims.role)
    }
}

// Multi-Factor Authentication using TOTP (Time-based One-Time Password)
pub struct MfaService;

impl MfaService {
    pub fn generate_secret() -> String {
        use rand::Rng;
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let mut rng = rand::thread_rng();
        
        (0..32)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }

    pub fn generate_totp(secret: &str) -> Result<String> {
        // Simple TOTP implementation (in production, use a library like totp-lite)
        use std::time::{SystemTime, UNIX_EPOCH};
        
        let time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs() / 30; // 30-second intervals
        
        let counter = time as u64;
        
        // HMAC-based one-time password (simplified)
        let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(secret.as_bytes())?;
        mac.update(&counter.to_be_bytes());
        let result = mac.finalize().into_bytes();
        
        // Convert to 6-digit code
        let offset = (result[19] & 0x0f) as usize;
        let code = ((result[offset] & 0x7f) as u32) << 24
            | ((result[offset + 1] & 0xff) as u32) << 16
            | ((result[offset + 2] & 0xff) as u32) << 8
            | ((result[offset + 3] & 0xff) as u32);
        
        Ok((code % 1_000_000).to_string())
    }

    pub fn verify_totp(secret: &str, code: &str) -> bool {
        match Self::generate_totp(secret) {
            Ok(expected_code) => expected_code == code,
            Err(_) => false,
        }
    }
}

// Session management
pub struct SessionService {
    // In production, use Redis or database for session storage
    sessions: std::collections::HashMap<String, SessionData>,
}

#[derive(Clone)]
struct SessionData {
    user_id: String,
    created_at: chrono::DateTime<chrono::Utc>,
    last_activity: chrono::DateTime<chrono::Utc>,
}

impl SessionService {
    pub fn new() -> Self {
        SessionService {
            sessions: std::collections::HashMap::new(),
        }
    }

    pub fn create_session(&mut self, user_id: &str) -> String {
        let session_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        self.sessions.insert(session_id.clone(), SessionData {
            user_id: user_id.to_string(),
            created_at: now,
            last_activity: now,
        });
        
        session_id
    }

    pub fn validate_session(&mut self, session_id: &str) -> Option<String> {
        let user_id = {
            let session = self.sessions.get(session_id)?;
            
            // Check if session is expired (30 minutes of inactivity)
            let now = Utc::now();
            let inactive_duration = now.signed_duration_since(session.last_activity);
            
            if inactive_duration.num_minutes() > 30 {
                self.sessions.remove(session_id);
                return None;
            }
            
            session.user_id.clone()
        };
        
        // Update last activity
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.last_activity = Utc::now();
        }
        
        Some(user_id)
    }

    pub fn revoke_session(&mut self, session_id: &str) {
        self.sessions.remove(session_id);
    }

    pub fn revoke_all_user_sessions(&mut self, user_id: &str) {
        self.sessions.retain(|_, session| session.user_id != user_id);
    }

    pub fn cleanup_expired_sessions(&mut self) {
        let now = Utc::now();
        self.sessions.retain(|_, session| {
            let inactive_duration = now.signed_duration_since(session.last_activity);
            inactive_duration.num_minutes() <= 30
        });
    }
}

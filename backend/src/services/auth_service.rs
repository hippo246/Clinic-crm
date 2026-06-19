use crate::config::Config;
use crate::models::{Claims, UserRole};
use anyhow::Result;

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
        let now = chrono::Utc::now();
        let exp = now + chrono::Duration::seconds(self.jwt_expiration);
        
        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            role,
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
        };

        jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(self.jwt_secret.as_ref()),
        ).map_err(|e| anyhow::anyhow!("Failed to generate access token: {}", e))
    }

    pub fn generate_refresh_token(&self, user_id: &str) -> Result<String> {
        let now = chrono::Utc::now();
        let exp = now + chrono::Duration::days(7);
        
        let claims = Claims {
            sub: user_id.to_string(),
            username: "".to_string(),
            role: UserRole::Receptionist,
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
        };

        jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(self.jwt_secret.as_ref()),
        ).map_err(|e| anyhow::anyhow!("Failed to generate refresh token: {}", e))
    }

    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let token_data = jsonwebtoken::decode::<Claims>(
            token,
            &jsonwebtoken::DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &jsonwebtoken::Validation::default(),
        ).map_err(|e| anyhow::anyhow!("Invalid token: {}", e))?;

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

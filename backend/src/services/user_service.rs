use crate::database::Database;
use crate::models::{UserRole};
use crate::encryption::PasswordService;
use crate::error::{AppError, not_found_error};
use chrono::Utc;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub role: UserRole,
    pub mfa_secret: Option<String>,
    pub mfa_enabled: bool,
    pub failed_login_attempts: i32,
    pub locked_until: Option<chrono::DateTime<chrono::Utc>>,
    pub last_login: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct UserService {
    db: Database,
}

impl UserService {
    pub fn new(db: Database) -> Self {
        UserService { db }
    }

    pub async fn create_user(
        &self,
        username: &str,
        email: &str,
        password: &str,
        role: UserRole,
    ) -> Result<User, AppError> {
        let password_hash = PasswordService::hash_password(password)?;
        let mfa_secret = Some(crate::auth::MfaService::generate_secret());

        let client = self.db.pool().get().await?;
        
        let row = client.query_one(
            r#"
            INSERT INTO users (username, email, password_hash, role, mfa_secret, mfa_enabled)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, email, password_hash, role, mfa_secret, mfa_enabled, 
                      failed_login_attempts, locked_until, last_login, created_at
            "#,
            &[&username, &email, &password_hash, &role.to_string(), &mfa_secret, &false],
        ).await?;

        Ok(User {
            id: row.get("id"),
            username: row.get("username"),
            email: row.get("email"),
            password_hash: row.get("password_hash"),
            role: match row.get::<&str, _>("role") {
                "admin" => UserRole::Admin,
                "doctor" => UserRole::Doctor,
                "receptionist" => UserRole::Receptionist,
                _ => UserRole::Receptionist,
            },
            mfa_secret: row.get("mfa_secret"),
            mfa_enabled: row.get("mfa_enabled"),
            failed_login_attempts: row.get("failed_login_attempts"),
            locked_until: row.get("locked_until"),
            last_login: row.get("last_login"),
            created_at: row.get("created_at"),
        })
    }

    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let client = self.db.pool().get().await?;
        
        let row = client.query_opt(
            r#"
            SELECT id, username, email, password_hash, role, mfa_secret, mfa_enabled,
                   failed_login_attempts, locked_until, last_login, created_at
            FROM users WHERE email = $1
            "#,
            &[&email],
        ).await?;

        match row {
            Some(row) => Ok(Some(User {
                id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                password_hash: row.get("password_hash"),
                role: match row.get::<&str, _>("role") {
                    "admin" => UserRole::Admin,
                    "doctor" => UserRole::Doctor,
                    "receptionist" => UserRole::Receptionist,
                    _ => UserRole::Receptionist,
                },
                mfa_secret: row.get("mfa_secret"),
                mfa_enabled: row.get("mfa_enabled"),
                failed_login_attempts: row.get("failed_login_attempts"),
                locked_until: row.get("locked_until"),
                last_login: row.get("last_login"),
                created_at: row.get("created_at"),
            })),
            None => Ok(None),
        }
    }

    pub async fn increment_failed_login(&self, user_id: &Uuid) -> Result<(), AppError> {
        let client = self.db.pool().get().await?;
        
        client.execute(
            r#"
            UPDATE users 
            SET failed_login_attempts = failed_login_attempts + 1
            WHERE id = $1
            "#,
            &[user_id],
        ).await?;

        Ok(())
    }

    pub async fn update_last_login(&self, user_id: &Uuid) -> Result<(), AppError> {
        let client = self.db.pool().get().await?;
        
        client.execute(
            r#"
            UPDATE users 
            SET last_login = $1, failed_login_attempts = 0, locked_until = NULL
            WHERE id = $2
            "#,
            &[&Utc::now(), user_id],
        ).await?;

        Ok(())
    }

    pub async fn enable_mfa(&self, user_id: &Uuid, secret: &str) -> Result<(), AppError> {
        let client = self.db.pool().get().await?;
        
        client.execute(
            r#"
            UPDATE users 
            SET mfa_secret = $1, mfa_enabled = true
            WHERE id = $2
            "#,
            &[&secret, user_id],
        ).await?;

        Ok(())
    }
}

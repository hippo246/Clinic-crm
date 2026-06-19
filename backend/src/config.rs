use serde::{Deserialize, Serialize};
use anyhow::Result;
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, private_key};
use std::io::BufReader;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration: i64, // in seconds
    pub encryption_key: String, // AES-256 key
    pub ssl_cert_path: String,
    pub ssl_key_path: String,
    pub max_file_size: usize, // in bytes
    pub backup_retention_days: i64,
    pub audit_log_retention_days: i64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok();

        Ok(Config {
            host: std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8443".to_string())
                .parse()
                .unwrap_or(8443),
            database_url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            jwt_secret: std::env::var("JWT_SECRET")
                .expect("JWT_SECRET must be set"),
            jwt_expiration: std::env::var("JWT_EXPIRATION")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .unwrap_or(3600),
            encryption_key: std::env::var("ENCRYPTION_KEY")
                .expect("ENCRYPTION_KEY must be set"),
            ssl_cert_path: std::env::var("SSL_CERT_PATH")
                .unwrap_or_else(|_| "certs/server.crt".to_string()),
            ssl_key_path: std::env::var("SSL_KEY_PATH")
                .unwrap_or_else(|_| "certs/server.key".to_string()),
            max_file_size: std::env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "10485760".to_string()) // 10MB
                .parse()
                .unwrap_or(10_485_760),
            backup_retention_days: std::env::var("BACKUP_RETENTION_DAYS")
                .unwrap_or_else(|_| "90".to_string())
                .parse()
                .unwrap_or(90),
            audit_log_retention_days: std::env::var("AUDIT_LOG_RETENTION_DAYS")
                .unwrap_or_else(|_| "365".to_string())
                .parse()
                .unwrap_or(365),
        })
    }

    pub fn rustls_config(&self) -> ServerConfig {
        // Load certificate file
        let cert_file = std::fs::File::open(&self.ssl_cert_path).expect("Failed to open certificate file");
        let mut cert_reader = BufReader::new(cert_file);
        let cert_chain: Vec<Certificate> = certs(&mut cert_reader)
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to parse certificate")
            .into_iter()
            .map(Certificate)
            .collect();

        // Load private key file
        let key_file = std::fs::File::open(&self.ssl_key_path).expect("Failed to open private key file");
        let mut key_reader = BufReader::new(key_file);
        let key = private_key(&mut key_reader)
            .expect("Failed to load private key")
            .map(PrivateKey)
            .expect("No private key found");

        // Configure TLS
        let config = ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(cert_chain, key)
            .expect("Failed to build TLS config");

        config
    }
}

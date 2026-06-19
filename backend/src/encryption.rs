use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use anyhow::{Result, anyhow};
use base64::{Engine as _, engine::general_purpose};
use rand::RngCore;
use zeroize::Zeroize;

pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    pub fn new(key: &str) -> Result<Self> {
        // Decode base64 key
        let key_bytes = general_purpose::STANDARD
            .decode(key)
            .map_err(|_| anyhow!("Invalid encryption key format"))?;
        
        if key_bytes.len() != 32 {
            return Err(anyhow!("Encryption key must be 32 bytes (256 bits)"));
        }
        
        let cipher = Aes256Gcm::new_from_slice(&key_bytes)?;
        
        Ok(EncryptionService { cipher })
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        if plaintext.is_empty() {
            return Ok(String::new());
        }

        // Generate random nonce
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        
        // Encrypt
        let ciphertext = self.cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| anyhow!("Encryption failed"))?;
        
        // Combine nonce + ciphertext and encode as base64
        let mut combined = nonce.to_vec();
        combined.extend_from_slice(&ciphertext);
        
        Ok(general_purpose::STANDARD.encode(combined))
    }

    pub fn decrypt(&self, encrypted: &str) -> Result<String> {
        if encrypted.is_empty() {
            return Ok(String::new());
        }

        // Decode base64
        let combined = general_purpose::STANDARD
            .decode(encrypted)
            .map_err(|_| anyhow!("Invalid encrypted data format"))?;
        
        if combined.len() < 12 {
            return Err(anyhow!("Invalid encrypted data length"));
        }
        
        // Split nonce and ciphertext
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        // Decrypt
        let plaintext = self.cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| anyhow!("Decryption failed"))?;
        
        String::from_utf8(plaintext)
            .map_err(|_| anyhow!("Invalid UTF-8 in decrypted data"))
    }

    pub fn encrypt_phone(&self, phone: &str) -> Result<Vec<u8>> {
        let encrypted = self.encrypt(phone)?;
        Ok(encrypted.into_bytes())
    }

    pub fn decrypt_phone(&self, encrypted: &[u8]) -> Result<String> {
        let encrypted_str = String::from_utf8(encrypted.to_vec())
            .map_err(|_| anyhow!("Invalid encrypted phone data"))?;
        self.decrypt(&encrypted_str)
    }
}

// Secure password hashing with Argon2 (more secure than bcrypt)
pub struct PasswordService;

impl PasswordService {
    pub fn hash_password(password: &str) -> Result<String> {
        // Use Argon2id (recommended for password hashing)
        let params = argon2::Params::new(65536, 3, 2, None).map_err(|e| anyhow!("Failed to create argon2 params: {}", e))?;
        let salt = Self::generate_salt();
        
        let password_hash = argon2::hash_encoded(
            password.as_bytes(),
            &salt,
            &params,
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
        ).map_err(|e| anyhow!("Password hashing failed: {}", e))?;
        
        Ok(password_hash)
    }

    pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
        argon2::verify_encoded(hash, password.as_bytes())
            .map_err(|_| anyhow!("Password verification failed"))
    }

    fn generate_salt() -> [u8; 32] {
        let mut salt = [0u8; 32];
        OsRng.fill_bytes(&mut salt);
        salt
    }
}

// Secure token generation
pub struct TokenService;

impl TokenService {
    pub fn generate_secure_token(length: usize) -> String {
        let mut bytes = vec![0u8; length];
        OsRng.fill_bytes(&mut bytes);
        general_purpose::STANDARD.encode(&bytes)[..length].to_string()
    }

    pub fn generate_api_key() -> String {
        format!("clk_{}", Self::generate_secure_token(32))
    }
}

// Data sanitization to prevent injection attacks
pub struct Sanitizer;

impl Sanitizer {
    pub fn sanitize_string(input: &str) -> String {
        input
            .chars()
            .filter(|c| c.is_ascii() && !c.is_control())
            .collect()
    }

    pub fn sanitize_email(input: &str) -> Result<String> {
        let sanitized = input.trim().to_lowercase();
        
        if !sanitized.contains('@') || !sanitized.contains('.') {
            return Err(anyhow!("Invalid email format"));
        }
        
        Ok(sanitized)
    }

    pub fn sanitize_phone(input: &str) -> String {
        input
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '+' || *c == ' ' || *c == '-')
            .collect()
    }

    pub fn validate_sql_input(input: &str) -> bool {
        // Basic SQL injection prevention
        let dangerous_patterns = [
            "--", ";", "/*", "*/", "xp_", "sp_", "DROP", "DELETE", 
            "TRUNCATE", "ALTER", "EXEC", "UNION", "SELECT", "INSERT",
            "UPDATE", "WHERE", "OR", "AND"
        ];
        
        let upper_input = input.to_uppercase();
        !dangerous_patterns.iter().any(|pattern| upper_input.contains(pattern))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let key = "abcdefghijklmnopqrstuvwxyz123456"; // 32 bytes
        let service = EncryptionService::new(key).unwrap();
        
        let plaintext = "Sensitive patient data";
        let encrypted = service.encrypt(plaintext).unwrap();
        let decrypted = service.decrypt(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_password_hashing() {
        let password = "SecurePassword123!";
        let hash = PasswordService::hash_password(password).unwrap();
        let verified = PasswordService::verify_password(password, &hash).unwrap();
        
        assert!(verified);
    }
}

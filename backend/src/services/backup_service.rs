use crate::database::Database;
use crate::error::AppError;
use crate::encryption::EncryptionService;
use chrono::Utc;
use std::path::PathBuf;
use tokio::fs;

pub struct BackupService {
    db: Database,
    encryption_service: EncryptionService,
    backup_dir: PathBuf,
}

impl BackupService {
    pub fn new(db: Database, encryption_service: EncryptionService) -> Self {
        let backup_dir = PathBuf::from("./backups");
        
        // Create backup directory if it doesn't exist
        std::fs::create_dir_all(&backup_dir).expect("Failed to create backup directory");
        
        BackupService {
            db,
            encryption_service,
            backup_dir,
        }
    }

    pub async fn create_encrypted_backup(&self) -> Result<String, AppError> {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let backup_filename = format!("clinic_backup_{}.sql.enc", timestamp);
        let backup_path = self.backup_dir.join(&backup_filename);
        
        // Execute pg_dump to create SQL backup
        let output = tokio::process::Command::new("pg_dump")
            .arg("--dbname=postgres")
            .arg("--format=plain")
            .arg("--no-owner")
            .arg("--no-acl")
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to execute pg_dump: {}", e)))?;

        if !output.status.success() {
            return Err(AppError::Internal(format!("pg_dump failed: {}", String::from_utf8_lossy(&output.stderr))));
        }

        let sql_content = String::from_utf8(output.stdout)
            .map_err(|e| AppError::Internal(format!("Failed to parse pg_dump output: {}", e)))?;

        // Encrypt the backup
        let encrypted_content = self.encryption_service.encrypt(&sql_content)?;
        
        // Write encrypted backup to file
        fs::write(&backup_path, encrypted_content).await
            .map_err(|e| AppError::Internal(format!("Failed to write backup file: {}", e)))?;

        // Clean up old backups (retention policy)
        self.cleanup_old_backups().await?;

        Ok(backup_path.to_string_lossy().to_string())
    }

    pub async fn restore_backup(&self, backup_path: &str) -> Result<(), AppError> {
        // Read encrypted backup
        let encrypted_content = fs::read(backup_path).await
            .map_err(|e| AppError::Internal(format!("Failed to read backup file: {}", e)))?;

        // Decrypt backup
        let sql_content = self.encryption_service.decrypt(&String::from_utf8_lossy(&encrypted_content))?;

        // Execute SQL restore
        let output = tokio::process::Command::new("psql")
            .arg("--dbname=postgres")
            .arg("-c")
            .arg(&sql_content)
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to execute psql: {}", e)))?;

        if !output.status.success() {
            return Err(AppError::Internal(format!("psql failed: {}", String::from_utf8_lossy(&output.stderr))));
        }

        Ok(())
    }

    async fn cleanup_old_backups(&self) -> Result<(), AppError> {
        let retention_days = 90; // Default retention period
        let cutoff_time = Utc::now() - chrono::Duration::days(retention_days);

        let mut entries = fs::read_dir(&self.backup_dir).await
            .map_err(|e| AppError::Internal(format!("Failed to read backup directory: {}", e)))?;

        while let Some(entry) = entries.next_entry().await
            .map_err(|e| AppError::Internal(format!("Failed to read directory entry: {}", e)))? {
            
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "enc") {
                if let Ok(metadata) = entry.metadata().await {
                    if let Ok(modified) = metadata.modified() {
                        let modified_time = chrono::DateTime::<chrono::Utc>::from(modified);
                        if modified_time < cutoff_time {
                            fs::remove_file(&path).await
                                .map_err(|e| AppError::Internal(format!("Failed to delete old backup: {}", e)))?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn schedule_automated_backups(&self) -> Result<(), AppError> {
        // This would typically be run as a separate background task
        // For now, we'll just create a backup on demand
        Ok(())
    }
}

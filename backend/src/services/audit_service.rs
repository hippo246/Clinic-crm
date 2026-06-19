use crate::database::Database;
use crate::models::{AuditLog, AuditSeverity};
use crate::error::AppError;
use chrono::Utc;
use uuid::Uuid;

pub struct AuditService {
    db: Database,
}

impl AuditService {
    pub fn new(db: Database) -> Self {
        AuditService { db }
    }

    pub async fn log_action(
        &self,
        user_id: Option<Uuid>,
        action: &str,
        resource_type: &str,
        resource_id: Option<String>,
        old_values: Option<serde_json::Value>,
        new_values: Option<serde_json::Value>,
    ) -> Result<AuditLog, AppError> {
        let client = self.db.pool().get().await?;
        
        let row = client.query_one(
            r#"
            INSERT INTO audit_logs (
                patient_id, user_id, action, resource_type, resource_id,
                old_values, new_values, timestamp, severity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, patient_id, user_id, action, resource_type, resource_id,
                      old_values, new_values, timestamp, severity
            "#,
            &[
                &resource_id.clone(), // Using resource_id as patient_id for now
                &user_id,
                &action,
                &resource_type,
                &resource_id,
                &old_values,
                &new_values,
                &Utc::now(),
                &AuditSeverity::Info,
            ],
        ).await?;

        Ok(AuditLog {
            id: row.get("id"),
            patient_id: row.get("patient_id"),
            user_id: row.get("user_id"),
            username: None, // Would need to fetch from users table
            action: row.get("action"),
            resource_type: Some(row.get("resource_type")),
            resource_id: row.get("resource_id"),
            old_values: row.get("old_values"),
            new_values: row.get("new_values"),
            ip_address: None, // Would need to extract from request
            user_agent: None, // Would need to extract from request
            timestamp: row.get("timestamp"),
            severity: match row.get::<&str, _>("severity") {
                "debug" => AuditSeverity::Debug,
                "info" => AuditSeverity::Info,
                "warning" => AuditSeverity::Warning,
                "error" => AuditSeverity::Error,
                "critical" => AuditSeverity::Critical,
                _ => AuditSeverity::Info,
            },
        })
    }

    pub async fn list_audit_logs(
        &self,
        patient_id: Option<String>,
        user_id: Option<Uuid>,
        action: Option<String>,
        start_date: Option<chrono::DateTime<chrono::Utc>>,
        end_date: Option<chrono::DateTime<chrono::Utc>>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditLog>, AppError> {
        let client = self.db.pool().get().await?;
        
        let mut query = String::from(
            "SELECT id, patient_id, user_id, action, resource_type, resource_id,
                    old_values, new_values, timestamp, severity
             FROM audit_logs WHERE 1=1"
        );
        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
        let mut param_count = 0;

        if let Some(ref patient_id) = patient_id {
            param_count += 1;
            query.push_str(&format!(" AND patient_id = ${}", param_count));
            params.push(patient_id);
        }

        if let Some(ref user_id) = user_id {
            param_count += 1;
            query.push_str(&format!(" AND user_id = ${}", param_count));
            params.push(user_id);
        }

        if let Some(ref action) = action {
            param_count += 1;
            query.push_str(&format!(" AND action = ${}", param_count));
            params.push(action);
        }

        if let Some(ref start_date) = start_date {
            param_count += 1;
            query.push_str(&format!(" AND timestamp >= ${}", param_count));
            params.push(start_date);
        }

        if let Some(ref end_date) = end_date {
            param_count += 1;
            query.push_str(&format!(" AND timestamp <= ${}", param_count));
            params.push(end_date);
        }

        query.push_str(&format!(" ORDER BY timestamp DESC LIMIT {} OFFSET {}", limit, offset));

        let rows = client.query(&query, &params).await?;

        let logs = rows.iter().map(|row| AuditLog {
            id: row.get("id"),
            patient_id: row.get("patient_id"),
            user_id: row.get("user_id"),
            username: None,
            action: row.get("action"),
            resource_type: Some(row.get("resource_type")),
            resource_id: row.get("resource_id"),
            old_values: row.get("old_values"),
            new_values: row.get("new_values"),
            ip_address: None,
            user_agent: None,
            timestamp: row.get("timestamp"),
            severity: match row.get::<&str, _>("severity") {
                "debug" => AuditSeverity::Debug,
                "info" => AuditSeverity::Info,
                "warning" => AuditSeverity::Warning,
                "error" => AuditSeverity::Error,
                "critical" => AuditSeverity::Critical,
                _ => AuditSeverity::Info,
            },
        }).collect();

        Ok(logs)
    }

    pub async fn get_patient_audit_logs(&self, patient_id: &str) -> Result<Vec<AuditLog>, AppError> {
        let client = self.db.pool().get().await?;
        
        let rows = client.query(
            r#"
            SELECT id, patient_id, user_id, action, resource_type, resource_id,
                   old_values, new_values, timestamp, severity
            FROM audit_logs
            WHERE patient_id = $1
            ORDER BY timestamp DESC
            LIMIT 100
            "#,
            &[&patient_id],
        ).await?;

        let logs = rows.iter().map(|row| AuditLog {
            id: row.get("id"),
            patient_id: row.get("patient_id"),
            user_id: row.get("user_id"),
            username: None,
            action: row.get("action"),
            resource_type: Some(row.get("resource_type")),
            resource_id: row.get("resource_id"),
            old_values: row.get("old_values"),
            new_values: row.get("new_values"),
            ip_address: None,
            user_agent: None,
            timestamp: row.get("timestamp"),
            severity: match row.get::<&str, _>("severity") {
                "debug" => AuditSeverity::Debug,
                "info" => AuditSeverity::Info,
                "warning" => AuditSeverity::Warning,
                "error" => AuditSeverity::Error,
                "critical" => AuditSeverity::Critical,
                _ => AuditSeverity::Info,
            },
        }).collect();

        Ok(logs)
    }

    pub async fn cleanup_old_logs(&self, retention_days: i64) -> Result<u64, AppError> {
        let client = self.db.pool().get().await?;
        
        let cutoff_date = Utc::now() - chrono::Duration::days(retention_days);
        
        let result = client.execute(
            r#"
            DELETE FROM audit_logs
            WHERE timestamp < $1
            "#,
            &[&cutoff_date],
        ).await?;

        Ok(result)
    }
}

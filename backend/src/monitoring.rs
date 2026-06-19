use crate::database::Database;
use crate::error::AppError;
use chrono::Utc;
use tracing::{info, warn, error};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, serde::Serialize)]
pub struct SecurityEvent {
    pub event_type: String,
    pub severity: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub details: serde_json::Value,
    pub source_ip: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemMetrics {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub active_connections: i32,
    pub requests_per_second: f64,
    pub error_rate: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

pub struct MonitoringService {
    db: Database,
    security_events: Arc<Mutex<Vec<SecurityEvent>>>,
    metrics: Arc<Mutex<SystemMetrics>>,
    alert_thresholds: AlertThresholds,
}

#[derive(Debug, Clone)]
pub struct AlertThresholds {
    pub max_cpu_usage: f64,
    pub max_memory_usage: f64,
    pub max_disk_usage: f64,
    pub max_error_rate: f64,
    pub max_failed_logins: i32,
}

impl Default for AlertThresholds {
    fn default() -> Self {
        AlertThresholds {
            max_cpu_usage: 80.0,
            max_memory_usage: 85.0,
            max_disk_usage: 90.0,
            max_error_rate: 5.0,
            max_failed_logins: 5,
        }
    }
}

impl MonitoringService {
    pub fn new(db: Database) -> Self {
        MonitoringService {
            db,
            security_events: Arc::new(Mutex::new(Vec::new())),
            metrics: Arc::new(Mutex::new(SystemMetrics {
                cpu_usage: 0.0,
                memory_usage: 0.0,
                disk_usage: 0.0,
                active_connections: 0,
                requests_per_second: 0.0,
                error_rate: 0.0,
                timestamp: Utc::now(),
            })),
            alert_thresholds: AlertThresholds::default(),
        }
    }

    pub fn log_security_event(&self, event: SecurityEvent) {
        let mut events = self.security_events.lock().unwrap();
        events.push(event.clone());
        
        // Keep only last 1000 events
        if events.len() > 1000 {
            events.remove(0);
        }

        // Check for alert conditions
        self.check_alert_conditions(&event);
    }

    pub fn update_metrics(&self, metrics: SystemMetrics) {
        let mut current_metrics = self.metrics.lock().unwrap();
        *current_metrics = metrics.clone();
        
        // Check metric thresholds
        self.check_metric_thresholds(&metrics);
    }

    pub fn get_security_events(&self, limit: usize) -> Vec<SecurityEvent> {
        let events = self.security_events.lock().unwrap();
        events.iter().rev().take(limit).cloned().collect()
    }

    pub fn get_current_metrics(&self) -> SystemMetrics {
        let metrics = self.metrics.lock().unwrap();
        metrics.clone()
    }

    fn check_alert_conditions(&self, event: &SecurityEvent) {
        match event.severity.as_str() {
            "critical" => {
                error!("CRITICAL SECURITY EVENT: {} - {}", event.event_type, event.details);
                self.send_alert(&format!("CRITICAL: {}", event.event_type), &event.details.to_string());
            }
            "high" => {
                warn!("HIGH SECURITY EVENT: {} - {}", event.event_type, event.details);
                if event.event_type.contains("failed_login") {
                    self.check_failed_login_pattern();
                }
            }
            _ => {
                info!("Security event: {}", event.event_type);
            }
        }
    }

    fn check_metric_thresholds(&self, metrics: &SystemMetrics) {
        if metrics.cpu_usage > self.alert_thresholds.max_cpu_usage {
            warn!("HIGH CPU USAGE: {}%", metrics.cpu_usage);
            self.send_alert("High CPU Usage", &format!("CPU usage is {}%", metrics.cpu_usage));
        }

        if metrics.memory_usage > self.alert_thresholds.max_memory_usage {
            warn!("HIGH MEMORY USAGE: {}%", metrics.memory_usage);
            self.send_alert("High Memory Usage", &format!("Memory usage is {}%", metrics.memory_usage));
        }

        if metrics.disk_usage > self.alert_thresholds.max_disk_usage {
            warn!("HIGH DISK USAGE: {}%", metrics.disk_usage);
            self.send_alert("High Disk Usage", &format!("Disk usage is {}%", metrics.disk_usage));
        }

        if metrics.error_rate > self.alert_thresholds.max_error_rate {
            warn!("HIGH ERROR RATE: {}%", metrics.error_rate);
            self.send_alert("High Error Rate", &format!("Error rate is {}%", metrics.error_rate));
        }
    }

    fn check_failed_login_pattern(&self) {
        let events = self.security_events.lock().unwrap();
        let recent_failed_logins: Vec<_> = events
            .iter()
            .filter(|e| e.event_type.contains("failed_login"))
            .filter(|e| {
                (Utc::now() - e.timestamp).num_minutes() < 5
            })
            .collect();

        if recent_failed_logins.len() as i32 > self.alert_thresholds.max_failed_logins {
            error!("BRUTE FORCE ATTACK DETECTED: {} failed logins in 5 minutes", recent_failed_logins.len());
            self.send_alert("Brute Force Attack", &format!("{} failed login attempts detected", recent_failed_logins.len()));
        }
    }

    fn send_alert(&self, title: &str, message: &str) {
        // In production, this would send alerts via:
        // - Email
        // - Slack/Teams webhook
        // - SMS
        // - PagerDuty
        // - Monitoring system integration
        
        error!("ALERT: {} - {}", title, message);
        
        // Log to database for audit trail
        let client = match self.db.pool().get().await {
            Ok(client) => client,
            Err(e) => {
                error!("Failed to get database connection for alert logging: {}", e);
                return;
            }
        };

        let _ = client.execute(
            r#"
            INSERT INTO audit_logs (action, severity, timestamp, resource_type)
            VALUES ($1, $2, $3, $4)
            "#,
            &[&format!("ALERT: {}", title), &String::from("critical"), &Utc::now().to_string(), &String::from("monitoring")],
        );
    }

    pub async fn collect_system_metrics(&self) -> SystemMetrics {
        // Collect actual system metrics
        let cpu_usage = self.get_cpu_usage();
        let memory_usage = self.get_memory_usage();
        let disk_usage = self.get_disk_usage();
        
        let metrics = SystemMetrics {
            cpu_usage,
            memory_usage,
            disk_usage,
            active_connections: 0, // Would be collected from connection pool
            requests_per_second: 0.0, // Would be calculated from request logs
            error_rate: 0.0, // Would be calculated from error logs
            timestamp: Utc::now(),
        };

        self.update_metrics(metrics.clone());
        metrics
    }

    fn get_cpu_usage(&self) -> f64 {
        // In production, use actual system metrics collection
        // This is a placeholder implementation
        45.0
    }

    fn get_memory_usage(&self) -> f64 {
        // In production, use actual system metrics collection
        // This is a placeholder implementation
        60.0
    }

    fn get_disk_usage(&self) -> f64 {
        // In production, use actual system metrics collection
        // This is a placeholder implementation
        55.0
    }

    pub async fn start_monitoring(&self) {
        let monitoring_service = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                let metrics = monitoring_service.collect_system_metrics().await;
                info!("System metrics: {:?}", metrics);
            }
        });
    }
}

impl Clone for MonitoringService {
    fn clone(&self) -> Self {
        MonitoringService {
            db: self.db.clone(),
            security_events: Arc::clone(&self.security_events),
            metrics: Arc::clone(&self.metrics),
            alert_thresholds: self.alert_thresholds.clone(),
        }
    }
}

// Intrusion Detection System
pub struct IntrusionDetectionSystem {
    monitoring_service: MonitoringService,
    suspicious_patterns: Vec<SuspiciousPattern>,
}

#[derive(Debug, Clone)]
struct SuspiciousPattern {
    pattern_type: String,
    threshold: i32,
    time_window: Duration,
    current_count: Arc<Mutex<i32>>,
    last_reset: Arc<Mutex<Instant>>,
}

impl IntrusionDetectionSystem {
    pub fn new(monitoring_service: MonitoringService) -> Self {
        IntrusionDetectionSystem {
            monitoring_service,
            suspicious_patterns: vec![
                SuspiciousPattern {
                    pattern_type: "rapid_failed_logins".to_string(),
                    threshold: 5,
                    time_window: Duration::from_secs(300), // 5 minutes
                    current_count: Arc::new(Mutex::new(0)),
                    last_reset: Arc::new(Mutex::new(Instant::now())),
                },
                SuspiciousPattern {
                    pattern_type: "unusual_access_pattern".to_string(),
                    threshold: 10,
                    time_window: Duration::from_secs(3600), // 1 hour
                    current_count: Arc::new(Mutex::new(0)),
                    last_reset: Arc::new(Mutex::new(Instant::now())),
                },
                SuspiciousPattern {
                    pattern_type: "data_export_attempts".to_string(),
                    threshold: 3,
                    time_window: Duration::from_secs(3600), // 1 hour
                    current_count: Arc::new(Mutex::new(0)),
                    last_reset: Arc::new(Mutex::new(Instant::now())),
                },
            ],
        }
    }

    pub fn analyze_event(&self, event: &SecurityEvent) {
        for pattern in &self.suspicious_patterns {
            if self.matches_pattern(event, pattern) {
                self.increment_pattern_count(pattern);
                
                if self.check_threshold(pattern) {
                    self.trigger_alert(pattern, event);
                }
            }
        }
    }

    fn matches_pattern(&self, event: &SecurityEvent, pattern: &SuspiciousPattern) -> bool {
        match pattern.pattern_type.as_str() {
            "rapid_failed_logins" => event.event_type.contains("failed_login"),
            "unusual_access_pattern" => event.event_type.contains("unusual_access"),
            "data_export_attempts" => event.event_type.contains("data_export"),
            _ => false,
        }
    }

    fn increment_pattern_count(&self, pattern: &SuspiciousPattern) {
        let mut last_reset = pattern.last_reset.lock().unwrap();
        let mut count = pattern.current_count.lock().unwrap();

        if last_reset.elapsed() > pattern.time_window {
            *count = 0;
            *last_reset = Instant::now();
        }

        *count += 1;
    }

    fn check_threshold(&self, pattern: &SuspiciousPattern) -> bool {
        let count = pattern.current_count.lock().unwrap();
        *count >= pattern.threshold
    }

    fn trigger_alert(&self, pattern: &SuspiciousPattern, event: &SecurityEvent) {
        error!("INTRUSION DETECTED: {} - {}", pattern.pattern_type, event.details);
        self.monitoring_service.send_alert(
            &format!("Intrusion Detected: {}", pattern.pattern_type),
            &format!("Suspicious pattern detected: {}", event.details),
        );
    }
}

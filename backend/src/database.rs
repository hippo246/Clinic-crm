use deadpool_postgres::{Config, Pool, Runtime};
use tokio_postgres::NoTls;
use anyhow::Result;
use tracing::{info, error};

#[derive(Clone)]
pub struct Database {
    pool: Pool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let mut cfg = Config::new();
        cfg.url = Some(database_url.to_string());
        
        let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)?;
        
        info!("Successfully connected to PostgreSQL database");
        
        Ok(Database { pool })
    }

    pub fn pool(&self) -> &Pool {
        &self.pool
    }

    pub async fn run_migrations(&self) -> Result<()> {
        // Run database migrations to create tables with proper security
        let client = self.pool.get().await?;
        
        // Create users table with proper constraints
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'doctor', 'receptionist')),
                mfa_secret VARCHAR(255),
                mfa_enabled BOOLEAN DEFAULT FALSE,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create patients table with encryption-ready fields
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS patients (
                id VARCHAR(50) PRIMARY KEY,
                first_name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                dob DATE NOT NULL,
                age INTEGER NOT NULL,
                gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
                blood_group VARCHAR(10) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
                phone_encrypted BYTEA NOT NULL,
                email_encrypted BYTEA,
                address_encrypted BYTEA,
                nationality VARCHAR(100),
                emergency_name_encrypted BYTEA,
                emergency_relation VARCHAR(50),
                emergency_phone_encrypted BYTEA,
                insurer VARCHAR(255),
                policy_number_encrypted BYTEA,
                insurance_expiry DATE,
                insurance_status VARCHAR(20) CHECK (insurance_status IN ('Active', 'Expiring', 'Expired', 'None')),
                allergies_encrypted BYTEA,
                conditions JSONB,
                medications JSONB,
                alerts JSONB,
                status VARCHAR(50) CHECK (status IN ('New', 'Active', 'Follow-Up Due', 'Under Treatment', 'Observation', 'Inactive', 'VIP', 'Archived')),
                doctor VARCHAR(255),
                last_visit DATE,
                next_appointment DATE,
                follow_up_date DATE,
                follow_up_reason TEXT,
                follow_up_staff VARCHAR(255),
                follow_up_priority VARCHAR(20) CHECK (follow_up_priority IN ('High', 'Medium', 'Low')),
                follow_up_status VARCHAR(20) CHECK (follow_up_status IN ('Pending', 'Called', 'No Answer', 'Completed')),
                call_attempts INTEGER DEFAULT 0,
                last_contacted TIMESTAMP,
                follow_up_notes TEXT,
                phone_verified BOOLEAN DEFAULT FALSE,
                insurance_verified BOOLEAN DEFAULT FALSE,
                id_verified BOOLEAN DEFAULT FALSE,
                consent_signed BOOLEAN DEFAULT FALSE,
                documents_complete BOOLEAN DEFAULT FALSE,
                timeline JSONB,
                documents JSONB,
                notes JSONB,
                family JSONB,
                consents JSONB,
                flags JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create audit_logs table (immutable for HIPAA compliance)
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50),
                user_id UUID REFERENCES users(id),
                username VARCHAR(255),
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(100),
                resource_id VARCHAR(255),
                old_values JSONB,
                new_values JSONB,
                ip_address INET,
                user_agent TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
            )
            "#,
            &[]
        ).await?;

        // Create indexes for performance and security
        client.execute(
            r#"
            CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
            CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor);
            CREATE INDEX IF NOT EXISTS idx_patients_follow_up ON patients(follow_up_date);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_patient ON audit_logs(patient_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
            "#,
            &[]
        ).await?;

        // Create appointments table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS appointments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                doctor_id UUID REFERENCES users(id),
                appointment_date TIMESTAMP NOT NULL,
                duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 15 AND duration_minutes <= 480),
                appointment_type VARCHAR(50) NOT NULL CHECK (appointment_type IN ('Checkup', 'Consultation', 'FollowUp', 'Emergency', 'Surgery', 'LabTest', 'Imaging', 'Therapy')),
                reason TEXT NOT NULL,
                notes TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'InProgress', 'Completed', 'Cancelled', 'NoShow')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create consultations table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS consultations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                doctor_id UUID REFERENCES users(id),
                appointment_id UUID REFERENCES appointments(id),
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                vitals JSONB,
                chief_complaint TEXT NOT NULL,
                history_of_present_illness TEXT,
                physical_examination TEXT,
                diagnosis TEXT,
                treatment_plan TEXT,
                follow_up_instructions TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'InProgress' CHECK (status IN ('InProgress', 'Completed', 'Discharged')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create prescriptions table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS prescriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                doctor_id UUID REFERENCES users(id),
                consultation_id UUID REFERENCES consultations(id),
                medication_name VARCHAR(255) NOT NULL,
                dosage VARCHAR(100) NOT NULL,
                frequency VARCHAR(100) NOT NULL,
                route VARCHAR(50) NOT NULL,
                duration VARCHAR(100) NOT NULL,
                instructions TEXT,
                refills INTEGER DEFAULT 0 CHECK (refills >= 0 AND refills <= 12),
                dispensed BOOLEAN DEFAULT FALSE,
                dispensed_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create invoices table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                invoice_number VARCHAR(100) NOT NULL UNIQUE,
                invoice_date DATE NOT NULL,
                due_date DATE NOT NULL,
                items JSONB NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                tax DECIMAL(10,2) NOT NULL DEFAULT 0,
                total DECIMAL(10,2) NOT NULL,
                notes TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled')),
                paid_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create communications table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS communications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                staff_id UUID REFERENCES users(id),
                message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('SMS', 'Email', 'PhoneCall')),
                recipient VARCHAR(255) NOT NULL,
                subject VARCHAR(500),
                message TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Delivered', 'Failed')),
                sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create follow_ups table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS follow_ups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                staff_id UUID REFERENCES users(id),
                follow_up_date TIMESTAMP NOT NULL,
                follow_up_type VARCHAR(50) NOT NULL CHECK (follow_up_type IN ('PhoneCall', 'InPerson', 'VideoCall', 'LabTest', 'Imaging')),
                reason TEXT NOT NULL,
                notes TEXT,
                reminder_days INTEGER,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Called', 'NoAnswer', 'Completed')),
                completed_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create consents table
        client.execute(
            r#"
            CREATE TABLE IF NOT EXISTS consents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
                consent_type VARCHAR(100) NOT NULL,
                witness_name VARCHAR(255),
                witness_signature BOOLEAN DEFAULT FALSE,
                signed_at TIMESTAMP NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Signed' CHECK (status IN ('Signed', 'Expired', 'Revoked')),
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            &[]
        ).await?;

        // Create indexes for medical workflow tables
        client.execute(
            r#"
            CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
            CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
            CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
            CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
            CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
            CREATE INDEX IF NOT EXISTS idx_communications_patient ON communications(patient_id);
            CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(status);
            CREATE INDEX IF NOT EXISTS idx_follow_ups_patient ON follow_ups(patient_id);
            CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
            CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
            CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
            CREATE INDEX IF NOT EXISTS idx_consents_type ON consents(consent_type);
            "#,
            &[]
        ).await?;

        // Enable row-level security for HIPAA compliance
        client.execute(
            r#"
            ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
            ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
            "#,
            &[]
        ).await?;

        info!("Database migrations completed successfully");
        
        Ok(())
    }
}

use crate::database::Database;
use crate::models::{Patient, CreatePatientRequest, UpdatePatientRequest, Gender, BloodGroup, InsuranceStatus, PatientStatus, AlertType, FollowUpPriority, FollowUpStatus};
use crate::error::{AppError, not_found_error};
use chrono::{Utc, Datelike};
use serde::{Deserialize, Serialize};
use deadpool_postgres::tokio_postgres::Row;

pub struct PatientService {
    db: Database,
}

impl PatientService {
    pub fn new(db: Database) -> Self {
        PatientService { db }
    }

    pub async fn list_patients(&self, limit: i64, offset: i64) -> Result<Vec<Patient>, AppError> {
        let client = self.db.pool().get().await?;
        
        let rows = client.query(
            r#"
            SELECT id, first_name, last_name, name, dob, age, gender, blood_group,
                   phone_encrypted, email_encrypted, address_encrypted, nationality,
                   emergency_name_encrypted, emergency_relation, emergency_phone_encrypted,
                   insurer, policy_number_encrypted, insurance_expiry, insurance_status,
                   allergies_encrypted, conditions, medications, alerts, status, doctor,
                   last_visit, next_appointment, follow_up_date, follow_up_reason,
                   follow_up_staff, follow_up_priority, follow_up_status, call_attempts,
                   last_contacted, follow_up_notes, phone_verified, insurance_verified,
                   id_verified, consent_signed, documents_complete, timeline, documents,
                   notes, family, consents, flags, created_at, updated_at
            FROM patients
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
            &[&limit, &offset],
        ).await?;

        let patients = rows.iter().map(|row| self.row_to_patient(row)).collect();
        
        Ok(patients)
    }

    pub async fn get_patient(&self, patient_id: &str) -> Result<Option<Patient>, AppError> {
        let client = self.db.pool().get().await?;
        
        let row = client.query_opt(
            r#"
            SELECT id, first_name, last_name, name, dob, age, gender, blood_group,
                   phone_encrypted, email_encrypted, address_encrypted, nationality,
                   emergency_name_encrypted, emergency_relation, emergency_phone_encrypted,
                   insurer, policy_number_encrypted, insurance_expiry, insurance_status,
                   allergies_encrypted, conditions, medications, alerts, status, doctor,
                   last_visit, next_appointment, follow_up_date, follow_up_reason,
                   follow_up_staff, follow_up_priority, follow_up_status, call_attempts,
                   last_contacted, follow_up_notes, phone_verified, insurance_verified,
                   id_verified, consent_signed, documents_complete, timeline, documents,
                   notes, family, consents, flags, created_at, updated_at
            FROM patients
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            &[&patient_id],
        ).await?;

        match row {
            Some(row) => Ok(Some(self.row_to_patient(&row))),
            None => Ok(None),
        }
    }

    pub async fn create_patient(
        &self,
        patient_id: String,
        req: CreatePatientRequest,
        phone_encrypted: Vec<u8>,
        email_encrypted: Option<Vec<u8>>,
        address_encrypted: Option<Vec<u8>>,
        emergency_name_encrypted: Option<Vec<u8>>,
        emergency_phone_encrypted: Option<Vec<u8>>,
        policy_number_encrypted: Option<Vec<u8>>,
        allergies_encrypted: Option<Vec<u8>>,
    ) -> Result<Patient, AppError> {
        let client = self.db.pool().get().await?;
        
        let name = format!("{} {}", req.first_name, req.last_name);
        let age = self.calculate_age(&req.dob);
        let doctor = req.doctor.unwrap_or_else(|| "Dr. Sharma".to_string());
        let insurer = req.insurer.unwrap_or_else(|| "None".to_string());
        
        let row = client.query_one(
            r#"
            INSERT INTO patients (
                id, first_name, last_name, name, dob, age, gender, blood_group,
                phone_encrypted, email_encrypted, address_encrypted, nationality,
                emergency_name_encrypted, emergency_relation, emergency_phone_encrypted,
                insurer, policy_number_encrypted, insurance_expiry, insurance_status,
                allergies_encrypted, conditions, medications, alerts, status, doctor,
                last_visit, next_appointment, follow_up_date, follow_up_reason,
                follow_up_staff, follow_up_priority, follow_up_status, call_attempts,
                last_contacted, follow_up_notes, phone_verified, insurance_verified,
                id_verified, consent_signed, documents_complete, timeline, documents,
                notes, family, consents, flags, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25,
                $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35,
                $36, $37, $38, $39, $40,
                $41, $42, $43, $44, $45, $46, $47, $48, $49, $50
            )
            RETURNING id, first_name, last_name, name, dob, age, gender, blood_group,
                      phone_encrypted, email_encrypted, address_encrypted, nationality,
                      emergency_name_encrypted, emergency_relation, emergency_phone_encrypted,
                      insurer, policy_number_encrypted, insurance_expiry, insurance_status,
                      allergies_encrypted, conditions, medications, alerts, status, doctor,
                      last_visit, next_appointment, follow_up_date, follow_up_reason,
                      follow_up_staff, follow_up_priority, follow_up_status, call_attempts,
                      last_contacted, follow_up_notes, phone_verified, insurance_verified,
                      id_verified, consent_signed, documents_complete, timeline, documents,
                      notes, family, consents, flags, created_at, updated_at
            "#,
            &[
                &patient_id, &req.first_name, &req.last_name, &name, &req.dob, &age, 
                &req.gender.to_string(), &req.blood_group.to_string(),
                &phone_encrypted, &email_encrypted, &address_encrypted, &req.nationality.unwrap_or_else(|| "Indian".to_string()),
                &emergency_name_encrypted, &req.emergency_relation.unwrap_or_else(|| "".to_string()), &emergency_phone_encrypted,
                &insurer, &policy_number_encrypted, &req.insurance_expiry, &InsuranceStatus::None.to_string(),
                &allergies_encrypted, &req.conditions.unwrap_or_else(|| vec![]), &req.medications.unwrap_or_else(|| vec![]), 
                &req.alerts.unwrap_or_else(|| vec![]), &PatientStatus::New.to_string(), &doctor,
                &None::<String>, &None::<String>, &None::<String>, &None::<String>,
                &None::<String>, &None::<FollowUpPriority>, &None::<FollowUpStatus>, &0i32,
                &None::<chrono::DateTime<chrono::Utc>>, &None::<String>,
                &false, &false, &false, &false, &false,
                &Vec::<serde_json::Value>::new(), &Vec::<serde_json::Value>::new(),
                &Vec::<serde_json::Value>::new(), &Vec::<serde_json::Value>::new(),
                &serde_json::json!({}), &serde_json::json!({}),
                &Utc::now(), &Utc::now(),
            ],
        ).await?;

        Ok(self.row_to_patient(&row))
    }

    pub async fn update_patient(
        &self,
        patient_id: String,
        req: UpdatePatientRequest,
        phone_encrypted: Option<Vec<u8>>,
        email_encrypted: Option<Vec<u8>>,
        address_encrypted: Option<Vec<u8>>,
        emergency_name_encrypted: Option<Vec<u8>>,
        emergency_phone_encrypted: Option<Vec<u8>>,
        policy_number_encrypted: Option<Vec<u8>>,
        allergies_encrypted: Option<Vec<u8>>,
    ) -> Result<Patient, AppError> {
        let client = self.db.pool().get().await?;

        // Build dynamic update query
        let mut updates = vec!["updated_at = $1".to_string()];
        let now = Utc::now();
        let mut owned_strings: Vec<String> = Vec::new();
        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![&now];
        let mut param_count = 1;

        if let Some(ref first_name) = req.first_name {
            param_count += 1;
            updates.push(format!("first_name = ${}", param_count));
            params.push(first_name);
        }
        if let Some(ref last_name) = req.last_name {
            param_count += 1;
            updates.push(format!("last_name = ${}", param_count));
            params.push(last_name);
        }
        if let Some(ref phone_encrypted) = phone_encrypted {
            param_count += 1;
            updates.push(format!("phone_encrypted = ${}", param_count));
            params.push(phone_encrypted);
        }
        if let Some(ref email_encrypted) = email_encrypted {
            param_count += 1;
            updates.push(format!("email_encrypted = ${}", param_count));
            params.push(email_encrypted);
        }
        if let Some(ref address_encrypted) = address_encrypted {
            param_count += 1;
            updates.push(format!("address_encrypted = ${}", param_count));
            params.push(address_encrypted);
        }
        if let Some(ref emergency_name_encrypted) = emergency_name_encrypted {
            param_count += 1;
            updates.push(format!("emergency_name_encrypted = ${}", param_count));
            params.push(emergency_name_encrypted);
        }
        if let Some(ref emergency_phone_encrypted) = emergency_phone_encrypted {
            param_count += 1;
            updates.push(format!("emergency_phone_encrypted = ${}", param_count));
            params.push(emergency_phone_encrypted);
        }
        if let Some(ref insurer) = req.insurer {
            param_count += 1;
            updates.push(format!("insurer = ${}", param_count));
            params.push(insurer);
        }
        if let Some(ref policy_number_encrypted) = policy_number_encrypted {
            param_count += 1;
            updates.push(format!("policy_number_encrypted = ${}", param_count));
            params.push(policy_number_encrypted);
        }
        if let Some(ref insurance_expiry) = req.insurance_expiry {
            param_count += 1;
            updates.push(format!("insurance_expiry = ${}", param_count));
            params.push(insurance_expiry);
        }
        if let Some(ref allergies_encrypted) = allergies_encrypted {
            param_count += 1;
            updates.push(format!("allergies_encrypted = ${}", param_count));
            params.push(allergies_encrypted);
        }
        if let Some(ref conditions) = req.conditions {
            param_count += 1;
            updates.push(format!("conditions = ${}", param_count));
            params.push(conditions);
        }
        if let Some(ref medications) = req.medications {
            param_count += 1;
            updates.push(format!("medications = ${}", param_count));
            params.push(medications);
        }
        if let Some(ref alerts) = req.alerts {
            param_count += 1;
            updates.push(format!("alerts = ${}", param_count));
            params.push(alerts);
        }
        if let Some(status) = req.status {
            param_count += 1;
            updates.push(format!("status = ${}", param_count));
            let status_str = status.to_string();
            owned_strings.push(status_str);
            params.push(owned_strings.last().unwrap());
        }
        if let Some(ref doctor) = req.doctor {
            param_count += 1;
            updates.push(format!("doctor = ${}", param_count));
            params.push(doctor);
        }
        if let Some(ref notes) = req.notes {
            param_count += 1;
            updates.push(format!("follow_up_notes = ${}", param_count));
            params.push(notes);
        }

        param_count += 1;
        params.push(&patient_id);

        let query = format!(
            "UPDATE patients SET {} WHERE id = ${} RETURNING *",
            updates.join(", "),
            param_count
        );

        let row = client.query_one(&query, &params).await?;
        
        Ok(self.row_to_patient(&row))
    }

    pub async fn soft_delete_patient(&self, patient_id: &str) -> Result<(), AppError> {
        let client = self.db.pool().get().await?;
        
        client.execute(
            r#"
            UPDATE patients 
            SET deleted_at = $1
            WHERE id = $2
            "#,
            &[&Utc::now(), &patient_id],
        ).await?;

        Ok(())
    }

    pub async fn search_patients(&self, search_term: &str) -> Result<Vec<Patient>, AppError> {
        let client = self.db.pool().get().await?;
        
        let search_pattern = format!("%{}%", search_term);
        
        let rows = client.query(
            r#"
            SELECT id, first_name, last_name, name, dob, age, gender, blood_group,
                   phone_encrypted, email_encrypted, address_encrypted, nationality,
                   emergency_name_encrypted, emergency_relation, emergency_phone_encrypted,
                   insurer, policy_number_encrypted, insurance_expiry, insurance_status,
                   allergies_encrypted, conditions, medications, alerts, status, doctor,
                   last_visit, next_appointment, follow_up_date, follow_up_reason,
                   follow_up_staff, follow_up_priority, follow_up_status, call_attempts,
                   last_contacted, follow_up_notes, phone_verified, insurance_verified,
                   id_verified, consent_signed, documents_complete, timeline, documents,
                   notes, family, consents, flags, created_at, updated_at
            FROM patients
            WHERE deleted_at IS NULL
            AND (name ILIKE $1 OR doctor ILIKE $1 OR id ILIKE $1)
            ORDER BY created_at DESC
            LIMIT 50
            "#,
            &[&search_pattern],
        ).await?;

        let patients = rows.iter().map(|row| self.row_to_patient(row)).collect();
        
        Ok(patients)
    }

    fn row_to_patient(&self, row: &Row) -> Patient {
        Patient {
            id: row.get("id"),
            first_name: row.get("first_name"),
            last_name: row.get("last_name"),
            name: row.get("name"),
            dob: row.get("dob"),
            age: row.get("age"),
            gender: match row.get::<&str, _>("gender") {
                "Male" => Gender::Male,
                "Female" => Gender::Female,
                _ => Gender::Other,
            },
            blood_group: match row.get::<&str, _>("blood_group") {
                "A+" => BloodGroup::APlus,
                "A-" => BloodGroup::AMinus,
                "B+" => BloodGroup::BPlus,
                "B-" => BloodGroup::BMinus,
                "O+" => BloodGroup::OPlus,
                "O-" => BloodGroup::OMinus,
                "AB+" => BloodGroup::ABPlus,
                "AB-" => BloodGroup::ABMinus,
                _ => BloodGroup::OPlus,
            },
            phone_encrypted: row.get("phone_encrypted"),
            email_encrypted: row.get("email_encrypted"),
            address_encrypted: row.get("address_encrypted"),
            nationality: row.get("nationality"),
            emergency_name_encrypted: row.get("emergency_name_encrypted"),
            emergency_relation: row.get("emergency_relation"),
            emergency_phone_encrypted: row.get("emergency_phone_encrypted"),
            insurer: row.get("insurer"),
            policy_number_encrypted: row.get("policy_number_encrypted"),
            insurance_expiry: row.get("insurance_expiry"),
            insurance_status: match row.get::<&str, _>("insurance_status") {
                "Active" => InsuranceStatus::Active,
                "Expiring" => InsuranceStatus::Expiring,
                "Expired" => InsuranceStatus::Expired,
                _ => InsuranceStatus::None,
            },
            allergies_encrypted: row.get("allergies_encrypted"),
            conditions: row.get("conditions"),
            medications: row.get("medications"),
            alerts: Vec::new(),
            status: match row.get::<&str, _>("status") {
                "New" => PatientStatus::New,
                "Active" => PatientStatus::Active,
                "Follow-Up Due" => PatientStatus::FollowUpDue,
                "Under Treatment" => PatientStatus::UnderTreatment,
                "Observation" => PatientStatus::Observation,
                "Inactive" => PatientStatus::Inactive,
                "VIP" => PatientStatus::VIP,
                "Archived" => PatientStatus::Archived,
                _ => PatientStatus::New,
            },
            doctor: row.get("doctor"),
            last_visit: row.get("last_visit"),
            next_appointment: row.get("next_appointment"),
            follow_up_date: row.get("follow_up_date"),
            follow_up_reason: row.get("follow_up_reason"),
            follow_up_staff: row.get("follow_up_staff"),
            follow_up_priority: match row.get("follow_up_priority") {
                "High" => Some(FollowUpPriority::High),
                "Medium" => Some(FollowUpPriority::Medium),
                "Low" => Some(FollowUpPriority::Low),
                _ => None,
            },
            follow_up_status: match row.get("follow_up_status") {
                "Pending" => Some(FollowUpStatus::Pending),
                "Called" => Some(FollowUpStatus::Called),
                "No Answer" => Some(FollowUpStatus::NoAnswer),
                "Completed" => Some(FollowUpStatus::Completed),
                _ => None,
            },
            call_attempts: row.get("call_attempts"),
            last_contacted: row.get("last_contacted"),
            follow_up_notes: row.get("follow_up_notes"),
            phone_verified: row.get("phone_verified"),
            insurance_verified: row.get("insurance_verified"),
            id_verified: row.get("id_verified"),
            consent_signed: row.get("consent_signed"),
            documents_complete: row.get("documents_complete"),
            timeline: serde_json::from_str(row.get::<&str, _>("timeline")).unwrap_or_default(),
            documents: serde_json::from_str(row.get::<&str, _>("documents")).unwrap_or_default(),
            notes: serde_json::from_str(row.get::<&str, _>("notes")).unwrap_or_default(),
            family: serde_json::from_str(row.get::<&str, _>("family")).unwrap_or_default(),
            consents: serde_json::from_str(row.get::<&str, _>("consents")).unwrap_or_default(),
            flags: serde_json::from_str(row.get::<&str, _>("flags")).unwrap_or_default(),
            created_at: chrono::DateTime::parse_from_rfc3339(row.get::<&str, _>("created_at")).map(|dt| dt.to_utc()).unwrap_or_else(|_| Utc::now()),
            updated_at: chrono::DateTime::parse_from_rfc3339(row.get::<&str, _>("updated_at")).map(|dt| dt.to_utc()).unwrap_or_else(|_| Utc::now()),
        }
    }

    fn calculate_age(&self, dob: &str) -> i32 {
        match chrono::NaiveDate::parse_from_str(dob, "%Y-%m-%d") {
            Ok(dob_date) => {
                let today = chrono::Utc::now().date_naive();
                let years = today.year() - dob_date.year();
                if today.month() < dob_date.month() || 
                   (today.month() == dob_date.month() && today.day() < dob_date.day()) {
                    years - 1
                } else {
                    years
                }
            }
            Err(_) => 0,
        }
    }
}

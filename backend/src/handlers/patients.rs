use actix_web::{web, HttpResponse, Responder};
use crate::models::{CreatePatientRequest, UpdatePatientRequest, Patient};
use crate::services::{PatientService, AuditService};
use crate::encryption::EncryptionService;
use crate::error::{not_found_error, validation_error, AppError};
use validator::Validate;
use tracing::{info, error};
use uuid::Uuid;

pub async fn list_patients(
    query: web::Query<std::collections::HashMap<String, String>>,
    patient_service: web::Data<PatientService>,
    encryption_service: web::Data<EncryptionService>,
) -> Result<HttpResponse> {
    let limit = query.get("limit")
        .and_then(|l| l.parse::<i64>().ok())
        .unwrap_or(20);
    let offset = query.get("offset")
        .and_then(|o| o.parse::<i64>().ok())
        .unwrap_or(0);

    let patients = patient_service.list_patients(limit, offset).await?;
    
    // Decrypt sensitive fields before sending to frontend
    let decrypted_patients: Vec<serde_json::Value> = patients
        .into_iter()
        .map(|p| decrypt_patient_for_api(p, &encryption_service))
        .collect();
    
    Ok(HttpResponse::Ok().json(decrypted_patients))
}

pub async fn get_patient(
    path: web::Path<String>,
    patient_service: web::Data<PatientService>,
    encryption_service: web::Data<EncryptionService>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    let patient = patient_service.get_patient(&patient_id).await?
        .ok_or_else(|| not_found_error("Patient"))?;
    
    let decrypted = decrypt_patient_for_api(patient, &encryption_service);
    Ok(HttpResponse::Ok().json(decrypted))
}

pub async fn create_patient(
    req: web::Json<CreatePatientRequest>,
    patient_service: web::Data<PatientService>,
    encryption_service: web::Data<EncryptionService>,
    audit_service: web::Data<AuditService>,
) -> Result<HttpResponse> {
    // Validate request
    if let Err(e) = req.validate() {
        return Err(validation_error(&format!("Invalid patient data: {}", e)).into());
    }

    // Encrypt sensitive fields
    let phone_encrypted = encryption_service.encrypt_phone(&req.phone)?;
    let email_encrypted = req.email.as_ref()
        .map(|e| encryption_service.encrypt(e))
        .transpose()?
        .map(|s| s.into_bytes());
    let address_encrypted = req.address.as_ref()
        .map(|a| encryption_service.encrypt(a))
        .transpose()?
        .map(|s| s.into_bytes());
    let emergency_name_encrypted = req.emergency_name.as_ref()
        .map(|n| encryption_service.encrypt(n))
        .transpose()?
        .map(|s| s.into_bytes());
    let emergency_phone_encrypted = req.emergency_phone.as_ref()
        .map(|p| encryption_service.encrypt_phone(p))
        .transpose()?;
    let policy_number_encrypted = req.policy_number.as_ref()
        .map(|p| encryption_service.encrypt(p))
        .transpose()?
        .map(|s| s.into_bytes());
    let allergies_encrypted = req.allergies.as_ref()
        .map(|a| encryption_service.encrypt(a))
        .transpose()?
        .map(|s| s.into_bytes());

    // Generate patient ID
    let patient_id = format!("CLN-{:05}", rand::random::<u32>() % 90000 + 10000);

    // Create patient
    let patient = patient_service.create_patient(
        patient_id,
        req.into_inner(),
        phone_encrypted,
        email_encrypted,
        address_encrypted,
        emergency_name_encrypted,
        emergency_phone_encrypted,
        policy_number_encrypted,
        allergies_encrypted,
    ).await?;

    // Log audit entry
    let _ = audit_service.log_action(
        None,
        "create",
        "patient",
        Some(patient.id.clone()),
        None,
        Some(serde_json::to_value(&patient).unwrap_or_default()),
    ).await;

    info!("Patient created: {}", patient.id);

    let decrypted = decrypt_patient_for_api(patient, &encryption_service);
    Ok(HttpResponse::Created().json(decrypted))
}

pub async fn update_patient(
    path: web::Path<String>,
    req: web::Json<UpdatePatientRequest>,
    patient_service: web::Data<PatientService>,
    encryption_service: web::Data<EncryptionService>,
    audit_service: web::Data<AuditService>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    // Validate request
    if let Err(e) = req.validate() {
        return Err(validation_error(&format!("Invalid patient data: {}", e)).into());
    }

    // Get existing patient
    let existing = patient_service.get_patient(&patient_id).await?
        .ok_or_else(|| not_found_error("Patient"))?;

    // Encrypt sensitive fields if provided
    let phone_encrypted = req.phone.as_ref()
        .map(|p| encryption_service.encrypt_phone(p))
        .transpose()?;
    let email_encrypted = req.email.as_ref()
        .map(|e| encryption_service.encrypt(e))
        .transpose()?
        .map(|s| s.into_bytes());
    let address_encrypted = req.address.as_ref()
        .map(|a| encryption_service.encrypt(a))
        .transpose()?
        .map(|s| s.into_bytes());
    let emergency_name_encrypted = req.emergency_name.as_ref()
        .map(|n| encryption_service.encrypt(n))
        .transpose()?
        .map(|s| s.into_bytes());
    let emergency_phone_encrypted = req.emergency_phone.as_ref()
        .map(|p| encryption_service.encrypt_phone(p))
        .transpose()?;
    let policy_number_encrypted = req.policy_number.as_ref()
        .map(|p| encryption_service.encrypt(p))
        .transpose()?
        .map(|s| s.into_bytes());
    let allergies_encrypted = req.allergies.as_ref()
        .map(|a| encryption_service.encrypt(a))
        .transpose()?
        .map(|s| s.into_bytes());

    // Update patient
    let updated = patient_service.update_patient(
        patient_id,
        req.into_inner(),
        phone_encrypted,
        email_encrypted,
        address_encrypted,
        emergency_name_encrypted,
        emergency_phone_encrypted,
        policy_number_encrypted,
        allergies_encrypted,
    ).await?;

    // Log audit entry
    let _ = audit_service.log_action(
        None,
        "update",
        "patient",
        Some(updated.id.clone()),
        Some(serde_json::to_value(&existing).unwrap_or_default()),
        Some(serde_json::to_value(&updated).unwrap_or_default()),
    ).await;

    info!("Patient updated: {}", updated.id);

    let decrypted = decrypt_patient_for_api(updated, &encryption_service);
    Ok(HttpResponse::Ok().json(decrypted))
}

pub async fn delete_patient(
    path: web::Path<String>,
    patient_service: web::Data<PatientService>,
    audit_service: web::Data<AuditService>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    // Soft delete (HIPAA compliance - don't actually delete, just mark as deleted)
    patient_service.soft_delete_patient(&patient_id).await?;

    // Log audit entry
    let _ = audit_service.log_action(
        None,
        "delete",
        "patient",
        Some(patient_id.clone()),
        None,
        None,
    ).await;

    info!("Patient soft-deleted: {}", patient_id);

    Ok(HttpResponse::NoContent().finish())
}

pub async fn search_patients(
    query: web::Query<std::collections::HashMap<String, String>>,
    patient_service: web::Data<PatientService>,
    encryption_service: web::Data<EncryptionService>,
) -> Result<HttpResponse> {
    let search_term = query.get("q").unwrap_or(&String::new()).clone();

    let patients = patient_service.search_patients(&search_term).await?;

    let decrypted_patients: Vec<serde_json::Value> = patients
        .into_iter()
        .map(|p| decrypt_patient_for_api(p, &encryption_service))
        .collect();

    Ok(HttpResponse::Ok().json(decrypted_patients))
}

pub async fn import_patients(
    req: web::Json<Vec<CreatePatientRequest>>,
    patient_service: web::Data<PatientService>,
    encryption_service: web::Data<EncryptionService>,
    audit_service: web::Data<AuditService>,
) -> Result<HttpResponse> {
    let mut imported_count = 0;
    let mut errors: Vec<String> = Vec::new();

    for patient_req in req.into_inner() {
        match create_patient_internal(
            patient_req,
            &patient_service,
            &encryption_service,
            &audit_service,
        ).await {
            Ok(_) => imported_count += 1,
            Err(e) => errors.push(format!("Import failed: {}", e)),
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "imported": imported_count,
        "errors": errors
    })))
}

async fn create_patient_internal(
    req: CreatePatientRequest,
    patient_service: &PatientService,
    encryption_service: &EncryptionService,
    audit_service: &AuditService,
) -> Result<Patient, AppError> {
    // Encrypt sensitive fields
    let phone_encrypted = encryption_service.encrypt_phone(&req.phone)?;
    let email_encrypted = req.email.as_ref()
        .map(|e| encryption_service.encrypt(e))
        .transpose()?
        .map(|s| s.into_bytes());
    let address_encrypted = req.address.as_ref()
        .map(|a| encryption_service.encrypt(a))
        .transpose()?
        .map(|s| s.into_bytes());
    let emergency_name_encrypted = req.emergency_name.as_ref()
        .map(|n| encryption_service.encrypt(n))
        .transpose()?
        .map(|s| s.into_bytes());
    let emergency_phone_encrypted = req.emergency_phone.as_ref()
        .map(|p| encryption_service.encrypt_phone(p))
        .transpose()?;
    let policy_number_encrypted = req.policy_number.as_ref()
        .map(|p| encryption_service.encrypt(p))
        .transpose()?
        .map(|s| s.into_bytes());
    let allergies_encrypted = req.allergies.as_ref()
        .map(|a| encryption_service.encrypt(a))
        .transpose()?
        .map(|s| s.into_bytes());

    let patient_id = format!("CLN-{:05}", rand::random::<u32>() % 90000 + 10000);

    let patient = patient_service.create_patient(
        patient_id,
        req,
        phone_encrypted,
        email_encrypted,
        address_encrypted,
        emergency_name_encrypted,
        emergency_phone_encrypted,
        policy_number_encrypted,
        allergies_encrypted,
    ).await?;

    let _ = audit_service.log_action(
        None,
        "import",
        "patient",
        Some(patient.id.clone()),
        None,
        Some(serde_json::to_value(&patient).unwrap_or_default()),
    ).await;

    Ok(patient)
}

fn decrypt_patient_for_api(patient: Patient, encryption_service: &EncryptionService) -> serde_json::Value {
    let mut json = serde_json::to_value(&patient).unwrap_or_default();
    
    // Decrypt sensitive fields for API response
    if let Ok(phone) = encryption_service.decrypt_phone(&patient.phone_encrypted) {
        json["phone"] = serde_json::Value::String(phone);
    }
    
    if let Some(email_encrypted) = patient.email_encrypted.as_deref() {
        if let Ok(email) = encryption_service.decrypt(&String::from_utf8_lossy(email_encrypted)) {
            json["email"] = serde_json::Value::String(email);
        }
    }
    
    if let Some(address_encrypted) = patient.address_encrypted.as_deref() {
        if let Ok(address) = encryption_service.decrypt(&String::from_utf8_lossy(address_encrypted)) {
            json["address"] = serde_json::Value::String(address);
        }
    }
    
    // Remove encrypted fields from response
    json["phone_encrypted"] = serde_json::Value::Null;
    json["email_encrypted"] = serde_json::Value::Null;
    json["address_encrypted"] = serde_json::Value::Null;
    
    json
}

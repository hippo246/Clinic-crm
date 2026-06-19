use actix_web::{web, HttpResponse, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;
use deadpool_postgres::Pool;
use crate::models::{
    Appointment, CreateAppointmentRequest, UpdateAppointmentRequest, AppointmentType, AppointmentStatus,
    Consultation, CreateConsultationRequest, UpdateConsultationRequest, ConsultationStatus,
    Prescription, CreatePrescriptionRequest, UpdatePrescriptionRequest,
    Invoice, CreateInvoiceRequest, UpdateInvoiceRequest, InvoiceItem, InvoiceItemRequest, InvoiceStatus,
    Communication, CreateCommunicationRequest, CommunicationType, CommunicationStatus,
    FollowUp, CreateFollowUpRequest, UpdateFollowUpRequest, FollowUpType,
    Consent, CreateConsentRequest, ConsentStatus,
};
use crate::error::AppError;

// ============================================================================
// Appointment Handlers
// ============================================================================

pub async fn create_appointment(
    req: web::Json<CreateAppointmentRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let appointment = Appointment {
        id: Uuid::new_v4(),
        patient_id: req.patient_id.clone(),
        doctor_id: req.doctor_id,
        appointment_date: req.appointment_date.parse().unwrap_or_else(|_| Utc::now()),
        duration_minutes: req.duration_minutes,
        appointment_type: req.appointment_type,
        reason: req.reason.clone(),
        notes: req.notes.clone(),
        status: AppointmentStatus::Scheduled,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query = r#"
        INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, duration_minutes, appointment_type, reason, notes, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
    "#;

    client.execute(
        query,
        &[
            &appointment.id,
            &appointment.patient_id,
            &appointment.doctor_id,
            &appointment.appointment_date,
            &appointment.duration_minutes,
            &appointment.appointment_type,
            &appointment.reason,
            &appointment.notes,
            &appointment.status,
            &appointment.created_at,
            &appointment.updated_at,
        ],
    ).await.map_err(|e| {
        eprintln!("Failed to create appointment: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Created().json(appointment))
}

pub async fn get_appointments(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM appointments WHERE patient_id = $1 ORDER BY appointment_date DESC"
    } else {
        "SELECT * FROM appointments ORDER BY appointment_date DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch appointments: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch appointments: {}", e);
            AppError::Postgres(e)
        })?
    };

    let appointments: Vec<Appointment> = rows.iter().map(|row| Appointment {
        id: row.get("id"),
        patient_id: row.get("patient_id"),
        doctor_id: row.get("doctor_id"),
        appointment_date: row.get("appointment_date"),
        duration_minutes: row.get("duration_minutes"),
        appointment_type: row.get("appointment_type"),
        reason: row.get("reason"),
        notes: row.get("notes"),
        status: row.get("status"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();
    
    Ok(HttpResponse::Ok().json(appointments))
}

pub async fn update_appointment(
    path: web::Path<Uuid>,
    req: web::Json<UpdateAppointmentRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();
    
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let mut updates = vec![];
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
    let mut param_count = 1;

    if let Some(date) = &req.appointment_date {
        updates.push(format!("appointment_date = ${}", param_count));
        params.push(date as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(duration) = req.duration_minutes {
        updates.push(format!("duration_minutes = ${}", param_count));
        params.push(&duration);
        param_count += 1;
    }
    if let Some(appt_type) = req.appointment_type {
        updates.push(format!("appointment_type = ${}", param_count));
        params.push(&appt_type);
        param_count += 1;
    }
    if let Some(reason) = &req.reason {
        updates.push(format!("reason = ${}", param_count));
        params.push(reason as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(notes) = &req.notes {
        updates.push(format!("notes = ${}", param_count));
        params.push(notes as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(status) = req.status {
        updates.push(format!("status = ${}", param_count));
        params.push(&status);
        param_count += 1;
    }

    updates.push(format!("updated_at = ${}", param_count));
    params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
    param_count += 1;

    params.push(&appointment_id as &(dyn tokio_postgres::types::ToSql + Sync));

    let query = format!(
        "UPDATE appointments SET {} WHERE id = ${}",
        updates.join(", "),
        param_count
    );

    client.execute(&query, &params[..]).await.map_err(|e| {
        eprintln!("Failed to update appointment: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Appointment updated",
        "id": appointment_id
    })))
}

pub async fn cancel_appointment(
    path: web::Path<Uuid>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    client.execute(
        "UPDATE appointments SET status = 'Cancelled', updated_at = $1 WHERE id = $2",
        &[&Utc::now(), &appointment_id],
    ).await.map_err(|e| {
        eprintln!("Failed to cancel appointment: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Appointment cancelled",
        "id": appointment_id
    })))
}

// ============================================================================
// Consultation Handlers
// ============================================================================

pub async fn create_consultation(
    req: web::Json<CreateConsultationRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let consultation = Consultation {
        id: Uuid::new_v4(),
        patient_id: req.patient_id.clone(),
        doctor_id: req.doctor_id,
        appointment_id: req.appointment_id,
        start_time: Utc::now(),
        end_time: None,
        vitals: req.vitals.clone(),
        chief_complaint: req.chief_complaint.clone(),
        history_of_present_illness: req.history_of_present_illness.clone(),
        physical_examination: req.physical_examination.clone(),
        diagnosis: req.diagnosis.clone(),
        treatment_plan: req.treatment_plan.clone(),
        follow_up_instructions: req.follow_up_instructions.clone(),
        status: ConsultationStatus::InProgress,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query = r#"
        INSERT INTO consultations (id, patient_id, doctor_id, appointment_id, start_time, end_time, vitals, chief_complaint, history_of_present_illness, physical_examination, diagnosis, treatment_plan, follow_up_instructions, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
    "#;

    client.execute(
        query,
        &[
            &consultation.id,
            &consultation.patient_id,
            &consultation.doctor_id,
            &consultation.appointment_id,
            &consultation.start_time,
            &consultation.end_time,
            &consultation.vitals,
            &consultation.chief_complaint,
            &consultation.history_of_present_illness,
            &consultation.physical_examination,
            &consultation.diagnosis,
            &consultation.treatment_plan,
            &consultation.follow_up_instructions,
            &consultation.status,
            &consultation.created_at,
            &consultation.updated_at,
        ],
    ).await.map_err(|e| {
        eprintln!("Failed to create consultation: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Created().json(consultation))
}

pub async fn get_consultations(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM consultations WHERE patient_id = $1 ORDER BY start_time DESC"
    } else {
        "SELECT * FROM consultations ORDER BY start_time DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch consultations: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch consultations: {}", e);
            AppError::Postgres(e)
        })?
    };

    let consultations: Vec<Consultation> = rows.iter().map(|row| Consultation {
        id: row.get("id"),
        patient_id: row.get("patient_id"),
        doctor_id: row.get("doctor_id"),
        appointment_id: row.get("appointment_id"),
        start_time: row.get("start_time"),
        end_time: row.get("end_time"),
        vitals: row.get("vitals"),
        chief_complaint: row.get("chief_complaint"),
        history_of_present_illness: row.get("history_of_present_illness"),
        physical_examination: row.get("physical_examination"),
        diagnosis: row.get("diagnosis"),
        treatment_plan: row.get("treatment_plan"),
        follow_up_instructions: row.get("follow_up_instructions"),
        status: row.get("status"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();
    
    Ok(HttpResponse::Ok().json(consultations))
}

pub async fn update_consultation(
    path: web::Path<Uuid>,
    req: web::Json<UpdateConsultationRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let consultation_id = path.into_inner();

    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let mut updates = vec![];
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
    let mut param_count = 1;

    if let Some(end_time) = &req.end_time {
        updates.push(format!("end_time = ${}", param_count));
        params.push(end_time as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(vitals) = &req.vitals {
        updates.push(format!("vitals = ${}", param_count));
        params.push(vitals as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(diagnosis) = &req.diagnosis {
        updates.push(format!("diagnosis = ${}", param_count));
        params.push(diagnosis as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(treatment_plan) = &req.treatment_plan {
        updates.push(format!("treatment_plan = ${}", param_count));
        params.push(treatment_plan as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(follow_up_instructions) = &req.follow_up_instructions {
        updates.push(format!("follow_up_instructions = ${}", param_count));
        params.push(follow_up_instructions as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(status) = req.status {
        updates.push(format!("status = ${}", param_count));
        params.push(&status);
        param_count += 1;
    }

    updates.push(format!("updated_at = ${}", param_count));
    params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
    param_count += 1;

    params.push(&consultation_id as &(dyn tokio_postgres::types::ToSql + Sync));

    let query = format!(
        "UPDATE consultations SET {} WHERE id = ${}",
        updates.join(", "),
        param_count
    );

    client.execute(&query, &params[..]).await.map_err(|e| {
        eprintln!("Failed to update consultation: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Consultation updated",
        "id": consultation_id
    })))
}

pub async fn complete_consultation(
    path: web::Path<Uuid>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let consultation_id = path.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    client.execute(
        "UPDATE consultations SET status = 'Completed', end_time = $1, updated_at = $2 WHERE id = $3",
        &[&Utc::now(), &Utc::now(), &consultation_id],
    ).await.map_err(|e| {
        eprintln!("Failed to complete consultation: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Consultation completed",
        "id": consultation_id
    })))
}

// ============================================================================
// Prescription Handlers
// ============================================================================

pub async fn create_prescriptions(
    req: web::Json<serde_json::Value>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let prescriptions_data = req.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let prescriptions = if let Some(prescriptions_array) = prescriptions_data.as_array() {
        prescriptions_array.iter().map(|p| {
            let prescription_req: CreatePrescriptionRequest = serde_json::from_value(p.clone()).unwrap_or_else(|_| CreatePrescriptionRequest {
                patient_id: String::new(),
                doctor_id: None,
                consultation_id: None,
                medication_name: String::new(),
                dosage: String::new(),
                frequency: String::new(),
                route: String::new(),
                duration: String::new(),
                instructions: None,
                refills: 0,
            });
            
            Prescription {
                id: Uuid::new_v4(),
                patient_id: prescription_req.patient_id,
                doctor_id: prescription_req.doctor_id,
                consultation_id: prescription_req.consultation_id,
                medication_name: prescription_req.medication_name,
                dosage: prescription_req.dosage,
                frequency: prescription_req.frequency,
                route: prescription_req.route,
                duration: prescription_req.duration,
                instructions: prescription_req.instructions,
                refills: prescription_req.refills,
                dispensed: false,
                dispensed_date: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }
        }).collect::<Vec<Prescription>>()
    } else {
        vec![]
    };

    for prescription in &prescriptions {
        let query = r#"
            INSERT INTO prescriptions (id, patient_id, doctor_id, consultation_id, medication_name, dosage, frequency, route, duration, instructions, refills, dispensed, dispensed_date, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        "#;

        client.execute(
            query,
            &[
                &prescription.id,
                &prescription.patient_id,
                &prescription.doctor_id,
                &prescription.consultation_id,
                &prescription.medication_name,
                &prescription.dosage,
                &prescription.frequency,
                &prescription.route,
                &prescription.duration,
                &prescription.instructions,
                &prescription.refills,
                &prescription.dispensed,
                &prescription.dispensed_date,
                &prescription.created_at,
                &prescription.updated_at,
            ],
        ).await.map_err(|e| {
            eprintln!("Failed to create prescription: {}", e);
            AppError::Postgres(e)
        })?;
    }

    Ok(HttpResponse::Created().json(prescriptions))
}

pub async fn get_prescriptions(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC"
    } else {
        "SELECT * FROM prescriptions ORDER BY created_at DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch prescriptions: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch prescriptions: {}", e);
            AppError::Postgres(e)
        })?
    };

    let prescriptions: Vec<Prescription> = rows.iter().map(|row| Prescription {
        id: row.get("id"),
        patient_id: row.get("patient_id"),
        doctor_id: row.get("doctor_id"),
        consultation_id: row.get("consultation_id"),
        medication_name: row.get("medication_name"),
        dosage: row.get("dosage"),
        frequency: row.get("frequency"),
        route: row.get("route"),
        duration: row.get("duration"),
        instructions: row.get("instructions"),
        refills: row.get("refills"),
        dispensed: row.get("dispensed"),
        dispensed_date: row.get("dispensed_date"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();
    
    Ok(HttpResponse::Ok().json(prescriptions))
}

pub async fn update_prescription(
    path: web::Path<Uuid>,
    req: web::Json<UpdatePrescriptionRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let prescription_id = path.into_inner();
    
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let mut updates = vec![];
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
    let mut param_count = 1;

    if let Some(dosage) = &req.dosage {
        updates.push(format!("dosage = ${}", param_count));
        params.push(dosage as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(frequency) = &req.frequency {
        updates.push(format!("frequency = ${}", param_count));
        params.push(frequency as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(route) = &req.route {
        updates.push(format!("route = ${}", param_count));
        params.push(route as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(duration) = &req.duration {
        updates.push(format!("duration = ${}", param_count));
        params.push(duration as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(instructions) = &req.instructions {
        updates.push(format!("instructions = ${}", param_count));
        params.push(instructions as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(refills) = req.refills {
        updates.push(format!("refills = ${}", param_count));
        params.push(&refills);
        param_count += 1;
    }
    if let Some(dispensed) = req.dispensed {
        updates.push(format!("dispensed = ${}", param_count));
        params.push(&dispensed);
        param_count += 1;
        if dispensed {
            updates.push(format!("dispensed_date = ${}", param_count));
            params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
            param_count += 1;
        }
    }

    updates.push(format!("updated_at = ${}", param_count));
    params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
    param_count += 1;

    params.push(&prescription_id as &(dyn tokio_postgres::types::ToSql + Sync));

    let query = format!(
        "UPDATE prescriptions SET {} WHERE id = ${}",
        updates.join(", "),
        param_count
    );

    client.execute(&query, &params[..]).await.map_err(|e| {
        eprintln!("Failed to update prescription: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Prescription updated",
        "id": prescription_id
    })))
}

pub async fn dispense_prescription(
    path: web::Path<Uuid>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let prescription_id = path.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    client.execute(
        "UPDATE prescriptions SET dispensed = true, dispensed_date = $1, updated_at = $2 WHERE id = $3",
        &[&Utc::now(), &Utc::now(), &prescription_id],
    ).await.map_err(|e| {
        eprintln!("Failed to dispense prescription: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Prescription dispensed",
        "id": prescription_id
    })))
}

// ============================================================================
// Invoice Handlers
// ============================================================================

pub async fn create_invoice(
    req: web::Json<CreateInvoiceRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let tax_rate = req.tax_rate.unwrap_or(0.0);
    let subtotal: f64 = req.items.iter().map(|item| item.quantity as f64 * item.unit_price).sum();
    let tax = subtotal * (tax_rate / 100.0);
    let total = subtotal + tax;

    let invoice_items: Vec<InvoiceItem> = req.items.iter().map(|item| InvoiceItem {
        id: Uuid::new_v4(),
        description: item.description.clone(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity as f64 * item.unit_price,
    }).collect();

    let items_json = serde_json::to_value(&invoice_items).unwrap_or(serde_json::Value::Null);

    let invoice = Invoice {
        id: Uuid::new_v4(),
        patient_id: req.patient_id.clone(),
        invoice_number: req.invoice_number.clone(),
        invoice_date: req.invoice_date.parse().unwrap_or_else(|_| Utc::now()),
        due_date: req.due_date.parse().unwrap_or_else(|_| Utc::now()),
        items: invoice_items,
        subtotal,
        tax,
        total,
        notes: req.notes.clone(),
        status: InvoiceStatus::Draft,
        paid_date: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query = r#"
        INSERT INTO invoices (id, patient_id, invoice_number, invoice_date, due_date, items, subtotal, tax, total, notes, status, paid_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
    "#;

    client.execute(
        query,
        &[
            &invoice.id,
            &invoice.patient_id,
            &invoice.invoice_number,
            &invoice.invoice_date,
            &invoice.due_date,
            &items_json,
            &invoice.subtotal,
            &invoice.tax,
            &invoice.total,
            &invoice.notes,
            &invoice.status,
            &invoice.paid_date,
            &invoice.created_at,
            &invoice.updated_at,
        ],
    ).await.map_err(|e| {
        eprintln!("Failed to create invoice: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Created().json(invoice))
}

pub async fn get_invoices(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM invoices WHERE patient_id = $1 ORDER BY invoice_date DESC"
    } else {
        "SELECT * FROM invoices ORDER BY invoice_date DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch invoices: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch invoices: {}", e);
            AppError::Postgres(e)
        })?
    };

    let invoices: Vec<Invoice> = rows.iter().map(|row| {
        let items_json: serde_json::Value = row.get("items");
        let items: Vec<InvoiceItem> = serde_json::from_value(items_json).unwrap_or_default();
        
        Invoice {
            id: row.get("id"),
            patient_id: row.get("patient_id"),
            invoice_number: row.get("invoice_number"),
            invoice_date: row.get("invoice_date"),
            due_date: row.get("due_date"),
            items,
            subtotal: row.get("subtotal"),
            tax: row.get("tax"),
            total: row.get("total"),
            notes: row.get("notes"),
            status: row.get("status"),
            paid_date: row.get("paid_date"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }
    }).collect();
    
    Ok(HttpResponse::Ok().json(invoices))
}

pub async fn update_invoice(
    path: web::Path<Uuid>,
    req: web::Json<UpdateInvoiceRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let mut updates = vec![];
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
    let mut param_count = 1;

    if let Some(due_date) = &req.due_date {
        updates.push(format!("due_date = ${}", param_count));
        params.push(due_date as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(items) = &req.items {
        let subtotal: f64 = items.iter().map(|item| item.quantity as f64 * item.unit_price).sum();
        let items_json = serde_json::to_value(items).unwrap_or(serde_json::Value::Null);
        updates.push(format!("items = ${}", param_count));
        params.push(&items_json as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
        updates.push(format!("subtotal = ${}", param_count));
        params.push(&subtotal as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(tax_rate) = req.tax_rate {
        updates.push(format!("tax = ${}", param_count));
        params.push(&tax_rate as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(notes) = &req.notes {
        updates.push(format!("notes = ${}", param_count));
        params.push(notes as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(status) = req.status {
        updates.push(format!("status = ${}", param_count));
        params.push(&status);
        param_count += 1;
        if status == InvoiceStatus::Paid {
            updates.push(format!("paid_date = ${}", param_count));
            params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
            param_count += 1;
        }
    }

    updates.push(format!("updated_at = ${}", param_count));
    params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
    param_count += 1;

    params.push(&invoice_id as &(dyn tokio_postgres::types::ToSql + Sync));

    let query = format!(
        "UPDATE invoices SET {} WHERE id = ${}",
        updates.join(", "),
        param_count
    );

    client.execute(&query, &params[..]).await.map_err(|e| {
        eprintln!("Failed to update invoice: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Invoice updated",
        "id": invoice_id
    })))
}

pub async fn mark_invoice_paid(
    path: web::Path<Uuid>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    client.execute(
        "UPDATE invoices SET status = 'Paid', paid_date = $1, updated_at = $2 WHERE id = $3",
        &[&Utc::now(), &Utc::now(), &invoice_id],
    ).await.map_err(|e| {
        eprintln!("Failed to mark invoice as paid: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Invoice marked as paid",
        "id": invoice_id
    })))
}

// ============================================================================
// Communication Handlers
// ============================================================================

pub async fn send_communication(
    req: web::Json<CreateCommunicationRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let communication = Communication {
        id: Uuid::new_v4(),
        patient_id: req.patient_id.clone(),
        staff_id: req.staff_id,
        message_type: req.message_type,
        recipient: req.recipient.clone(),
        subject: req.subject.clone(),
        message: req.message.clone(),
        status: CommunicationStatus::Pending,
        sent_at: None,
        created_at: Utc::now(),
    };

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query = r#"
        INSERT INTO communications (id, patient_id, staff_id, message_type, recipient, subject, message, status, sent_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
    "#;

    client.execute(
        query,
        &[
            &communication.id,
            &communication.patient_id,
            &communication.staff_id,
            &communication.message_type,
            &communication.recipient,
            &communication.subject,
            &communication.message,
            &communication.status,
            &communication.sent_at,
            &communication.created_at,
        ],
    ).await.map_err(|e| {
        eprintln!("Failed to create communication: {}", e);
        AppError::Postgres(e)
    })?;

    // TODO: Send actual communication (SMS/Email) via external service
    // For now, mark as sent
    client.execute(
        "UPDATE communications SET status = 'Sent', sent_at = $1 WHERE id = $2",
        &[&Utc::now(), &communication.id],
    ).await.map_err(|e| {
        eprintln!("Failed to update communication status: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Created().json(communication))
}

pub async fn get_communication_history(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();
    
    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM communications WHERE patient_id = $1 ORDER BY created_at DESC"
    } else {
        "SELECT * FROM communications ORDER BY created_at DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch communications: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch communications: {}", e);
            AppError::Postgres(e)
        })?
    };

    let communications: Vec<Communication> = rows.iter().map(|row| Communication {
        id: row.get("id"),
        patient_id: row.get("patient_id"),
        staff_id: row.get("staff_id"),
        message_type: row.get("message_type"),
        recipient: row.get("recipient"),
        subject: row.get("subject"),
        message: row.get("message"),
        status: row.get("status"),
        sent_at: row.get("sent_at"),
        created_at: row.get("created_at"),
    }).collect();
    
    Ok(HttpResponse::Ok().json(communications))
}

// ============================================================================
// Follow-up Handlers
// ============================================================================

pub async fn schedule_follow_up(
    req: web::Json<CreateFollowUpRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let follow_up = FollowUp {
        id: Uuid::new_v4(),
        patient_id: req.patient_id.clone(),
        staff_id: req.staff_id,
        follow_up_date: req.follow_up_date.parse().unwrap_or_else(|_| Utc::now()),
        follow_up_type: req.follow_up_type,
        reason: req.reason.clone(),
        notes: req.notes.clone(),
        reminder_days: req.reminder_days,
        status: crate::models::FollowUpStatus::Pending,
        completed_date: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query = r#"
        INSERT INTO follow_ups (id, patient_id, staff_id, follow_up_date, follow_up_type, reason, notes, reminder_days, status, completed_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
    "#;

    client.execute(
        query,
        &[
            &follow_up.id,
            &follow_up.patient_id,
            &follow_up.staff_id,
            &follow_up.follow_up_date,
            &follow_up.follow_up_type,
            &follow_up.reason,
            &follow_up.notes,
            &follow_up.reminder_days,
            &follow_up.status,
            &follow_up.completed_date,
            &follow_up.created_at,
            &follow_up.updated_at,
        ],
    ).await.map_err(|e| {
        eprintln!("Failed to create follow-up: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Created().json(follow_up))
}

pub async fn get_follow_ups(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM follow_ups WHERE patient_id = $1 ORDER BY follow_up_date DESC"
    } else {
        "SELECT * FROM follow_ups ORDER BY follow_up_date DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch follow-ups: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch follow-ups: {}", e);
            AppError::Postgres(e)
        })?
    };

    let follow_ups: Vec<FollowUp> = rows.iter().map(|row| FollowUp {
        id: row.get("id"),
        patient_id: row.get("patient_id"),
        staff_id: row.get("staff_id"),
        follow_up_date: row.get("follow_up_date"),
        follow_up_type: row.get("follow_up_type"),
        reason: row.get("reason"),
        notes: row.get("notes"),
        reminder_days: row.get("reminder_days"),
        status: row.get("status"),
        completed_date: row.get("completed_date"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();
    
    Ok(HttpResponse::Ok().json(follow_ups))
}

pub async fn update_follow_up(
    path: web::Path<Uuid>,
    req: web::Json<UpdateFollowUpRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let follow_up_id = path.into_inner();
    
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let mut updates = vec![];
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
    let mut param_count = 1;

    if let Some(follow_up_date) = &req.follow_up_date {
        updates.push(format!("follow_up_date = ${}", param_count));
        params.push(follow_up_date as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(follow_up_type) = req.follow_up_type {
        updates.push(format!("follow_up_type = ${}", param_count));
        params.push(&follow_up_type);
        param_count += 1;
    }
    if let Some(reason) = &req.reason {
        updates.push(format!("reason = ${}", param_count));
        params.push(reason as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(notes) = &req.notes {
        updates.push(format!("notes = ${}", param_count));
        params.push(notes as &(dyn tokio_postgres::types::ToSql + Sync));
        param_count += 1;
    }
    if let Some(reminder_days) = req.reminder_days {
        updates.push(format!("reminder_days = ${}", param_count));
        params.push(&reminder_days);
        param_count += 1;
    }
    if let Some(status) = req.status {
        updates.push(format!("status = ${}", param_count));
        params.push(&status);
        param_count += 1;
        if status == crate::models::FollowUpStatus::Completed {
            updates.push(format!("completed_date = ${}", param_count));
            params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
            param_count += 1;
        }
    }

    updates.push(format!("updated_at = ${}", param_count));
    params.push(&Utc::now() as &(dyn tokio_postgres::types::ToSql + Sync));
    param_count += 1;

    params.push(&follow_up_id as &(dyn tokio_postgres::types::ToSql + Sync));

    let query = format!(
        "UPDATE follow_ups SET {} WHERE id = ${}",
        updates.join(", "),
        param_count
    );

    client.execute(&query, &params[..]).await.map_err(|e| {
        eprintln!("Failed to update follow-up: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Follow-up updated",
        "id": follow_up_id
    })))
}

pub async fn complete_follow_up(
    path: web::Path<Uuid>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let follow_up_id = path.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    client.execute(
        "UPDATE follow_ups SET status = 'Completed', completed_date = $1, updated_at = $2 WHERE id = $3",
        &[&Utc::now(), &Utc::now(), &follow_up_id],
    ).await.map_err(|e| {
        eprintln!("Failed to complete follow-up: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Follow-up completed",
        "id": follow_up_id
    })))
}

// ============================================================================
// Consent Handlers
// ============================================================================

pub async fn create_consent(
    req: web::Json<CreateConsentRequest>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    if let Err(errors) = req.validate() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "details": errors
        })));
    }

    let consent = Consent {
        id: Uuid::new_v4(),
        patient_id: req.patient_id.clone(),
        consent_type: req.consent_type.clone(),
        witness_name: req.witness_name.clone(),
        witness_signature: req.witness_signature,
        signed_at: Utc::now(),
        status: ConsentStatus::Signed,
        expires_at: None,
        created_at: Utc::now(),
    };

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query = r#"
        INSERT INTO consents (id, patient_id, consent_type, witness_name, witness_signature, signed_at, status, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
    "#;

    client.execute(
        query,
        &[
            &consent.id,
            &consent.patient_id,
            &consent.consent_type,
            &consent.witness_name,
            &consent.witness_signature,
            &consent.signed_at,
            &consent.status,
            &consent.expires_at,
            &consent.created_at,
        ],
    ).await.map_err(|e| {
        eprintln!("Failed to create consent: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Created().json(consent))
}

pub async fn get_consents(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let patient_id = query.get("patient_id").cloned();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    let query_str = if let Some(pid) = patient_id {
        "SELECT * FROM consents WHERE patient_id = $1 ORDER BY signed_at DESC"
    } else {
        "SELECT * FROM consents ORDER BY signed_at DESC"
    };

    let rows = if let Some(pid) = patient_id {
        client.query(query_str, &[&pid]).await.map_err(|e| {
            eprintln!("Failed to fetch consents: {}", e);
            AppError::Postgres(e)
        })?
    } else {
        client.query(query_str, &[]).await.map_err(|e| {
            eprintln!("Failed to fetch consents: {}", e);
            AppError::Postgres(e)
        })?
    };

    let consents: Vec<Consent> = rows.iter().map(|row| Consent {
        id: row.get("id"),
        patient_id: row.get("patient_id"),
        consent_type: row.get("consent_type"),
        witness_name: row.get("witness_name"),
        witness_signature: row.get("witness_signature"),
        signed_at: row.get("signed_at"),
        status: row.get("status"),
        expires_at: row.get("expires_at"),
        created_at: row.get("created_at"),
    }).collect();
    
    Ok(HttpResponse::Ok().json(consents))
}

pub async fn sign_consent(
    path: web::Path<Uuid>,
    pool: web::Data<Pool>,
) -> Result<HttpResponse> {
    let consent_id = path.into_inner();

    let client = pool.get().await.map_err(|e| {
        eprintln!("Database connection error: {}", e);
        AppError::Pool(e)
    })?;

    client.execute(
        "UPDATE consents SET status = 'Signed', signed_at = $1 WHERE id = $2",
        &[&Utc::now(), &consent_id.to_string()],
    ).await.map_err(|e| {
        eprintln!("Failed to sign consent: {}", e);
        AppError::Postgres(e)
    })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Consent signed",
        "id": consent_id
    })))
}

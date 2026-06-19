use actix_web::{web, HttpResponse, Responder, multipart};
use actix_multipart::Multipart;
use futures_util::TryStreamExt;
use crate::encryption::EncryptionService;
use crate::services::AuditService;
use crate::error::{validation_error, AppError};
use tracing::{info, warn};
use uuid::Uuid;
use std::io::Write;
use validator::Validate;

// Allowed file types for medical documents
const ALLOWED_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "dicom", "dcm"
];

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB

#[derive(serde::Deserialize, Validate)]
pub struct FileUploadRequest {
    #[validate(length(min = 1, max = 255))]
    pub patient_id: String,
    #[validate(length(min = 1, max = 100))]
    pub document_type: String,
}

pub async fn upload_file(
    mut payload: Multipart,
    encryption_service: web::Data<EncryptionService>,
    audit_service: web::Data<AuditService>,
) -> impl Responder {
    let mut file_data: Vec<u8> = Vec::new();
    let mut filename = String::new();
    let mut content_type = String::new();
    let mut patient_id = String::new();
    let mut document_type = String::new();
    let mut total_size = 0;

    while let Some(field) = payload.try_next().await.map_err(|e| {
        validation_error(&format!("Failed to read multipart field: {}", e))
    })? {
        let content_disposition = field.content_disposition();
        let field_name = content_disposition.get_name().unwrap_or("");

        match field_name {
            "file" => {
                filename = content_disposition
                    .get_filename()
                    .unwrap_or("unknown")
                    .to_string();
                content_type = field
                    .content_type()
                    .map(|ct| ct.to_string())
                    .unwrap_or_else(|| "application/octet-stream".to_string());

                // Validate file extension
                if let Some(ext) = filename.split('.').last() {
                    if !ALLOWED_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                        return Err(validation_error(&format!(
                            "Invalid file type: {}. Allowed types: {:?}",
                            ext, ALLOWED_EXTENSIONS
                        )).into());
                    }
                }

                // Read file data with size limit
                while let Some(chunk) = field.try_next().await.map_err(|e| {
                    validation_error(&format!("Failed to read file chunk: {}", e))
                })? {
                    total_size += chunk.len();
                    if total_size > MAX_FILE_SIZE {
                        return Err(validation_error(&format!(
                            "File size exceeds limit of {} bytes",
                            MAX_FILE_SIZE
                        )).into());
                    }
                    file_data.extend_from_slice(&chunk);
                }
            }
            "patient_id" => {
                let bytes = field.try_next().await.map_err(|e| {
                    validation_error(&format!("Failed to read patient_id: {}", e))
                })?
                .ok_or_else(|| validation_error("Missing patient_id"))?;
                patient_id = String::from_utf8(bytes.to_vec())
                    .map_err(|_| validation_error("Invalid patient_id encoding"))?;
            }
            "document_type" => {
                let bytes = field.try_next().await.map_err(|e| {
                    validation_error(&format!("Failed to read document_type: {}", e))
                })?
                .ok_or_else(|| validation_error("Missing document_type"))?;
                document_type = String::from_utf8(bytes.to_vec())
                    .map_err(|_| validation_error("Invalid document_type encoding"))?;
            }
            _ => {
                warn!("Ignoring unknown field: {}", field_name);
            }
        }
    }

    // Validate required fields
    if patient_id.is_empty() {
        return Err(validation_error("patient_id is required").into());
    }
    if document_type.is_empty() {
        return Err(validation_error("document_type is required").into());
    }
    if file_data.is_empty() {
        return Err(validation_error("No file data provided").into());
    }

    // Encrypt file data
    let encrypted_data = encryption_service.encrypt(&String::from_utf8_lossy(&file_data))
        .map_err(|e| AppError::Encryption(format!("Failed to encrypt file: {}", e)))?;

    // Generate secure filename
    let file_id = Uuid::new_v4().to_string();
    let secure_filename = format!("{}_{}", file_id, filename);
    let file_path = format!("./uploads/{}", secure_filename);

    // Create uploads directory if it doesn't exist
    std::fs::create_dir_all("./uploads")
        .map_err(|e| AppError::Internal(format!("Failed to create uploads directory: {}", e)))?;

    // Write encrypted file to disk
    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| AppError::Internal(format!("Failed to create file: {}", e)))?;
    file.write_all(encrypted_data.as_bytes())
        .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;

    // Log audit entry
    let _ = audit_service.log_action(
        None,
        "upload",
        "document",
        Some(patient_id.clone()),
        None,
        Some(serde_json::json!({
            "file_id": file_id,
            "filename": filename,
            "document_type": document_type,
            "size": total_size,
            "content_type": content_type
        })),
    ).await;

    info!("File uploaded successfully: {} for patient {}", secure_filename, patient_id);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "file_id": file_id,
        "filename": secure_filename,
        "original_filename": filename,
        "document_type": document_type,
        "size": total_size,
        "content_type": content_type,
        "patient_id": patient_id,
        "uploaded_at": chrono::Utc::now().to_rfc3339()
    })))
}

pub async fn download_file(
    path: web::Path<String>,
    encryption_service: web::Data<EncryptionService>,
) -> impl Responder {
    let file_id = path.into_inner();
    
    // Find file by ID (simplified - in production, query database)
    let file_path = format!("./uploads/{}", file_id);
    
    // Check if file exists
    if !std::path::Path::new(&file_path).exists() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    // Read encrypted file
    let encrypted_data = std::fs::read(&file_path)
        .map_err(|e| AppError::Internal(format!("Failed to read file: {}", e)))?;

    // Decrypt file data
    let decrypted_data = encryption_service.decrypt(&String::from_utf8_lossy(&encrypted_data))
        .map_err(|e| AppError::Encryption(format!("Failed to decrypt file: {}", e)))?;

    // Determine content type based on file extension
    let content_type = if file_id.ends_with(".pdf") {
        "application/pdf"
    } else if file_id.ends_with(".jpg") || file_id.ends_with(".jpeg") {
        "image/jpeg"
    } else if file_id.ends_with(".png") {
        "image/png"
    } else {
        "application/octet-stream"
    };

    info!("File downloaded: {}", file_id);

    Ok(HttpResponse::Ok()
        .content_type(content_type)
        .body(decrypted_data))
}

pub async fn delete_file(
    path: web::Path<String>,
    audit_service: web::Data<AuditService>,
) -> impl Responder {
    let file_id = path.into_inner();
    
    // Find file by ID (simplified - in production, query database)
    let file_path = format!("./uploads/{}", file_id);
    
    // Check if file exists
    if !std::path::Path::new(&file_path).exists() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    // Delete file
    std::fs::remove_file(&file_path)
        .map_err(|e| AppError::Internal(format!("Failed to delete file: {}", e)))?;

    // Log audit entry
    let _ = audit_service.log_action(
        None,
        "delete",
        "document",
        Some(file_id.clone()),
        None,
        None,
    ).await;

    info!("File deleted: {}", file_id);

    Ok(HttpResponse::NoContent().finish())
}

pub async fn list_files(
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let patient_id = query.get("patient_id").cloned().unwrap_or_default();
    
    // List files in uploads directory (simplified - in production, query database)
    let uploads_dir = "./uploads";
    let mut files = Vec::new();

    if let Ok(entries) = std::fs::read_dir(uploads_dir) {
        for entry in entries.flatten() {
            if let Ok(filename) = entry.file_name().into_string() {
                if patient_id.is_empty() || filename.contains(&patient_id) {
                    if let Ok(metadata) = entry.metadata() {
                        files.push(serde_json::json!({
                            "filename": filename,
                            "size": metadata.len(),
                            "modified": metadata.modified().ok().map(|t| {
                                chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
                            })
                        }));
                    }
                }
            }
        }
    }

    Ok(HttpResponse::Ok().json(files))
}

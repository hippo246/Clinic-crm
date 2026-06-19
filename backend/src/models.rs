use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use validator::Validate;
use secrecy::{Secret, ExposeSecret};

// User models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
    pub mfa_enabled: bool,
    pub last_login: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8))]
    pub password: String,
    pub mfa_token: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3))]
    pub username: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8))]
    pub password: String,
    pub role: UserRole,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: User,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct MfaVerifyRequest {
    pub token: String,
}

// Patient models
#[derive(Debug, Serialize, Deserialize, Clone, Validate)]
pub struct Patient {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub name: String,
    pub dob: String,
    pub age: i32,
    pub gender: Gender,
    pub blood_group: BloodGroup,
    #[serde(skip_serializing)] // Phone is encrypted, don't expose in API
    pub phone_encrypted: Vec<u8>,
    #[serde(skip_serializing)]
    pub email_encrypted: Option<Vec<u8>>,
    #[serde(skip_serializing)]
    pub address_encrypted: Option<Vec<u8>>,
    pub nationality: String,
    #[serde(skip_serializing)]
    pub emergency_name_encrypted: Option<Vec<u8>>,
    pub emergency_relation: String,
    #[serde(skip_serializing)]
    pub emergency_phone_encrypted: Option<Vec<u8>>,
    pub insurer: String,
    #[serde(skip_serializing)]
    pub policy_number_encrypted: Option<Vec<u8>>,
    pub insurance_expiry: Option<String>,
    pub insurance_status: InsuranceStatus,
    #[serde(skip_serializing)]
    pub allergies_encrypted: Option<Vec<u8>>,
    pub conditions: Vec<String>,
    pub medications: Vec<String>,
    pub alerts: Vec<AlertType>,
    pub status: PatientStatus,
    pub doctor: String,
    pub last_visit: Option<String>,
    pub next_appointment: Option<String>,
    pub follow_up_date: Option<String>,
    pub follow_up_reason: Option<String>,
    pub follow_up_staff: Option<String>,
    pub follow_up_priority: Option<FollowUpPriority>,
    pub follow_up_status: Option<FollowUpStatus>,
    pub call_attempts: i32,
    pub last_contacted: Option<DateTime<Utc>>,
    pub follow_up_notes: Option<String>,
    pub phone_verified: bool,
    pub insurance_verified: bool,
    pub id_verified: bool,
    pub consent_signed: bool,
    pub documents_complete: bool,
    pub timeline: Vec<TimelineEvent>,
    pub documents: Vec<PatientDocument>,
    pub notes: Vec<PatientNote>,
    pub family: Vec<FamilyMember>,
    pub consents: serde_json::Value,
    pub flags: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePatientRequest {
    #[validate(length(min = 1))]
    pub first_name: String,
    #[validate(length(min = 1))]
    pub last_name: String,
    #[validate(length(min = 10))]
    pub dob: String,
    pub gender: Gender,
    pub blood_group: BloodGroup,
    #[validate(length(min = 10))]
    pub phone: String,
    #[validate(email)]
    pub email: Option<String>,
    pub address: Option<String>,
    pub nationality: Option<String>,
    pub emergency_name: Option<String>,
    pub emergency_relation: Option<String>,
    pub emergency_phone: Option<String>,
    pub insurer: Option<String>,
    pub policy_number: Option<String>,
    pub insurance_expiry: Option<String>,
    pub allergies: Option<String>,
    pub conditions: Option<Vec<String>>,
    pub medications: Option<Vec<String>>,
    pub alerts: Option<Vec<AlertType>>,
    pub doctor: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePatientRequest {
    #[validate(length(min = 1))]
    pub first_name: Option<String>,
    #[validate(length(min = 1))]
    pub last_name: Option<String>,
    pub phone: Option<String>,
    #[validate(email)]
    pub email: Option<String>,
    pub address: Option<String>,
    pub emergency_name: Option<String>,
    pub emergency_relation: Option<String>,
    pub emergency_phone: Option<String>,
    pub insurer: Option<String>,
    pub policy_number: Option<String>,
    pub insurance_expiry: Option<String>,
    pub allergies: Option<String>,
    pub conditions: Option<Vec<String>>,
    pub medications: Option<Vec<String>>,
    pub alerts: Option<Vec<AlertType>>,
    pub status: Option<PatientStatus>,
    pub doctor: Option<String>,
    pub notes: Option<String>,
}

// Audit log models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: Uuid,
    pub patient_id: Option<String>,
    pub user_id: Option<Uuid>,
    pub username: Option<String>,
    pub action: String,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub severity: AuditSeverity,
}

#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    pub patient_id: Option<String>,
    pub user_id: Option<Uuid>,
    pub action: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// Enums
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Doctor,
    Receptionist,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Admin => write!(f, "Admin"),
            UserRole::Doctor => write!(f, "Doctor"),
            UserRole::Receptionist => write!(f, "Receptionist"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum Gender {
    Male,
    Female,
    Other,
}

impl std::fmt::Display for Gender {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Gender::Male => write!(f, "Male"),
            Gender::Female => write!(f, "Female"),
            Gender::Other => write!(f, "Other"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum BloodGroup {
    APlus,
    AMinus,
    BPlus,
    BMinus,
    OPlus,
    OMinus,
    ABPlus,
    ABMinus,
}

impl std::fmt::Display for BloodGroup {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BloodGroup::APlus => write!(f, "A+"),
            BloodGroup::AMinus => write!(f, "A-"),
            BloodGroup::BPlus => write!(f, "B+"),
            BloodGroup::BMinus => write!(f, "B-"),
            BloodGroup::OPlus => write!(f, "O+"),
            BloodGroup::OMinus => write!(f, "O-"),
            BloodGroup::ABPlus => write!(f, "AB+"),
            BloodGroup::ABMinus => write!(f, "AB-"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum InsuranceStatus {
    Active,
    Expiring,
    Expired,
    None,
}

impl std::fmt::Display for InsuranceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InsuranceStatus::Active => write!(f, "Active"),
            InsuranceStatus::Expiring => write!(f, "Expiring"),
            InsuranceStatus::Expired => write!(f, "Expired"),
            InsuranceStatus::None => write!(f, "None"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum PatientStatus {
    New,
    Active,
    FollowUpDue,
    UnderTreatment,
    Observation,
    Inactive,
    VIP,
    Archived,
}

impl std::fmt::Display for PatientStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PatientStatus::New => write!(f, "New"),
            PatientStatus::Active => write!(f, "Active"),
            PatientStatus::FollowUpDue => write!(f, "Follow-Up Due"),
            PatientStatus::UnderTreatment => write!(f, "Under Treatment"),
            PatientStatus::Observation => write!(f, "Observation"),
            PatientStatus::Inactive => write!(f, "Inactive"),
            PatientStatus::VIP => write!(f, "VIP"),
            PatientStatus::Archived => write!(f, "Archived"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum AlertType {
    Allergy,
    Diabetic,
    Hypertension,
    HeartCondition,
    Pregnancy,
    HighRisk,
}

impl std::fmt::Display for AlertType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AlertType::Allergy => write!(f, "Allergy"),
            AlertType::Diabetic => write!(f, "Diabetic"),
            AlertType::Hypertension => write!(f, "Hypertension"),
            AlertType::HeartCondition => write!(f, "HeartCondition"),
            AlertType::Pregnancy => write!(f, "Pregnancy"),
            AlertType::HighRisk => write!(f, "HighRisk"),
        }
    }
}

impl tokio_postgres::types::ToSql for AlertType {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum FollowUpPriority {
    High,
    Medium,
    Low,
}

impl std::fmt::Display for FollowUpPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FollowUpPriority::High => write!(f, "High"),
            FollowUpPriority::Medium => write!(f, "Medium"),
            FollowUpPriority::Low => write!(f, "Low"),
        }
    }
}

impl tokio_postgres::types::ToSql for FollowUpPriority {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum FollowUpStatus {
    Pending,
    Called,
    NoAnswer,
    Completed,
}

impl std::fmt::Display for FollowUpStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FollowUpStatus::Pending => write!(f, "Pending"),
            FollowUpStatus::Called => write!(f, "Called"),
            FollowUpStatus::NoAnswer => write!(f, "No Answer"),
            FollowUpStatus::Completed => write!(f, "Completed"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for FollowUpStatus {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Pending" => Ok(FollowUpStatus::Pending),
            "Called" => Ok(FollowUpStatus::Called),
            "No Answer" => Ok(FollowUpStatus::NoAnswer),
            "Completed" => Ok(FollowUpStatus::Completed),
            _ => Err(format!("Unknown FollowUpStatus: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for FollowUpStatus {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum AuditSeverity {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

impl std::fmt::Display for AuditSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditSeverity::Debug => write!(f, "Debug"),
            AuditSeverity::Info => write!(f, "Info"),
            AuditSeverity::Warning => write!(f, "Warning"),
            AuditSeverity::Error => write!(f, "Error"),
            AuditSeverity::Critical => write!(f, "Critical"),
        }
    }
}

impl tokio_postgres::types::ToSql for AuditSeverity {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

// Sub-models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub label: String,
    pub icon: String,
    pub color: String,
    pub date: DateTime<Utc>,
    pub note: Option<String>,
    pub doctor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatientDocument {
    pub id: String,
    #[serde(rename = "type")]
    pub doc_type: String,
    pub uploaded: DateTime<Utc>,
    pub size: String,
    pub verified: Option<bool>,
    pub expiry: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatientNote {
    pub id: String,
    pub text: String,
    pub pinned: bool,
    pub date: DateTime<Utc>,
    pub category: Option<String>,
    pub author: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FamilyMember {
    pub id: String,
    pub name: String,
    pub relation: String,
    pub patient_id: String,
}

// JWT Claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub username: String,
    pub role: UserRole,
    pub exp: i64,
    pub iat: i64,
    pub jti: String, // JWT ID for token revocation
}

// Medical Workflow Models

// Appointment
#[derive(Debug, Serialize, Deserialize, Clone, Validate)]
pub struct Appointment {
    pub id: Uuid,
    pub patient_id: String,
    pub doctor_id: Option<Uuid>,
    pub appointment_date: DateTime<Utc>,
    pub duration_minutes: i32,
    pub appointment_type: AppointmentType,
    pub reason: String,
    pub notes: Option<String>,
    pub status: AppointmentStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAppointmentRequest {
    pub patient_id: String,
    pub doctor_id: Option<Uuid>,
    #[validate(length(min = 1))]
    pub appointment_date: String,
    #[validate(range(min = 15, max = 480))]
    pub duration_minutes: i32,
    pub appointment_type: AppointmentType,
    #[validate(length(min = 1))]
    pub reason: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateAppointmentRequest {
    pub appointment_date: Option<String>,
    pub duration_minutes: Option<i32>,
    pub appointment_type: Option<AppointmentType>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub status: Option<AppointmentStatus>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum AppointmentType {
    Checkup,
    Consultation,
    FollowUp,
    Emergency,
    Surgery,
    LabTest,
    Imaging,
    Therapy,
}

impl std::fmt::Display for AppointmentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppointmentType::Checkup => write!(f, "Checkup"),
            AppointmentType::Consultation => write!(f, "Consultation"),
            AppointmentType::FollowUp => write!(f, "Follow Up"),
            AppointmentType::Emergency => write!(f, "Emergency"),
            AppointmentType::Surgery => write!(f, "Surgery"),
            AppointmentType::LabTest => write!(f, "Lab Test"),
            AppointmentType::Imaging => write!(f, "Imaging"),
            AppointmentType::Therapy => write!(f, "Therapy"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for AppointmentType {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Checkup" => Ok(AppointmentType::Checkup),
            "Consultation" => Ok(AppointmentType::Consultation),
            "Follow Up" => Ok(AppointmentType::FollowUp),
            "Emergency" => Ok(AppointmentType::Emergency),
            "Surgery" => Ok(AppointmentType::Surgery),
            "Lab Test" => Ok(AppointmentType::LabTest),
            "Imaging" => Ok(AppointmentType::Imaging),
            "Therapy" => Ok(AppointmentType::Therapy),
            _ => Err(format!("Unknown AppointmentType: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for AppointmentType {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum AppointmentStatus {
    Scheduled,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
    NoShow,
}

impl std::fmt::Display for AppointmentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppointmentStatus::Scheduled => write!(f, "Scheduled"),
            AppointmentStatus::Confirmed => write!(f, "Confirmed"),
            AppointmentStatus::InProgress => write!(f, "In Progress"),
            AppointmentStatus::Completed => write!(f, "Completed"),
            AppointmentStatus::Cancelled => write!(f, "Cancelled"),
            AppointmentStatus::NoShow => write!(f, "No Show"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for AppointmentStatus {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Scheduled" => Ok(AppointmentStatus::Scheduled),
            "Confirmed" => Ok(AppointmentStatus::Confirmed),
            "In Progress" => Ok(AppointmentStatus::InProgress),
            "Completed" => Ok(AppointmentStatus::Completed),
            "Cancelled" => Ok(AppointmentStatus::Cancelled),
            "No Show" => Ok(AppointmentStatus::NoShow),
            _ => Err(format!("Unknown AppointmentStatus: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for AppointmentStatus {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

// Consultation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Consultation {
    pub id: Uuid,
    pub patient_id: String,
    pub doctor_id: Option<Uuid>,
    pub appointment_id: Option<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub vitals: Option<serde_json::Value>,
    pub chief_complaint: String,
    pub history_of_present_illness: Option<String>,
    pub physical_examination: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub follow_up_instructions: Option<String>,
    pub status: ConsultationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateConsultationRequest {
    pub patient_id: String,
    pub doctor_id: Option<Uuid>,
    pub appointment_id: Option<Uuid>,
    #[validate(length(min = 1))]
    pub chief_complaint: String,
    pub vitals: Option<serde_json::Value>,
    pub history_of_present_illness: Option<String>,
    pub physical_examination: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub follow_up_instructions: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateConsultationRequest {
    pub end_time: Option<String>,
    pub vitals: Option<serde_json::Value>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub follow_up_instructions: Option<String>,
    pub status: Option<ConsultationStatus>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum ConsultationStatus {
    InProgress,
    Completed,
    Discharged,
}

impl std::fmt::Display for ConsultationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConsultationStatus::InProgress => write!(f, "In Progress"),
            ConsultationStatus::Completed => write!(f, "Completed"),
            ConsultationStatus::Discharged => write!(f, "Discharged"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for ConsultationStatus {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "In Progress" => Ok(ConsultationStatus::InProgress),
            "Completed" => Ok(ConsultationStatus::Completed),
            "Discharged" => Ok(ConsultationStatus::Discharged),
            _ => Err(format!("Unknown ConsultationStatus: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for ConsultationStatus {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

// Prescription
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prescription {
    pub id: Uuid,
    pub patient_id: String,
    pub doctor_id: Option<Uuid>,
    pub consultation_id: Option<Uuid>,
    pub medication_name: String,
    pub dosage: String,
    pub frequency: String,
    pub route: String,
    pub duration: String,
    pub instructions: Option<String>,
    pub refills: i32,
    pub dispensed: bool,
    pub dispensed_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePrescriptionRequest {
    pub patient_id: String,
    pub doctor_id: Option<Uuid>,
    pub consultation_id: Option<Uuid>,
    #[validate(length(min = 1))]
    pub medication_name: String,
    #[validate(length(min = 1))]
    pub dosage: String,
    #[validate(length(min = 1))]
    pub frequency: String,
    #[validate(length(min = 1))]
    pub route: String,
    #[validate(length(min = 1))]
    pub duration: String,
    pub instructions: Option<String>,
    #[validate(range(min = 0, max = 12))]
    pub refills: i32,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePrescriptionRequest {
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub route: Option<String>,
    pub duration: Option<String>,
    pub instructions: Option<String>,
    pub refills: Option<i32>,
    pub dispensed: Option<bool>,
}

// Invoice
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Invoice {
    pub id: Uuid,
    pub patient_id: String,
    pub invoice_number: String,
    pub invoice_date: DateTime<Utc>,
    pub due_date: DateTime<Utc>,
    pub items: Vec<InvoiceItem>,
    pub subtotal: f64,
    pub tax: f64,
    pub total: f64,
    pub notes: Option<String>,
    pub status: InvoiceStatus,
    pub paid_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvoiceItem {
    pub id: Uuid,
    pub description: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total: f64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateInvoiceRequest {
    pub patient_id: String,
    #[validate(length(min = 1))]
    pub invoice_number: String,
    #[validate(length(min = 1))]
    pub invoice_date: String,
    #[validate(length(min = 1))]
    pub due_date: String,
    #[validate(length(min = 1))]
    pub items: Vec<InvoiceItemRequest>,
    pub tax_rate: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct InvoiceItemRequest {
    #[validate(length(min = 1))]
    pub description: String,
    #[validate(range(min = 1))]
    pub quantity: i32,
    #[validate(range(min = 0))]
    pub unit_price: f64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateInvoiceRequest {
    pub due_date: Option<String>,
    pub items: Option<Vec<InvoiceItemRequest>>,
    pub tax_rate: Option<f64>,
    pub notes: Option<String>,
    pub status: Option<InvoiceStatus>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum InvoiceStatus {
    Draft,
    Sent,
    PartiallyPaid,
    Paid,
    Overdue,
    Cancelled,
}

impl std::fmt::Display for InvoiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InvoiceStatus::Draft => write!(f, "Draft"),
            InvoiceStatus::Sent => write!(f, "Sent"),
            InvoiceStatus::PartiallyPaid => write!(f, "Partially Paid"),
            InvoiceStatus::Paid => write!(f, "Paid"),
            InvoiceStatus::Overdue => write!(f, "Overdue"),
            InvoiceStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for InvoiceStatus {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Draft" => Ok(InvoiceStatus::Draft),
            "Sent" => Ok(InvoiceStatus::Sent),
            "Partially Paid" => Ok(InvoiceStatus::PartiallyPaid),
            "Paid" => Ok(InvoiceStatus::Paid),
            "Overdue" => Ok(InvoiceStatus::Overdue),
            "Cancelled" => Ok(InvoiceStatus::Cancelled),
            _ => Err(format!("Unknown InvoiceStatus: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for InvoiceStatus {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

// Communication
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Communication {
    pub id: Uuid,
    pub patient_id: String,
    pub staff_id: Option<Uuid>,
    pub message_type: CommunicationType,
    pub recipient: String,
    pub subject: Option<String>,
    pub message: String,
    pub status: CommunicationStatus,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCommunicationRequest {
    pub patient_id: String,
    pub staff_id: Option<Uuid>,
    pub message_type: CommunicationType,
    #[validate(length(min = 1))]
    pub recipient: String,
    pub subject: Option<String>,
    #[validate(length(min = 1))]
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum CommunicationType {
    SMS,
    Email,
    PhoneCall,
}

impl std::fmt::Display for CommunicationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommunicationType::SMS => write!(f, "SMS"),
            CommunicationType::Email => write!(f, "Email"),
            CommunicationType::PhoneCall => write!(f, "Phone Call"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for CommunicationType {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "SMS" => Ok(CommunicationType::SMS),
            "Email" => Ok(CommunicationType::Email),
            "Phone Call" => Ok(CommunicationType::PhoneCall),
            _ => Err(format!("Unknown CommunicationType: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for CommunicationType {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum CommunicationStatus {
    Pending,
    Sent,
    Delivered,
    Failed,
}

impl std::fmt::Display for CommunicationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommunicationStatus::Pending => write!(f, "Pending"),
            CommunicationStatus::Sent => write!(f, "Sent"),
            CommunicationStatus::Delivered => write!(f, "Delivered"),
            CommunicationStatus::Failed => write!(f, "Failed"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for CommunicationStatus {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Pending" => Ok(CommunicationStatus::Pending),
            "Sent" => Ok(CommunicationStatus::Sent),
            "Delivered" => Ok(CommunicationStatus::Delivered),
            "Failed" => Ok(CommunicationStatus::Failed),
            _ => Err(format!("Unknown CommunicationStatus: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for CommunicationStatus {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

// Follow-up
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FollowUp {
    pub id: Uuid,
    pub patient_id: String,
    pub staff_id: Option<Uuid>,
    pub follow_up_date: DateTime<Utc>,
    pub follow_up_type: FollowUpType,
    pub reason: String,
    pub notes: Option<String>,
    pub reminder_days: Option<i32>,
    pub status: FollowUpStatus,
    pub completed_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFollowUpRequest {
    pub patient_id: String,
    pub staff_id: Option<Uuid>,
    #[validate(length(min = 1))]
    pub follow_up_date: String,
    pub follow_up_type: FollowUpType,
    #[validate(length(min = 1))]
    pub reason: String,
    pub notes: Option<String>,
    pub reminder_days: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateFollowUpRequest {
    pub follow_up_date: Option<String>,
    pub follow_up_type: Option<FollowUpType>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub reminder_days: Option<i32>,
    pub status: Option<FollowUpStatus>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum FollowUpType {
    PhoneCall,
    InPerson,
    VideoCall,
    LabTest,
    Imaging,
}

impl std::fmt::Display for FollowUpType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FollowUpType::PhoneCall => write!(f, "Phone Call"),
            FollowUpType::InPerson => write!(f, "In Person"),
            FollowUpType::VideoCall => write!(f, "Video Call"),
            FollowUpType::LabTest => write!(f, "Lab Test"),
            FollowUpType::Imaging => write!(f, "Imaging"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for FollowUpType {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Phone Call" => Ok(FollowUpType::PhoneCall),
            "In Person" => Ok(FollowUpType::InPerson),
            "Video Call" => Ok(FollowUpType::VideoCall),
            "Lab Test" => Ok(FollowUpType::LabTest),
            "Imaging" => Ok(FollowUpType::Imaging),
            _ => Err(format!("Unknown FollowUpType: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for FollowUpType {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

// Consent
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Consent {
    pub id: Uuid,
    pub patient_id: String,
    pub consent_type: String,
    pub witness_name: Option<String>,
    pub witness_signature: bool,
    pub signed_at: DateTime<Utc>,
    pub status: ConsentStatus,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateConsentRequest {
    pub patient_id: String,
    #[validate(length(min = 1))]
    pub consent_type: String,
    pub witness_name: Option<String>,
    pub witness_signature: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum ConsentStatus {
    Signed,
    Expired,
    Revoked,
}

impl std::fmt::Display for ConsentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConsentStatus::Signed => write!(f, "Signed"),
            ConsentStatus::Expired => write!(f, "Expired"),
            ConsentStatus::Revoked => write!(f, "Revoked"),
        }
    }
}

impl tokio_postgres::types::FromSql<'_> for ConsentStatus {
    fn from_sql<'a>(
        ty: &tokio_postgres::types::Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let s = <&str as tokio_postgres::types::FromSql>::from_sql(ty, raw)?;
        match s {
            "Signed" => Ok(ConsentStatus::Signed),
            "Expired" => Ok(ConsentStatus::Expired),
            "Revoked" => Ok(ConsentStatus::Revoked),
            _ => Err(format!("Unknown ConsentStatus: {}", s).into()),
        }
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::FromSql>::accepts(ty)
    }

    tokio_postgres::types::from_sql_checked!();
}

impl tokio_postgres::types::ToSql for ConsentStatus {
    fn to_sql<'a>(
        &'a self,
        ty: &tokio_postgres::types::Type,
        out: &mut bytes::BytesMut,
    ) -> Result<tokio_postgres::types::IsNull, Box<dyn std::error::Error + Sync + Send>>
    where
        Self: tokio_postgres::types::ToSql + Sized,
    {
        let s = self.to_string();
        <&str as tokio_postgres::types::ToSql>::to_sql(&s.as_str(), ty, out)
    }

    fn accepts(ty: &tokio_postgres::types::Type) -> bool {
        <&str as tokio_postgres::types::ToSql>::accepts(ty)
    }

    tokio_postgres::types::to_sql_checked!();
}

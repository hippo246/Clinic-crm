# Clinic CRM Architecture - Hybrid Firebase + Rust (On-Premises)

## Overview
Hybrid architecture combining Firebase authentication with a secure Rust backend for HIPAA-compliant medical data storage on clinic servers.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLINIC NETWORK                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   React      │    │  Firebase    │    │  Rust        │      │
│  │   Frontend   │◄──►│  Auth        │    │  Backend     │      │
│  │   (Clinic)   │    │  (Cloud)     │    │  (On-Prem)   │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│         │                                       │               │
│         │                                       │               │
│         │                                       ▼               │
│         │                              ┌──────────────┐         │
│         │                              │  PostgreSQL  │         │
│         │                              │  Database    │         │
│         │                              │  (Encrypted) │         │
│         │                              └──────────────┘         │
│         │                                       │               │
│         │                                       │               │
│         ▼                                       ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   File       │    │   Backup     │    │   Monitoring │      │
│  │   Storage    │    │   System     │    │   System     │      │
│  │  (Encrypted) │    │  (Encrypted) │    │  (Alerts)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### 1. React Frontend (Clinic)
- **Location**: Clinic workstations
- **Responsibilities**:
  - User interface for clinic staff
  - Firebase authentication integration
  - API communication with Rust backend
  - Real-time updates via Firebase (optional)
- **Security**: HTTPS only, Firebase auth tokens

### 2. Firebase Authentication (Cloud)
- **Location**: Google Cloud (managed service)
- **Responsibilities**:
  - User authentication (email/password, phone, SSO)
  - Multi-factor authentication (MFA)
  - Session management
  - Token generation and validation
- **Security**: Google's security infrastructure
- **HIPAA**: Requires BAA with Google

### 3. Rust Backend (On-Premises)
- **Location**: Clinic servers
- **Responsibilities**:
  - Business logic for patient management
  - Data encryption/decryption
  - Audit logging (HIPAA compliant)
  - API endpoint security
  - Rate limiting and validation
  - File upload handling
  - Monitoring and alerting
- **Security**: AES-256 encryption, TLS 1.3, RBAC

### 4. PostgreSQL Database (On-Premises)
- **Location**: Clinic servers
- **Responsibilities**:
  - Secure data storage
  - Encrypted patient records
  - Audit logs
  - Row-level security
- **Security**: Database encryption, access controls

## Data Flow

### Authentication Flow
```
1. User enters credentials in React frontend
2. Firebase validates credentials
3. Firebase returns JWT token
4. Frontend stores token securely
5. Frontend includes token in API requests
6. Rust backend validates Firebase token
7. Backend processes request
8. Backend returns data to frontend
```

### Patient Data Flow
```
1. Frontend requests patient data via API
2. Rust backend validates Firebase token
3. Backend checks RBAC permissions
4. Backend queries PostgreSQL
5. Backend decrypts sensitive fields
6. Backend returns encrypted data
7. Frontend displays data
```

### File Upload Flow
```
1. Frontend uploads file to Rust backend
2. Backend validates file type and size
3. Backend encrypts file with AES-256
4. Backend stores encrypted file on clinic server
5. Backend logs audit entry
6. Backend returns success to frontend
```

## API Endpoints

### Authentication (Firebase Integration)
- `POST /api/auth/firebase-login` - Validate Firebase token
- `POST /api/auth/refresh` - Refresh Firebase token
- `POST /api/auth/logout` - Logout user

### Patient Management
- `GET /api/patients` - List all patients (with RBAC)
- `POST /api/patients` - Create new patient
- `GET /api/patients/{id}` - Get patient details
- `PUT /api/patients/{id}` - Update patient
- `DELETE /api/patients/{id}` - Soft delete patient
- `GET /api/patients/search?q={query}` - Search patients

### File Management
- `POST /api/files/upload` - Upload encrypted file
- `GET /api/files/download/{file_id}` - Download decrypted file
- `DELETE /api/files/delete/{file_id}` - Delete file
- `GET /api/files` - List files

### Audit Logs (Admin Only)
- `GET /api/audit` - List audit logs
- `GET /api/audit/patient/{patient_id}` - Get patient audit trail

### Monitoring (Admin Only)
- `GET /api/monitoring/metrics` - System metrics
- `GET /api/monitoring/events` - Security events
- `GET /api/monitoring/health` - Health check

## PostgreSQL Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- admin, doctor, nurse, receptionist
    mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Patients Table
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(50) NOT NULL,
    blood_group VARCHAR(10),
    phone_encrypted TEXT NOT NULL, -- AES-256 encrypted
    email_encrypted TEXT, -- AES-256 encrypted
    address_encrypted TEXT, -- AES-256 encrypted
    doctor VARCHAR(255),
    insurer VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    risk_score INTEGER DEFAULT 0,
    next_appointment TIMESTAMP,
    follow_up_date TIMESTAMP,
    follow_up_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT
);
```

### Files Table
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100),
    document_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

## Security Architecture

### Encryption Strategy
- **At Rest**: AES-256-GCM for sensitive fields
- **In Transit**: TLS 1.3 for all communications
- **Passwords**: Firebase handles password hashing
- **Files**: AES-256 encryption before storage

### Access Control
- **Firebase Auth**: User authentication
- **RBAC**: Role-based permissions in Rust backend
- **Row-Level Security**: PostgreSQL RLS for data access
- **API Security**: Rate limiting, input validation

### HIPAA Compliance
- **Audit Logging**: All data access logged
- **Data Retention**: Configurable retention policies
- **Right to be Forgotten**: Soft delete implementation
- **Backup Encryption**: Encrypted automated backups
- **BAA Required**: Firebase BAA with Google

## Deployment Architecture

### Clinic Server Setup
```
┌─────────────────────────────────────────┐
│         Clinic Server (On-Premises)     │
│                                         │
│  ┌──────────────┐                      │
│  │  Nginx/SSL   │  (Port 443)          │
│  │  Termination │                      │
│  └──────┬───────┘                      │
│         │                               │
│         ▼                               │
│  ┌──────────────┐                      │
│  │  Rust        │  (Port 8080)         │
│  │  Backend     │                      │
│  └──────┬───────┘                      │
│         │                               │
│         ▼                               │
│  ┌──────────────┐                      │
│  │  PostgreSQL  │  (Port 5432)         │
│  │  Database    │                      │
│  └──────────────┘                      │
│                                         │
│  ┌──────────────┐                      │
│  │  File        │  (/uploads)          │
│  │  Storage     │                      │
│  └──────────────┘                      │
│                                         │
│  ┌──────────────┐                      │
│  │  Backup      │  (/backups)          │
│  │  Storage     │                      │
│  └──────────────┘                      │
└─────────────────────────────────────────┘
```

### Network Configuration
- **Internal Network**: Clinic LAN
- **Firewall**: Allow only necessary ports
- **SSL/TLS**: Certificates for clinic domain
- **VPN**: Remote access for authorized staff

## Firebase Integration Points

### 1. Authentication
```typescript
// Frontend Firebase Auth
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Login
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();

// Use token with Rust backend
const response = await fetch('/api/patients', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 2. Token Validation in Rust
```rust
// Rust backend validates Firebase token
use firebase_auth::FirebaseAuth;

async fn validate_firebase_token(token: &str) -> Result<User> {
    let auth = FirebaseAuth::new(&config.firebase_project_id)?;
    let decoded = auth.verify_id_token(token).await?;
    
    // Check if user exists in our database
    let user = db.get_user_by_firebase_uid(&decoded.uid).await?;
    Ok(user)
}
```

## Environment Variables

### Backend (.env)
```bash
# Server
HOST=127.0.0.1
PORT=8080

# Database
DATABASE_URL=postgresql://user:password@localhost/clinic_crm

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=path/to/service-account.json

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-aes-256-key

# SSL
SSL_CERT_PATH=/etc/ssl/certs/clinic.crt
SSL_KEY_PATH=/etc/ssl/private/clinic.key

# File Upload
MAX_FILE_SIZE=10485760  # 10MB

# Backup
BACKUP_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=365
```

### Frontend (.env)
```bash
VITE_API_URL=https://clinic.yourdomain.com/api
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

## Backup Strategy

### Automated Backups
- **Frequency**: Daily at 2 AM
- **Retention**: 90 days
- **Encryption**: AES-256
- **Storage**: Local backup server
- **Off-site**: Weekly encrypted backups to external drive

### Backup Process
```bash
# Database backup
pg_dump clinic_crm | gzip > /backups/db_$(date +%Y%m%d).sql.gz

# Encrypt backup
openssl enc -aes-256-cbc -salt -in backup.sql.gz -out backup.enc -k $ENCRYPTION_KEY

# Upload to backup server
scp backup.enc backup-server:/backups/
```

## Monitoring and Alerting

### System Metrics
- CPU usage
- Memory usage
- Disk usage
- Network traffic
- Database connections

### Security Events
- Failed login attempts
- Unauthorized access attempts
- Unusual data access patterns
- API rate limit violations
- File upload violations

### Alerting
- Email alerts for critical events
- SMS alerts for security incidents
- Dashboard for real-time monitoring
- Log aggregation and analysis

## Disaster Recovery

### Recovery Procedures
1. **Database Recovery**: Restore from encrypted backup
2. **File Recovery**: Restore from encrypted file storage
3. **System Recovery**: Rebuild from Docker images
4. **Data Verification**: Audit log verification

### Recovery Time Objective (RTO)
- **Critical Systems**: 4 hours
- **Non-critical Systems**: 24 hours

### Recovery Point Objective (RPO)
- **Database**: 24 hours (daily backups)
- **Files**: 7 days (weekly off-site backups)

## Compliance Checklist

### HIPAA Security Rule
- [x] Access controls (Firebase Auth + RBAC)
- [x] Audit controls (comprehensive logging)
- [x] Integrity controls (encryption + validation)
- [x] Transmission security (TLS 1.3)
- [x] Encryption (AES-256 at rest and in transit)

### HIPAA Privacy Rule
- [x] Minimum necessary access (RBAC)
- [x] Right to be forgotten (soft delete)
- [x] Access request handling (audit logs)
- [x] Business associate agreements (Firebase BAA)

### Data Retention
- [x] Configurable retention policies
- [x] Automated cleanup
- [x] Audit log retention (6+ years)
- [x] Backup retention (90 days)

## Implementation Roadmap

### Phase 1: Foundation
1. Set up PostgreSQL database
2. Configure Firebase project
3. Implement Rust backend authentication
4. Create basic API endpoints

### Phase 2: Core Features
1. Patient management CRUD
2. File upload/download
3. Audit logging
4. RBAC enforcement

### Phase 3: Security
1. Encryption implementation
2. TLS configuration
3. Rate limiting
4. Input validation

### Phase 4: Monitoring
1. System monitoring
2. Security event tracking
3. Alerting system
4. Backup automation

### Phase 5: Integration
1. Firebase authentication integration
2. Frontend API integration
3. Testing and validation
4. Deployment to clinic servers

## Cost Analysis

### Development Costs
- Rust development: Free (open source)
- PostgreSQL: Free (open source)
- Firebase Auth: Free tier available
- SSL certificates: Free (Let's Encrypt)

### Operational Costs
- Server hardware: One-time cost
- Electricity: Ongoing
- Internet connection: Ongoing
- Firebase: Free tier or paid based on usage
- Backup storage: Local (free) or cloud (paid)

### Estimated Monthly Costs
- Small clinic: $0-50 (Firebase free tier)
- Medium clinic: $50-200 (Firebase paid tier)
- Large clinic: $200-500 (Firebase paid tier + backup storage)

## Advantages of This Architecture

### Security
- Full control over data (on-premises)
- HIPAA compliant encryption
- Comprehensive audit logging
- No cloud data storage risks

### Flexibility
- Firebase makes authentication easy
- Rust provides maximum security
- Can scale independently
- Easy to maintain and update

### Cost-Effective
- Open source technologies
- No expensive cloud database
- Local storage reduces costs
- Firebase free tier available

### Compliance
- HIPAA compliant by design
- Audit trail for all access
- Data retention policies
- Right to be forgotten

## Next Steps

1. **Set up Firebase project**
   - Create Firebase project
   - Enable Authentication
   - Configure security rules
   - Obtain API keys

2. **Set up PostgreSQL**
   - Install PostgreSQL on clinic server
   - Create database and user
   - Run migrations
   - Configure encryption

3. **Configure Rust backend**
   - Set environment variables
   - Generate SSL certificates
   - Configure Firebase integration
   - Test API endpoints

4. **Deploy to clinic servers**
   - Install dependencies
   - Configure firewall
   - Set up monitoring
   - Test disaster recovery

5. **Integrate frontend**
   - Configure Firebase SDK
   - Update API client
   - Test authentication flow
   - Deploy to clinic workstations

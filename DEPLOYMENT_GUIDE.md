# Clinic CRM Deployment Guide - On-Premises

## Prerequisites

### Hardware Requirements
- **Server**: 4GB RAM, 2 CPU cores, 100GB storage minimum
- **Network**: Stable internet connection for Firebase Auth
- **Backup**: External storage for backups (optional but recommended)

### Software Requirements
- **OS**: Ubuntu 22.04 LTS or later
- **Rust**: 1.70 or later
- **PostgreSQL**: 14 or later
- **Nginx**: 1.18 or later (for SSL termination)
- **OpenSSL**: For SSL certificates

## Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Required Packages
```bash
sudo apt install -y curl wget git build-essential \
    postgresql postgresql-contrib nginx \
    openssl libssl-dev pkg-config
```

### 1.3 Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 1.4 Create Application User
```bash
sudo useradd -m -s /bin/bash clinic
sudo usermod -aG sudo clinic
```

## Step 2: PostgreSQL Setup

### 2.1 Start PostgreSQL Service
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.2 Create Database and User
```bash
sudo -u postgres psql
```

```sql
-- Create database
CREATE DATABASE clinic_crm;

-- Create user
CREATE USER clinic_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE clinic_crm TO clinic_user;

-- Exit
\q
```

### 2.3 Create Tables
```bash
sudo -u postgres psql -d clinic_crm
```

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'doctor', 'nurse', 'receptionist')),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(50) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    blood_group VARCHAR(10) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    phone_encrypted TEXT NOT NULL,
    email_encrypted TEXT,
    address_encrypted TEXT,
    doctor VARCHAR(255),
    insurer VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discharged', 'deceased')),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    next_appointment TIMESTAMP,
    follow_up_date TIMESTAMP,
    follow_up_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    timestamp TIMESTAMP NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Create indexes
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_files_patient ON files(patient_id);

-- Exit
\q
```

## Step 3: Rust Backend Setup

### 3.1 Clone Repository
```bash
cd /home/clinic
git clone <your-repo-url> clinic-crm
cd clinic-crm/backend
```

### 3.2 Configure Environment Variables
```bash
cp .env.example .env
nano .env
```

Edit `.env`:
```bash
# Server
HOST=127.0.0.1
PORT=8080

# Database
DATABASE_URL=postgresql://clinic_user:your_secure_password@localhost/clinic_crm

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=/home/clinic/clinic-crm/backend/service-account.json

# Security
JWT_SECRET=generate-secure-random-string-here
ENCRYPTION_KEY=generate-secure-random-string-here

# SSL
SSL_CERT_PATH=/etc/ssl/certs/clinic.crt
SSL_KEY_PATH=/etc/ssl/private/clinic.key

# File Upload
MAX_FILE_SIZE=10485760

# Backup
BACKUP_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=365
```

### 3.3 Generate Secure Keys
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate encryption key
openssl rand -base64 32
```

### 3.4 Build Backend
```bash
cargo build --release
```

### 3.5 Create Required Directories
```bash
sudo mkdir -p /uploads
sudo mkdir -p /backups
sudo chown -R clinic:clinic /uploads
sudo chown -R clinic:clinic /backups
```

## Step 4: SSL Certificate Setup

### 4.1 Generate Self-Signed Certificate (for testing)
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/clinic.key \
    -out /etc/ssl/certs/clinic.crt
```

### 4.2 OR Use Let's Encrypt (for production)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d clinic.yourdomain.com
```

### 4.3 Set Permissions
```bash
sudo chmod 600 /etc/ssl/private/clinic.key
sudo chmod 644 /etc/ssl/certs/clinic.crt
```

## Step 5: Nginx Configuration

### 5.1 Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/clinic-crm
```

```nginx
server {
    listen 443 ssl http2;
    server_name clinic.yourdomain.com;

    ssl_certificate /etc/ssl/certs/clinic.crt;
    ssl_certificate_key /etc/ssl/private/clinic.key;

    ssl_protocols TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # File upload size
        client_max_body_size 10M;
    }

    location /uploads {
        alias /uploads;
        internal;
    }
}

server {
    listen 80;
    server_name clinic.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/clinic-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Systemd Service Setup

### 6.1 Create Service File
```bash
sudo nano /etc/systemd/system/clinic-crm.service
```

```ini
[Unit]
Description=Clinic CRM Backend
After=network.target postgresql.service

[Service]
Type=simple
User=clinic
WorkingDirectory=/home/clinic/clinic-crm/backend
Environment="PATH=/home/clinic/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/home/clinic/.cargo/bin/cargo run --release
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 6.2 Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable clinic-crm
sudo systemctl start clinic-crm
sudo systemctl status clinic-crm
```

## Step 7: Firebase Setup

### 7.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Authentication
4. Enable Email/Password authentication
5. Enable Multi-factor authentication (optional but recommended)

### 7.2 Get Firebase Configuration
1. Go to Project Settings
2. Add Web App
3. Copy configuration values
4. Download service account key

### 7.3 Configure Firebase
```bash
# Place service account key in backend directory
cp path/to/service-account.json /home/clinic/clinic-crm/backend/
chmod 600 /home/clinic/clinic-crm/backend/service-account.json
```

### 7.4 Update Backend Config
Add to `.env`:
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=/home/clinic/clinic-crm/backend/service-account.json
```

## Step 8: Firewall Configuration

### 8.1 Configure UFW
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### 8.2 Restrict Database Access
```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add/modify:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    clinic_crm      clinic_user     127.0.0.1/32            scram-sha-256
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## Step 9: Backup Setup

### 9.1 Create Backup Script
```bash
sudo nano /usr/local/bin/clinic-backup.sh
```

```bash
#!/bin/bash

# Configuration
DB_NAME="clinic_crm"
DB_USER="clinic_user"
BACKUP_DIR="/backups"
RETENTION_DAYS=90
ENCRYPTION_KEY="your-encryption-key"

# Create backup filename with date
BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Create database backup
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Encrypt backup
openssl enc -aes-256-cbc -salt -in $BACKUP_FILE -out $BACKUP_FILE.enc -k $ENCRYPTION_KEY

# Remove unencrypted backup
rm $BACKUP_FILE

# Delete old backups (older than RETENTION_DAYS)
find $BACKUP_DIR -name "db_backup_*.sql.gz.enc" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_FILE.enc"
```

### 9.2 Make Script Executable
```bash
sudo chmod +x /usr/local/bin/clinic-backup.sh
```

### 9.3 Setup Cron Job
```bash
sudo crontab -e
```

Add:
```
0 2 * * * /usr/local/bin/clinic-backup.sh >> /var/log/clinic-backup.log 2>&1
```

## Step 10: Monitoring Setup

### 10.1 Install Monitoring Tools
```bash
sudo apt install -y htop iotop nethogs
```

### 10.2 Setup Log Rotation
```bash
sudo nano /etc/logrotate.d/clinic-crm
```

```
/home/clinic/clinic-crm/backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 clinic clinic
}
```

### 10.3 Setup Health Check Script
```bash
sudo nano /usr/local/bin/clinic-health.sh
```

```bash
#!/bin/bash

# Check if backend is running
if systemctl is-active --quiet clinic-crm; then
    echo "Backend: RUNNING"
else
    echo "Backend: STOPPED"
    systemctl restart clinic-crm
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
    echo "PostgreSQL: RUNNING"
else
    echo "PostgreSQL: STOPPED"
    systemctl restart postgresql
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "Nginx: RUNNING"
else
    echo "Nginx: STOPPED"
    systemctl restart nginx
fi
```

### 10.4 Make Health Check Executable
```bash
sudo chmod +x /usr/local/bin/clinic-health.sh
```

### 10.5 Setup Cron for Health Check
```bash
sudo crontab -e
```

Add:
```
*/5 * * * * /usr/local/bin/clinic-health.sh >> /var/log/clinic-health.log 2>&1
```

## Step 11: Frontend Deployment

### 11.1 Build Frontend
```bash
cd /home/clinic/clinic-crm
npm install
npm run build
```

### 11.2 Configure Frontend
```bash
cd /home/clinic/clinic-crm
nano .env.production
```

```bash
VITE_API_URL=https://clinic.yourdomain.com/api
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### 11.3 Serve Frontend with Nginx
Update Nginx config:
```nginx
server {
    listen 443 ssl http2;
    server_name clinic.yourdomain.com;

    ssl_certificate /etc/ssl/certs/clinic.crt;
    ssl_certificate_key /etc/ssl/private/clinic.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        root /home/clinic/clinic-crm/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 11.4 Restart Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Step 12: Testing

### 12.1 Test Backend Health
```bash
curl https://clinic.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-06-14T10:00:00Z",
  "version": "0.1.0",
  "environment": "production"
}
```

### 12.2 Test Database Connection
```bash
sudo -u postgres psql -d clinic_crm -c "SELECT version();"
```

### 12.3 Test SSL Certificate
```bash
openssl s_client -connect clinic.yourdomain.com:443 -servername clinic.yourdomain.com
```

### 12.4 Test Firebase Authentication
1. Open frontend in browser
2. Try to login with Firebase
3. Check if token is validated by backend

## Step 13: Security Hardening

### 13.1 Disable Root SSH Login
```bash
sudo nano /etc/ssh/sshd_config
```

Set:
```
PermitRootLogin no
PasswordAuthentication no
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### 13.2 Setup Fail2Ban
```bash
sudo apt install -y fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Add:
```
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
```

Start Fail2Ban:
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 13.3 Setup Automatic Updates
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Step 14: Disaster Recovery Testing

### 14.1 Test Backup Restore
```bash
# Decrypt backup
openssl enc -aes-256-cbc -d -in /backups/db_backup_20240614_020000.sql.gz.enc -out /tmp/backup.sql.gz -k your-encryption-key

# Extract
gunzip /tmp/backup.sql.gz

# Restore
sudo -u postgres psql -d clinic_crm < /tmp/backup.sql
```

### 14.2 Test Service Recovery
```bash
# Stop services
sudo systemctl stop clinic-crm
sudo systemctl stop postgresql

# Start services
sudo systemctl start postgresql
sudo systemctl start clinic-crm

# Verify
sudo systemctl status clinic-crm
```

## Step 15: Documentation

### 15.1 Create Operations Manual
Document:
- Server credentials
- Backup procedures
- Recovery procedures
- Contact information
- Maintenance schedule

### 15.2 Create Runbook
Document:
- Common issues and solutions
- Performance tuning
- Security procedures
- Update procedures

## Maintenance Schedule

### Daily
- Check health status
- Review logs for errors
- Monitor disk space

### Weekly
- Review backup logs
- Check security alerts
- Review audit logs

### Monthly
- Test backup restore
- Review system performance
- Update security patches
- Review user access

### Quarterly
- Security audit
- Performance review
- Disaster recovery test
- Documentation update

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
sudo journalctl -u clinic-crm -n 50

# Check database connection
sudo -u postgres psql -d clinic_crm

# Restart service
sudo systemctl restart clinic-crm
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Test connection
psql -U clinic_user -d clinic_crm -h localhost
```

### SSL Certificate Issues
```bash
# Check certificate expiry
openssl x509 -in /etc/ssl/certs/clinic.crt -text -noout | grep "Not After"

# Renew Let's Encrypt
sudo certbot renew
```

### High CPU/Memory Usage
```bash
# Check system resources
htop

# Check PostgreSQL connections
sudo -u postgres psql -d clinic_crm -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries
sudo -u postgres psql -d clinic_crm -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"
```

## Support and Contact

### Emergency Contacts
- System Administrator: [contact]
- Database Administrator: [contact]
- Security Team: [contact]

### Documentation
- Architecture: `/home/clinic/clinic-crm/ARCHITECTURE.md`
- Security: `/home/clinic/clinic-crm/SECURITY_IMPLEMENTATION_SUMMARY.md`
- API Documentation: `/home/clinic/clinic-crm/backend/README.md`

## Completion Checklist

- [ ] Server setup complete
- [ ] PostgreSQL configured and running
- [ ] Rust backend built and deployed
- [ ] SSL certificates configured
- [ ] Nginx configured and running
- [ ] Firebase project set up
- [ ] Firewall configured
- [ ] Backup system configured
- [ ] Monitoring system configured
- [ ] Frontend deployed
- [ ] All services tested
- [ ] Security hardening complete
- [ ] Disaster recovery tested
- [ ] Documentation complete
- [ ] Handover to operations team

## Next Steps

1. Train clinic staff on system usage
2. Set up user accounts in Firebase
3. Migrate existing patient data
4. Go live with production system
5. Monitor system performance
6. Schedule regular maintenance

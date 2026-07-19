# System Architecture

**IMPORTANT DISCLAIMER:** This document describes the current and planned system architecture of the Clinic CRM. This is NOT a production deployment guide or architecture certification.

**COMPLIANCE-READINESS ONLY:** This project implements technical controls to support compliance frameworks. It does not claim production readiness or architectural certification. Backend implementation required for production deployment.

## Overview

The Clinic CRM is a React-based clinic management system with a frontend-only architecture using localStorage for demonstration purposes. This document describes the current architecture after Phases 6-10 hardening, and the planned backend architecture for production deployment.

**Current Architecture:** Frontend-only with localStorage demo persistence. Backend implementation required for production deployment.

## Current Architecture

### Frontend Stack

**Core Technologies:**
- React 19.2.6 with TypeScript 6.0.3
- Vite 8.0.12 (build tool)
- React Router DOM 6.21.0 (routing)
- Recharts 3.8.1 (charts)
- Firebase Auth 10.7.1 (authentication)

**State Management:**
- React hooks (useState, useEffect, useMemo, useCallback)
- No state management library (Redux, Zustand, etc.)
- localStorage for persistence
- Component-level state

**Styling:**
- CSS custom properties (CSS variables)
- Inline styles and className-based styling
- No UI component library (custom components)
- Responsive design with media queries

### Backend Stack (Planned for Production)

**Core Technologies:**
- Backend framework (to be determined - Rust/Node.js/Python options)
- PostgreSQL database
- Authentication service
- RBAC middleware
- File upload handling
- Monitoring service
- Audit logging service

**Features:**
- RESTful API endpoints
- Authentication middleware
- RBAC middleware
- File upload handling
- Monitoring service
- Audit logging service
- Encryption at rest
- Backup/restore service

### Data Storage

**Frontend-Only Mode (Current):**
- localStorage for all data persistence
- Keys: clinic_crm_patients_v1, clinic_crm_audit, admin_audit, clinic_crm_security_events, clinic_crm_documents, clinic_crm_lab_orders, clinic_crm_invoices, clinic_crm_prescriptions, etc.
- No database
- No server-side storage
- **Limitation:** localStorage is not secure for production

**Backend Mode (Planned for Production):**
- PostgreSQL database with encryption at rest
- API-based data access
- Server-side authentication
- Server-side storage
- Secure backup/restore service

### Current File Structure (Phases 6-10)

```
src/
├── firebase.ts              # Firebase configuration and auth (not used in demo mode)
├── main.jsx                 # React entry point
├── ui/
│   ├── App.tsx              # Main app component with routing
│   ├── types.ts             # Domain types
│   ├── utils.ts             # Utility functions
│   ├── constants.ts         # App constants
│   ├── api.ts               # LocalStorage API client
│   ├── PatientList.tsx      # Patient list
│   ├── PatientProfile.tsx   # Patient profile with consent management
│   ├── Dashboard.tsx        # Dashboard
│   ├── Communications.tsx  # Communications
│   ├── Billing.tsx          # Billing
│   ├── Consultations.tsx    # Consultations with workflow state machines
│   ├── Lab.tsx              # Lab with clinical safety validation
│   ├── Staff.tsx            # Staff
│   ├── PatientForm.tsx      # Patient form
│   ├── Queue.tsx            # Queue management
│   ├── Documents.tsx        # Documents
│   ├── Reports.tsx          # Reports with PHI-safe exports
│   ├── Settings.tsx         # Settings with backup/import/export
│   ├── Audit.tsx            # Audit logs with legacy PHI scan
│   ├── Prescriptions.tsx    # Prescriptions
│   ├── components/          # Shared components
│   │   ├── Badges.tsx
│   │   ├── Charts.tsx
│   │   ├── ConsultationWorkflow.tsx
│   │   ├── ConsentManager.tsx
│   │   ├── FileUpload.tsx
│   │   ├── InvoiceGenerator.tsx
│   │   ├── PatientCommunication.tsx
│   │   ├── PrescriptionManager.tsx
│   │   └── ...
│   └── ...
├── modules/                 # Feature modules (Phase 6-10 refactoring)
│   ├── audit/
│   │   ├── services/
│   │   │   └── auditService.ts
│   │   ├── components/
│   │   │   └── AuditLogList.tsx
│   │   └── hooks/
│   │       └── useAudit.ts
│   ├── security/
│   │   ├── services/
│   │   │   └── securityService.ts
│   │   ├── components/
│   │   │   └── SecurityEvents.tsx
│   │   └── hooks/
│   │       └── useSecurity.ts
│   └── ...
├── shared/                  # Shared infrastructure (Phase 6-10)
│   ├── components/
│   │   ├── feedback/
│   │   │   ├── Feedback.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   └── ...
│   ├── permissions/
│   │   └── permissions.ts   # RBAC and permission definitions
│   ├── services/
│   │   ├── adminAudit.ts     # Admin operation audit logging
│   │   ├── auditRetention.ts # Audit retention helper
│   │   ├── logSanitizer.ts  # Legacy PHI scan/redaction
│   │   ├── deniedActionLogger.ts # Denied-action logging
│   │   └── ...
│   ├── workflow/
│   │   ├── workflowStateMachine.ts # Workflow state machines
│   │   ├── workflowValidation.ts   # Workflow validation
│   │   ├── workflowAudit.ts        # Workflow audit logging
│   │   ├── workflowHandoff.ts      # Workflow handoff helpers
│   │   ├── workflowIntegrity.ts    # Workflow integrity scanning
│   │   └── ...
│   ├── validation/
│   │   ├── entityValidation.ts     # Entity validation helpers
│   │   └── clinicalSafety.ts       # Clinical safety validation
│   └── ...
└── ...
```

### Architecture Improvements (Phases 6-10 Completed)

**1. Shared Infrastructure Created:**
- Shared components (Feedback, ConfirmDialog) replacing browser dialogs
- Shared permissions system (permissions.ts) with 7 roles
- Shared services (adminAudit, auditRetention, logSanitizer, deniedActionLogger)
- Shared workflow helpers (workflowStateMachine, workflowValidation, workflowAudit, workflowHandoff, workflowIntegrity)
- Shared validation helpers (entityValidation, clinicalSafety)

**2. Module Structure Initiated:**
- Audit module with services, components, and hooks
- Security module with services, components, and hooks
- Feature-based organization foundation

**3. Security Controls Added:**
- RBAC with 7 roles and granular permissions
- Denied-action logging for unauthorized access
- PHI-safe export/download sanitization
- Admin operation audit logging
- Archive-before-clear behavior
- Legacy PHI/PII scan and redaction
- Typed confirmation modals for high-risk actions
- Workflow state machines for clinical operations
- Clinical safety validation

**4. Remaining Architecture Issues:**
- Some large component files still exist (PatientList, Dashboard, PatientProfile, Communications)
- Business logic still in UI components
- No route guards
- No field-level permissions
- Frontend-only localStorage persistence (not secure for production)

## Completed Hardening Phases (6-10)

### Phase 6: RBAC/Security Hardening
- Enhanced RBAC with 7 roles and granular permissions
- Denied-action logging for unauthorized access attempts
- Permission system hardening in permissions.ts
- Role normalization and consistent permission checks

### Phase 7: Patient Module Hardening
- Patient archive/restore functionality
- Patient validation helpers
- Patient data safety controls
- Audit logging for patient operations

### Phase 8: Workflow Module Hardening
- Workflow state machines for clinical operations
- Workflow validation and handoff helpers
- Workflow integrity scanning
- Clinical safety validation helpers
- Workflow audit logging

### Phase 9: Operations/Admin Hardening
- Admin operation audit logging (adminAudit.ts)
- Archive-before-clear behavior for audit/security logs
- Audit retention helper (auditRetention.ts)
- Import/export hardening with validation
- Settings audit logging
- Legacy PHI/PII scan and redaction helpers (logSanitizer.ts)

### Phase 10A: Compliance/Privacy Final Audit
- Comprehensive read-only audit of entire codebase
- Privacy data inventory audit
- Consent/privacy rights audit
- RBAC/access-control compliance audit
- Audit trail compliance audit
- Export/download/privacy audit
- Backup/import/restore compliance audit
- Data retention/deletion/archive audit
- Security posture audit
- Clinical safety readiness audit
- Documentation compliance audit
- Persistent PHI/PII scan
- Browser dialog scan (confirmed none present)
- Compliance readiness matrix
- Final risk register

### Phase 10B: Legacy PHI/PII Audit Cleanup
- Fixed api.ts patient creation/update audit to use patientId instead of patient name
- Added legacy PHI scan UI in Audit page (admin-only)
- Added redaction preview functionality
- Added redaction execution with typed confirmation "REDACT LEGACY LOGS"
- Scan covers all log sources: audit, admin audit, security events, denied actions, staff activity, communication activity, queue activity

## Planned Architecture (Backend Implementation Required)

### Target File Structure for Production

```
src/
├── app/
│   ├── routes/                    # Route definitions and guards
│   ├── providers/                  # Context providers
│   └── layouts/                    # Layout components
├── modules/                        # Feature modules (expanded)
│   ├── patients/
│   ├── appointments/
│   ├── queue/
│   ├── consultations/
│   ├── prescriptions/
│   ├── lab/
│   ├── billing/
│   ├── documents/
│   ├── communications/
│   ├── staff/
│   ├── reports/
│   ├── settings/
│   ├── audit/
│   ├── security/
│   └── dashboard/
├── shared/                         # Shared infrastructure (expanded)
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   ├── constants/
│   ├── permissions/
│   ├── validation/
│   └── types/
└── main.tsx
```

### Production Architecture Target

**Backend Required:**
- Backend API with authentication service
- PostgreSQL database with encryption at rest
- Server-side RBAC enforcement
- Server-side audit trail with immutability
- Secure backup/restore service
- Session management with timeout
- MFA support
- Rate limiting
- CSRF protection
- Secure file storage

**Frontend Enhancements Required:**
- Route guards for authentication and authorization
- Field-level permissions
- Centralized validation system
- XSS/CSRF protection framework
- Error tracking integration
- Performance monitoring

### Key Helper Files (Phases 6-10)

**Workflow Helpers:**
- workflowStateMachine.ts - State machines for clinical operations
- workflowValidation.ts - Workflow validation logic
- workflowAudit.ts - Workflow audit logging
- workflowHandoff.ts - Workflow handoff helpers
- workflowIntegrity.ts - Workflow integrity scanning

**Validation Helpers:**
- entityValidation.ts - Entity validation helpers
- clinicalSafety.ts - Clinical safety validation

**Audit/Admin Helpers:**
- adminAudit.ts - Admin operation audit logging (PHI-safe)
- auditRetention.ts - Audit retention helper
- logSanitizer.ts - Legacy PHI scan and redaction

**Permission System:**
- permissions.ts - RBAC and permission definitions with 7 roles

**UI Components:**
- Feedback.tsx - User feedback notifications
- ConfirmDialog.tsx - Custom confirmation dialogs (replaces browser dialogs)

## Migration Strategy

### Phase 6-10: Foundation and Hardening (Completed)
- Created shared infrastructure (components, services, helpers)
- Created shared permissions system with 7 roles
- Created shared workflow helpers (state machines, validation, audit, handoff, integrity)
- Created shared validation helpers (entity validation, clinical safety)
- Created audit/admin helpers (adminAudit, auditRetention, logSanitizer, deniedActionLogger)
- Initiated module structure (audit, security modules)
- Added security controls (RBAC, denied-action logging, PHI-safe exports, etc.)
- Updated documentation

### Phase 10D-10E: Frontend Enhancements (Recommended)
- Implement privacy rights workflow
- Implement consent management with versioning
- Add data subject request portal
- Implement retention UI for automated cleanup
- Conduct manual QA and testing

### Backend Implementation (Required for Production)
- Implement backend API with authentication service
- Implement PostgreSQL database with encryption at rest
- Implement server-side RBAC enforcement
- Implement server-side audit trail with immutability
- Implement secure backup/restore service
- Implement session management with timeout
- Implement MFA support
- Implement rate limiting and CSRF protection
- Migrate from localStorage to secure backend storage

## Data Flow

### Current Data Flow

```
User Action → Component → localStorage → Component Update → UI Update
```

### Planned Data Flow (Backend Required)

```
User Action → Component → Hook → Service → API → Backend → Database → API → Service → Component Update → UI Update
```

### Service Layer

**Current (Phases 6-10):**
- Direct localStorage access in components
- api.ts has basic CRUD but not used consistently
- Shared services for audit, workflow, validation

**Planned (Backend Required):**
- Centralized service layer
- Consistent data access patterns
- Abstraction over localStorage/API
- Error handling and logging
- Backend API integration

## State Management

### Current State Management (Phases 6-10)

- Component-level state with useState
- No global state management
- localStorage for persistence
- Props drilling for data passing
- Shared services for cross-component logic

### Planned State Management (Backend Required)

- Component-level state for UI state
- Context providers for global state
- Custom hooks for data fetching
- Service layer for business logic
- Backend API integration
- Reduced props drilling

## Routing

### Current Routing

- Tab-based navigation in App.tsx
- No route guards
- No role-based route access
- All routes accessible if logged in

### Planned Routing (Backend Required)

- React Router for proper routing
- Route guards for authentication
- Route guards for authorization
- Role-based route access
- Lazy loading for code splitting

## Security Architecture (Phases 6-10 Status)

### Current Security

- Demo role switcher for development/testing
- RBAC with 7 roles and granular permissions
- Permission checks in components
- Denied-action logging for unauthorized access
- PHI-safe export/download sanitization
- Admin operation audit logging
- Archive-before-clear behavior
- Legacy PHI/PII scan and redaction
- Typed confirmation modals for high-risk actions
- **Limitation:** No real authentication, no backend enforcement

### Planned Security (Backend Required)

- Backend authentication with session management
- MFA support
- Comprehensive RBAC with route guards
- Field-level permissions
- Server-side audit trail with immutability
- Encryption at rest
- Session timeout and management

## Performance Considerations

### Current Performance Issues

- Large component files still exist
- No code splitting
- No lazy loading
- No memoization where needed
- localStorage quota issues

### Planned Performance Improvements (Backend Required)

- Code splitting with React.lazy
- Lazy loading of routes
- Memoization with React.memo
- Virtual scrolling for large lists
- Optimized re-renders
- Backend API for large datasets

## Testing Strategy

### Current Testing

- No test framework
- No unit tests
- No integration tests
- No E2E tests

### Planned Testing (Recommended)

- Vitest for unit tests
- React Testing Library for component tests
- Playwright for E2E tests
- Test coverage reporting
- CI/CD integration

## Deployment Strategy

### Current Deployment

- Vite build
- Static hosting
- No CI/CD
- Frontend-only localStorage

### Planned Deployment (Backend Required)

- Automated builds with CI/CD
- Environment-specific configurations
- Automated testing in CI
- Staging environment
- Production deployment automation
- Backend API deployment
- Database deployment

## Monitoring and Observability

### Current Monitoring

- Console logging
- No error tracking
- No performance monitoring
- No uptime monitoring

### Planned Monitoring (Backend Required)

- Error tracking (Sentry)
- Performance monitoring
- Uptime monitoring
- Log aggregation
- Security event monitoring
- Backend API monitoring

## Conclusion

The current architecture is a frontend-only demonstration system with localStorage persistence. Through Phases 6-10, comprehensive shared infrastructure has been created including RBAC, denied-action logging, PHI-safe exports, admin operation audit logging, archive-before-clear behavior, legacy PHI/PII scan and redaction, workflow state machines, and typed confirmation modals. However, significant backend implementation is required for production deployment, including authentication, encryption, audit immutability, session management, and secure data storage.

The migration strategy prioritizes backend implementation for production, with optional frontend enhancements (Phases 10D-10E) for privacy rights workflow and retention UI.

This document should be reviewed and updated regularly as new architecture decisions are made and implementation progresses.

**Related Documentation:**
- docs/compliance/README.md - Compliance readiness
- docs/security/SECURITY_ARCHITECTURE.md - Security architecture
- docs/compliance/PRODUCTION_READINESS_CHECKLIST.md - Production readiness assessment
- docs/compliance/BACKEND_IMPLEMENTATION_ROADMAP.md - Backend implementation plan
- src/shared/services/IMMUTABLE_AUDIT_PLAN.md - Immutable audit trail plan

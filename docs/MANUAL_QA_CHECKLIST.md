# Manual QA Checklist - Phase 10G

## Phase 10G: Final Full Verification + Manual QA Checklist

This checklist is for manual QA testing of the Clinic CRM frontend demonstration system after Phase 10 hardening.

---

## Login/Security

- [ ] App opens without errors
- [ ] Login screen displays demo mode warning banner
- [ ] Login footer shows "Frontend demo authentication" message (not "Secure authentication powered by Firebase")
- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Role switcher is visible in sidebar (demo mode)
- [ ] Role switcher is visible in top bar (demo mode)
- [ ] Role switcher shows confirmation modal before switching
- [ ] Role switcher confirmation message includes "(Demo-only - no real authentication)"
- [ ] Role switch to admin requires confirmation
- [ ] Role switch logs to admin_audit with fromRole/toRole
- [ ] No email/password/token logged in security events (should be "[REDACTED]")

---

## RBAC/Tab Navigation

- [ ] Dashboard tab accessible to admin
- [ ] Dashboard tab accessible to doctor
- [ ] Dashboard tab NOT accessible to nurse
- [ ] Dashboard tab NOT accessible to receptionist
- [ ] Dashboard tab NOT accessible to billing
- [ ] Dashboard tab NOT accessible to auditor
- [ ] Dashboard tab NOT accessible to readonly
- [ ] Queue tab accessible to admin, doctor, nurse, receptionist
- [ ] Appointments tab accessible to admin, doctor, nurse, receptionist
- [ ] Consultations tab accessible to admin, doctor, nurse
- [ ] Consultations tab NOT accessible to receptionist, billing, auditor, readonly
- [ ] Prescriptions tab accessible to admin, doctor
- [ ] Prescriptions tab NOT accessible to nurse, receptionist, billing, auditor, readonly
- [ ] Lab tab accessible to admin, doctor, nurse
- [ ] Lab tab NOT accessible to receptionist, billing, auditor, readonly
- [ ] Billing tab accessible to admin, billing, receptionist
- [ ] Billing tab NOT accessible to doctor, nurse, auditor, readonly
- [ ] Documents tab accessible to admin, doctor, nurse, receptionist, readonly
- [ ] Documents tab NOT accessible to billing, auditor
- [ ] Communications tab accessible to admin, doctor, nurse, receptionist
- [ ] Communications tab NOT accessible to billing, auditor, readonly
- [ ] Reports tab accessible to admin, auditor, doctor
- [ ] Reports tab NOT accessible to nurse, receptionist, billing, readonly
- [ ] Staff tab accessible to admin only
- [ ] Staff tab NOT accessible to any other role
- [ ] Settings tab accessible to admin only
- [ ] Settings tab NOT accessible to any other role
- [ ] Audit tab accessible to admin, auditor
- [ ] Audit tab NOT accessible to doctor, nurse, receptionist, billing, readonly
- [ ] Patients tab accessible to admin, doctor, nurse, receptionist, billing, auditor, readonly
- [ ] Unauthorized tab access shows DeniedAccessPanel
- [ ] DeniedAccessPanel has "Return to Dashboard" button
- [ ] Dashboard shortcuts respect tab permissions
- [ ] Unknown role falls back to dashboard with denied access
- [ ] Invalid tab ID is blocked safely

---

## Patient Module

- [ ] Patient list loads without errors
- [ ] Patient search works
- [ ] Patient filters work
- [ ] Add patient button respects RBAC (admin, doctor, nurse, receptionist)
- [ ] Edit patient respects RBAC
- [ ] Delete/archive patient requires confirmation
- [ ] Patient profile loads without errors
- [ ] Patient profile shows all tabs for authorized roles
- [ ] Patient profile clinical tab respects RBAC
- [ ] Patient profile billing tab respects RBAC
- [ ] Patient profile documents tab respects RBAC
- [ ] Patient profile privacy tab is visible
- [ ] Privacy request creation works (admin only)
- [ ] Privacy request status update works (admin only)
- [ ] Consent grant/revoke works
- [ ] Consent history displays correctly
- [ ] Expiring consents are highlighted
- [ ] Expired consents are highlighted
- [ ] Communication preferences display correctly
- [ ] Opt-out blocking works in Communications
- [ ] Patient portability export requires typed confirmation
- [ ] Patient portability export is patient-specific only

---

## Workflow Module

- [ ] Queue loads without errors
- [ ] Queue status changes respect RBAC
- [ ] Queue consultation start respects RBAC
- [ ] Queue cancel/no-show respects RBAC
- [ ] Consultations load without errors
- [ ] Consultation creation respects RBAC
- [ ] Consultation editing respects RBAC
- [ ] Consultation deletion respects RBAC
- [ ] Consultation templates respect RBAC
- [ ] Consultation drafts respect RBAC
- [ ] Consultation export respects RBAC
- [ ] Consultation print respects RBAC
- [ ] Prescriptions load without errors
- [ ] Prescription creation respects RBAC
- [ ] Prescription editing respects RBAC
- [ ] Lab results load without errors
- [ ] Lab result entry respects RBAC
- [ ] Lab result validation works
- [ ] Workflow integrity scan runs (admin only)
- [ ] Workflow integrity scan displays results correctly

---

## Documents

- [ ] Documents list loads without errors
- [ ] Document upload respects RBAC
- [ ] Document download respects RBAC
- [ ] Document download removes patientName (PHI-safe)
- [ ] Document renewal respects RBAC
- [ ] Document renewal requires confirmation
- [ ] Document mark signed respects RBAC
- [ ] Document deletion respects RBAC
- [ ] Document search works
- [ ] Document filtering works
- [ ] Consent documents display correctly
- [ ] ID documents display correctly
- [ ] Insurance documents display correctly
- [ ] Expired documents are highlighted

---

## Billing

- [ ] Invoices list loads without errors
- [ ] Invoice creation respects RBAC
- [ ] Invoice editing respects RBAC
- [ ] Invoice deletion respects RBAC
- [ ] Invoice deletion requires confirmation
- [ ] Payment recording respects RBAC
- [ ] Payment recording respects RBAC
- [ ] Invoice export CSV removes patientName (PHI-safe)
- [ ] Payment export CSV removes patientName (PHI-safe)
- [ ] Insurance export CSV removes patientName (PHI-safe)
- [ ] Activity export CSV is count-only (PHI-safe)
- [ ] Activity clear requires typed confirmation "CLEAR BILLING ACTIVITY"
- [ ] Activity clear logs count only (PHI-safe)

---

## Communications

- [ ] Communications list loads without errors
- [ ] Message sending respects RBAC
- [ ] Message sending respects opt-out preferences
- [ ] Communication history loads without errors
- [ ] Communication templates respect RBAC
- [ ] Communication export respects RBAC
- [ ] Activity clear requires typed confirmation "CLEAR COMMUNICATION ACTIVITY"
- [ ] Activity clear logs count only (PHI-safe)

---

## Staff

- [ ] Staff list loads without errors
- [ ] Staff creation respects RBAC
- [ ] Staff editing respects RBAC
- [ ] Staff deletion respects RBAC
- [ ] Staff deletion requires confirmation
- [ ] Staff status change respects RBAC
- [ ] Schedule creation respects RBAC
- [ ] Schedule editing respects RBAC
- [ ] Schedule deletion respects RBAC
- [ ] Reset demo staff requires typed confirmation "RESET STAFF"
- [ ] Reset demo staff logs count only (PII-safe)
- [ ] Clear staff activity requires typed confirmation "CLEAR STAFF ACTIVITY"
- [ ] Clear staff activity logs count only (PII-safe)

---

## Settings/Import/Export/Backup

- [ ] Settings loads without errors
- [ ] Clinic settings respect RBAC
- [ ] Invoice settings respect RBAC
- [ ] Prescription settings respect RBAC
- [ ] Notification settings respect RBAC
- [ ] Backup section is visible (admin only)
- [ ] Export patients CSV removes patientName (PHI-safe)
- [ ] Export appointments CSV removes patientName (PHI-safe)
- [ ] Export invoices CSV removes patientName (PHI-safe)
- [ ] Export sanitized backup is PHI-safe
- [ ] Export full PHI backup requires typed confirmation "EXPORT FULL PHI BACKUP"
- [ ] Export full PHI backup logs action (PHI-safe)
- [ ] Import respects RBAC
- [ ] Import replace mode requires typed confirmation "REPLACE DATA"
- [ ] Import replace mode logs action (PHI-safe)
- [ ] Clear section requires typed confirmation for high-risk sections
- [ ] Clear section logs action (PHI-safe)
- [ ] Retention tab is visible (admin only)
- [ ] Retention policy display shows correct values
- [ ] Retention policy editing respects RBAC (admin only)
- [ ] Retention cleanup preview runs without errors
- [ ] Retention cleanup preview shows counts only
- [ ] Retention cleanup requires typed confirmation "APPLY RETENTION CLEANUP"
- [ ] Retention cleanup only touches approved log sources
- [ ] Retention cleanup excludes patient/clinical/document records
- [ ] Retention report export has no PHI
- [ ] Backup retention preview has no PHI
- [ ] Legacy PHI scan cross-reference exists

---

## Audit/Security

- [ ] Audit page loads without errors
- [ ] Audit logs display correctly
- [ ] Security events display correctly
- [ ] Audit log export respects RBAC
- [ ] Security event export respects RBAC (admin only)
- [ ] Clear audit logs requires typed confirmation "CLEAR AUDIT LOGS"
- [ ] Clear audit logs logs count only (PHI-safe)
- [ ] Clear security events requires typed confirmation "CLEAR SECURITY EVENTS"
- [ ] Clear security events logs count only (PHI-safe)
- [ ] Workflow integrity scan runs (admin only)
- [ ] Workflow integrity scan displays results correctly
- [ ] Legacy PHI Scan tab exists (admin only)
- [ ] Legacy PHI scan runs without errors
- [ ] Legacy PHI scan shows counts/field names only (no sensitive values)
- [ ] Legacy PHI redaction requires typed confirmation "REDACT LEGACY LOGS"
- [ ] Legacy PHI redaction preserves IDs/timestamps/actions
- [ ] Legacy PHI redaction does not delete logs
- [ ] Legacy PHI redaction does not touch patient/clinical records

---

## Legacy PHI Scan

- [ ] Legacy PHI Scan tab is visible (admin only)
- [ ] Legacy PHI Scan tab is NOT visible to auditor
- [ ] Scan button runs scan without errors
- [ ] Scan shows total entries count
- [ ] Scan shows risky records count
- [ ] Scan shows safe entries count
- [ ] Scan shows sources scanned
- [ ] Scan shows risky field names only (no sensitive values)
- [ ] Redaction preview button works
- [ ] Redaction preview shows counts/sources/fields only
- [ ] Redaction execute button requires typed confirmation
- [ ] Typed confirmation text is "REDACT LEGACY LOGS"
- [ ] Redaction replaces sensitive values with "[REDACTED]"
- [ ] Redaction preserves IDs, timestamps, actions, resourceIds
- [ ] Redaction logs action with count/type only (PHI-safe)

---

## Retention

- [ ] Retention tab is visible (admin only)
- [ ] Retention tab is NOT visible to auditor
- [ ] Retention tab shows compliance summary
- [ ] Compliance summary mentions "Frontend retention is demo-level only"
- [ ] Retention policy display shows correct values
- [ ] Retention policy editing is visible (admin only)
- [ ] Retention policy editing is NOT visible to auditor
- [ ] Retention policy save works
- [ ] Retention policy save logs changes (PHI-safe)
- [ ] Retention cleanup preview runs without errors
- [ ] Retention cleanup preview shows counts only
- [ ] Retention cleanup execution requires typed confirmation
- [ ] Typed confirmation text is "APPLY RETENTION CLEANUP"
- [ ] Retention cleanup only touches approved log sources
- [ ] Retention cleanup excludes patient records
- [ ] Retention cleanup excludes clinical data
- [ ] Retention cleanup excludes documents
- [ ] Retention cleanup excludes invoices
- [ ] Retention cleanup excludes privacy requests
- [ ] Retention report export has no PHI
- [ ] Backup retention preview has no PHI
- [ ] Legacy PHI scan cross-reference link exists

---

## Privacy Rights

- [ ] Privacy tab is visible in PatientProfile
- [ ] Privacy request creation works (admin only)
- [ ] Privacy request type selection works
- [ ] Privacy request status update works (admin only)
- [ ] Privacy request completion works (admin only)
- [ ] Privacy request cancellation works (admin only)
- [ ] Consent grant works
- [ ] Consent revoke works
- [ ] Consent history displays correctly
- [ ] Consent versioning works
- [ ] Expiring consents are highlighted
- [ ] Expired consents are highlighted
- [ ] Communication preferences display correctly
- [ ] Communication preference update works
- [ ] Opt-out blocking works in Communications
- [ ] Patient portability export works
- [ ] Patient portability export requires typed confirmation
- [ ] Patient portability export is patient-specific only
- [ ] Privacy audit logs are PHI-safe

---

## Reports

- [ ] Reports page loads without errors
- [ ] Revenue tab respects RBAC
- [ ] Patients tab respects RBAC
- [ ] Appointments tab respects RBAC
- [ ] Performance tab respects RBAC
- [ ] Follow-ups tab respects RBAC
- [ ] Financial report export respects RBAC
- [ ] Clinical report export respects RBAC
- [ ] Report export includes metadata (exported_at, exported_by, export_type, record_count)
- [ ] Report export has no patientName in CSV

---

## Exports/Downloads/Prints

- [ ] Settings patients export CSV removes patientName
- [ ] Settings appointments export CSV removes patientName
- [ ] Settings invoices export CSV removes patientName
- [ ] Settings sanitized backup is PHI-safe
- [ ] Settings full PHI backup requires typed confirmation
- [ ] Billing invoices export CSV removes patientName
- [ ] Billing payments export CSV removes patientName
- [ ] Billing insurance export CSV removes patientName
- [ ] Billing activity export CSV is count-only
- [ ] Queue export CSV removes patientName
- [ ] Queue activity export CSV removes patientName
- [ ] Documents download removes patientName
- [ ] Consultations export respects RBAC
- [ ] Consultations print respects RBAC
- [ ] Reports export respects RBAC
- [ ] Audit log export respects RBAC
- [ ] Security event export respects RBAC
- [ ] Retention report export has no PHI

---

## Destructive Actions

- [ ] Patient delete/archive requires confirmation
- [ ] Patient restore requires confirmation
- [ ] Document delete requires confirmation
- [ ] Document renewal requires confirmation
- [ ] Invoice delete requires confirmation
- [ ] Invoice void requires confirmation
- [ ] Communication delete requires confirmation
- [ ] Staff delete requires confirmation
- [ ] Staff reset requires typed confirmation "RESET STAFF"
- [ ] Staff activity clear requires typed confirmation "CLEAR STAFF ACTIVITY"
- [ ] Settings import replace requires typed confirmation "REPLACE DATA"
- [ ] Settings clear section requires typed confirmation for high-risk
- [ ] Full PHI backup export requires typed confirmation "EXPORT FULL PHI BACKUP"
- [ ] Audit logs clear requires typed confirmation "CLEAR AUDIT LOGS"
- [ ] Security events clear requires typed confirmation "CLEAR SECURITY EVENTS"
- [ ] Legacy PHI redaction requires typed confirmation "REDACT LEGACY LOGS"
- [ ] Retention cleanup requires typed confirmation "APPLY RETENTION CLEANUP"
- [ ] Communication activity clear requires typed confirmation "CLEAR COMMUNICATION ACTIVITY"
- [ ] Billing activity clear requires typed confirmation "CLEAR BILLING ACTIVITY"

---

## Browser/Mobile Responsiveness

- [ ] App loads on desktop browser
- [ ] App loads on mobile browser
- [ ] Sidebar collapses on mobile
- [ ] Bottom navigation works on mobile
- [ ] More sheet opens on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Forms are usable on mobile
- [ ] Modals are usable on mobile
- [ ] No horizontal scroll on desktop
- [ ] No broken layouts on different screen sizes

---

## Compliance Docs

- [ ] Compliance README exists with disclaimer
- [ ] Security architecture exists with disclaimer
- [ ] Architecture docs exist with disclaimer
- [ ] Production readiness checklist exists
- [ ] Backend implementation roadmap exists
- [ ] Data retention policy exists
- [ ] Privacy policy template exists
- [ ] Phase 10 summary exists
- [ ] Backend production blockers exists
- [ ] Immutable audit plan exists
- [ ] No docs claim "compliant"
- [ ] No docs claim "certified"
- [ ] No docs claim "production ready"
- [ ] No docs claim "legally compliant"
- [ ] No docs claim "medically certified"

---

## General

- [ ] No console errors on app load
- [ ] No console errors during navigation
- [ ] No console errors during actions
- [ ] Build completes successfully
- [ ] Lint passes successfully
- [ ] No native browser dialogs (alert, confirm, prompt)
- [ ] All confirmations use custom modals
- [ ] All typed confirmations work correctly
- [ ] Feedback toasts display correctly
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Empty states display correctly

---

## Session Timeout (Helper-Ready)

- [ ] sessionSecurity.ts helper exists
- [ ] Helper has initSessionSecurity function
- [ ] Helper has recordActivity function
- [ ] Helper has logoutSession function
- [ ] Helper has setupActivityListeners function
- [ ] Helper logs session timeout safely (PHI-safe)
- [ ] Helper logs manual logout safely (PHI-safe)
- [ ] Helper is documented as demo-level only
- [ ] Helper is NOT wired into App.tsx (acceptable per 10F)
- [ ] Helper is documented as helper-ready/not active

---

## Final Notes

- All destructive actions require confirmation
- All high-risk destructive actions require typed confirmation
- All exports are PHI-safe (no patientName, staffName in broad exports)
- All audit logs are PHI-safe (sanitized by helpers)
- All role switches are logged (PHI-safe)
- All tab access denied is logged (PHI-safe)
- No email/password/token logged (should be "[REDACTED]")
- Demo mode is clearly labeled
- No claims of compliance/certification/production readiness
- Backend requirements clearly documented

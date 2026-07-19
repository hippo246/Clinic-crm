import React, { useState, useCallback, useMemo, useEffect } from "react";
import type { Patient, AuditEntry, UserRole, TimelineEvent, PatientNote, PatientDocument, Prescription, LabResult } from "./types";
import {
  fmtDate, getAvatarColor, getInitials, calcRiskScore,
  calcVisitReadiness, calcNextBestAction, buildSmartSnapshot,
  createAuditEntry,
  maskPhone, maskEmail, maskAddress, canViewClinicalField, canViewBillingField,
} from "./utils";
import { QUICK_ACTIONS, ALERT_SEVERITY, CONSENT_TYPES } from "./constants";
import {
  StatusBadge, AlertChip, InsuranceBadge, BloodGroupBadge,
  RiskBadge, AvatarCircle, VerifiedDot, ConsentBadge,
} from "./Badges";
import { can } from "./constants";
import { hasRole, normalizeRole } from "../shared/permissions/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";
import { logAdminOperation } from "../shared/services/adminAudit";
import { AppointmentBooking } from "./components/AppointmentBooking";
import { ConsultationWorkflow } from "./components/ConsultationWorkflow";
import { PrescriptionManager } from "./components/PrescriptionManager";
import { FileUpload } from "./components/FileUpload";
import { InvoiceGenerator } from "./components/InvoiceGenerator";
import { PatientCommunication } from "./components/PatientCommunication";
import { FollowUpScheduler } from "./components/FollowUpScheduler";
import { apiClient } from "./api";
import { ConsentManager } from "./components/ConsentManager";
import { useToast } from "./Toast";
import {
  createPrivacyRequest,
  updatePrivacyRequestStatus,
  completePrivacyRequest,
  cancelPrivacyRequest,
  getPrivacyRequestsForPatient,
  type PrivacyRequest,
  type PrivacyRequestType,
  type PrivacyRequestStatus,
} from "../shared/privacy/privacyRequests";
import {
  getConsentStatus,
  getPatientConsents,
  getConsentHistory,
  getExpiringConsents,
  getExpiredConsents,
  getConsentSummary,
  grantConsent,
  revokeConsent,
  type ConsentRecord,
} from "../shared/privacy/consentManager";
import {
  getCommunicationPreferences,
  updateCommunicationPreference,
  getOptedOutChannels,
  type CommunicationChannel,
} from "../shared/privacy/optOutManager";
import {
  generatePortabilityExport,
  downloadExportFile,
  type PatientDataExport,
} from "../shared/privacy/dataPortability";

// Phase 7F: Current user constant for audit logging
const CURRENT_USER = { name: "Current User", role: "doctor" };

// Phase 7F: Local audit trail function (simplified for this component)
function logAuditTrail(action: string, type: string, patientId: string) {
  console.log(`[AUDIT] ${type}: ${action} for patient ${patientId}`);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const PROFILE_TABS = [
  { id: "overview",  label: "Overview",   icon: "ti-layout-dashboard" },
  { id: "timeline",  label: "Timeline",   icon: "ti-timeline" },
  { id: "prescriptions", label: "Prescriptions", icon: "ti-pill" },
  { id: "labresults", label: "Lab Results", icon: "ti-test-tube" },
  { id: "documents", label: "Documents",  icon: "ti-files" },
  { id: "notes",     label: "Notes",      icon: "ti-notes" },
  { id: "followup",  label: "Follow-Up",  icon: "ti-phone" },
  { id: "consents",  label: "Consents",   icon: "ti-writing" },
  { id: "privacy",   label: "Privacy",    icon: "ti-shield" },
  { id: "audit",     label: "Audit Log",  icon: "ti-history" },
] as const;

type TabId = typeof PROFILE_TABS[number]["id"];

// ─── Props ────────────────────────────────────────────────────────────────────
interface PatientProfileProps {
  patient: Patient;
  auditEntries: AuditEntry[];
  onBack: () => void;
  onEditPatient: () => void;
  onUpdatePatient: (p: Patient, action?: string) => void;
  onDeletePatient: (id: string) => void;
  role: UserRole;
}

export default function PatientProfile({
  patient,
  auditEntries,
  onBack,
  onEditPatient,
  onUpdatePatient,
  onDeletePatient,
  role,
}: PatientProfileProps) {
  // Normalize role to ensure it's a valid UserRole
  const normalizedRole = normalizeRole(role) as UserRole;

  const [tab,          setTab]          = useState<TabId>("overview");
  const [showEmergency,setShowEmergency] = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [quickAction,  setQuickAction]  = useState<string | null>(null);
  
  // Medical workflow modals
  const [showAppointment, setShowAppointment] = useState(false);
  const [showConsultation, setShowConsultation] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showCommunication, setShowCommunication] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [activeWorkflowLoading, setActiveWorkflowLoading] = useState<string | null>(null);

  // Phase 10D: Privacy modals and state
  const [showPrivacyRequestModal, setShowPrivacyRequestModal] = useState(false);
  const [privacyRequestType, setPrivacyRequestType] = useState<PrivacyRequestType | null>(null);
  const [privacyRequestReason, setPrivacyRequestReason] = useState("");
  const [showPortabilityConfirm, setShowPortabilityConfirm] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showCommPreferencesModal, setShowCommPreferencesModal] = useState(false);
  const [commPreferences, setCommPreferences] = useState<Record<CommunicationChannel, boolean> | null>(null);

  // Phase 10D: Privacy data
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [patientConsents, setPatientConsents] = useState<ConsentRecord[]>([]);
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  const [expiringConsents, setExpiringConsents] = useState<ConsentRecord[]>([]);
  const [expiredConsents, setExpiredConsents] = useState<ConsentRecord[]>([]);
  const [optedOutChannels, setOptedOutChannels] = useState<CommunicationChannel[]>([]);

  const { toast } = useToast();

  const nba  = calcNextBestAction(patient);
  const risk = calcRiskScore(patient);
  const readiness = calcVisitReadiness(patient);
  const snapshot  = buildSmartSnapshot(patient);
  const avatarBg  = getAvatarColor(patient.name);

  // ─── Local Permission Guards (Phase 6G) ─────────────────────────────────────────────
  const canViewClinicalSections = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canEditClinicalSections = hasRole(normalizedRole, ["admin", "doctor"]);
  const canViewPrescriptions = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canManagePrescriptions = hasRole(normalizedRole, ["admin", "doctor"]);
  const canViewLabResults = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canViewClinicalNotes = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canManageClinicalNotes = hasRole(normalizedRole, ["admin", "doctor"]);
  const canViewDocuments = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist", "readonly"]);
  const canManageDocuments = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canViewAuditEntries = hasRole(normalizedRole, ["admin", "auditor"]);
  const canViewConsents = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist", "readonly"]);
  const canManageConsents = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canEditPatient = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canDeletePatient = hasRole(normalizedRole, ["admin"]);

  // Phase 10D: Privacy permission guards
  const canViewPrivacy = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist", "readonly"]);
  const canManagePrivacyRequests = hasRole(normalizedRole, ["admin", "doctor"]);
  const canExportPortability = hasRole(normalizedRole, ["admin", "doctor"]);
  const canManageCommunicationPreferences = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);

  // Phase 7I: Field-level privacy guards
  const shouldMaskContact = hasRole(normalizedRole, ["auditor", "readonly"]);
  const shouldMaskBilling = !canViewBillingField(normalizedRole, "insuranceId");
  const shouldMaskClinical = !canViewClinicalField(normalizedRole, "alerts");

  // Phase 7K: Patient profile view audit logging (one-time per mount)
  useEffect(() => {
    logAuditTrail(`Patient profile viewed`, "profile", patient.id);
  }, [patient.id]); // Only log when patient ID changes (mount or patient switch)

  // ─── Local Denied Helper (Phase 6G) ───────────────────────────────────────────────
  const handleDeniedAccess = (action: string, resource: string) => {
    toast({ title: `You do not have permission to ${action} ${resource}.`, variant: "error" });
    logDeniedAction({
      role: normalizedRole,
      action,
      resource,
      reason: "Insufficient permissions",
      severity: "medium",
    });
  };

  // ── Local helpers ──────────────────────────────────────────────────────────
  function appendTimeline(event: Omit<TimelineEvent, "id">, basePatient?: Patient): Patient {
    const base = basePatient ?? patient;
    const newEvent: TimelineEvent = { ...event, id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    return { ...base, timeline: [...(base.timeline || []), newEvent] };
  }

  function appendTimelineOnce(event: Omit<TimelineEvent, "id">, basePatient?: Patient, dedupeWindowMs = 3000): Patient {
    const base = basePatient ?? patient;
    const cutoff = Date.now() - dedupeWindowMs;
    const isDupe = (base.timeline || []).some(
      (e) =>
        e.type === event.type &&
        e.label === event.label &&
        e.note === event.note &&
        new Date(e.date).getTime() >= cutoff,
    );
    if (isDupe) return base;
    const newEvent: TimelineEvent = { ...event, id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    return { ...base, timeline: [...(base.timeline || []), newEvent] };
  }

  function formatFileSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function savePatientUpdate(updated: Patient, action: string, successMessage?: string) {
    onUpdatePatient(updated, action);
    if (successMessage) toast({ title: successMessage, variant: "success" });
  }

  // Phase 10D: Privacy request handlers
  useEffect(() => {
    if (tab === "privacy") {
      setPrivacyRequests(getPrivacyRequestsForPatient(patient.id));
      setPatientConsents(getPatientConsents(patient.id));
      setConsentHistory(getConsentHistory(patient.id));
      setExpiringConsents(getExpiringConsents(patient.id));
      setExpiredConsents(getExpiredConsents(patient.id));
      setOptedOutChannels(getOptedOutChannels(patient.id));
      
      const prefs = getCommunicationPreferences(patient.id);
      if (prefs) {
        setCommPreferences(prefs.preferences);
      }
    }
  }, [tab, patient.id]);

  const handleCreatePrivacyRequest = () => {
    if (!privacyRequestType || !canManagePrivacyRequests) {
      if (!canManagePrivacyRequests) {
        handleDeniedAccess("create", "privacy request");
      }
      return;
    }

    const request = createPrivacyRequest(
      patient.id,
      privacyRequestType,
      normalizedRole,
      privacyRequestReason,
      "medium"
    );

    if (request) {
      setPrivacyRequests([...privacyRequests, request]);
      setShowPrivacyRequestModal(false);
      setPrivacyRequestType(null);
      setPrivacyRequestReason("");
      
      // Audit log (PHI-safe)
      logAdminOperation({
        action: "privacy_request_created",
        module: "privacy",
        resourceType: privacyRequestType,
        resourceId: request.id,
        metadata: { patientId: patient.id },
        actor: normalizedRole,
        role: normalizedRole,
      });
      
      toast({ title: "Privacy request created successfully", variant: "success" });
    } else {
      toast({ title: "Failed to create privacy request", variant: "error" });
    }
  };

  const handleUpdatePrivacyRequestStatus = (requestId: string, newStatus: PrivacyRequestStatus) => {
    if (!canManagePrivacyRequests) {
      handleDeniedAccess("update", "privacy request status");
      return;
    }

    const success = updatePrivacyRequestStatus(requestId, newStatus, normalizedRole);
    if (success) {
      setPrivacyRequests(getPrivacyRequestsForPatient(patient.id));
      
      // Audit log (PHI-safe)
      logAdminOperation({
        action: "privacy_request_status_updated",
        module: "privacy",
        resourceType: "privacy_request",
        resourceId: requestId,
        metadata: { patientId: patient.id, newStatus },
        actor: normalizedRole,
        role: normalizedRole,
      });
      
      toast({ title: `Request status updated to ${newStatus}`, variant: "success" });
    } else {
      toast({ title: "Failed to update request status", variant: "error" });
    }
  };

  const handlePortabilityExport = () => {
    if (!canExportPortability) {
      handleDeniedAccess("generate", "portability export");
      return;
    }

    const exportData = generatePortabilityExport(patient.id, normalizedRole);
    if (exportData) {
      downloadExportFile(exportData);
      setShowPortabilityConfirm(false);
      
      // Audit log (PHI-safe)
      logAdminOperation({
        action: "portability_export",
        module: "privacy",
        resourceType: "patient_data",
        resourceId: patient.id,
        exportType: "portability",
        count: exportData.metadata.recordCount,
        metadata: { sections: exportData.metadata.sections },
        actor: normalizedRole,
        role: normalizedRole,
      });
      
      toast({ title: "Portability export downloaded", variant: "success" });
    } else {
      toast({ title: "Failed to generate portability export", variant: "error" });
    }
  };

  const handleConsentChange = (consentType: string, action: 'grant' | 'revoke') => {
    if (!canManageConsents) {
      handleDeniedAccess(action, "consent");
      return;
    }

    if (action === 'grant') {
      grantConsent(patient.id, consentType as any, normalizedRole, "patient_profile");
    } else {
      revokeConsent(patient.id, consentType as any, normalizedRole, "patient_profile");
    }

    setPatientConsents(getPatientConsents(patient.id));
    setConsentHistory(getConsentHistory(patient.id));
    
    // Audit log (PHI-safe)
    logAdminOperation({
      action: `consent_${action}ed`,
      module: "privacy",
      resourceType: "consent",
      resourceId: consentType,
      metadata: { patientId: patient.id },
      actor: normalizedRole,
      role: normalizedRole,
    });
    
    toast({ title: `Consent ${action}ed successfully`, variant: "success" });
  };

  const handleCommunicationPreferenceChange = (channel: CommunicationChannel, optedOut: boolean) => {
    if (!canManageCommunicationPreferences) {
      handleDeniedAccess("update", "communication preferences");
      return;
    }

    updateCommunicationPreference(patient.id, channel, optedOut, normalizedRole);
    setOptedOutChannels(getOptedOutChannels(patient.id));
    
    // Audit log (PHI-safe)
    logAdminOperation({
      action: "communication_preference_updated",
      module: "privacy",
      resourceType: "communication_preference",
      resourceId: channel,
      metadata: { patientId: patient.id, optedOut },
      actor: normalizedRole,
      role: normalizedRole,
    });
    
    toast({ title: "Communication preferences updated", variant: "success" });
  };

  function closeAllWorkflowModals() {
    setShowAppointment(false);
    setShowConsultation(false);
    setShowPrescription(false);
    setShowFileUpload(false);
    setShowInvoice(false);
    setShowCommunication(false);
    setShowFollowUp(false);
    setShowConsent(false);
    setQuickAction(null);
  }

  function handleVerificationToggle(key: string) {
    const updated = { ...patient, [key]: !patient[key as keyof Patient] };
    onUpdatePatient(updated as Patient, "verification updated");
  }

  function handleAddTimelineEvent(event: Omit<TimelineEvent, "id">) {
    const newEvent: TimelineEvent = {
      ...event,
      id: `tl-${Date.now()}`,
      // Phase 7F: Add metadata
      sourceType: event.sourceType || "manual",
      sourceId: event.sourceId,
      createdAt: new Date().toISOString(),
      createdBy: CURRENT_USER.name,
      immutable: event.immutable || false,
    };
    onUpdatePatient(
      { ...patient, timeline: [...(patient.timeline || []), newEvent] },
      "timeline event added",
    );
    // Phase 7F: Safe audit logging
    logAuditTrail(`Timeline event added: ${event.type} (source: ${event.sourceType || "manual"})`, "timeline", patient.id);
  }

  function handleDeleteTimelineEvent(id: string) {
    const eventToDelete = (patient.timeline || []).find(e => e.id === id);
    onUpdatePatient(
      { ...patient, timeline: (patient.timeline || []).filter((e) => e.id !== id) },
      "timeline event deleted",
    );
    // Phase 7F: Safe audit logging
    if (eventToDelete) {
      logAuditTrail(`Timeline event deleted: ${eventToDelete.type}`, "timeline", patient.id);
    }
  }

  function handleAddNote(note: Omit<PatientNote, "id">) {
    if (!canManageClinicalNotes) {
      handleDeniedAccess("add", "clinical note");
      return;
    }
    const newNote: PatientNote = { 
      ...note, 
      id: `note-${Date.now()}`,
      author: CURRENT_USER.name,
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: CURRENT_USER.name,
      versions: [],
    };
    onUpdatePatient(
      { ...patient, notes: [...(patient.notes || []), newNote] },
      "note added",
    );
    // Phase 7F: Safe audit logging
    logAuditTrail(`Note added: ${note.category || "general"}`, "note", patient.id);
  }

  function handleEditNote(id: string, updatedText: string) {
    if (!canManageClinicalNotes) {
      handleDeniedAccess("edit", "clinical note");
      return;
    }
    const noteToEdit = (patient.notes || []).find(n => n.id === id);
    if (!noteToEdit) return;
    
    // Phase 7I: Preserve previous version
    const previousVersion = {
      text: noteToEdit.text,
      updatedAt: noteToEdit.updatedAt || noteToEdit.date,
      updatedBy: noteToEdit.updatedBy || noteToEdit.author || CURRENT_USER.name,
    };
    
    const updatedNotes = (patient.notes || []).map(n => 
      n.id === id ? { 
        ...n, 
        text: updatedText,
        updatedAt: new Date().toISOString(),
        updatedBy: CURRENT_USER.name,
        versions: [...(n.versions || []), previousVersion],
      } : n
    );
    onUpdatePatient(
      { ...patient, notes: updatedNotes },
      "note edited",
    );
    // Phase 7I: Safe audit logging
    logAuditTrail(`Note edited: ${noteToEdit.category || "general"}`, "note", patient.id);
  }

  function handleDeleteNote(id: string) {
    if (!canManageClinicalNotes) {
      handleDeniedAccess("delete", "clinical note");
      return;
    }
    const noteToDelete = (patient.notes || []).find(n => n.id === id);
    // Phase 7F: Soft-delete instead of permanent delete
    const updatedNotes = (patient.notes || []).map(n => 
      n.id === id ? { ...n, deletedAt: new Date().toISOString(), deletedBy: CURRENT_USER.name } : n
    );
    onUpdatePatient(
      { ...patient, notes: updatedNotes },
      "note deleted",
    );
    // Phase 7F: Safe audit logging
    if (noteToDelete) {
      logAuditTrail(`Note deleted: ${noteToDelete.category || "general"}`, "note", patient.id);
    }
  }

  function handleToggleNotePin(id: string) {
    if (!canManageClinicalNotes) {
      handleDeniedAccess("edit", "clinical note");
      return;
    }
    onUpdatePatient({
      ...patient,
      notes: (patient.notes || []).map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n),
    }, "note pinned");
    // Phase 7F: Safe audit logging
    logAuditTrail(`Note pin toggled`, "note", patient.id);
  }

  function handleAddDocument(doc: Omit<PatientDocument, "id">) {
    if (!canManageDocuments) {
      handleDeniedAccess("add", "document");
      return;
    }
    const newDoc: PatientDocument = { ...doc, id: `doc-${Date.now()}` };
    onUpdatePatient(
      { ...patient, documents: [...(patient.documents || []), newDoc] },
      "document added",
    );
  }

  function handleDeleteDocument(id: string) {
    if (!canManageDocuments) {
      handleDeniedAccess("delete", "document");
      return;
    }
    onUpdatePatient(
      { ...patient, documents: (patient.documents || []).filter((d) => d.id !== id) },
      "document deleted",
    );
  }

  function handleToggleConsent(key: string) {
    if (!canManageConsents) {
      handleDeniedAccess("edit", "consent");
      return;
    }
    const consents = { ...(patient.consents || {}), [key]: !(patient.consents || {})[key] };
    const allSigned = CONSENT_TYPES.every((c) => consents[c.key]);
    
    // Phase 7I: Track consent history
    const consentRecord = {
      type: key,
      status: consents[key] ? "granted" as const : "revoked" as const,
      changedAt: new Date().toISOString(),
      changedBy: CURRENT_USER.name,
      source: "manual",
    };
    
    const updatedPatient = { 
      ...patient, 
      consents, 
      consentSigned: allSigned,
      consentHistory: [...((patient as any).consentHistory || []), consentRecord],
    };
    
    onUpdatePatient(updatedPatient, "consent updated");
    // Phase 7F: Safe audit logging
    const status = consents[key] ? "granted" : "revoked";
    logAuditTrail(`Consent ${status}: ${key}`, "consent", patient.id);
  }

  function handleAcknowledgeAlerts() {
    const now = new Date().toISOString();
    const criticalAlerts = (patient.alerts || []).filter(
      (a) => ALERT_SEVERITY[a as keyof typeof ALERT_SEVERITY] === "critical",
    );
    let updated = appendTimelineOnce({
      type: "note",
      label: "Medical Alerts Acknowledged",
      icon: "ti-shield-check",
      color: "#10b981",
      date: now,
      note: `Acknowledged: ${criticalAlerts.join(", ")}`,
    });
    updated = { ...updated, alertsReviewed: true, acknowledgedAlerts: criticalAlerts, updatedAt: now } as Patient;
    savePatientUpdate(updated, "alerts acknowledged", "Alerts acknowledged");
  }

  function handleCopyPatientId() {
    if (!navigator?.clipboard) { console.warn("Clipboard API not available"); return; }
    navigator.clipboard.writeText(patient.id).then(
      () => toast({ title: "Patient ID copied", variant: "success" }),
      () => console.warn("Failed to copy patient ID"),
    );
  }

  function handleUpdateFollowUp(updates: Partial<Patient>) {
    onUpdatePatient({ ...patient, ...updates }, "follow-up updated");
  }

  // Medical workflow handlers
  const handleBookAppointment = async (appointment: any) => {
    if (activeWorkflowLoading) return;
    // Validation
    if (!appointment.appointment_date || isNaN(Date.parse(appointment.appointment_date))) {
      toast({ title: "A valid appointment date is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("appointment");
    const now = new Date().toISOString();
    const nextAppointment = `${appointment.appointment_date}${appointment.appointment_time ? " " + appointment.appointment_time : ""}`;
    const tlNote = [
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.appointment_type,
      appointment.reason,
    ].filter(Boolean).join(" · ");
    let backendOk = true;
    try {
      if (typeof apiClient.bookAppointment === "function") {
        await apiClient.bookAppointment(appointment);
      }
    } catch (error) {
      console.error('Failed to book appointment (backend):', error);
      backendOk = false;
    }
    try {
      let updated = appendTimelineOnce({
        type: 'appointment',
        label: 'Appointment Booked',
        icon: 'ti-calendar',
        color: '#7c4fff',
        date: now,
        note: tlNote || `Appointment scheduled for ${appointment.appointment_date}`,
      });
      updated = { ...updated, nextAppointment, status: "Scheduled" as Patient["status"], updatedAt: now };
      savePatientUpdate(updated, "appointment booked", backendOk ? "Appointment booked" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowAppointment(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to book appointment:', err);
      toast({ title: "Failed to book appointment", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleStartConsultation = async (consultation: any) => {
    if (activeWorkflowLoading) return;
    if (!consultation.chief_complaint && !consultation.diagnosis && !consultation.treatment_plan) {
      toast({ title: "Chief complaint, diagnosis, or treatment plan is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("consultation");
    const now = new Date().toISOString();
    const tlNote = [consultation.chief_complaint, consultation.diagnosis]
      .filter(Boolean).join(" · ") || "Consultation recorded";
    let backendOk = true;
    try {
      if (typeof apiClient.startConsultation === "function") {
        await apiClient.startConsultation(consultation);
      }
    } catch (error) {
      console.error('Failed to start consultation (backend):', error);
      backendOk = false;
    }
    try {
      let updated = appendTimelineOnce({
        type: 'consultation',
        label: 'Consultation Started',
        icon: 'ti-stethoscope',
        color: '#00b4a0',
        date: now,
        note: tlNote,
      });
      updated = { ...updated, status: "Active" as Patient["status"], lastVisit: now, updatedAt: now };
      savePatientUpdate(updated, "consultation started", backendOk ? "Consultation started" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowConsultation(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to start consultation:', err);
      toast({ title: "Failed to start consultation", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleSavePrescriptions = async (prescriptions: any[]) => {
    if (activeWorkflowLoading) return;
    if (!canManagePrescriptions) {
      handleDeniedAccess("manage", "prescriptions");
      return;
    }
    const validRx = prescriptions.filter((rx) => !!(rx.medication ?? rx.name ?? "").trim());
    if (validRx.length === 0) {
      toast({ title: "At least one medication name is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("prescription");
    const now = new Date().toISOString();
    const normalizedRx: Prescription[] = validRx.map((rx, i) => ({
      id: rx.id ?? `rx-${Date.now()}-${i}`,
      medication: rx.medication ?? rx.name ?? "",
      dosage: rx.dosage ?? "",
      frequency: rx.frequency ?? "",
      duration: rx.duration ?? "",
      prescribedBy: rx.prescribedBy ?? rx.prescribed_by ?? "",
      date: rx.date ?? now,
      status: rx.status ?? "Active",
      ...rx,
    }));
    const firstName = normalizedRx[0]?.medication ?? "";
    const tlNote = `${normalizedRx.length} medication${normalizedRx.length !== 1 ? "s" : ""}${firstName ? ` · ${firstName}` : ""}`;
    let backendOk = true;
    try {
      if (typeof apiClient.createPrescriptions === "function") {
        await apiClient.createPrescriptions(validRx);
      }
    } catch (error) {
      console.error('Failed to save prescriptions (backend):', error);
      backendOk = false;
    }
    try {
      let updated = appendTimelineOnce({
        type: 'prescription',
        label: 'Prescription Saved',
        icon: 'ti-pill',
        color: '#ff7c4f',
        date: now,
        note: tlNote,
      });
      updated = {
        ...updated,
        prescriptions: [...(patient.prescriptions || []), ...normalizedRx],
        updatedAt: now,
      };
      savePatientUpdate(updated, "prescriptions saved", backendOk ? "Prescription saved" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowPrescription(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to save prescriptions:', err);
      toast({ title: "Failed to save prescription", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    if (activeWorkflowLoading) return;
    if (!canManageDocuments) {
      handleDeniedAccess("upload", "documents");
      return;
    }
    if (!files || files.length === 0) {
      toast({ title: "At least one file is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("fileupload");
    const now = new Date().toISOString();
    const newDocs: PatientDocument[] = files.map((f, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name: f.name,
      type: (f.type || "other") as PatientDocument["type"],
      uploaded: now,
      size: formatFileSize(f.size),
      verified: false,
    }));
    const tlNote = `${files.length} file${files.length !== 1 ? "s" : ""} uploaded`;
    let backendOk = true;
    try {
      if (typeof apiClient.uploadFiles === "function") {
        await apiClient.uploadFiles(files, { patient_id: patient.id });
      }
    } catch (error) {
      console.error('Failed to upload files (backend):', error);
      backendOk = false;
    }
    try {
      let updated = appendTimelineOnce({
        type: 'report',
        label: 'Documents Uploaded',
        icon: 'ti-file-analytics',
        color: '#4f7cff',
        date: now,
        note: tlNote,
      });
      const allDocs = [...(patient.documents || []), ...newDocs];
      updated = { ...updated, documents: allDocs, documentsComplete: allDocs.length > 0, updatedAt: now };
      savePatientUpdate(updated, "documents uploaded", backendOk ? "Documents uploaded" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowFileUpload(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to upload files:', err);
      toast({ title: "Failed to upload documents", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleCreateInvoice = async (invoice: any) => {
    if (activeWorkflowLoading) return;
    const items = invoice.items ?? invoice.line_items ?? [];
    if (!items || items.length === 0) {
      toast({ title: "At least one invoice item is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("invoice");
    const now = new Date().toISOString();
    const tlNote = [
      invoice.invoice_number ? `#${invoice.invoice_number}` : null,
      invoice.total != null ? `Total: ${invoice.total}` : null,
    ].filter(Boolean).join(" · ") || "Invoice created";
    let backendOk = true;
    try {
      if (typeof apiClient.createInvoice === "function") {
        await apiClient.createInvoice(invoice);
      }
    } catch (error) {
      console.error('Failed to create invoice (backend):', error);
      backendOk = false;
    }
    try {
      const updated = appendTimelineOnce({
        type: 'note',
        label: 'Invoice Created',
        icon: 'ti-receipt',
        color: '#10b981',
        date: now,
        note: tlNote,
      });
      savePatientUpdate({ ...updated, updatedAt: now }, "invoice created", backendOk ? "Invoice created" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowInvoice(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to create invoice:', err);
      toast({ title: "Failed to create invoice", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleCallPatient = (patientId: string) => {
    if (!patient.phone) {
      toast({ title: "No phone number on record", variant: "error" });
      return;
    }
    const now = new Date().toISOString();
    let updated = appendTimelineOnce({
      type: 'note',
      label: 'Patient Called',
      icon: 'ti-phone',
      color: '#7c4fff',
      date: now,
      note: `Phone call initiated to ${patient.phone}`,
    });
    updated = {
      ...updated,
      callAttempts: (patient.callAttempts ?? 0) + 1,
      lastContacted: now,
      updatedAt: now,
    };
    savePatientUpdate(updated, "call logged", "Call logged");
    setShowCommunication(false);
    setQuickAction(null);
    // Open tel link after saving so we don't lose the update if the page navigates
    window.open(`tel:${patient.phone}`, "_self");
  };

  const handleSendMessage = async (message: any) => {
    if (activeWorkflowLoading) return;
    const content = message.content ?? message.body ?? message.message ?? "";
    if (!content.trim()) {
      toast({ title: "Message content is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("message");
    const now = new Date().toISOString();
    const channel = message.message_type ?? message.channel ?? "Message";
    const tlNote = `${channel} sent to patient`;
    let backendOk = true;
    try {
      if (typeof apiClient.sendCommunication === "function") {
        await apiClient.sendCommunication(message);
      }
    } catch (error) {
      console.error('Failed to send message (backend):', error);
      backendOk = false;
    }
    try {
      let updated = appendTimelineOnce({
        type: 'note',
        label: 'Message Sent',
        icon: 'ti-message',
        color: '#7c4fff',
        date: now,
        note: tlNote,
      });
      updated = { ...updated, lastContacted: now, updatedAt: now };
      savePatientUpdate(updated, "message sent", backendOk ? "Message logged" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowCommunication(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast({ title: "Failed to send message", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleScheduleFollowUp = async (followUp: any) => {
    if (activeWorkflowLoading) return;
    if (!followUp.follow_up_date) {
      toast({ title: "A follow-up date is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("followup");
    const now = new Date().toISOString();
    const tlNote = [followUp.follow_up_date, followUp.reason].filter(Boolean).join(" · ");
    let backendOk = true;
    try {
      if (typeof apiClient.scheduleFollowUp === "function") {
        await apiClient.scheduleFollowUp(followUp);
      }
    } catch (error) {
      console.error('Failed to schedule follow-up (backend):', error);
      backendOk = false;
    }
    try {
      let updated = appendTimelineOnce({
        type: 'followup',
        label: 'Follow-up Scheduled',
        icon: 'ti-clock',
        color: '#f0a500',
        date: now,
        note: tlNote || `Follow-up scheduled for ${followUp.follow_up_date}`,
      });
      updated = {
        ...updated,
        followUpDate: followUp.follow_up_date,
        followUpReason: followUp.reason,
        followUpStatus: "Pending" as const,
        priority: followUp.priority ?? patient.priority ?? "Medium",
        updatedAt: now,
      };
      savePatientUpdate(updated, "follow-up scheduled", backendOk ? "Follow-up scheduled" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowFollowUp(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      toast({ title: "Failed to schedule follow-up", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const handleSignConsent = async (consent: any) => {
    if (activeWorkflowLoading) return;
    if (!consent.consent_type) {
      toast({ title: "Consent type is required", variant: "error" });
      return;
    }
    setActiveWorkflowLoading("consent");
    const now = new Date().toISOString();
    const tlNote = `${consent.consent_type} consent signed`;
    let backendOk = true;
    try {
      if (typeof apiClient.createConsent === "function") {
        await apiClient.createConsent(consent);
      }
    } catch (error) {
      console.error('Failed to sign consent (backend):', error);
      backendOk = false;
    }
    try {
      const updatedConsents = { ...(patient.consents || {}), [consent.consent_type]: true };
      const allSigned = CONSENT_TYPES.every((c) => updatedConsents[c.key]);
      let updated = appendTimelineOnce({
        type: 'note',
        label: 'Consent Updated',
        icon: 'ti-writing',
        color: '#10b981',
        date: now,
        note: tlNote,
      });
      updated = { ...updated, consents: updatedConsents, consentSigned: allSigned, updatedAt: now };
      savePatientUpdate(updated, "consent updated", backendOk ? "Consent updated" : undefined);
      if (!backendOk) toast({ title: "Saved locally. Backend sync unavailable.", variant: "warning" });
      setShowConsent(false);
      setQuickAction(null);
    } catch (err) {
      console.error('Failed to sign consent:', err);
      toast({ title: "Failed to update consent", variant: "error" });
    } finally {
      setActiveWorkflowLoading(null);
    }
  };

  const consentsSigned = CONSENT_TYPES.filter((c) => (patient.consents || {})[c.key]).length;

  const tabCounts: Partial<Record<TabId, number>> = useMemo(() => ({
    timeline:      (patient.timeline     || []).length,
    prescriptions: (patient.prescriptions|| []).length,
    labresults:    (patient.labResults   || []).length,
    documents:     (patient.documents    || []).length,
    notes:         (patient.notes        || []).length,
    consents:      consentsSigned > 0 ? consentsSigned : undefined,
    audit:         auditEntries.length,
    followup:      patient.followUpDate ? 1 : 0,
  }), [patient.timeline, patient.prescriptions, patient.labResults, patient.documents, patient.notes, consentsSigned, auditEntries, patient.followUpDate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <style>{`
        .pp-identity { padding: 14px 16px 10px; display: flex; align-items: flex-start; gap: 12; }
        .pp-identity .pp-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .pp-tabs { padding: 0 16px; display: flex; gap: 2px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .pp-tabs::-webkit-scrollbar { display: none; }
        .pp-tab-content { padding: 16px; }
        .pp-quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 640px) {
          .pp-identity { flex-wrap: wrap; padding: 10px 12px 8px !important; }
          .pp-identity .pp-actions { width: 100%; justify-content: flex-start; margin-top: 4px; }
          .pp-identity .pp-actions .btn { min-height: 36px; }
          .pp-tab-content { padding: 10px !important; }
          .pp-tabs button { padding: 8px 10px !important; font-size: 11px !important; }
          .pp-tabs button .pp-tab-label { display: none; }
          .pp-tabs button i { font-size: 16px !important; }
          /* On small screens keep only Age+Blood in the meta row; DOB/ID/Doctor are secondary */
          .pp-meta-id, .pp-meta-doctor { display: none !important; }
          .pp-quick-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {/* ── Header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {/* Critical alert banner */}
        {(patient.alerts || []).some((a) => ALERT_SEVERITY[a as keyof typeof ALERT_SEVERITY] === "critical") && (
          <div style={{
            background: "var(--red-bg)", borderBottom: "2px solid var(--red)",
            padding: "8px 16px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "var(--red)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 12, color: "#fff" }} />
            </div>
            <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "#991b1b", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Critical Medical Alert
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(patient.alerts || [])
                .filter((a) => ALERT_SEVERITY[a as keyof typeof ALERT_SEVERITY] === "critical")
                .map((a) => (
                  <span key={a} style={{
                    padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--red)",
                    color: "#fff", fontSize: "var(--font-xs)", fontWeight: 700,
                  }}>{a}</span>
                ))}
            </div>
            {!(patient as any).alertsReviewed ? (
              <button
                className="btn btn-ghost"
                onClick={handleAcknowledgeAlerts}
                style={{ marginLeft: "auto", fontSize: "var(--font-xs)", color: "#991b1b", border: "1px solid #991b1b", padding: "3px 10px" }}
              >
                <i className="ti ti-shield-check" style={{ fontSize: 11 }} /> Acknowledge
              </button>
            ) : (
              <span style={{ marginLeft: "auto", fontSize: "var(--font-xs)", color: "#16a34a", fontWeight: 600 }}>
                <i className="ti ti-shield-check" style={{ fontSize: 11 }} /> Reviewed
              </span>
            )}
          </div>
        )}

        {/* Identity row */}
        <div className="pp-identity" style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button className="btn btn-ghost" onClick={onBack} style={{ padding: "6px 10px", fontSize: "var(--font-sm)", flexShrink: 0 }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
            <span className="desktop-only">Back</span>
          </button>

          {/* Avatar */}
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: avatarBg + "22", color: avatarBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800,
          }}>
            {getInitials(patient.name)}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: "var(--text)", margin: 0 }}>
                {patient.name}
              </h2>
              <StatusBadge status={patient.status} />
              <RiskBadge patient={patient} />
              {patient.status === "VIP" && (
                <span className="badge" style={{ background: "#fff7ed", color: "#92400e", border: "1px solid #f97316" }}>
                  <i className="ti ti-crown" style={{ fontSize: 10 }} /> VIP
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              {[
                { label: "ID",      value: patient.id,           icon: "ti-id",          cls: "pp-meta-id" },
                { label: "Age",     value: `${patient.age}y · ${patient.gender}`, icon: "ti-user", cls: "" },
                { label: "DOB",     value: fmtDate(patient.dob), icon: "ti-calendar",    cls: "desktop-only" },
                { label: "Blood",   value: patient.bloodGroup,   icon: "ti-droplet",     cls: "" },
                { label: "Doctor",  value: patient.doctor,       icon: "ti-stethoscope", cls: "pp-meta-doctor" },
              ].map(({ label, value, icon, cls }) => (
                <span key={label} className={cls} style={{ fontSize: "var(--font-xs)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 11 }} />
                  <strong style={{ color: "var(--text)" }}>{value}</strong>
                </span>
              ))}
              <button
                onClick={handleCopyPatientId}
                title="Copy patient ID"
                style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "var(--muted)", fontSize: "var(--font-xs)" }}
              >
                <i className="ti ti-copy" style={{ fontSize: 11 }} />
              </button>
            </div>
            {((patient as any).updatedAt || (patient as any).createdAt) && (
              <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                {(patient as any).createdAt && (
                  <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>
                    Created {fmtDate((patient as any).createdAt)}
                  </span>
                )}
                {(patient as any).updatedAt && (
                  <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>
                    Updated {fmtDate((patient as any).updatedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Alert chips */}
            {(patient.alerts || []).length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                {(patient.alerts || []).map((a) => <AlertChip key={a} alert={a} />)}
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="pp-actions" style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {patient.phone && (
              <button className="btn btn-ghost" onClick={() => { window.open(`tel:${patient.phone}`, "_self"); }} title={`Call ${shouldMaskContact ? maskPhone(patient.phone) : patient.phone}`} style={{ fontSize: "var(--font-sm)" }}>
                <i className="ti ti-phone" style={{ fontSize: 14, color: "var(--green)" }} />
                <span className="desktop-only">Call</span>
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowCommunication(true)} style={{ fontSize: "var(--font-sm)" }}>
              <i className="ti ti-message" style={{ fontSize: 14 }} />
              <span className="desktop-only">Message</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAppointment(true)} style={{ fontSize: "var(--font-sm)" }}>
              <i className="ti ti-calendar-plus" style={{ fontSize: 14, color: "var(--accent)" }} />
              <span className="desktop-only">Book</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setShowEmergency(true)} style={{ fontSize: "var(--font-sm)" }}>
              <i className="ti ti-emergency-bed" style={{ fontSize: 14, color: "var(--red)" }} />
              <span className="desktop-only">Emergency</span>
            </button>
            {canEditPatient && (
              <button className="btn btn-primary" onClick={onEditPatient} style={{ fontSize: "var(--font-sm)" }}>
                <i className="ti ti-edit" style={{ fontSize: 14 }} />
                <span className="desktop-only">Edit</span>
              </button>
            )}
            {canDeletePatient && (
              <button className="btn btn-danger" onClick={() => { closeAllWorkflowModals(); setShowDelete(true); }} style={{ fontSize: "var(--font-sm)" }}>
                <i className="ti ti-trash" style={{ fontSize: 14 }} />
              </button>
            )}
          </div>
        </div>

        {/* NBA bar */}
        {nba.urgency !== "none" && (
          <div style={{
            margin: "0 16px 10px",
            padding: "8px 12px", borderRadius: "var(--radius)",
            background: nba.bg, border: `1px solid ${nba.color}30`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <i className={`ti ${nba.icon}`} style={{ fontSize: 15, color: nba.color, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: nba.color }}>
                {nba.label}
              </span>
              <span style={{ fontSize: "var(--font-xs)", color: nba.color + "cc", marginLeft: 8 }}>
                {nba.detail}
              </span>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="pp-tabs" style={{ padding: "0 16px", display: "flex", gap: 2, overflowX: "auto" }}>
          {PROFILE_TABS.filter(({ id }) => {
            // Filter tabs based on permissions
            if (id === "prescriptions") return canViewPrescriptions;
            if (id === "labresults") return canViewLabResults;
            if (id === "notes") return canViewClinicalNotes;
            if (id === "documents") return canViewDocuments;
            if (id === "audit") return canViewAuditEntries;
            if (id === "consents") return canViewConsents;
            return true; // overview, timeline, followup are always visible
          }).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 12px", borderRadius: "var(--radius) var(--radius) 0 0",
                border: "1px solid transparent", borderBottom: "none",
                fontSize: "var(--font-sm)", fontWeight: tab === id ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                color:      tab === id ? "var(--accent)" : "var(--muted)",
                background: tab === id ? "var(--bg)" : "transparent",
                marginBottom: tab === id ? -1 : 0,
                borderColor: tab === id ? "var(--border)" : "transparent",
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
              <span className="pp-tab-label">{label}</span>
              {tabCounts[id] !== undefined && tabCounts[id]! > 0 && (
                <span style={{
                  fontSize: "var(--font-2xs)", fontWeight: 700, padding: "1px 5px",
                  borderRadius: "var(--radius-full)",
                  background: tab === id ? "var(--accent-soft)" : "var(--surface3)",
                  color: tab === id ? "var(--accent)" : "var(--muted)",
                }}>
                  {tabCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        <div className="fade-in pp-tab-content" key={tab} style={{ padding: 16 }}>
          {/* Fallback if current tab becomes restricted */}
          {tab === "prescriptions" && !canViewPrescriptions && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              <i className="ti ti-lock" style={{ fontSize: 32, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Restricted Section</div>
              <div style={{ fontSize: "var(--font-sm)" }}>You do not have permission to view prescriptions.</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setTab("overview")}>
                Return to Overview
              </button>
            </div>
          )}
          {tab === "labresults" && !canViewLabResults && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              <i className="ti ti-lock" style={{ fontSize: 32, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Restricted Section</div>
              <div style={{ fontSize: "var(--font-sm)" }}>You do not have permission to view lab results.</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setTab("overview")}>
                Return to Overview
              </button>
            </div>
          )}
          {tab === "notes" && !canViewClinicalNotes && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              <i className="ti ti-lock" style={{ fontSize: 32, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Restricted Section</div>
              <div style={{ fontSize: "var(--font-sm)" }}>You do not have permission to view clinical notes.</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setTab("overview")}>
                Return to Overview
              </button>
            </div>
          )}
          {tab === "documents" && !canViewDocuments && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              <i className="ti ti-lock" style={{ fontSize: 32, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Restricted Section</div>
              <div style={{ fontSize: "var(--font-sm)" }}>You do not have permission to view documents.</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setTab("overview")}>
                Return to Overview
              </button>
            </div>
          )}
          {tab === "audit" && !canViewAuditEntries && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              <i className="ti ti-lock" style={{ fontSize: 32, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Restricted Section</div>
              <div style={{ fontSize: "var(--font-sm)" }}>You do not have permission to view audit logs.</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setTab("overview")}>
                Return to Overview
              </button>
            </div>
          )}
          {tab === "consents" && !canViewConsents && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              <i className="ti ti-lock" style={{ fontSize: 32, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Restricted Section</div>
              <div style={{ fontSize: "var(--font-sm)" }}>You do not have permission to view consents.</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setTab("overview")}>
                Return to Overview
              </button>
            </div>
          )}

          {/* Normal tab content */}
          {tab === "overview"  && (
            <OverviewTab
              patient={patient}
              role={role}
              onVerificationToggle={handleVerificationToggle}
              snapshot={snapshot}
              readiness={readiness}
              onQuickAction={setQuickAction}
              onBookAppointment={() => setShowAppointment(true)}
              onStartConsultation={() => setShowConsultation(true)}
              onPrescription={() => setShowPrescription(true)}
              onFileUpload={() => setShowFileUpload(true)}
              onInvoice={() => setShowInvoice(true)}
              onCommunication={() => setShowCommunication(true)}
              onFollowUp={() => setShowFollowUp(true)}
              onConsent={() => setShowConsent(true)}
              onAcknowledgeAlerts={handleAcknowledgeAlerts}
              consentsSigned={consentsSigned}
              consentsTotal={CONSENT_TYPES.length}
            />
          )}
          {tab === "timeline"  && <TimelineTab patient={patient} role={role} onAddEvent={handleAddTimelineEvent} onDeleteEvent={handleDeleteTimelineEvent} />}
          {tab === "prescriptions" && canViewPrescriptions && <PrescriptionHistoryTab patient={patient} role={role} onUpdatePatient={onUpdatePatient} onAddPrescription={canManagePrescriptions ? () => setShowPrescription(true) : undefined} />}
          {tab === "labresults" && canViewLabResults && <LabResultsTab patient={patient} role={role} onAddLabResult={() => toast("Lab result modal would open here. For now, please use the Documents tab to upload lab result files.", "info")} />}
          {tab === "documents" && canViewDocuments && <DocumentsTab patient={patient} role={role} onAddDoc={handleAddDocument} onDeleteDoc={handleDeleteDocument} onUploadFiles={canManageDocuments ? () => setShowFileUpload(true) : undefined} />}
          {tab === "notes"     && canViewClinicalNotes && <NotesTab patient={patient} role={role} onAddNote={handleAddNote} onDeleteNote={handleDeleteNote} onTogglePin={handleToggleNotePin} />}
          {tab === "followup"  && <FollowUpTab patient={patient} onUpdate={handleUpdateFollowUp} onScheduleFollowUp={() => setShowFollowUp(true)} />}
          {tab === "consents"  && canViewConsents && <ConsentsTab patient={patient} onToggle={handleToggleConsent} onSignNewConsent={canManageConsents ? () => setShowConsent(true) : undefined} />}
          {tab === "privacy"   && canViewPrivacy && <PrivacyTab 
            patient={patient} 
            role={normalizedRole}
            privacyRequests={privacyRequests}
            patientConsents={patientConsents}
            consentHistory={consentHistory}
            expiringConsents={expiringConsents}
            expiredConsents={expiredConsents}
            optedOutChannels={optedOutChannels}
            commPreferences={commPreferences}
            onCreateRequest={canManagePrivacyRequests ? (type: PrivacyRequestType) => { setPrivacyRequestType(type); setShowPrivacyRequestModal(true); } : undefined}
            onUpdateRequestStatus={canManagePrivacyRequests ? handleUpdatePrivacyRequestStatus : undefined}
            onPortabilityExport={canExportPortability ? () => setShowPortabilityConfirm(true) : undefined}
            onConsentChange={canManageConsents ? handleConsentChange : undefined}
            onCommPreferenceChange={canManageCommunicationPreferences ? handleCommunicationPreferenceChange : undefined}
          />}
          {tab === "audit"     && canViewAuditEntries && <AuditTab entries={auditEntries} />}
        </div>
      </div>

      {/* ── Modals ── */}
      {showEmergency && <EmergencyModal patient={patient} onClose={() => setShowEmergency(false)} />}
      {showDelete && (
        <ConfirmDeleteModal
          patient={patient}
          onConfirm={() => { setShowDelete(false); closeAllWorkflowModals(); onDeletePatient(patient.id); }}
          onClose={() => setShowDelete(false)}
        />
      )}
      {quickAction && (
        <QuickActionModal
          action={quickAction}
          patient={patient}
          onClose={() => setQuickAction(null)}
          onBookAppointment={() => { setQuickAction(null); setShowAppointment(true); }}
          onStartConsultation={() => { setQuickAction(null); setShowConsultation(true); }}
          onPrescription={() => { setQuickAction(null); setShowPrescription(true); }}
          onFileUpload={() => { setQuickAction(null); setShowFileUpload(true); }}
          onInvoice={() => { setQuickAction(null); setShowInvoice(true); }}
          onCommunication={() => { setQuickAction(null); setShowCommunication(true); }}
          onFollowUp={() => { setQuickAction(null); setShowFollowUp(true); }}
          onConsent={() => { setQuickAction(null); setShowConsent(true); }}
        />
      )}
      
      {/* Medical Workflow Modals */}
      {showAppointment && (
        <AppointmentBooking
          patientId={patient.id}
          patientName={patient.name}
          onBookAppointment={handleBookAppointment}
          onCancel={() => setShowAppointment(false)}
        />
      )}
      {showConsultation && (
        <ConsultationWorkflow
          patientId={patient.id}
          patientName={patient.name}
          onStartConsultation={handleStartConsultation}
          onCancel={() => setShowConsultation(false)}
        />
      )}
      {showPrescription && (
        <PrescriptionManager
          patientId={patient.id}
          patientName={patient.name}
          onSavePrescriptions={handleSavePrescriptions}
          onCancel={() => setShowPrescription(false)}
        />
      )}
      {showFileUpload && (
        <FileUpload
          patientId={patient.id}
          patientName={patient.name}
          onUploadFiles={handleUploadFiles}
          onCancel={() => setShowFileUpload(false)}
        />
      )}
      {showInvoice && (
        <InvoiceGenerator
          patientId={patient.id}
          patientName={patient.name}
          onCreateInvoice={handleCreateInvoice}
          onCancel={() => setShowInvoice(false)}
        />
      )}
      {showCommunication && (
        <PatientCommunication
          patientId={patient.id}
          patientName={patient.name}
          patientPhone={patient.phone}
          patientEmail={patient.email}
          onCallPatient={handleCallPatient}
          onSendMessage={handleSendMessage}
          onCancel={() => setShowCommunication(false)}
        />
      )}
      {showFollowUp && (
        <FollowUpScheduler
          patientId={patient.id}
          patientName={patient.name}
          onScheduleFollowUp={handleScheduleFollowUp}
          onCancel={() => setShowFollowUp(false)}
        />
      )}
      {showConsent && (
        <ConsentManager
          patientId={patient.id}
          patientName={patient.name}
          onSignConsent={handleSignConsent}
          onCancel={() => setShowConsent(false)}
        />
      )}

      {/* Phase 10D: Privacy Request Modal */}
      {showPrivacyRequestModal && privacyRequestType && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowPrivacyRequestModal(false); }}>
          <div style={{
            background: "var(--surface)", borderRadius: "var(--radius)",
            padding: 24, maxWidth: 500, width: "90%", maxHeight: "90vh", overflowY: "auto"
          }}>
            <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
              Create {privacyRequestType.replace(/_/g, ' ').toUpperCase()}
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Reason (optional)
              </label>
              <textarea
                value={privacyRequestReason}
                onChange={(e) => setPrivacyRequestReason(e.target.value)}
                placeholder="Enter reason for this request..."
                style={{
                  width: "100%", minHeight: 80, padding: "8px 12px",
                  borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  fontSize: "var(--font-sm)", resize: "vertical"
                }}
                maxLength={500}
              />
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 4 }}>
                {privacyRequestReason.length}/500 characters
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowPrivacyRequestModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreatePrivacyRequest}>
                Create Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 10D: Portability Export Confirmation Modal */}
      {showPortabilityConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowPortabilityConfirm(false); }}>
          <div style={{
            background: "var(--surface)", borderRadius: "var(--radius)",
            padding: 24, maxWidth: 500, width: "90%"
          }}>
            <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
              Confirm Data Portability Export
            </h3>
            <div style={{ marginBottom: 16, fontSize: "var(--font-sm)", color: "var(--muted)" }}>
              This will generate a patient-specific data portability export for patient ID: <strong>{patient.id}</strong>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: "var(--amber-bg)", borderRadius: "var(--radius)", fontSize: "var(--font-xs)", color: "var(--amber)" }}>
              <i className="ti ti-alert-triangle" /> This export contains patient data by design for portability purposes. Handle with appropriate security measures.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowPortabilityConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handlePortabilityExport}>
                Confirm Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({
  patient, role, onVerificationToggle, snapshot, readiness, onQuickAction,
  onBookAppointment, onStartConsultation, onPrescription, onFileUpload,
  onInvoice, onCommunication, onFollowUp, onConsent,
  onAcknowledgeAlerts, consentsSigned, consentsTotal,
}: {
  patient: Patient;
  role: UserRole;
  onVerificationToggle: (key: string) => void;
  snapshot: string;
  readiness: ReturnType<typeof calcVisitReadiness>;
  onQuickAction: (a: string) => void;
  onBookAppointment?: () => void;
  onStartConsultation?: () => void;
  onPrescription?: () => void;
  onFileUpload?: () => void;
  onInvoice?: () => void;
  onCommunication?: () => void;
  onFollowUp?: () => void;
  onConsent?: () => void;
  onAcknowledgeAlerts?: () => void;
  consentsSigned?: number;
  consentsTotal?: number;
}) {
  // Profile completeness score
  const completenessChecks = useMemo(() => [
    !!patient.phone,
    !!patient.dob,
    !!patient.emergencyName,
    !!(patient.insuranceStatus && patient.insuranceStatus !== "None") || !!patient.insurer,
    !!patient.consentSigned,
    !!patient.documentsComplete,
    !!patient.doctor,
    !!patient.bloodGroup,
  ], [patient.phone, patient.dob, patient.emergencyName, patient.insuranceStatus, patient.insurer, patient.consentSigned, patient.documentsComplete, patient.doctor, patient.bloodGroup]);
  const completenessScore = useMemo(() => completenessChecks.filter(Boolean).length, [completenessChecks]);
  const completenessTotal = completenessChecks.length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
      {/* Main col */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── At-a-glance safety strip ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {/* Risk */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface2)", border: "1px solid var(--border)", fontSize: "var(--font-xs)" }}>
            <i className="ti ti-activity" style={{ fontSize: 11, color: "var(--muted)" }} />
            <span style={{ color: "var(--muted)" }}>Risk:</span>
            <RiskBadge patient={patient} />
          </div>
          {/* Insurance */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface2)", border: "1px solid var(--border)", fontSize: "var(--font-xs)" }}>
            <i className="ti ti-shield" style={{ fontSize: 11, color: "var(--muted)" }} />
            <span style={{ color: "var(--muted)" }}>Insurance:</span>
            <InsuranceBadge status={patient.insuranceStatus} />
          </div>
          {/* Consent */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface2)", border: "1px solid var(--border)", fontSize: "var(--font-xs)" }}>
            <i className="ti ti-writing" style={{ fontSize: 11, color: "var(--muted)" }} />
            <span style={{ color: "var(--muted)" }}>Consents:</span>
            <span style={{ fontWeight: 700, color: consentsSigned === consentsTotal ? "var(--green)" : "var(--amber)" }}>
              {consentsSigned ?? 0}/{consentsTotal ?? 0}
            </span>
          </div>
          {/* Documents */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface2)", border: "1px solid var(--border)", fontSize: "var(--font-xs)" }}>
            <i className="ti ti-files" style={{ fontSize: 11, color: "var(--muted)" }} />
            <span style={{ color: "var(--muted)" }}>Docs:</span>
            <span style={{ fontWeight: 700, color: patient.documentsComplete ? "var(--green)" : "var(--amber)" }}>
              {patient.documentsComplete ? "Complete" : (patient.documents || []).length > 0 ? "Partial" : "Missing"}
            </span>
          </div>
          {/* Next appt */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--surface2)", border: "1px solid var(--border)", fontSize: "var(--font-xs)" }}>
            <i className="ti ti-calendar" style={{ fontSize: 11, color: "var(--muted)" }} />
            <span style={{ color: "var(--muted)" }}>Next appt:</span>
            <span style={{ fontWeight: 700, color: patient.nextAppointment ? "var(--text)" : "var(--amber)" }}>
              {patient.nextAppointment ? fmtDate(patient.nextAppointment) : "None"}
            </span>
          </div>
          {/* Follow-up */}
          {patient.followUpDate && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-full)", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", fontSize: "var(--font-xs)" }}>
              <i className="ti ti-clock" style={{ fontSize: 11, color: "var(--amber)" }} />
              <span style={{ color: "var(--amber)", fontWeight: 600 }}>Follow-up: {fmtDate(patient.followUpDate)}</span>
            </div>
          )}
        </div>

        {/* Profile completeness */}
        <div className="card card-padded" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
              Profile completeness
            </span>
            <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--surface3)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${(completenessScore / completenessTotal) * 100}%`,
                background: completenessScore === completenessTotal ? "var(--green)" : "var(--accent)",
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{
              fontSize: "var(--font-xs)", fontWeight: 700,
              color: completenessScore === completenessTotal ? "var(--green)" : "var(--muted)",
              whiteSpace: "nowrap",
            }}>
              {completenessScore}/{completenessTotal}
            </span>
          </div>
        </div>

        {/* Snapshot */}
        <div className="card card-padded" style={{
          background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)",
          border: "1px solid var(--accent)30",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <i className="ti ti-sparkles" style={{ fontSize: 16, color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                AI Snapshot
              </div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--text)", lineHeight: 1.7 }}>
                {snapshot}
              </p>
            </div>
          </div>
        </div>

        {/* Demographics */}
        <InfoCard title="Demographics" icon="ti-user" iconBg="var(--blue-bg)" iconColor="var(--blue)">
          <InfoGrid cols={2} rows={[
            ["Full Name",       patient.name],
            ["Date of Birth",   fmtDate(patient.dob)],
            ["Age",             `${patient.age} years`],
            ["Gender",          patient.gender],
            ["Blood Group",     patient.bloodGroup],
            ["Nationality",     patient.nationality],
            ["Address",         shouldMaskContact ? maskAddress(patient.address || "") : patient.address],
          ]} />
          {/* Clickable contact row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginTop: 8 }}>
            <div>
              <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2 }}>Phone</div>
              {patient.phone
                ? <a href={`tel:${patient.phone}`} style={{ fontSize: "var(--font-sm)", color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}>{shouldMaskContact ? maskPhone(patient.phone) : patient.phone}</a>
                : <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>—</span>}
            </div>
            <div>
              <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2 }}>Email</div>
              {patient.email
                ? shouldMaskContact 
                  ? <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{maskEmail(patient.email)}</span>
                  : <a href={`mailto:${patient.email}`} style={{ fontSize: "var(--font-sm)", color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}>{patient.email}</a>
                : <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>—</span>}
            </div>
          </div>
        </InfoCard>

        {/* Emergency Contact */}
        <InfoCard title="Emergency Contact" icon="ti-phone-call" iconBg="#fce7f3" iconColor="#9d174d">
          {patient.emergencyName ? (
            <InfoGrid cols={2} rows={[
              ["Name",        patient.emergencyName],
              ["Relation",    patient.emergencyRelation || "—"],
              ["Phone",       patient.emergencyPhone],
            ]} />
          ) : (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <i className="ti ti-phone-off empty-state-icon" style={{ fontSize: 24 }} />
              <div className="empty-state-sub">No emergency contact on file</div>
            </div>
          )}
        </InfoCard>

        {/* Medical (role-gated) */}
        {can(role, "viewMedical") && (
          <InfoCard title="Medical Information" icon="ti-heart-rate-monitor" iconBg="var(--red-bg)" iconColor="var(--red)">
            <InfoGrid cols={2} rows={[
              ["Allergies",    patient.allergies || "None known"],
              ["Blood Group",  patient.bloodGroup],
              ["Conditions",   (patient.conditions || []).join(", ") || "None"],
              ["Medications",  (patient.medications || []).join(", ") || "None"],
            ]} />
          </InfoCard>
        )}

        {/* Insurance */}
        {can(role, "viewBilling") && (
          <InfoCard title="Insurance" icon="ti-shield" iconBg="var(--green-bg)" iconColor="var(--green)">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <InsuranceBadge status={patient.insuranceStatus} />
            </div>
            {patient.insurer !== "None" ? (
              <InfoGrid cols={2} rows={[
                ["Provider",       patient.insurer],
                ["Policy Number",  patient.policyNumber || "—"],
                ["Expiry",         fmtDate(patient.insuranceExpiry)],
              ]} />
            ) : (
              <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No insurance on file</p>
            )}
          </InfoCard>
        )}

        {/* Quick Actions */}
        <InfoCard title="Quick Actions" icon="ti-bolt" iconBg="var(--purple-bg)" iconColor="var(--purple)">
          <div className="pp-quick-grid">
            {onBookAppointment && (
              <button onClick={onBookAppointment} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#2563eb15", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-calendar" style={{ fontSize: 18, color: "#2563eb" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Book Appointment
                </span>
              </button>
            )}
            {onStartConsultation && (
              <button onClick={onStartConsultation} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#10b98115", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-stethoscope" style={{ fontSize: 18, color: "#10b981" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Start Consultation
                </span>
              </button>
            )}
            {onPrescription && (
              <button onClick={onPrescription} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#f59e0b15", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-pill" style={{ fontSize: 18, color: "#f59e0b" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  New Prescription
                </span>
              </button>
            )}
            {onFileUpload && (
              <button onClick={onFileUpload} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#8b5cf615", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-upload" style={{ fontSize: 18, color: "#8b5cf6" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Upload Report
                </span>
              </button>
            )}
            {onInvoice && (
              <button onClick={onInvoice} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#ef444415", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-receipt" style={{ fontSize: 18, color: "#ef4444" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Create Invoice
                </span>
              </button>
            )}
            {onCommunication && (
              <button onClick={onCommunication} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#06b6d415", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-phone" style={{ fontSize: 18, color: "#06b6d4" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Call/Message
                </span>
              </button>
            )}
            {onFollowUp && (
              <button onClick={onFollowUp} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#ec489915", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-calendar-time" style={{ fontSize: 18, color: "#ec4899" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Schedule Follow-up
                </span>
              </button>
            )}
            {onConsent && (
              <button onClick={onConsent} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  background: "#10b98115", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="ti ti-writing" style={{ fontSize: 18, color: "#10b981" }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>
                  Sign Consent
                </span>
              </button>
            )}
          </div>
        </InfoCard>
      </div>

      {/* Side col */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 0 }}>

        {/* Visit Readiness */}
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Visit Readiness</span>
            <span style={{
              fontSize: "var(--font-xs)", fontWeight: 700,
              color: readiness.ready ? "var(--green)" : "var(--amber)",
              background: readiness.ready ? "var(--green-bg)" : "var(--amber-bg)",
              padding: "4px 8px", borderRadius: "var(--radius-sm)",
            }}>
              {readiness.done}/{readiness.total}
            </span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 12 }}>
            <div className="progress-fill" style={{
              width: `${(readiness.done / readiness.total) * 100}%`,
              background: readiness.ready ? "var(--green)" : "var(--amber)",
            }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {readiness.items.map((item) => (
              <button key={item.key} onClick={() => onVerificationToggle(item.key)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderRadius: "var(--radius-sm)", border: `1px solid ${item.done ? "var(--green-border)" : "var(--red-border)"}`,
                background: item.done ? "var(--green-bg)" : "transparent",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <VerifiedDot done={item.done} />
                <span style={{ fontSize: "var(--font-xs)", color: item.done ? "var(--green)" : "var(--text)" }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Appointments */}
        <div className="card card-padded">
          <div className="section-label">Appointments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Last Visit</span>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(patient.lastVisit)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Next Appointment</span>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                {patient.nextAppointment ? fmtDate(patient.nextAppointment) : (
                  <span style={{ color: "var(--amber)", fontSize: "var(--font-xs)" }}>Not scheduled</span>
                )}
              </span>
            </div>
            {patient.followUpDate && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Follow-Up Due</span>
                <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--amber)" }}>
                  {fmtDate(patient.followUpDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Family */}
        {(patient.family || []).length > 0 && (
          <div className="card card-padded">
            <div className="section-label">Family Members</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(patient.family || []).map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface2)" }}>
                  <AvatarCircle name={f.name} size="sm" />
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{f.relation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pinned notes */}
        {(patient.notes || []).filter((n) => n.pinned).length > 0 && (
          <div className="card card-padded">
            <div className="section-label">
              <i className="ti ti-pin" style={{ fontSize: 10, marginRight: 4 }} />
              Pinned Notes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(patient.notes || []).filter((n) => n.pinned).map((n) => (
                <div key={n.id} style={{
                  padding: "8px 10px", borderRadius: "var(--radius-sm)",
                  background: "#fffbeb", border: "1px solid var(--amber-border)",
                  fontSize: "var(--font-xs)", color: "#92400e",
                }}>
                  {n.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────
function TimelineTab({
  patient, role, onAddEvent, onDeleteEvent,
}: {
  patient: Patient;
  role: UserRole;
  onAddEvent: (e: Omit<TimelineEvent, "id">) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "note", label: "Doctor Note Added", icon: "ti-notes", color: "#7c4fff", note: "", date: new Date().toISOString().split("T")[0], doctor: "" });
  const [filterType, setFilterType] = useState("All");
  const [filterDoctor, setFilterDoctor] = useState("All");
  const [dateRangeFrom, setDateRangeFrom] = useState("");
  const [dateRangeTo, setDateRangeTo] = useState("");

  const allEvents = useMemo(() => [...(patient.timeline || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  ), [patient.timeline]);

  const filteredEvents = useMemo(() => allEvents.filter((ev) => {
    if (filterType !== "All" && ev.type !== filterType) return false;
    if (filterDoctor !== "All" && ev.doctor !== filterDoctor) return false;
    if (dateRangeFrom && new Date(ev.date) < new Date(dateRangeFrom)) return false;
    if (dateRangeTo && new Date(ev.date) > new Date(dateRangeTo)) return false;
    return true;
  }), [allEvents, filterType, filterDoctor, dateRangeFrom, dateRangeTo]);

  const allDoctors = useMemo(() => {
    const doctors = new Set<string>();
    allEvents.forEach(ev => { if (ev.doctor) doctors.add(ev.doctor); });
    return Array.from(doctors).sort();
  }, [allEvents]);

  function submit() {
    onAddEvent({ ...form, date: new Date(form.date) });
    setShowForm(false);
    setForm({ type: "note", label: "Doctor Note Added", icon: "ti-notes", color: "#7c4fff", note: "", date: new Date().toISOString().split("T")[0], doctor: "" });
  }

  function clearFilters() {
    setFilterType("All");
    setFilterDoctor("All");
    setDateRangeFrom("");
    setDateRangeTo("");
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Clinical Timeline</span>
        <div style={{ display: "flex", gap: 8 }}>
          {can(role, "editPatient") && (
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(true)}>
              <i className="ti ti-plus" style={{ fontSize: 13 }} />
              Add Event
            </button>
          )}
        </div>
      </div>

      {/* Timeline Filters */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <option value="All">All Types</option>
            <option value="note">Doctor Note</option>
            <option value="appointment">Appointment</option>
            <option value="consultation">Consultation</option>
            <option value="prescription">Prescription</option>
            <option value="report">Report</option>
            <option value="followup">Follow-Up</option>
          </select>
          {allDoctors.length > 0 && (
            <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <option value="All">All Doctors</option>
              {allDoctors.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <input type="date" value={dateRangeFrom} onChange={(e) => setDateRangeFrom(e.target.value)} placeholder="From" style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
          <input type="date" value={dateRangeTo} onChange={(e) => setDateRangeTo(e.target.value)} placeholder="To" style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
          {(filterType !== "All" || filterDoctor !== "All" || dateRangeFrom || dateRangeTo) && (
            <button className="btn btn-ghost" onClick={clearFilters} style={{ fontSize: "var(--font-sm)" }}>
              <i className="ti ti-x" style={{ fontSize: 12 }} />
              Clear
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            {filteredEvents.length} of {allEvents.length} events
          </span>
        </div>
      </div>

      {showForm && (
        <div className="card card-padded" style={{ marginBottom: 16, border: "1px solid var(--accent)40" }}>
          <div className="section-label">New Timeline Event</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field-group">
              <label className="field-label">Type</label>
              <select value={form.type} onChange={(e) => {
                const types: Record<string, { label: string; icon: string; color: string }> = {
                  note:         { label: "Doctor Note Added",      icon: "ti-notes",          color: "#7c4fff" },
                  appointment:  { label: "Appointment Booked",     icon: "ti-calendar",       color: "#7c4fff" },
                  consultation: { label: "Consultation Completed", icon: "ti-stethoscope",    color: "#00b4a0" },
                  prescription: { label: "Prescription Issued",    icon: "ti-pill",           color: "#ff7c4f" },
                  report:       { label: "Report Uploaded",        icon: "ti-file-analytics", color: "#4f7cff" },
                  followup:     { label: "Follow-Up Scheduled",    icon: "ti-clock",          color: "#f0a500" },
                };
                const t = types[e.target.value] || types.note;
                setForm((f) => ({ ...f, type: e.target.value, ...t }));
              }} style={{ width: "100%" }}>
                <option value="note">Doctor Note</option>
                <option value="appointment">Appointment</option>
                <option value="consultation">Consultation</option>
                <option value="prescription">Prescription</option>
                <option value="report">Report</option>
                <option value="followup">Follow-Up</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Doctor</label>
              <input type="text" value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))} placeholder="Dr. Name" style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Note</label>
              <input type="text" value={form.note || ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional note" style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={submit}>Add Event</button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-timeline empty-state-icon" />
          <div className="empty-state-text">No timeline events</div>
          <div className="empty-state-sub">{allEvents.length === 0 ? "Add events to track the patient's clinical history" : "Try adjusting your filters"}</div>
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 20 }}>
          <div className="timeline-line" />
          {filteredEvents.map((ev, idx) => (
            <div key={ev.id} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
              <div className="timeline-dot" style={{ background: ev.color + "20" }}>
                <i className={`ti ${ev.icon}`} style={{ fontSize: 13, color: ev.color }} />
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{ev.label}</span>
                    {ev.doctor && (
                      <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginLeft: 6 }}>
                        · {ev.doctor}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {fmtDate(ev.date)}
                    </span>
                    {can(role, "editPatient") && (
                      <button className="btn-icon" style={{ padding: 4 }} onClick={() => onDeleteEvent(ev.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                      </button>
                    )}
                  </div>
                </div>
                {ev.note && (
                  <p style={{
                    fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 4,
                    padding: "6px 10px", background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${ev.color}`,
                  }}>
                    {ev.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
function DocumentsTab({
  patient, role, onAddDoc, onDeleteDoc, onUploadFiles,
}: {
  patient: Patient;
  role: UserRole;
  onAddDoc: (d: Omit<PatientDocument, "id">) => void;
  onDeleteDoc: (id: string) => void;
  onUploadFiles: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "Medical Report", uploaded: new Date().toISOString().split("T")[0], size: "—", verified: false });

  const DOC_ICONS: Record<string, string> = {
    "Insurance Card": "ti-shield", "Passport": "ti-passport", "National ID": "ti-id",
    "Consent Form": "ti-writing", "Medical Report": "ti-file-analytics", "Referral Letter": "ti-file-text",
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Documents</span>
        <div style={{ display: "flex", gap: 8 }}>
          {can(role, "editPatient") && (
            <>
              <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(true)}>
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Document
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={onUploadFiles}>
                <i className="ti ti-upload" style={{ fontSize: 13 }} /> Upload Files
              </button>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card card-padded" style={{ marginBottom: 16, border: "1px solid var(--accent)40" }}>
          <div className="section-label">New Document</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field-group">
              <label className="field-label">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ width: "100%" }}>
                {["Insurance Card","Passport","National ID","Consent Form","Medical Report","Referral Letter"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Upload Date</label>
              <input type="date" value={form.uploaded} onChange={(e) => setForm((f) => ({ ...f, uploaded: e.target.value }))} style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => { onAddDoc(form); setShowForm(false); }}>
              Add
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {(patient.documents || []).length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-files empty-state-icon" />
          <div className="empty-state-text">No documents</div>
          <div className="empty-state-sub">Upload patient documents for this record</div>
          {can(role, "editPatient") && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onUploadFiles}>
              <i className="ti ti-upload" style={{ fontSize: 13 }} /> Upload Files
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {(patient.documents || []).map((doc) => (
            <div key={doc.id} className="card card-padded" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius)",
                background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <i className={`ti ${DOC_ICONS[doc.type] || "ti-file"}`} style={{ fontSize: 16, color: "var(--accent)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>{doc.type}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>
                  {fmtDate(doc.uploaded)} · {doc.size}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span className="tag" style={{ background: doc.verified ? "var(--green-bg)" : "var(--amber-bg)", color: doc.verified ? "var(--green)" : "var(--amber)" }}>
                    <i className={`ti ${doc.verified ? "ti-shield-check" : "ti-shield-exclamation"}`} style={{ fontSize: 10 }} />
                    {doc.verified ? "Verified" : "Pending"}
                  </span>
                  {can(role, "deleteDocument") && (
                    <button className="btn-icon" style={{ padding: 3, marginLeft: "auto" }} onClick={() => onDeleteDoc(doc.id)}>
                      <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({
  patient, role, onAddNote, onDeleteNote, onTogglePin,
}: {
  patient: Patient;
  role: UserRole;
  onAddNote: (n: Omit<PatientNote, "id">) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [text,     setText]     = useState("");
  const [category, setCategory] = useState("general");

  const CATEGORIES = [
    { id: "general",   label: "General",   color: "var(--muted)" },
    { id: "clinical",  label: "Clinical",  color: "var(--red)" },
    { id: "billing",   label: "Billing",   color: "var(--amber)" },
    { id: "followup",  label: "Follow-Up", color: "var(--blue)" },
  ];

  const notes = useMemo(() => [...(patient.notes || [])]
    .filter(n => !n.deletedAt) // Phase 7K: Hide soft-deleted notes from normal view
    .sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  }), [patient.notes]);

  function submit() {
    if (!text.trim()) return;
    onAddNote({ text: text.trim(), pinned: false, date: new Date().toISOString().split("T")[0], category });
    setText("");
    setShowForm(false);
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Notes</span>
        {can(role, "editPatient") && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(true)}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Note
          </button>
        )}
      </div>

      {showForm && (
        <div className="card card-padded" style={{ marginBottom: 16, border: "1px solid var(--accent)40" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "var(--font-xs)", fontWeight: 600,
                border: `1px solid ${category === c.id ? c.color : "var(--border)"}`,
                background: category === c.id ? c.color + "15" : "transparent",
                color: category === c.id ? c.color : "var(--muted)", cursor: "pointer",
              }}>{c.label}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Write a note…" rows={3}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={submit}>Save Note</button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-notes empty-state-icon" />
          <div className="empty-state-text">No notes yet</div>
          <div className="empty-state-sub">Add notes to track important information</div>
          {can(role, "editPatient") && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Note
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => {
            const cat = CATEGORIES.find((c) => c.id === n.category) || CATEGORIES[0];
            return (
              <div key={n.id} className="card card-padded" style={{
                border: n.pinned ? "1px solid var(--amber-border)" : "1px solid var(--border)",
                background: n.pinned ? "var(--amber-bg)" : "var(--surface)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--text)", lineHeight: 1.6, flex: 1 }}>{n.text}</p>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button className="btn-icon" style={{ padding: 4 }} onClick={() => onTogglePin(n.id)}>
                      <i className={`ti ${n.pinned ? "ti-pin-filled" : "ti-pin"}`} style={{ fontSize: 12, color: n.pinned ? "var(--amber)" : "var(--muted)" }} />
                    </button>
                    {can(role, "editPatient") && (
                      <button className="btn-icon" style={{ padding: 4 }} onClick={() => onDeleteNote(n.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span className="tag" style={{ background: cat.color + "15", color: cat.color }}>
                    {cat.label}
                  </span>
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {fmtDate(n.date)}
                    {n.author && ` · ${n.author}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Follow-Up Tab ─────────────────────────────────────────────────────────────
function FollowUpTab({ patient, onUpdate, onScheduleFollowUp }: { patient: Patient; onUpdate: (u: Partial<Patient>) => void; onScheduleFollowUp: () => void }) {
  const [notes,   setNotes]   = useState(patient.followUpNotes || "");
  const [status,  setStatus]  = useState(patient.followUpStatus || "Pending");
  const [saved,   setSaved]   = useState(false);

  function save() {
    onUpdate({
      followUpStatus:   status as any,
      followUpNotes:    notes,
      lastContacted:    new Date().toISOString().split("T")[0],
      callAttempts:     (patient.callAttempts || 0) + 1,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function logCall() {
    onUpdate({
      callAttempts:  (patient.callAttempts || 0) + 1,
      lastContacted: new Date().toISOString().split("T")[0],
      followUpStatus: "Called" as any,
    });
  }

  if (!patient.followUpDate) {
    return (
      <div className="empty-state">
        <i className="ti ti-phone empty-state-icon" />
        <div className="empty-state-text">No follow-up scheduled</div>
        <div className="empty-state-sub">Follow-up information will appear here when scheduled</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onScheduleFollowUp}>
          <i className="ti ti-plus" style={{ fontSize: 13 }} />
          Schedule Follow-Up
        </button>
      </div>
    );
  }

  const STATUS_OPTIONS = [
    { id: "Pending",   label: "Pending",   color: "#d97706" },
    { id: "Called",    label: "Called",    color: "#2563eb" },
    { id: "No Answer", label: "No Answer", color: "#dc2626" },
    { id: "Completed", label: "Completed", color: "#16a34a" },
  ];
  const current = STATUS_OPTIONS.find((s) => s.id === status) || STATUS_OPTIONS[0];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 4 }} />Follow-Up Date</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmtDate(patient.followUpDate)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-phone" style={{ fontSize: 11, marginRight: 4 }} />Call Attempts</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{patient.callAttempts || 0}</div>
        </div>
        {patient.followUpReason && (
          <div className="stat-card" style={{ gridColumn: "1 / -1" }}>
            <div className="stat-label">Reason</div>
            <div style={{ fontSize: "var(--font-sm)", marginTop: 4 }}>{patient.followUpReason}</div>
          </div>
        )}
      </div>

      <div className="card card-padded">
        <div className="section-label">Status</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {STATUS_OPTIONS.map((s) => (
            <button key={s.id} onClick={() => setStatus(s.id)} style={{
              flex: 1, padding: "8px 12px", borderRadius: "var(--radius)",
              border: `2px solid ${status === s.id ? s.color : "var(--border)"}`,
              background: status === s.id ? s.color + "12" : "transparent",
              color: status === s.id ? s.color : "var(--muted)",
              fontWeight: status === s.id ? 700 : 500, fontSize: "var(--font-sm)", cursor: "pointer",
            }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="field-group" style={{ marginBottom: 12 }}>
          <label className="field-label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Add follow-up notes…" rows={4}
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        {patient.lastContacted && (
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 12 }}>
            Last contacted: {fmtDate(patient.lastContacted)}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={save}>
            <i className="ti ti-device-floppy" style={{ fontSize: 13 }} />
            {saved ? "Saved!" : "Save"}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={logCall}>
            <i className="ti ti-phone" style={{ fontSize: 13 }} />
            Log Call
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Privacy Tab (Phase 10D) ───────────────────────────────────────────────────────
interface PrivacyTabProps {
  patient: Patient;
  role: UserRole;
  privacyRequests: PrivacyRequest[];
  patientConsents: ConsentRecord[];
  consentHistory: any[];
  expiringConsents: ConsentRecord[];
  expiredConsents: ConsentRecord[];
  optedOutChannels: CommunicationChannel[];
  commPreferences: Record<CommunicationChannel, boolean> | null;
  onCreateRequest?: (type: PrivacyRequestType) => void;
  onUpdateRequestStatus?: (requestId: string, status: PrivacyRequestStatus) => void;
  onPortabilityExport?: () => void;
  onConsentChange?: (consentType: string, action: 'grant' | 'revoke') => void;
  onCommPreferenceChange?: (channel: CommunicationChannel, optedOut: boolean) => void;
}

function PrivacyTab({
  patient,
  role,
  privacyRequests,
  patientConsents,
  consentHistory,
  expiringConsents,
  expiredConsents,
  optedOutChannels,
  commPreferences,
  onCreateRequest,
  onUpdateRequestStatus,
  onPortabilityExport,
  onConsentChange,
  onCommPreferenceChange,
}: PrivacyTabProps) {
  const canManage = onCreateRequest !== undefined;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Privacy & Consent</span>
        {onPortabilityExport && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={onPortabilityExport}>
            <i className="ti ti-download" style={{ fontSize: 13 }} />
            Data Portability Export
          </button>
        )}
      </div>

      {/* Privacy Requests Section */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 12 }}>Privacy Requests</div>
        {privacyRequests.length === 0 ? (
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No privacy requests for this patient</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {privacyRequests.map((req) => (
              <div key={req.id} className="card card-padded" style={{ borderLeft: `4px solid ${getStatusColor(req.status)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{req.requestType.replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>
                      ID: {req.id} · Submitted: {new Date(req.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="badge" style={{ background: `${getStatusColor(req.status)}15`, color: getStatusColor(req.status) }}>
                    {req.status}
                  </span>
                </div>
                {onUpdateRequestStatus && req.status === 'submitted' && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onUpdateRequestStatus(req.id, 'under_review')}>
                      Review
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onUpdateRequestStatus(req.id, 'approved')}>
                      Approve
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onUpdateRequestStatus(req.id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onCreateRequest?.('access_request')}>
              Access Request
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onCreateRequest?.('correction_request')}>
              Correction Request
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onCreateRequest?.('deletion_request')}>
              Deletion Request
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onCreateRequest?.('portability_request')}>
              Portability Request
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onCreateRequest?.('consent_review_request')}>
              Consent Review
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onCreateRequest?.('grievance_request')}>
              Grievance
            </button>
          </div>
        )}
      </div>

      {/* Consent Status Section */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 12 }}>Consent Status</div>
        {patientConsents.length === 0 ? (
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No consent records for this patient</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {patientConsents.map((consent) => (
              <div key={consent.id} className="card card-padded" style={{ borderLeft: `4px solid ${consent.status === 'granted' ? 'var(--green)' : consent.status === 'revoked' ? 'var(--red)' : 'var(--amber)'}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{consent.consentType.replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>
                      Version: {consent.version} · Status: {consent.status}
                    </div>
                  </div>
                  {onConsentChange && consent.status === 'granted' && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onConsentChange(consent.consentType, 'revoke')}>
                      Revoke
                    </button>
                  )}
                  {onConsentChange && consent.status !== 'granted' && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => onConsentChange(consent.consentType, 'grant')}>
                      Grant
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {expiringConsents.length > 0 && (
          <div style={{ marginTop: 12, padding: 8, background: "var(--amber-bg)", borderRadius: "var(--radius)", fontSize: "var(--font-xs)", color: "var(--amber)" }}>
            <i className="ti ti-alert-triangle" /> {expiringConsents.length} consent(s) expiring soon
          </div>
        )}
        {expiredConsents.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: "var(--red-bg)", borderRadius: "var(--radius)", fontSize: "var(--font-xs)", color: "var(--red)" }}>
            <i className="ti ti-alert-circle" /> {expiredConsents.length} consent(s) expired
          </div>
        )}
      </div>

      {/* Communication Preferences Section */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 12 }}>Communication Preferences</div>
        {commPreferences ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(Object.keys(commPreferences) as CommunicationChannel[]).map((channel) => (
              <div key={channel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                <div style={{ fontSize: "var(--font-sm)" }}>{channel.replace(/_/g, ' ').toUpperCase()}</div>
                {onCommPreferenceChange ? (
                  <button 
                    className="btn btn-ghost"
                    style={{ 
                      fontSize: "var(--font-xs)", 
                      background: commPreferences[channel] ? "var(--green-bg)" : "var(--red-bg)",
                      color: commPreferences[channel] ? "var(--green)" : "var(--red)"
                    }}
                    onClick={() => onCommPreferenceChange(channel, !commPreferences[channel])}
                  >
                    {commPreferences[channel] ? 'Opted In' : 'Opted Out'}
                  </button>
                ) : (
                  <span style={{ fontSize: "var(--font-xs)", color: commPreferences[channel] ? "var(--green)" : "var(--red)" }}>
                    {commPreferences[channel] ? 'Opted In' : 'Opted Out'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No communication preferences set</div>
        )}
      </div>

      {/* Consent History Section */}
      <div className="card card-padded">
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 12 }}>Consent History</div>
        {consentHistory.length === 0 ? (
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No consent history for this patient</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {consentHistory.map((entry, index) => (
              <div key={index} style={{ fontSize: "var(--font-xs)", padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                <div style={{ fontWeight: 600 }}>{entry.consentType.replace(/_/g, ' ').toUpperCase()}</div>
                <div style={{ color: "var(--muted)", marginTop: 2 }}>
                  {entry.status} · Version {entry.version} · {new Date(entry.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'granted':
    case 'approved':
    case 'completed':
      return 'var(--green)';
    case 'revoked':
    case 'rejected':
    case 'cancelled':
      return 'var(--red)';
    case 'expired':
    case 'under_review':
      return 'var(--amber)';
    case 'submitted':
      return 'var(--blue)';
    default:
      return 'var(--muted)';
  }
}

// ─── Consents Tab ─────────────────────────────────────────────────────────────
function ConsentsTab({ patient, onToggle, onSignNewConsent }: { patient: Patient; onToggle: (key: string) => void; onSignNewConsent?: () => void }) {
  const consents = patient.consents || {};
  const total  = CONSENT_TYPES.length;
  const signed = CONSENT_TYPES.filter((c) => consents[c.key]).length;
  const allOK  = signed === total;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="stat-card" style={{ flex: 1 }}>
            <div className="stat-label">Signed</div>
            <div className="stat-value" style={{ color: allOK ? "var(--green)" : "var(--amber)" }}>{signed}/{total}</div>
          </div>
          <div style={{ flex: 2 }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(signed / total) * 100}%`, background: allOK ? "var(--green)" : "var(--amber)" }} />
            </div>
            <p style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 6 }}>
              {allOK ? "All consents collected — patient ready to proceed" : `${total - signed} consent${total - signed > 1 ? "s" : ""} still required`}
            </p>
          </div>
        </div>
        {onSignNewConsent && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={onSignNewConsent}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Sign New Consent
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CONSENT_TYPES.map((c) => {
          const done = !!consents[c.key];
          return (
            <button key={c.key} onClick={() => onToggle(c.key)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: "var(--radius)", border: `1px solid ${done ? "var(--green-border)" : "var(--border)"}`,
              background: done ? "var(--green-bg)" : "var(--surface)", cursor: "pointer",
              transition: "all 0.15s", textAlign: "left",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius)", flexShrink: 0,
                background: done ? "#16a34a" : "var(--surface3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`ti ${done ? "ti-check" : c.icon}`} style={{ fontSize: 16, color: done ? "#fff" : "var(--muted)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: done ? "#15803d" : "var(--text)" }}>
                  {c.label}
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: done ? "#16a34a" : "var(--muted)", marginTop: 2 }}>
                  {done ? "Signed & collected" : "Click to mark as signed"}
                </div>
              </div>
              <i className={`ti ${done ? "ti-circle-check-filled" : "ti-circle-dashed"}`} style={{ fontSize: 20, color: done ? "#16a34a" : "var(--border)" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────
function AuditTab({ entries }: { entries: AuditEntry[] }) {
  const sorted = useMemo(() => [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [entries]);
  const AUDIT_ICONS: Record<string, string> = {
    created: "ti-user-plus", edited: "ti-edit", deleted: "ti-trash",
    merged: "ti-merge", import: "ti-file-import", archived: "ti-archive",
    verification: "ti-shield-check", "timeline event added": "ti-timeline",
    "document added": "ti-file", "note added": "ti-notes", default: "ti-history",
  };
  const AUDIT_COLORS: Record<string, string> = {
    created: "#2563eb", edited: "#7c3aed", deleted: "#dc2626",
    merged: "#d97706", import: "#16a34a", archived: "#64748b", default: "var(--muted)",
  };

  return (
    <div style={{ width: '100%' }}>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-history empty-state-icon" />
          <div className="empty-state-text">No audit entries yet</div>
          <div className="empty-state-sub">All changes will be recorded here</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {sorted.map((entry, i) => {
            const icon  = AUDIT_ICONS[entry.type] || AUDIT_ICONS.default;
            const color = AUDIT_COLORS[entry.type] || AUDIT_COLORS.default;
            return (
              <div key={entry.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 14px", background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)",
                borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "var(--radius-sm)", flexShrink: 0,
                  background: color + "15", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 13, color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", color: "var(--text)" }}>{entry.message}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2, display: "flex", gap: 8 }}>
                    <span><i className="ti ti-user" style={{ fontSize: 10, marginRight: 3 }} />{entry.user}</span>
                    <span className="mono">
                      {new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Emergency Modal ──────────────────────────────────────────────────────────
function EmergencyModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div style={{
        background: "#0c0f1a", border: "2px solid #dc2626", borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 560, overflow: "hidden",
        boxShadow: "0 0 60px rgba(220,38,38,0.35)", animation: "scaleIn 0.2s ease",
      }}>
        <div style={{ background: "#dc2626", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-emergency-bed" style={{ fontSize: 20, color: "#fff" }} />
            <div>
              <div style={{ fontSize: "var(--font-md)", fontWeight: 800, color: "#fff", letterSpacing: "0.06em" }}>
                EMERGENCY VIEW
              </div>
              <div style={{ fontSize: "var(--font-xs)", color: "#fecaca" }}>
                {patient.name} · {patient.id}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "var(--radius)", padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "var(--font-sm)" }}>
            <i className="ti ti-x" style={{ fontSize: 14 }} /> Close
          </button>
        </div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Blood Group",       value: patient.bloodGroup || "Unknown", icon: "ti-droplet",          color: "#ef4444", large: true },
            { label: "Primary Doctor",    value: patient.doctor || "—",           icon: "ti-stethoscope",      color: "#60a5fa" },
            { label: "Allergies",         value: patient.allergies || "None known",icon: "ti-alert-triangle",  color: "#f59e0b", warn: !!patient.allergies },
            { label: "Medications",       value: (patient.medications||[]).join(", ") || "None", icon: "ti-pill", color: "#a78bfa" },
            { label: "Conditions",        value: (patient.conditions||[]).join(", ") || "None", icon: "ti-heart-rate-monitor", color: "#f97316", warn: (patient.conditions||[]).length > 0 },
            { label: "Emergency Contact", value: patient.emergencyName || "—",   icon: "ti-phone-call",        color: "#34d399", sub: `${patient.emergencyRelation} · ${patient.emergencyPhone}` },
          ].map(({ label, value, icon, color, large, warn, sub }) => (
            <div key={label} style={{
              background: warn ? "#1c1008" : "#131726",
              border: `1px solid ${warn ? "#f59e0b30" : "rgba(255,255,255,0.07)"}`,
              borderRadius: "var(--radius)", padding: "10px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <i className={`ti ${icon}`} style={{ fontSize: 12, color }} />
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              </div>
              <div style={{ fontSize: large ? 26 : 13, fontWeight: large ? 800 : 600, color: large ? color : warn ? "#fcd34d" : "#f9fafb", lineHeight: 1.3 }}>{value}</div>
              {sub && <div style={{ fontSize: "var(--font-xs)", color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Prescription History Tab ─────────────────────────────────────────────────
function PrescriptionHistoryTab({
  patient, role, onUpdatePatient, onAddPrescription,
}: {
  patient: Patient;
  role: UserRole;
  onUpdatePatient: (p: Patient, action?: string) => void;
  onAddPrescription: () => void;
}) {
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  const prescriptions = patient.prescriptions || [];

  function handleRefill(prescription: Prescription) {
    setSelectedPrescription(prescription);
    setShowRefillModal(true);
  }

  function processRefill() {
    if (!selectedPrescription) return;
    
    const updatedPrescriptions = prescriptions.map(p => {
      if (p.id === selectedPrescription.id) {
        return {
          ...p,
          refillsUsed: p.refillsUsed + 1,
          refillsRemaining: p.refillsRemaining - 1,
          refillHistory: [
            ...(p.refillHistory || []),
            { date: new Date().toISOString(), filledBy: "Current User" }
          ]
        };
      }
      return p;
    });

    onUpdatePatient(
      { ...patient, prescriptions: updatedPrescriptions },
      "prescription refill processed"
    );
    setShowRefillModal(false);
    setSelectedPrescription(null);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active": return "var(--green)";
      case "completed": return "var(--blue)";
      case "discontinued": return "var(--red)";
      default: return "var(--muted)";
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Prescription History</span>
        {can(role, "editPatient") && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={onAddPrescription}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Add Prescription
          </button>
        )}
      </div>

      {prescriptions.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-pill empty-state-icon" />
          <div className="empty-state-text">No prescriptions recorded</div>
          <div className="empty-state-sub">Prescriptions will appear here when added</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prescriptions.map((rx) => (
            <div key={rx.id} className="card card-padded" style={{ borderLeft: `4px solid ${getStatusColor(rx.status)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{rx.medicationName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>
                    {rx.dosage} · {rx.frequency} · {rx.route}
                  </div>
                </div>
                <span className="badge" style={{ background: `${getStatusColor(rx.status)}15`, color: getStatusColor(rx.status) }}>
                  {rx.status}
                </span>
              </div>
              
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>
                <div><strong>Duration:</strong> {rx.duration}</div>
                <div><strong>Prescribed:</strong> {fmtDate(rx.prescribedDate)} by {rx.prescribedBy}</div>
                {rx.instructions && <div><strong>Instructions:</strong> {rx.instructions}</div>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: "var(--font-xs)" }}>
                  <span style={{ color: "var(--muted)" }}>Refills:</span> {rx.refillsRemaining}/{rx.refillsTotal}
                </div>
                {rx.status === "active" && rx.refillsRemaining > 0 && can(role, "editPatient") && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => handleRefill(rx)}>
                    <i className="ti ti-refresh" style={{ fontSize: 12 }} />
                    Request Refill
                  </button>
                )}
                {rx.refillHistory && rx.refillHistory.length > 0 && (
                  <div style={{ marginLeft: "auto", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    Last refill: {fmtDate(rx.refillHistory[rx.refillHistory.length - 1].date)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refill Confirmation Modal */}
      {showRefillModal && selectedPrescription && (
        <div className="modal-backdrop" onClick={() => setShowRefillModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Confirm Refill</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPrescription.medicationName}</div>
              </div>
              <button className="btn-icon" onClick={() => setShowRefillModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>
                This will process a refill for <strong>{selectedPrescription.medicationName}</strong>. 
                {selectedPrescription.refillsRemaining - 1} refill(s) will remain after this.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowRefillModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={processRefill}>Confirm Refill</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lab Results Tab ─────────────────────────────────────────────────────────
function LabResultsTab({
  patient, role, onAddLabResult,
}: {
  patient: Patient;
  role: UserRole;
  onAddLabResult: () => void;
}) {
  const [selectedTestType, setSelectedTestType] = useState("All");
  const [showTrendView, setShowTrendView] = useState(false);

  const labResults = patient.labResults || [];

  const testTypes = useMemo(() => {
    const types = new Set<string>();
    labResults.forEach(r => types.add(r.testType));
    return Array.from(types).sort();
  }, [labResults]);

  const filteredResults = labResults.filter(r => 
    selectedTestType === "All" || r.testType === selectedTestType
  );

  const resultsByTestType = useMemo(() => {
    const grouped: Record<string, LabResult[]> = {};
    labResults.forEach(r => {
      if (!grouped[r.testType]) grouped[r.testType] = [];
      grouped[r.testType].push(r);
    });
    // Sort each group by date
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    return grouped;
  }, [labResults]);

  function getStatusColor(status: string) {
    switch (status) {
      case "normal": return "var(--green)";
      case "abnormal": return "var(--amber)";
      case "critical": return "var(--red)";
      default: return "var(--muted)";
    }
  }

  function renderTrendChart(testResults: LabResult[]) {
    if (testResults.length < 2) return null;
    
    const maxValue = Math.max(...testResults.map(r => r.value));
    const minValue = Math.min(...testResults.map(r => r.value));
    const range = maxValue - minValue || 1;

    return (
      <div style={{ marginTop: 16, padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 12 }}>Trend Over Time</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
          {testResults.map((r, i) => {
            const height = ((r.value - minValue) / range) * 80 + 10;
            return (
              <div key={r.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ 
                  width: "100%", 
                  height: `${height}%`, 
                  background: getStatusColor(r.status),
                  borderRadius: "4px 4px 0 0",
                  minHeight: 4,
                  transition: "height 0.3s ease"
                }} />
                <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", marginTop: 4, textAlign: "center" }}>
                  {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div style={{ fontSize: "var(--font-2xs)", fontWeight: 600, marginTop: 2 }}>
                  {r.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Lab Results</span>
        {can(role, "editPatient") && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={onAddLabResult}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Add Lab Result
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card card-padded" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={selectedTestType} onChange={(e) => setSelectedTestType(e.target.value)} style={{ fontSize: "var(--font-sm)", padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <option value="All">All Test Types</option>
            {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button 
            className="btn btn-ghost" 
            onClick={() => setShowTrendView(!showTrendView)}
            style={{ fontSize: "var(--font-sm)", background: showTrendView ? "var(--accent-soft)" : "transparent", color: showTrendView ? "var(--accent)" : "var(--text)" }}
          >
            <i className="ti ti-chart-line" style={{ fontSize: 12 }} />
            {showTrendView ? "Hide Trends" : "Show Trends"}
          </button>
          <span style={{ marginLeft: "auto", fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {labResults.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-test-tube empty-state-icon" />
          <div className="empty-state-text">No lab results recorded</div>
          <div className="empty-state-sub">Lab results will appear here when added</div>
        </div>
      ) : showTrendView ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(resultsByTestType).map(([testType, results]) => (
            <div key={testType} className="card card-padded">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{testType}</div>
                <span className="badge" style={{ background: "var(--surface3)", color: "var(--muted)" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
              </div>
              {renderTrendChart(results)}
              <div style={{ marginTop: 12, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                Latest: {results[results.length - 1]?.value} {results[results.length - 1]?.unit} · {fmtDate(results[results.length - 1]?.date)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredResults.map((result) => (
            <div key={result.id} className="card card-padded" style={{ borderLeft: `4px solid ${getStatusColor(result.status)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{result.testName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>
                    {result.testType}
                  </div>
                </div>
                <span className="badge" style={{ background: `${getStatusColor(result.status)}15`, color: getStatusColor(result.status) }}>
                  {result.status}
                </span>
              </div>
              
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: getStatusColor(result.status) }}>
                  {result.value}
                </div>
                <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{result.unit}</div>
                <div style={{ marginLeft: "auto", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  {fmtDate(result.date)}
                </div>
              </div>

              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>
                <div><strong>Reference Range:</strong> {result.referenceRange}</div>
                <div><strong>Performed by:</strong> {result.performedBy}</div>
                {result.notes && <div><strong>Notes:</strong> {result.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ patient, onConfirm, onClose }: { patient: Patient; onConfirm: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--red-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-trash" style={{ fontSize: 18, color: "var(--red)" }} />
          </div>
          <div>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Delete Patient Record</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>This action cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
          You are about to permanently delete <strong style={{ color: "var(--text)" }}>{patient.name}</strong> ({patient.id}). Type the patient ID to confirm.
        </p>
        <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder={patient.id} style={{ width: "100%", marginBottom: 16 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" style={{ flex: 1 }} disabled={confirm !== patient.id} onClick={onConfirm}>
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action Modal ───────────────────────────────────────────────────────
function QuickActionModal({
  action, patient, onClose,
  onBookAppointment, onStartConsultation, onPrescription,
  onFileUpload, onInvoice, onCommunication, onFollowUp, onConsent,
}: {
  action: string;
  patient: Patient;
  onClose: () => void;
  onBookAppointment?: () => void;
  onStartConsultation?: () => void;
  onPrescription?: () => void;
  onFileUpload?: () => void;
  onInvoice?: () => void;
  onCommunication?: () => void;
  onFollowUp?: () => void;
  onConsent?: () => void;
}) {
  const lower = action.toLowerCase();

  // Route known actions immediately to real modals
  React.useEffect(() => {
    if (lower.includes("appointment") || lower.includes("book")) { onBookAppointment?.(); return; }
    if (lower.includes("consultation") || lower.includes("visit")) { onStartConsultation?.(); return; }
    if (lower.includes("prescription") || lower.includes("medication")) { onPrescription?.(); return; }
    if (lower.includes("upload") || lower.includes("document") || lower.includes("file")) { onFileUpload?.(); return; }
    if (lower.includes("invoice") || lower.includes("billing")) { onInvoice?.(); return; }
    if (lower.includes("call") || lower.includes("message") || lower.includes("communication")) { onCommunication?.(); return; }
    if (lower.includes("follow")) { onFollowUp?.(); return; }
    if (lower.includes("consent")) { onConsent?.(); return; }
    // Unknown action — keep modal open and show fallback
  }, []);

  // If it's a known routable action, don't render modal (it will open the real one)
  const isRoutable =
    lower.includes("appointment") || lower.includes("book") ||
    lower.includes("consultation") || lower.includes("visit") ||
    lower.includes("prescription") || lower.includes("medication") ||
    lower.includes("upload") || lower.includes("document") || lower.includes("file") ||
    lower.includes("invoice") || lower.includes("billing") ||
    lower.includes("call") || lower.includes("message") || lower.includes("communication") ||
    lower.includes("follow") || lower.includes("consent");

  if (isRoutable) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>{action}</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)", lineHeight: 1.6 }}>
          This action is not yet implemented for <strong>{patient.name}</strong>.
          Please contact your administrator or use the relevant workflow button from the Overview tab.
        </p>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function InfoCard({ title, icon, iconBg, iconColor, children }: {
  title: string; icon: string; iconBg: string; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="panel-head">
        <div className="panel-icon" style={{ background: iconBg }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: iconColor }} />
        </div>
        <div className="panel-title">{title}</div>
      </div>
      <div style={{ padding: "12px 16px" }}>{children}</div>
    </div>
  );
}

function InfoGrid({ rows, cols = 2 }: { rows: [string, string | number | undefined | null][]; cols?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "8px 16px" }}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--text)", fontWeight: 500 }}>
            {value || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

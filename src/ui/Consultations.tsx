import React, { useState, useRef, useEffect } from "react";
import type { Patient, TimelineEvent, PatientNote, Prescription } from "./types";
import { fmtDate } from "./utils";
import { hasRole, normalizeRole } from "../shared/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";
// Phase 8B: Import workflow audit helper and state machine
import { logWorkflowAction } from "../shared/workflow/workflowAudit";
import { validateWorkflowTransition, type WorkflowEntityType } from "../shared/workflow/workflowStateMachine";
// Phase 8C: Import patient validation and handoff helpers
import { validateWorkflowPatientReference } from "../shared/workflow/workflowValidation";
import { logSuccessfulHandoff, logFailedHandoff, logBlockedHandoff } from "../shared/workflow/workflowHandoff";

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  .cs-input, .cs-textarea, .cs-select {
    width: 100%; padding: 9px 12px; box-sizing: border-box;
    border: 1px solid var(--border); border-radius: var(--radius);
    font-size: var(--font-sm); background: var(--surface1);
    color: var(--text); font-family: inherit;
  }
  .cs-input:focus, .cs-textarea:focus, .cs-select:focus {
    outline: none; border-color: var(--accent);
  }
  .cs-input:disabled, .cs-textarea:disabled {
    opacity: 0.55; background: var(--surface2); cursor: not-allowed;
  }
  .cs-textarea { resize: vertical; }
  .cs-label {
    display: block; font-size: var(--font-xs); font-weight: 700;
    color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;
    margin-bottom: 5px;
  }
  .cs-dropdown-menu {
    background: var(--surface1); border: 1px solid var(--border);
    border-radius: var(--radius); max-height: 260px; overflow-y: auto;
    margin-top: 6px;
  }
  .cs-dropdown-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer;
  }
  .cs-dropdown-item:hover, .cs-dropdown-item.active { background: var(--surface2); }
  .cs-section-title {
    font-size: var(--font-xs); font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
  }
  .cs-divider { border: none; border-top: 1px solid var(--border); margin: 18px 0; }
  .cs-history-item {
    padding: 14px 16px; border-radius: var(--radius);
    border: 1px solid var(--border); background: var(--surface2);
    cursor: pointer; transition: border-color 0.15s;
  }
  .cs-history-item:hover { border-color: var(--accent-border); }
  @media (max-width: 768px) {
    .cs-stats { grid-template-columns: repeat(2, 1fr) !important; }
    .cs-vitals { grid-template-columns: 1fr 1fr !important; }
    .cs-main-grid { grid-template-columns: 1fr !important; }
    .cs-actions { flex-direction: column !important; }
    .cs-actions button { width: 100%; }
    .cs-rx-grid { grid-template-columns: 1fr !important; }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────
type ConsultStatus = "pending" | "in-progress" | "completed";

interface ConsultRecord {
  id: string;
  patientId: string;
  date: string;
  doctor: string;
  bp: string; hr: string; temp: string; weight: string;
  complaint: string; symptoms: string; diagnosis: string;
  treatment: string; followup: string;
  prescriptions: Prescription[];
  status: ConsultStatus;
}

const emptyConsult = (patientId: string, doctor: string): ConsultRecord => ({
  id: `consult-${Date.now()}`,
  patientId, doctor,
  date: new Date().toISOString(),
  bp: "", hr: "", temp: "", weight: "",
  complaint: "", symptoms: "", diagnosis: "", treatment: "", followup: "",
  prescriptions: [],
  status: "pending",
});

// ─── localStorage helpers ──────────────────────────────────────────────────────
const CONSULTS_KEY = "clinic_consultations";
const DRAFTS_KEY = "clinic_consultation_drafts";
const ACTIVITY_KEY = "clinic_consultation_activity";
const TEMPLATES_KEY = "clinic_consultation_templates";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled */
  }
}

function loadConsults(): ConsultRecord[] {
  return readJSON<ConsultRecord[]>(CONSULTS_KEY, []);
}

function saveConsults(records: ConsultRecord[]) {
  writeJSON(CONSULTS_KEY, records);
}

interface DraftRecord {
  id: string;
  patientId: string;
  patientName: string;
  consult: ConsultRecord;
  savedAt: string;
}

function loadDrafts(): DraftRecord[] {
  return readJSON<DraftRecord[]>(DRAFTS_KEY, []);
}

function saveDrafts(drafts: DraftRecord[]) {
  writeJSON(DRAFTS_KEY, drafts);
}

interface ActivityEntry {
  timestamp: string;
  action: string;
  patientId?: string;
  details?: string;
}

function loadActivity(): ActivityEntry[] {
  return readJSON<ActivityEntry[]>(ACTIVITY_KEY, []);
}

function saveActivity(activity: ActivityEntry[]) {
  writeJSON(ACTIVITY_KEY, activity);
}

interface Template {
  id: string;
  name: string;
  category: string;
  complaint?: string;
  symptoms?: string;
  diagnosis?: string;
  treatment?: string;
  followup?: string;
}

function loadTemplates(): Template[] {
  return readJSON<Template[]>(TEMPLATES_KEY, []);
}

function saveTemplates(templates: Template[]) {
  writeJSON(TEMPLATES_KEY, templates);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ConsultationsPageProps {
  patients: Patient[];
  onUpdatePatient: (p: Patient, action?: string) => void;
  userRole?: "receptionist" | "doctor" | "admin";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConsultationsPage({ patients, onUpdatePatient, userRole = "admin" }: ConsultationsPageProps) {
  const normalizedRole = normalizeRole(userRole);

  // Local permission guards
  const canViewConsultations = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canCreateConsultation = hasRole(normalizedRole, ["admin", "doctor"]);
  const canEditConsultation = hasRole(normalizedRole, ["admin", "doctor"]);
  const canDeleteConsultation = hasRole(normalizedRole, ["admin"]);
  const canCompleteConsultation = hasRole(normalizedRole, ["admin", "doctor"]);
  const canPrintConsultation = hasRole(normalizedRole, ["admin", "doctor"]);
  const canExportConsultations = hasRole(normalizedRole, ["admin", "doctor"]);
  const canExportConsultationActivity = hasRole(normalizedRole, ["admin"]);
  const canApplyConsultationTemplate = hasRole(normalizedRole, ["admin", "doctor"]);
  const canManageConsultationTemplates = hasRole(normalizedRole, ["admin", "doctor"]);

  const handleDeniedAccess = (action: string, resource: string) => {
    setFeedback({ type: "error", message: `You don't have permission to ${action} ${resource}.` });
    logDeniedAction({
      action,
      resource,
      role: normalizedRole,
      reason: "Insufficient permissions",
      severity: "medium",
    });
  };

  const [allConsults, setAllConsults] = useState<ConsultRecord[]>(loadConsults);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeConsult, setActiveConsult] = useState<ConsultRecord | null>(null);
  const [viewingHistory, setViewingHistory] = useState<ConsultRecord | null>(null);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [newRx, setNewRx] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  // Holds the pre-edit snapshot of a *completed* consult while it's unlocked for editing,
  // so "Discard" can restore it instead of leaving a half-edited record persisted.
  const originalRef = useRef<ConsultRecord | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  // Drafts state
  const [drafts, setDrafts] = useState<DraftRecord[]>(loadDrafts);
  const [showDrafts, setShowDrafts] = useState(false);

  // Activity state
  const [activity, setActivity] = useState<ActivityEntry[]>(loadActivity);
  const [showActivity, setShowActivity] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<Template[]>(() => {
    const loaded = loadTemplates();
    // Initialize default templates if none exist
    if (loaded.length === 0) {
      const defaults: Template[] = [
        {
          id: "tpl-default-general",
          name: "General Consultation",
          category: "General",
          complaint: "Patient presents for routine consultation",
          symptoms: "No acute symptoms reported",
          diagnosis: "To be determined",
          treatment: "Physical examination performed. Vital signs within normal limits.",
          followup: "Follow up as needed",
        },
        {
          id: "tpl-default-followup",
          name: "Follow-up Visit",
          category: "Follow-up",
          complaint: "Follow-up for previous condition",
          symptoms: "Patient reports improvement in symptoms",
          diagnosis: "Condition stable",
          treatment: "Continue current treatment plan. Monitor for any changes.",
          followup: "Follow up in 2 weeks",
        },
        {
          id: "tpl-default-fever",
          name: "Fever/Cold Visit",
          category: "Fever/Cold",
          complaint: "Patient presents with fever and cold symptoms",
          symptoms: "Fever, runny nose, sore throat, cough, body aches",
          diagnosis: "Upper respiratory infection / Viral fever",
          treatment: "Rest, fluids, antipyretics for fever. Monitor temperature.",
          followup: "Follow up in 3-5 days if symptoms worsen",
        },
        {
          id: "tpl-default-diabetes",
          name: "Diabetes Review",
          category: "Diabetes",
          complaint: "Routine diabetes follow-up",
          symptoms: "No symptoms of hypo/hyperglycemia reported",
          diagnosis: "Type 2 Diabetes Mellitus - stable",
          treatment: "Continue current medications. Monitor blood glucose levels regularly.",
          followup: "Follow up in 1 month with HbA1c",
        },
        {
          id: "tpl-default-hypertension",
          name: "Hypertension Review",
          category: "Hypertension",
          complaint: "Routine blood pressure follow-up",
          symptoms: "No symptoms of hypertension reported",
          diagnosis: "Essential Hypertension - controlled",
          treatment: "Continue current antihypertensive medications. Monitor BP at home.",
          followup: "Follow up in 1 month",
        },
      ];
      saveTemplates(defaults);
      return defaults;
    }
    return loaded;
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateModal, setTemplateModal] = useState<{ mode: "create" | "edit"; template?: Template } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // History filters
  const [filterStatus, setFilterStatus] = useState<ConsultStatus | "">("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const showFeedback = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Phase 8B: Remove patientName from activity log (PHI-safe)
  const logActivity = (action: string, patientId?: string, details?: string) => {
    const entry: ActivityEntry = {
      timestamp: new Date().toISOString(),
      action,
      patientId,
      details,
    };
    const updated = [entry, ...activity].slice(0, 50);
    setActivity(updated);
    saveActivity(updated);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack typing inside inputs/textareas/selects
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        // Still allow Escape to close modals
        if (e.key === "Escape") {
          if (confirmModal) setConfirmModal(null);
          if (templateModal) setTemplateModal(null);
          if (showDrafts) setShowDrafts(false);
          if (showActivity) setShowActivity(false);
          if (showTemplates) setShowTemplates(false);
          if (viewingHistory) setViewingHistory(null);
        }
        return;
      }
      // Escape closes modals
      if (e.key === "Escape") {
        if (confirmModal) setConfirmModal(null);
        if (templateModal) setTemplateModal(null);
        if (showDrafts) setShowDrafts(false);
        if (showActivity) setShowActivity(false);
        if (showTemplates) setShowTemplates(false);
        if (viewingHistory) setViewingHistory(null);
      }
      // Ctrl/Cmd + S saves draft
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeConsult && selectedPatient) {
          handleSaveDraft();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, templateModal, showDrafts, showActivity, showTemplates, viewingHistory, activeConsult, selectedPatient]);

  const persist = (updated: ConsultRecord[]) => {
    setAllConsults(updated);
    saveConsults(updated);
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    (p.doctor || "").toLowerCase().includes(search.toLowerCase())
  );

  const patientConsults = (pid: string) =>
    allConsults.filter(c => c.patientId === pid).sort((a, b) => b.date.localeCompare(a.date));

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearch(p.name);
    setDropdownOpen(false);
    setViewingHistory(null);
    // Open the in-progress consult for this patient if one exists, else start fresh
    const inProg = allConsults.find(c => c.patientId === p.id && c.status === "in-progress");
    setActiveConsult(inProg ?? emptyConsult(p.id, p.doctor || ""));
    originalRef.current = null;
  };

  const handleFieldChange = (key: keyof ConsultRecord, value: string) => {
    if (!activeConsult) return;
    const updated = { ...activeConsult, [key]: value, status: "in-progress" as ConsultStatus };
    setActiveConsult(updated);
    // Auto-upsert into allConsults
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);

    // Phase 8B: Log workflow action for consultation edit
    if (activeConsult.status !== "in-progress") {
      logWorkflowAction({
        action: "edit",
        entityType: "consultation",
        entityId: updated.id,
        patientId: selectedPatient?.id,
        metadata: {
          field: key,
          performedBy: normalizedRole,
        },
      });
    }
  };

  const handleSave = () => {
    if (!canEditConsultation) {
      handleDeniedAccess("save", "consultation");
      return;
    }
    if (!activeConsult || !selectedPatient) {
      showFeedback("Please select a patient first.", "error");
      return;
    }

    // Phase 8C: Validate patient reference before saving consultation
    const patientValidation = validateWorkflowPatientReference(selectedPatient.id, patients, {
      requireActive: true,
      allowDeleted: false,
      action: "save consultation"
    });
    if (!patientValidation.valid) {
      showFeedback(patientValidation.reason, "error");
      logBlockedHandoff({
        fromModule: "consultations",
        toModule: "consultations",
        action: "save_consultation",
        patientId: selectedPatient.id,
        resourceId: activeConsult.id,
        reason: patientValidation.reason,
        actor: normalizedRole,
      });
      return;
    }

    // Validation for completing consultation
    if (!activeConsult.complaint && !activeConsult.diagnosis) {
      showFeedback("Chief complaint or diagnosis is required to complete consultation.", "error");
      return;
    }
    if (!activeConsult.treatment && !activeConsult.followup) {
      showFeedback("Treatment plan or follow-up notes are required to complete consultation.", "error");
      return;
    }

    // Vitals validation (light)
    if (activeConsult.hr && isNaN(Number(activeConsult.hr))) {
      showFeedback("Heart rate must be a number.", "warning");
      return;
    }
    if (activeConsult.temp && isNaN(Number(activeConsult.temp))) {
      showFeedback("Temperature must be a number.", "warning");
      return;
    }
    if (activeConsult.weight && isNaN(Number(activeConsult.weight))) {
      showFeedback("Weight must be a number.", "warning");
      return;
    }
    if (activeConsult.bp && !/^\d{2,3}\/\d{2,3}$/.test(activeConsult.bp)) {
      showFeedback("Blood pressure format should be like 120/80.", "warning");
      return;
    }

    // Phase 8B: Validate status transition using state machine
    const transitionResult = validateWorkflowTransition(
      "consultation" as WorkflowEntityType,
      activeConsult.status,
      "completed"
    );
    if (!transitionResult.valid) {
      showFeedback(`Invalid status transition: ${transitionResult.reason}`, "error");
      return;
    }

    const saved: ConsultRecord = { ...activeConsult, status: "completed" };
    const others = allConsults.filter(c => c.id !== saved.id);
    persist([...others, saved]);
    setActiveConsult(saved);

    // Phase 8B: Log workflow action for status change
    logWorkflowAction({
      action: "status_change",
      entityType: "consultation",
      entityId: saved.id,
      patientId: selectedPatient.id,
      metadata: {
        fromStatus: activeConsult.status,
        toStatus: "completed",
        performedBy: normalizedRole,
      },
    });

    // Phase 8C: Log handoff for consultation completion
    logSuccessfulHandoff({
      fromModule: "consultations",
      toModule: "patient_profile",
      action: "consultation_completed",
      patientId: selectedPatient.id,
      resourceId: saved.id,
      resourceType: "consultation",
      actor: normalizedRole,
    });

    // Remove draft if exists
    const updatedDrafts = drafts.filter(d => d.patientId !== selectedPatient.id);
    setDrafts(updatedDrafts);
    saveDrafts(updatedDrafts);

    // ── Write back to Patient record ──────────────────────────────────────────
    const now = new Date().toISOString();

    // 1. Update lastVisit
    // 2. Add/replace timeline event for this consult (tied to consult id so re-saving an
    //    edited visit updates the existing entry instead of duplicating it)
    const tlEvent: TimelineEvent = {
      id: `tl-${saved.id}`,
      type: "consultation",
      label: "Consultation Completed",
      icon: "ti-stethoscope",
      color: "var(--blue)",
      date: now,
      note: saved.diagnosis || saved.complaint || "Visit recorded",
      doctor: saved.doctor,
    };
    const timeline = [
      ...(selectedPatient.timeline || []).filter(t => t.id !== tlEvent.id),
      tlEvent,
    ];

    // 3. Add/replace clinical note for this consult if diagnosis/complaint filled
    const noteId = `note-${saved.id}`;
    let notes = (selectedPatient.notes || []).filter(n => n.id !== noteId);
    if (saved.diagnosis || saved.complaint) {
      const note: PatientNote = {
        id: noteId,
        text: [
          saved.complaint && `Chief Complaint: ${saved.complaint}`,
          saved.diagnosis && `Diagnosis: ${saved.diagnosis}`,
          saved.treatment && `Treatment: ${saved.treatment}`,
          saved.followup && `Follow-up: ${saved.followup}`,
        ].filter(Boolean).join("\n"),
        pinned: false,
        date: now,
        category: "Consultation",
        author: saved.doctor,
      };
      notes = [...notes, note];
    }

    // 4. Add any new prescriptions
    const existingRx = selectedPatient.prescriptions || [];
    const newRxItems = saved.prescriptions.filter(
      rx => !existingRx.find(e => e.id === rx.id)
    );

    // Update patient status
    const updatedPatient: Patient = {
      ...selectedPatient,
      lastVisit: now,
      status: "Active",
      timeline,
      notes,
      prescriptions: [...existingRx, ...newRxItems],
      updatedAt: now,
    };

    // Set follow-up if provided
    if (saved.followup) {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 7); // Default 7 days
      updatedPatient.followUpDate = followUpDate.toISOString().split("T")[0];
      updatedPatient.status = "Follow-Up Due";
    }

    onUpdatePatient(updatedPatient, "consultation saved");

    logActivity("consultation completed", selectedPatient.id, `Diagnosis: ${saved.diagnosis || saved.complaint}`);

    originalRef.current = null;
    setSaveFlash(true);
    showFeedback("Consultation completed and saved to patient record.", "success");
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const handleSaveDraft = () => {
    if (!canEditConsultation) {
      handleDeniedAccess("save draft", "consultation");
      return;
    }
    if (!activeConsult || !selectedPatient) {
      showFeedback("Please select a patient first.", "error");
      return;
    }

    // Validation for draft - at least one clinical field
    const hasContent = Object.entries(activeConsult)
      .filter(([k]) => ["bp","hr","temp","weight","complaint","symptoms","diagnosis","treatment","followup"].includes(k))
      .some(([,v]) => typeof v === "string" && v.trim())
      || activeConsult.prescriptions.length > 0;

    if (!hasContent) {
      showFeedback("Add at least one clinical field before saving draft.", "warning");
      return;
    }

    const draft: DraftRecord = {
      id: `draft-${activeConsult.id}`,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      consult: activeConsult,
      savedAt: new Date().toISOString(),
    };

    // Remove existing draft for this patient
    const updatedDrafts = drafts.filter(d => d.patientId !== selectedPatient.id);
    setDrafts([draft, ...updatedDrafts]);
    saveDrafts([draft, ...updatedDrafts]);

    logActivity("draft saved", selectedPatient.id);
    showFeedback("Draft saved successfully.", "success");
  };

  const handleLoadDraft = (draft: DraftRecord) => {
    if (draft.patientId !== selectedPatient?.id) {
      showFeedback("This draft belongs to a different patient.", "error");
      return;
    }
    setActiveConsult(draft.consult);
    setViewingHistory(null);
    logActivity("draft loaded", selectedPatient.id);
    showFeedback("Draft loaded.", "info");
  };

  const handleDeleteDraft = (draftId: string) => {
    if (!canEditConsultation) {
      handleDeniedAccess("delete draft", "consultation");
      return;
    }
    setConfirmModal({
      message: "Are you sure you want to delete this draft?",
      onConfirm: () => {
        const updatedDrafts = drafts.filter(d => d.id !== draftId);
        setDrafts(updatedDrafts);
        saveDrafts(updatedDrafts);
        logActivity("draft deleted");
        showFeedback("Draft deleted.", "info");
        setConfirmModal(null);
      },
    });
  };

  const handleApplyTemplate = (template: Template) => {
    if (!canApplyConsultationTemplate) {
      handleDeniedAccess("apply template", "consultation");
      return;
    }
    if (!activeConsult) {
      showFeedback("Start a consultation first to apply a template.", "warning");
      return;
    }
    const updated = {
      ...activeConsult,
      complaint: template.complaint || activeConsult.complaint,
      symptoms: template.symptoms || activeConsult.symptoms,
      diagnosis: template.diagnosis || activeConsult.diagnosis,
      treatment: template.treatment || activeConsult.treatment,
      followup: template.followup || activeConsult.followup,
      status: "in-progress" as ConsultStatus,
    };
    setActiveConsult(updated);
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);
    logActivity("template applied", selectedPatient?.id, `Template: ${template.name}`);
    showFeedback(`Template "${template.name}" applied.`, "success");
  };

  const handleSaveTemplate = (template: Omit<Template, "id">) => {
    if (!canManageConsultationTemplates) {
      handleDeniedAccess("save template", "consultation");
      return;
    }
    const newTemplate: Template = {
      ...template,
      id: `tpl-${Date.now()}`,
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveTemplates(updated);
    logActivity("template saved", undefined, undefined, `Template: ${template.name}`);
    showFeedback(`Template "${template.name}" saved.`, "success");
    setTemplateModal(null);
  };

  const handleEditTemplate = (template: Template) => {
    const updated = templates.map(t => t.id === template.id ? template : t);
    setTemplates(updated);
    saveTemplates(updated);
    logActivity("template updated", undefined, undefined, `Template: ${template.name}`);
    showFeedback(`Template "${template.name}" updated.`, "success");
    setTemplateModal(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!canManageConsultationTemplates) {
      handleDeniedAccess("delete template", "consultation");
      return;
    }
    setConfirmModal({
      message: "Are you sure you want to delete this template?",
      onConfirm: () => {
        const updated = templates.filter(t => t.id !== templateId);
        setTemplates(updated);
        saveTemplates(updated);
        logActivity("template deleted", undefined, undefined, `Template ID: ${templateId}`);
        showFeedback("Template deleted.", "info");
        setConfirmModal(null);
      },
    });
  };

  const handleExportConsultationTXT = () => {
    if (!canExportConsultations) {
      handleDeniedAccess("export", "consultation");
      return;
    }
    if (!viewingHistory && !activeConsult) {
      showFeedback("No consultation to export.", "warning");
      return;
    }
    const consult = viewingHistory || activeConsult;
    if (!consult) return;

    const patient = patients.find(p => p.id === consult.patientId);
    if (!patient) {
      showFeedback("Patient not found.", "error");
      return;
    }

    const txt = `
CONSULTATION RECORD
===================
Date: ${new Date(consult.date).toLocaleString()}
Patient: ${patient.name} (${patient.id})
Doctor: ${consult.doctor}

VITALS
------
Blood Pressure: ${consult.bp || "Not recorded"}
Heart Rate: ${consult.hr || "Not recorded"}
Temperature: ${consult.temp || "Not recorded"}
Weight: ${consult.weight || "Not recorded"}

CLINICAL NOTES
--------------
Chief Complaint: ${consult.complaint || "Not recorded"}
Symptoms: ${consult.symptoms || "Not recorded"}
Diagnosis: ${consult.diagnosis || "Not recorded"}
Treatment Plan: ${consult.treatment || "Not recorded"}
Follow-up: ${consult.followup || "Not recorded"}

PRESCRIPTIONS
${consult.prescriptions.length === 0 ? "None" : consult.prescriptions.map(rx => 
  `- ${rx.medicationName} ${rx.dosage}, ${rx.frequency}, ${rx.duration}${rx.route ? ` (${rx.route})` : ""}${rx.instructions ? ` - ${rx.instructions}` : ""}`
).join("\n")}

Generated by Clinic CRM
    `.trim();

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consultation-${patient.id}-${new Date(consult.date).toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("consultation exported as TXT", consult.patientId);
    showFeedback("Consultation exported as TXT.", "success");
  };

  const handleExportHistoryCSV = () => {
    if (!canExportConsultations) {
      handleDeniedAccess("export", "consultation history");
      return;
    }
    const filteredHistory = allConsults.filter(c => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterDoctor && c.doctor !== filterDoctor) return false;
      if (filterDateFrom && new Date(c.date) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(c.date) > new Date(filterDateTo + "T23:59:59")) return false;
      if (historySearch) {
        const patient = patients.find(p => p.id === c.patientId);
        const searchLower = historySearch.toLowerCase();
        if (!patient) return false;
        if (!patient.name.toLowerCase().includes(searchLower) &&
            !c.diagnosis?.toLowerCase().includes(searchLower) &&
            !c.complaint?.toLowerCase().includes(searchLower) &&
            !c.treatment?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });

    if (filteredHistory.length === 0) {
      showFeedback("No consultations to export with current filters.", "info");
      return;
    }

    const header = "Consultation ID,Patient ID,Patient Name,Doctor,Date,BP,HR,Temp,Weight,Chief Complaint,Symptoms,Diagnosis,Treatment,Follow-up,Status\n";
    const rows = filteredHistory.map(c => {
      const patient = patients.find(p => p.id === c.patientId);
      return [
        `"${c.id}"`,
        `"${c.patientId}"`,
        `"${patient?.name || "Unknown"}"`,
        `"${c.doctor}"`,
        `"${new Date(c.date).toLocaleString()}"`,
        `"${c.bp}"`,
        `"${c.hr}"`,
        `"${c.temp}"`,
        `"${c.weight}"`,
        `"${(c.complaint || "").replace(/"/g, '""')}"`,
        `"${(c.symptoms || "").replace(/"/g, '""')}"`,
        `"${(c.diagnosis || "").replace(/"/g, '""')}"`,
        `"${(c.treatment || "").replace(/"/g, '""')}"`,
        `"${(c.followup || "").replace(/"/g, '""')}"`,
        `"${c.status}"`,
      ].join(",");
    }).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consultations-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("consultation history exported as CSV", undefined, undefined, `${filteredHistory.length} records`);
    showFeedback(`Exported ${filteredHistory.length} consultation(s) as CSV.`, "success");
  };

  const handlePrintConsultation = () => {
    if (!canPrintConsultation) {
      handleDeniedAccess("print", "consultation");
      return;
    }
    if (!viewingHistory && !activeConsult) {
      showFeedback("No consultation to print.", "warning");
      return;
    }
    const consult = viewingHistory || activeConsult;
    if (!consult) return;

    const patient = patients.find(p => p.id === consult.patientId);
    if (!patient) {
      showFeedback("Patient not found.", "error");
      return;
    }

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Consultation - ${patient.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .section { margin: 20px 0; }
    .section h2 { background: #f4f4f4; padding: 8px; margin: 0 0 10px 0; }
    .vitals-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .vital-item { padding: 8px; background: #f9f9f9; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; }
    .value { margin-left: 10px; }
    .prescriptions { margin-top: 10px; }
    .rx-item { padding: 10px; border: 1px solid #ddd; margin-bottom: 5px; }
  </style>
</head>
<body>
  <h1>Consultation Record</h1>
  <div class="header">
    <div>
      <strong>Patient:</strong> ${patient.name}<br>
      <strong>ID:</strong> ${patient.id}<br>
      ${patient.age ? `<strong>Age:</strong> ${patient.age}<br>` : ""}
      ${patient.gender ? `<strong>Gender:</strong> ${patient.gender}<br>` : ""}
    </div>
    <div style="text-align: right;">
      <strong>Date:</strong> ${new Date(consult.date).toLocaleString()}<br>
      <strong>Doctor:</strong> ${consult.doctor}<br>
      <strong>Status:</strong> ${consult.status}
    </div>
  </div>

  <div class="section">
    <h2>Vitals</h2>
    <div class="vitals-grid">
      <div class="vital-item"><span class="label">BP:</span> <span class="value">${consult.bp || "Not recorded"}</span></div>
      <div class="vital-item"><span class="label">HR:</span> <span class="value">${consult.hr || "Not recorded"}</span></div>
      <div class="vital-item"><span class="label">Temp:</span> <span class="value">${consult.temp || "Not recorded"}</span></div>
      <div class="vital-item"><span class="label">Weight:</span> <span class="value">${consult.weight || "Not recorded"}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Clinical Notes</h2>
    <div class="field"><span class="label">Chief Complaint:</span> <span class="value">${consult.complaint || "Not recorded"}</span></div>
    <div class="field"><span class="label">Symptoms:</span> <span class="value">${consult.symptoms || "Not recorded"}</span></div>
    <div class="field"><span class="label">Diagnosis:</span> <span class="value">${consult.diagnosis || "Not recorded"}</span></div>
    <div class="field"><span class="label">Treatment Plan:</span> <span class="value">${consult.treatment || "Not recorded"}</span></div>
    <div class="field"><span class="label">Follow-up:</span> <span class="value">${consult.followup || "Not recorded"}</span></div>
  </div>

  ${consult.prescriptions.length > 0 ? `
  <div class="section">
    <h2>Prescriptions</h2>
    <div class="prescriptions">
      ${consult.prescriptions.map(rx => `
        <div class="rx-item">
          <strong>${rx.medicationName}</strong> - ${rx.dosage}, ${rx.frequency}, ${rx.duration}
          ${rx.route ? ` (${rx.route})` : ""}<br>
          ${rx.instructions ? `<em>${rx.instructions}</em>` : ""}
        </div>
      `).join("")}
    </div>
  </div>
  ` : ""}

  <div style="margin-top: 40px; font-size: 12px; color: #666; text-align: center;">
    Generated by Clinic CRM
  </div>
</body>
</html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      logActivity("consultation printed", consult.patientId);
      showFeedback("Print dialog opened.", "success");
    } else {
      showFeedback("Popup blocked. Please allow popups for this site.", "error");
    }
  };

  const handleDeleteConsultation = (consultId: string) => {
    if (!canDeleteConsultation) {
      handleDeniedAccess("delete", "consultation");
      return;
    }
    setConfirmModal({
      message: "Are you sure you want to delete this consultation? This cannot be undone.",
      onConfirm: () => {
        const consult = allConsults.find(c => c.id === consultId);
        const updated = allConsults.filter(c => c.id !== consultId);
        persist(updated);
        if (viewingHistory?.id === consultId) setViewingHistory(null);
        if (activeConsult?.id === consultId) setActiveConsult(null);
        if (consult) {
          logActivity("consultation deleted", consult.patientId, undefined, `Consultation ID: ${consultId}`);
        }
        showFeedback("Consultation deleted.", "success");
        setConfirmModal(null);
      },
    });
  };

  const handleMarkCompleted = (consultId: string) => {
    if (!canCompleteConsultation) {
      handleDeniedAccess("complete", "consultation");
      return;
    }
    const consult = allConsults.find(c => c.id === consultId);
    if (!consult) return;

    // Phase 8B: Validate status transition using state machine
    const transitionResult = validateWorkflowTransition(
      "consultation" as WorkflowEntityType,
      consult.status,
      "completed"
    );
    if (!transitionResult.valid) {
      showFeedback(`Invalid status transition: ${transitionResult.reason}`, "error");
      return;
    }

    const updated = { ...consult, status: "completed" as ConsultStatus };
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);

    if (viewingHistory?.id === consultId) setViewingHistory({ ...viewingHistory, status: "completed" });

    // Phase 8B: Log workflow action for status change
    logWorkflowAction({
      action: "status_change",
      entityType: "consultation",
      entityId: consultId,
      patientId: consult.patientId,
      metadata: {
        fromStatus: consult.status,
        toStatus: "completed",
        performedBy: normalizedRole,
      },
    });

    logActivity("consultation marked completed", consult.patientId, undefined, `Consultation ID: ${consultId}`);
    showFeedback("Consultation marked as completed.", "success");
  };

  const handleClearActivity = () => {
    if (!canExportConsultationActivity) {
      handleDeniedAccess("clear", "consultation activity");
      return;
    }
    setConfirmModal({
      message: "Are you sure you want to clear all activity logs?",
      onConfirm: () => {
        setActivity([]);
        saveActivity([]);
        showFeedback("Activity log cleared.", "success");
        setConfirmModal(null);
      },
    });
  };

  const handleExportActivityCSV = () => {
    if (!canExportConsultationActivity) {
      handleDeniedAccess("export", "consultation activity");
      return;
    }
    if (activity.length === 0) {
      showFeedback("No activity to export.", "info");
      return;
    }

    const header = "Timestamp,Action,Patient ID,Details\n";
    const rows = activity.map(a => [
      `"${new Date(a.timestamp).toLocaleString()}"`,
      `"${a.action}"`,
      `"${a.patientId || ""}"`,
      `"${(a.details || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consultation-activity-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showFeedback("Activity log exported.", "success");
  };

  const handleAddRx = (rx: Prescription) => {
    if (!activeConsult) return;
    const updated = { ...activeConsult, prescriptions: [...activeConsult.prescriptions, rx] };
    setActiveConsult(updated);
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);
    setNewRx(false);
  };

  const handleRemoveRx = (id: string) => {
    if (!activeConsult) return;
    const updated = { ...activeConsult, prescriptions: activeConsult.prescriptions.filter(r => r.id !== id) };
    setActiveConsult(updated);
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);
  };

  const handleNewConsult = () => {
    if (!selectedPatient) return;
    const fresh = emptyConsult(selectedPatient.id, selectedPatient.doctor || "");
    setActiveConsult(fresh);
    setViewingHistory(null);
    originalRef.current = null;
  };

  const handleViewHistory = (c: ConsultRecord) => {
    setViewingHistory(c);
    setActiveConsult(null);
    originalRef.current = null;
  };

  const handleDiscard = () => {
    if (!activeConsult) return;
    if (originalRef.current) {
      // Was a completed visit unlocked for editing — restore it instead of leaving
      // half-finished edits sitting in storage.
      const restored = originalRef.current;
      const others = allConsults.filter(c => c.id !== restored.id);
      persist([...others, restored]);
    } else {
      // Brand-new/never-completed draft — actually remove it, since it was
      // auto-persisted on every keystroke and would otherwise resurface later.
      persist(allConsults.filter(c => c.id !== activeConsult.id));
    }
    originalRef.current = null;
    setActiveConsult(null);
    setViewingHistory(null);
  };

  // Stats
  const totalToday = (() => {
    const today = new Date().toDateString();
    return allConsults.filter(c => new Date(c.date).toDateString() === today).length;
  })();
  const totalCompleted = allConsults.filter(c => c.status === "completed").length;
  const totalInProgress = allConsults.filter(c => c.status === "in-progress").length;

  const isCompleted = activeConsult?.status === "completed";
  const history = selectedPatient ? patientConsults(selectedPatient.id) : [];
  const hasContent = activeConsult ? (
    Object.entries(activeConsult)
      .filter(([k]) => ["bp","hr","temp","weight","complaint","symptoms","diagnosis","treatment","followup"].includes(k))
      .some(([,v]) => typeof v === "string" && v.trim())
    || activeConsult.prescriptions.length > 0
  ) : false;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <style>{css}</style>

      {/* Feedback display */}
      {feedback && (
        <div style={{
          padding: "10px 14px",
          marginBottom: 16,
          background: feedback.type === "success" ? "var(--green-bg)" : feedback.type === "error" ? "var(--red-bg)" : feedback.type === "warning" ? "var(--amber-bg)" : "var(--blue-bg)",
          color: feedback.type === "success" ? "var(--green)" : feedback.type === "error" ? "var(--red)" : feedback.type === "warning" ? "var(--amber)" : "var(--blue)",
          border: `1px solid ${feedback.type === "success" ? "var(--green-border)" : feedback.type === "error" ? "var(--red-border)" : feedback.type === "warning" ? "var(--amber-border)" : "var(--blue-border)"}`,
          borderRadius: "var(--radius)",
          fontSize: "var(--font-sm)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <i className={`ti ${feedback.type === "success" ? "ti-circle-check" : feedback.type === "error" ? "ti-alert-circle" : feedback.type === "warning" ? "ti-alert-triangle" : "ti-info-circle"}`} style={{ fontSize: 14 }} />
          {feedback.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 4 }}>
            Consultations & Encounters
          </h1>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            Record and manage patient visit notes — saves to patient timeline, notes, and prescriptions
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowDrafts(!showDrafts)}>
            <i className="ti ti-file-description" style={{ marginRight: 4, fontSize: 12 }} />Drafts ({drafts.length})
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowTemplates(!showTemplates)}>
            <i className="ti ti-template" style={{ marginRight: 4, fontSize: 12 }} />Templates
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowActivity(!showActivity)}>
            <i className="ti ti-history" style={{ marginRight: 4, fontSize: 12 }} />Activity
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="cs-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Today's Visits"  value={totalToday}      color="var(--blue)"  icon="ti-stethoscope" bg="var(--blue-bg)"  />
        <StatCard label="In Progress"     value={totalInProgress} color="var(--amber)" icon="ti-activity"    bg="var(--amber-bg)" />
        <StatCard label="Completed"       value={totalCompleted}  color="var(--green)" icon="ti-check"       bg="var(--green-bg)" />
        <StatCard label="All Patients"    value={patients.length} color="var(--muted)" icon="ti-users"       bg="var(--surface3)" />
      </div>

      {/* Drafts Panel */}
      {showDrafts && (
        <div className="card card-padded" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="cs-section-title" style={{ margin: 0 }}>Drafts ({drafts.length})</div>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setShowDrafts(false)}>
              <i className="ti ti-x" style={{ fontSize: 11 }} />
            </button>
          </div>
          {drafts.length === 0 ? (
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>
              No saved drafts
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {drafts.map(d => (
                <div key={d.id} style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {/* Phase 8B: Derive patient name from current patient data at display time */}
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                      {patients.find(p => p.id === d.patientId)?.name || d.patientId}
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Saved {new Date(d.savedAt).toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => handleLoadDraft(d)}>
                      <i className="ti ti-upload" style={{ fontSize: 11 }} />
                    </button>
                    {canEditConsultation && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }} onClick={() => handleDeleteDraft(d.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 11 }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div className="card card-padded" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="cs-section-title" style={{ margin: 0 }}>Clinical Note Templates</div>
            <div style={{ display: "flex", gap: 4 }}>
              {canManageConsultationTemplates && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setTemplateModal({ mode: "create" })}>
                  <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 4 }} />New
                </button>
              )}
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setShowTemplates(false)}>
                <i className="ti ti-x" style={{ fontSize: 11 }} />
              </button>
            </div>
          </div>
          {templates.length === 0 ? (
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>
              No templates saved. Create one to quickly fill clinical notes.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {templates.map(t => (
                <div key={t.id} style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>{t.category}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {canApplyConsultationTemplate && (
                      <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", flex: 1 }} onClick={() => handleApplyTemplate(t)}>
                        Apply
                      </button>
                    )}
                    {canManageConsultationTemplates && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }} onClick={() => setTemplateModal({ mode: "edit", template: t })}>
                        <i className="ti ti-pencil" style={{ fontSize: 11 }} />
                      </button>
                    )}
                    {canManageConsultationTemplates && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }} onClick={() => handleDeleteTemplate(t.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 11 }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Panel */}
      {showActivity && (
        <div className="card card-padded" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="cs-section-title" style={{ margin: 0 }}>Activity Log ({activity.length})</div>
            <div style={{ display: "flex", gap: 4 }}>
              {canExportConsultationActivity && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 90px" }} onClick={handleExportActivityCSV}>
                  <i className="ti ti-download" style={{ fontSize: 11, marginRight: 4 }} />Export CSV
                </button>
              )}
              {canExportConsultationActivity && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", color: "var(--red)" }} onClick={handleClearActivity}>
                  <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 4 }} />Clear
                </button>
              )}
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setShowActivity(false)}>
                <i className="ti ti-x" style={{ fontSize: 11 }} />
              </button>
            </div>
          </div>
          {activity.length === 0 ? (
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>
              No activity recorded yet
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {activity.map((a, i) => (
                <div key={i} style={{ padding: "8px 12px", background: i === 0 ? "var(--accent-soft)" : "var(--surface2)", borderRadius: "var(--radius)", fontSize: "var(--font-xs)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{a.action}</span>
                    <span style={{ color: "var(--muted)" }}>{new Date(a.timestamp).toLocaleString()}</span>
                  </div>
                  {a.patientId && (
                    <div style={{ color: "var(--muted)" }}>
                      Patient: {patients.find(p => p.id === a.patientId)?.name || a.patientId}
                    </div>
                  )}
                  {a.details && <div style={{ color: "var(--muted)", fontStyle: "italic" }}>{a.details}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 400, width: "90%" }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 12 }}>Confirm Action</div>
            <div style={{ fontSize: "var(--font-sm)", marginBottom: 16, color: "var(--muted)" }}>{confirmModal.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={confirmModal.onConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {templateModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 500, width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 12 }}>
              {templateModal.mode === "create" ? "Create Template" : "Edit Template"}
            </div>
            <TemplateForm
              template={templateModal.template}
              onSave={handleSaveTemplate}
              onEdit={handleEditTemplate}
              onCancel={() => setTemplateModal(null)}
            />
          </div>
        </div>
      )}

      {/* Patient Picker */}
      <div className="card card-padded" style={{ marginBottom: 14 }}>
        <div className="cs-section-title">Select Patient</div>
        <div style={{ position: "relative" }} ref={dropRef}>
          <div style={{ position: "relative" }}>
            <i className="ti ti-search" style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:13, pointerEvents:"none" }} />
            <input
              className="cs-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search by name, ID, or doctor…"
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true); if (!e.target.value) { setSelectedPatient(null); setActiveConsult(null); setViewingHistory(null); originalRef.current = null; } }}
              onFocus={() => setDropdownOpen(true)}
            />
            {search && (
              <button onClick={() => { setSearch(""); setSelectedPatient(null); setActiveConsult(null); setViewingHistory(null); originalRef.current = null; }}
                style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--muted)", padding:2 }}>
                <i className="ti ti-x" style={{ fontSize:13 }} />
              </button>
            )}
          </div>

          {dropdownOpen && (
            <div className="cs-dropdown-menu">
              {filtered.length === 0
                ? <div style={{ padding:"14px 16px", fontSize:"var(--font-sm)", color:"var(--muted)" }}>No patients found</div>
                : filtered.map(p => {
                  const pConsults = patientConsults(p.id);
                  const lastC = pConsults[0];
                  const hasDraft = pConsults.some(c => c.status === "in-progress");
                  return (
                    <div key={p.id} className={`cs-dropdown-item${selectedPatient?.id === p.id ? " active" : ""}`} onClick={() => handleSelectPatient(p)}>
                      <Avatar name={p.name} size={36} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"var(--font-sm)", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                          {p.name}
                          {hasDraft && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--amber)", display:"inline-block" }} title="Draft in progress" />}
                        </div>
                        <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {p.doctor}{p.age ? ` · Age ${p.age}` : ""}{lastC ? ` · Last: ${fmtDate(lastC.date)}` : " · No visits"}
                        </div>
                      </div>
                      <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", flexShrink:0 }}>
                        {pConsults.length} visit{pConsults.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>

        {/* Patient info strip */}
        {selectedPatient && (
          <div style={{ marginTop:12, padding:"10px 14px", background:"var(--accent-soft)", border:"1px solid var(--accent-border)", borderRadius:"var(--radius)", display:"flex", flexWrap:"wrap", gap:16, alignItems:"center" }}>
            <Chip icon="ti-id" label="ID" value={selectedPatient.id} />
            {selectedPatient.age    && <Chip icon="ti-calendar"        label="Age"       value={selectedPatient.age} />}
            {selectedPatient.gender && <Chip icon="ti-gender-bigender" label="Gender"    value={selectedPatient.gender} />}
            {selectedPatient.bloodGroup && <Chip icon="ti-droplet"     label="Blood"     value={selectedPatient.bloodGroup} />}
            {selectedPatient.doctor && <Chip icon="ti-user-md"         label="Doctor"    value={selectedPatient.doctor} />}
            {selectedPatient.phone  && <Chip icon="ti-phone"           label="Phone"     value={selectedPatient.phone} />}
            {(selectedPatient.allergies && selectedPatient.allergies !== "None") &&
              <Chip icon="ti-alert-triangle" label="Allergies" value={selectedPatient.allergies} color="var(--red)" />}
            {(selectedPatient.conditions?.length ?? 0) > 0 &&
              <Chip icon="ti-heartbeat" label="Conditions" value={(selectedPatient.conditions ?? []).join(", ")} />}
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="cs-main-grid" style={{ display:"grid", gridTemplateColumns: history.length > 0 ? "1fr 2fr" : "1fr", gap:14 }}>

          {/* Visit History sidebar */}
          {history.length > 0 && (
            <div className="card card-padded" style={{ alignSelf:"start" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div className="cs-section-title" style={{ margin:0 }}>Visit History ({history.length})</div>
                <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={handleNewConsult}>
                  <i className="ti ti-plus" style={{ fontSize:11, marginRight:4 }} />New
                </button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {history.map(c => {
                  const isActive = activeConsult?.id === c.id;
                  const isViewing = viewingHistory?.id === c.id;
                  return (
                    <div key={c.id} className="cs-history-item"
                      style={{ borderColor: (isActive || isViewing) ? "var(--accent-border)" : "var(--border)", background: (isActive||isViewing) ? "var(--accent-soft)" : "var(--surface2)" }}
                      onClick={() => c.status === "in-progress" ? (setActiveConsult(c), setViewingHistory(null)) : handleViewHistory(c)}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontSize:"var(--font-xs)", fontWeight:700 }}>{new Date(c.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                        <StatusPill status={c.status} />
                      </div>
                      <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {c.diagnosis || c.complaint || "No notes yet"}
                      </div>
                      {c.doctor && <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>{c.doctor}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Consult form / history viewer */}
          <div className="card card-padded">
            {viewingHistory ? (
              <HistoryView
                record={viewingHistory}
                onClose={() => setViewingHistory(null)}
                onEdit={canEditConsultation ? () => {
                  // Snapshot the completed record before unlocking so Discard can restore it
                  originalRef.current = viewingHistory;
                  const unlocked = { ...viewingHistory, status: "in-progress" as ConsultStatus };
                  const others = allConsults.filter(c => c.id !== unlocked.id);
                  persist([...others, unlocked]);
                  setActiveConsult(unlocked);
                  setViewingHistory(null);
                } : undefined}
                onExport={canExportConsultations ? handleExportConsultationTXT : undefined}
                onPrint={canPrintConsultation ? handlePrintConsultation : undefined}
                onDelete={canDeleteConsultation ? () => handleDeleteConsultation(viewingHistory.id) : undefined}
                onMarkCompleted={canCompleteConsultation ? () => handleMarkCompleted(viewingHistory.id) : undefined}
              />
            ) : activeConsult ? (
              <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:14, borderBottom:"1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize:"var(--font-md)", fontWeight:700 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>
                      {new Date(activeConsult.date).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                      {activeConsult.doctor && ` · ${activeConsult.doctor}`}
                    </div>
                  </div>
                  <StatusPill status={activeConsult.status} />
                </div>

                {/* Vitals */}
                <div className="cs-section-title">Vitals</div>
                <div className="cs-vitals" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
                  {([
                    { key:"bp",     label:"Blood Pressure", placeholder:"120/80"  },
                    { key:"hr",     label:"Heart Rate",     placeholder:"72 bpm"  },
                    { key:"temp",   label:"Temperature",    placeholder:"98.6°F"  },
                    { key:"weight", label:"Weight",         placeholder:"70 kg"   },
                  ] as { key: keyof ConsultRecord; label: string; placeholder: string }[]).map(f => (
                    <div key={f.key}>
                      <label className="cs-label">{f.label}</label>
                      <input className="cs-input" placeholder={f.placeholder}
                        value={activeConsult[f.key] as string}
                        onChange={e => handleFieldChange(f.key, e.target.value)}
                        disabled={isCompleted} />
                    </div>
                  ))}
                </div>

                <hr className="cs-divider" />

                {/* Notes */}
                {([
                  { key:"complaint",  label:"Chief Complaint",  placeholder:"Patient's main concern…",        rows:2 },
                  { key:"symptoms",   label:"Symptoms",         placeholder:"Describe symptoms presented…",   rows:3 },
                  { key:"diagnosis",  label:"Diagnosis",        placeholder:"Primary and secondary diagnoses…",rows:2 },
                  { key:"treatment",  label:"Treatment Plan",   placeholder:"Medications, procedures, referrals…", rows:3 },
                  { key:"followup",   label:"Follow-up Plan",   placeholder:"Return in X weeks for…",        rows:2 },
                ] as { key: keyof ConsultRecord; label: string; placeholder: string; rows: number }[]).map(f => (
                  <div key={f.key} style={{ marginBottom:14 }}>
                    <label className="cs-label">{f.label}</label>
                    <textarea className="cs-textarea" placeholder={f.placeholder} rows={f.rows}
                      value={activeConsult[f.key] as string}
                      onChange={e => handleFieldChange(f.key, e.target.value)}
                      disabled={isCompleted} />
                  </div>
                ))}

                <hr className="cs-divider" />

                {/* Prescriptions */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div className="cs-section-title" style={{ margin:0 }}>Prescriptions ({activeConsult.prescriptions.length})</div>
                  {!isCompleted && (
                    <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={() => setNewRx(true)}>
                      <i className="ti ti-plus" style={{ fontSize:11, marginRight:4 }} />Add
                    </button>
                  )}
                </div>

                {activeConsult.prescriptions.length === 0 && !newRx && (
                  <div style={{ fontSize:"var(--font-sm)", color:"var(--muted)", padding:"10px 0", marginBottom:8 }}>
                    No prescriptions for this visit
                  </div>
                )}
                {activeConsult.prescriptions.map(rx => (
                  <RxCard key={rx.id} rx={rx} onRemove={isCompleted ? undefined : () => handleRemoveRx(rx.id)} />
                ))}
                {newRx && <RxForm onSave={handleAddRx} onCancel={() => setNewRx(false)} doctor={selectedPatient.doctor || ""} />}

                <hr className="cs-divider" />

                {/* Actions */}
                <div className="cs-actions" style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
                  {isCompleted ? (
                    <>
                      {canExportConsultations && (
                        <button className="btn btn-ghost" onClick={handleExportConsultationTXT}>
                          <i className="ti ti-download" style={{ marginRight:5, fontSize:12 }} />Export TXT
                        </button>
                      )}
                      {canPrintConsultation && (
                        <button className="btn btn-ghost" onClick={handlePrintConsultation}>
                          <i className="ti ti-printer" style={{ marginRight:5, fontSize:12 }} />Print
                        </button>
                      )}
                      {canEditConsultation && (
                        <button className="btn btn-ghost" onClick={() => {
                          originalRef.current = activeConsult;
                          const unlocked = { ...activeConsult, status: "in-progress" as ConsultStatus };
                          setActiveConsult(unlocked);
                          const others = allConsults.filter(c => c.id !== unlocked.id);
                          persist([...others, unlocked]);
                        }}>
                          <i className="ti ti-pencil" style={{ marginRight:5, fontSize:12 }} />Edit
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {canEditConsultation && (
                        <button className="btn btn-ghost" onClick={handleSaveDraft}>
                          <i className="ti ti-device-floppy" style={{ marginRight:5, fontSize:12 }} />Save Draft
                        </button>
                      )}
                      {canEditConsultation && (
                        <button className="btn btn-ghost" onClick={handleDiscard}>Discard</button>
                      )}
                      {canEditConsultation && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={!hasContent}>
                          {saveFlash
                            ? <><i className="ti ti-check" style={{ marginRight:5, fontSize:12 }} />Saved to Patient Record</>
                            : <><i className="ti ti-device-floppy" style={{ marginRight:5, fontSize:12 }} />Save &amp; Update Patient</>
                          }
                        </button>
                      )}
                    </>
                  )}
                </div>

                {isCompleted && (
                  <div style={{ marginTop:10, fontSize:"var(--font-xs)", color:"var(--green)", display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                    <i className="ti ti-circle-check" style={{ fontSize:13 }} />
                    Saved — added to patient timeline, notes &amp; prescriptions
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
                <i className="ti ti-stethoscope" style={{ fontSize:40, display:"block", marginBottom:12 }} />
                <div style={{ fontSize:"var(--font-md)", fontWeight:600, marginBottom:6 }}>No active consultation</div>
                <div style={{ fontSize:"var(--font-sm)", marginBottom:16 }}>Select a visit from history or start a new one</div>
                <button className="btn btn-primary" onClick={handleNewConsult}>
                  <i className="ti ti-plus" style={{ fontSize:12, marginRight:6 }} />New Consultation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedPatient && (
        <div className="card card-padded" style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
          <i className="ti ti-stethoscope" style={{ fontSize:40, display:"block", marginBottom:12 }} />
          <div style={{ fontSize:"var(--font-md)", fontWeight:600, marginBottom:6 }}>Search for a patient above</div>
          <div style={{ fontSize:"var(--font-sm)" }}>Select a patient to view their consultation history or start a new visit</div>
        </div>
      )}
    </div>
  );
}

// ─── History Viewer ───────────────────────────────────────────────────────────
function HistoryView({ record, onClose, onEdit, onExport, onPrint, onDelete, onMarkCompleted }: { record: ConsultRecord; onClose: () => void; onEdit: () => void; onExport: () => void; onPrint: () => void; onDelete: () => void; onMarkCompleted: () => void }) {
  const fields = [
    { label: "Chief Complaint", value: record.complaint },
    { label: "Symptoms",        value: record.symptoms  },
    { label: "Diagnosis",       value: record.diagnosis },
    { label: "Treatment Plan",  value: record.treatment },
    { label: "Follow-up Plan",  value: record.followup  },
  ];
  const vitals = [
    { label: "Blood Pressure", value: record.bp },
    { label: "Heart Rate",     value: record.hr },
    { label: "Temperature",    value: record.temp },
    { label: "Weight",         value: record.weight },
  ].filter(v => v.value);

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:14, borderBottom:"1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize:"var(--font-md)", fontWeight:700 }}>
            Visit — {new Date(record.date).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </div>
          {record.doctor && <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>{record.doctor}</div>}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <StatusPill status={record.status} />
          {record.status !== "completed" && (
            <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px", color: "var(--green)" }} onClick={onMarkCompleted}>
              <i className="ti ti-check" style={{ fontSize:11, marginRight:4 }} />Complete
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={onExport}>
            <i className="ti ti-download" style={{ fontSize:11, marginRight:4 }} />Export
          </button>
          <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={onPrint}>
            <i className="ti ti-printer" style={{ fontSize:11, marginRight:4 }} />Print
          </button>
          <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={onEdit}>
            <i className="ti ti-pencil" style={{ fontSize:11, marginRight:4 }} />Edit
          </button>
          <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px", color: "var(--red)" }} onClick={onDelete}>
            <i className="ti ti-trash" style={{ fontSize:11, marginRight:4 }} />Delete
          </button>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize:14 }} /></button>
        </div>
      </div>

      {vitals.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:18, padding:"10px 14px", background:"var(--surface2)", borderRadius:"var(--radius)" }}>
          {vitals.map(v => (
            <div key={v.label}>
              <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>{v.label}</div>
              <div style={{ fontSize:"var(--font-md)", fontWeight:700 }}>{v.value}</div>
            </div>
          ))}
        </div>
      )}

      {fields.map(f => f.value ? (
        <div key={f.label} style={{ marginBottom:14 }}>
          <label className="cs-label">{f.label}</label>
          <div style={{ fontSize:"var(--font-sm)", lineHeight:1.6, padding:"9px 12px", background:"var(--surface2)", borderRadius:"var(--radius)", whiteSpace:"pre-wrap" }}>{f.value}</div>
        </div>
      ) : null)}

      {record.prescriptions.length > 0 && (
        <>
          <hr className="cs-divider" />
          <div className="cs-section-title">Prescriptions ({record.prescriptions.length})</div>
          {record.prescriptions.map(rx => <RxCard key={rx.id} rx={rx} />)}
        </>
      )}
    </>
  );
}

// ─── Rx Card ─────────────────────────────────────────────────────────────────
function RxCard({ rx, onRemove }: { rx: Prescription; onRemove?: () => void }) {
  return (
    <div style={{ padding:"10px 14px", background:"var(--surface2)", borderRadius:"var(--radius)", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <div style={{ fontSize:"var(--font-sm)", fontWeight:700 }}>{rx.medicationName}</div>
        <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>
          {rx.dosage} · {rx.frequency} · {rx.duration}
          {rx.route && ` · ${rx.route}`}
        </div>
        {rx.instructions && <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>{rx.instructions}</div>}
        <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>By: {rx.prescribedBy} · {fmtDate(rx.prescribedDate)}</div>
      </div>
      {onRemove && (
        <button className="btn-icon" onClick={onRemove} title="Remove"><i className="ti ti-trash" style={{ fontSize:13, color:"var(--red)" }} /></button>
      )}
    </div>
  );
}

// ─── Rx Form ──────────────────────────────────────────────────────────────────
function RxForm({ onSave, onCancel, doctor }: { onSave: (rx: Prescription) => void; onCancel: () => void; doctor: string }) {
  const [form, setForm] = useState({ medicationName:"", dosage:"", frequency:"", route:"oral", duration:"", instructions:"" });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.medicationName || !form.dosage) return;
    onSave({
      id: `rx-${Date.now()}`,
      ...form,
      prescribedDate: new Date().toISOString().split("T")[0],
      prescribedBy: doctor,
      refillsTotal: 0, refillsUsed: 0, refillsRemaining: 0,
      status: "active",
    });
  };

  return (
    <div style={{ padding:"14px 16px", border:"1px solid var(--accent-border)", borderRadius:"var(--radius)", background:"var(--accent-soft)", marginBottom:8 }}>
      <div style={{ fontSize:"var(--font-xs)", fontWeight:700, color:"var(--accent)", marginBottom:10, textTransform:"uppercase" }}>New Prescription</div>
      <div className="cs-rx-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <div><label className="cs-label">Medication *</label><input className="cs-input" placeholder="e.g. Amoxicillin" value={form.medicationName} onChange={f("medicationName")} /></div>
        <div><label className="cs-label">Dosage *</label><input className="cs-input" placeholder="e.g. 500mg" value={form.dosage} onChange={f("dosage")} /></div>
        <div><label className="cs-label">Frequency</label><input className="cs-input" placeholder="e.g. 3x daily" value={form.frequency} onChange={f("frequency")} /></div>
        <div><label className="cs-label">Duration</label><input className="cs-input" placeholder="e.g. 7 days" value={form.duration} onChange={f("duration")} /></div>
        <div>
          <label className="cs-label">Route</label>
          <select className="cs-select" value={form.route} onChange={f("route")}>
            {["oral","topical","intravenous","intramuscular","subcutaneous","inhaled","sublingual","rectal","nasal"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div><label className="cs-label">Instructions</label><input className="cs-input" placeholder="e.g. with food" value={form.instructions} onChange={f("instructions")} /></div>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!form.medicationName || !form.dosage}>Add Prescription</button>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"var(--accent-soft)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.3, fontWeight:700, flexShrink:0 }}>
      {name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
    </div>
  );
}

function Chip({ icon, label, value, color }: { icon: string; label: string; value: any; color?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <i className={`ti ${icon}`} style={{ fontSize:11, color: color || "var(--accent)" }} />
      <span style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>{label}:</span>
      <span style={{ fontSize:"var(--font-xs)", fontWeight:600, color: color || "var(--text)" }}>{value}</span>
    </div>
  );
}

const STATUS_META: Record<ConsultStatus, { label: string; color: string; bg: string }> = {
  pending:       { label:"Pending",     color:"var(--muted)",  bg:"var(--surface3)"  },
  "in-progress": { label:"In Progress", color:"var(--amber)",  bg:"var(--amber-bg)"  },
  completed:     { label:"Completed",   color:"var(--green)",  bg:"var(--green-bg)"  },
};

function StatusPill({ status }: { status: ConsultStatus }) {
  const m = STATUS_META[status];
  return <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, background:m.bg, color:m.color, flexShrink:0 }}>{m.label}</span>;
}

function StatCard({ label, value, color, icon, bg }: { label:string; value:number; color:string; icon:string; bg:string }) {
  return (
    <div className="card card-padded" style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:30, height:30, borderRadius:"var(--radius)", background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <i className={`ti ${icon}`} style={{ fontSize:14, color }} />
        </div>
        <span style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize:"var(--font-xl)", fontWeight:800, color }}>{value}</div>
    </div>
  );
}

// ─── Template Form ─────────────────────────────────────────────────────────────
function TemplateForm({ template, onSave, onEdit, onCancel }: { template?: Template; onSave: (t: Omit<Template, "id">) => void; onEdit: (t: Template) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: template?.name || "",
    category: template?.category || "General",
    complaint: template?.complaint || "",
    symptoms: template?.symptoms || "",
    diagnosis: template?.diagnosis || "",
    treatment: template?.treatment || "",
    followup: template?.followup || "",
  });

  const handleChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.name || !form.category) return;
    if (template) {
      onEdit({ ...template, ...form });
    } else {
      onSave(form);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label className="cs-label">Template Name *</label>
          <input className="cs-input" placeholder="e.g. General Consultation" value={form.name} onChange={handleChange("name")} />
        </div>
        <div>
          <label className="cs-label">Category *</label>
          <select className="cs-select" value={form.category} onChange={handleChange("category")}>
            <option value="General">General</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Fever/Cold">Fever/Cold</option>
            <option value="Diabetes">Diabetes</option>
            <option value="Hypertension">Hypertension</option>
            <option value="Cardiovascular">Cardiovascular</option>
            <option value="Respiratory">Respiratory</option>
            <option value="Gastrointestinal">Gastrointestinal</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
      </div>
      <div>
        <label className="cs-label">Chief Complaint</label>
        <textarea className="cs-textarea" placeholder="Typical chief complaint for this template..." rows={2} value={form.complaint} onChange={handleChange("complaint")} />
      </div>
      <div>
        <label className="cs-label">Symptoms</label>
        <textarea className="cs-textarea" placeholder="Common symptoms..." rows={2} value={form.symptoms} onChange={handleChange("symptoms")} />
      </div>
      <div>
        <label className="cs-label">Diagnosis</label>
        <textarea className="cs-textarea" placeholder="Common diagnosis..." rows={2} value={form.diagnosis} onChange={handleChange("diagnosis")} />
      </div>
      <div>
        <label className="cs-label">Treatment Plan</label>
        <textarea className="cs-textarea" placeholder="Standard treatment approach..." rows={2} value={form.treatment} onChange={handleChange("treatment")} />
      </div>
      <div>
        <label className="cs-label">Follow-up</label>
        <textarea className="cs-textarea" placeholder="Follow-up instructions..." rows={2} value={form.followup} onChange={handleChange("followup")} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!form.name || !form.category}>{template ? "Update Template" : "Save Template"}</button>
      </div>
    </div>
  );
}

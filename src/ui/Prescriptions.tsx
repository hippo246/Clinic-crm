import React, { useState, useEffect, useRef } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctor: string;
  medications: Medication[];
  createdAt: string;
  status: "active" | "completed" | "cancelled";
  notes: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  warnings?: string[];
}

interface RefillRequest {
  id: string;
  prescriptionId: string;
  patientName: string;
  medication: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
}

interface PrescriptionDraft {
  id: string;
  patientId?: string;
  patientName?: string;
  doctor: string;
  medications: Medication[];
  notes: string;
  savedAt: string;
}

interface PrescriptionTemplate {
  id: string;
  name: string;
  category: string;
  medications: Omit<Medication, "id">[];
  notes?: string;
}

interface ActivityEntry {
  timestamp: string;
  action: string;
  patientId?: string;
  patientName?: string;
  details?: string;
}

// ─── Safe localStorage helpers ────────────────────────────────────────────────
const PRESCRIPTIONS_KEY = "clinic_crm_prescriptions";
const REFILLS_KEY = "clinic_crm_refill_requests";
const DRAFTS_KEY = "clinic_crm_prescription_drafts";
const ACTIVITY_KEY = "clinic_crm_prescription_activity";
const TEMPLATES_KEY = "clinic_crm_prescription_templates";

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

export default function PrescriptionsPage({ patients, onUpdatePatient, userRole = "admin" }: { patients: Patient[]; onUpdatePatient?: (updated: Patient, action?: string) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  const [showNewPrescription, setShowNewPrescription] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "history" | "refills">("create");

  // Feedback state
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  // State with safe localStorage helpers
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(() => readJSON(PRESCRIPTIONS_KEY, []));
  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>(() => readJSON(REFILLS_KEY, []));
  const [drafts, setDrafts] = useState<PrescriptionDraft[]>(() => readJSON(DRAFTS_KEY, []));
  const [activity, setActivity] = useState<ActivityEntry[]>(() => readJSON(ACTIVITY_KEY, []));
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>(() => {
    const loaded = readJSON(TEMPLATES_KEY, []);
    // Seed default templates if none exist
    if (loaded.length === 0) {
      const defaults: PrescriptionTemplate[] = [
        {
          id: "tpl-fever",
          name: "General Fever Pack",
          category: "Fever",
          medications: [
            { name: "Paracetamol", dosage: "500mg", frequency: "Three times daily", duration: "5 days", instructions: "Take after food" },
            { name: "Ibuprofen", dosage: "400mg", frequency: "As needed", duration: "3 days", instructions: "Take with food, max 3 times daily" },
          ],
          notes: "Monitor temperature. Seek medical attention if fever persists beyond 3 days.",
        },
        {
          id: "tpl-pain",
          name: "Pain Relief Template",
          category: "Pain",
          medications: [
            { name: "Paracetamol", dosage: "650mg", frequency: "Three times daily", duration: "7 days", instructions: "Take after food" },
          ],
          notes: "Avoid alcohol while taking medication.",
        },
        {
          id: "tpl-followup",
          name: "Follow-up Medication Template",
          category: "Follow-up",
          medications: [
            { name: "Antibiotic", dosage: "500mg", frequency: "Twice daily", duration: "7 days", instructions: "Complete full course" },
            { name: "Probiotic", dosage: "1 capsule", frequency: "Once daily", duration: "7 days", instructions: "Take with breakfast" },
          ],
          notes: "Follow up in 1 week to assess response.",
        },
      ];
      writeJSON(TEMPLATES_KEY, defaults);
      return defaults;
    }
    return loaded;
  });

  // Modal states
  const [editingRx, setEditingRx] = useState<Prescription | null>(null);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // History filters
  const [filterStatus, setFilterStatus] = useState<"">("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  // Refill modal form
  const [refillForm, setRefillForm] = useState({ prescriptionId: "", patientName: "", medication: "", notes: "" });

  const showFeedback = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const logActivity = (action: string, patientId?: string, patientName?: string, details?: string) => {
    const entry: ActivityEntry = {
      timestamp: new Date().toISOString(),
      action,
      patientId,
      patientName,
      details,
    };
    const updated = [entry, ...activity].slice(0, 50);
    setActivity(updated);
    writeJSON(ACTIVITY_KEY, updated);
  };

  function persistPrescriptions(next: Prescription[]) {
    setPrescriptions(next);
    writeJSON(PRESCRIPTIONS_KEY, next);
  }
  function persistRefills(next: RefillRequest[]) {
    setRefillRequests(next);
    writeJSON(REFILLS_KEY, next);
  }
  function persistDrafts(next: PrescriptionDraft[]) {
    setDrafts(next);
    writeJSON(DRAFTS_KEY, next);
  }
  function persistTemplates(next: PrescriptionTemplate[]) {
    setTemplates(next);
    writeJSON(TEMPLATES_KEY, next);
  }

  // "View" needed somewhere to show the full prescription — there was no modal/route for it.
  const [viewingRx, setViewingRx] = useState<Prescription | null>(null);

  // Create-prescription form state — these fields were plain uncontrolled <input>/<select>
  // with no state at all, so "Create Prescription" had nothing to read and could never submit.
  const [doctor, setDoctor] = useState("");
  const [medications, setMedications] = useState<Medication[]>([
    { id: "m1", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
    { id: "m2", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
  ]);
  const [notes, setNotes] = useState("");

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        if (e.key === "Escape") {
          if (confirmModal) setConfirmModal(null);
          if (viewingRx) setViewingRx(null);
          if (editingRx) setEditingRx(null);
          if (showRefillModal) setShowRefillModal(false);
          if (showTemplateModal) setShowTemplateModal(false);
          if (showActivity) setShowActivity(false);
        }
        return;
      }
      if (e.key === "Escape") {
        if (confirmModal) setConfirmModal(null);
        if (viewingRx) setViewingRx(null);
        if (editingRx) setEditingRx(null);
        if (showRefillModal) setShowRefillModal(false);
        if (showTemplateModal) setShowTemplateModal(false);
        if (showActivity) setShowActivity(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab === "create" && selectedPatient && doctor) {
          handleSaveDraft();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, viewingRx, editingRx, showRefillModal, showTemplateModal, showActivity, activeTab, selectedPatient, doctor]);

  function updateMedication(id: string, field: keyof Medication, value: string) {
    setMedications(meds => meds.map(m => m.id === id ? { ...m, [field]: value } : m));
  }
  function addMedicationRow() {
    setMedications(meds => [...meds, { id: `m${Date.now()}`, name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  }
  function removeMedicationRow(id: string) {
    setMedications(meds => meds.length > 1 ? meds.filter(m => m.id !== id) : meds);
  }
  function clearForm() {
    setSelectedPatient(null);
    setDoctor("");
    setMedications([
      { id: "m1", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
      { id: "m2", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
    ]);
    setNotes("");
  }

  function handleSaveDraft() {
    if (!doctor) {
      showFeedback("Doctor is required to save draft.", "warning");
      return;
    }
    const filledMeds = medications.filter(m => m.name.trim());
    if (filledMeds.length === 0) {
      showFeedback("Add at least one medication to save draft.", "warning");
      return;
    }
    const draft: PrescriptionDraft = {
      id: `draft-${Date.now()}`,
      patientId: selectedPatient?.id,
      patientName: selectedPatient?.name,
      doctor,
      medications: filledMeds,
      notes,
      savedAt: new Date().toISOString(),
    };
    // Remove existing draft for this patient
    const updatedDrafts = selectedPatient
      ? drafts.filter(d => d.patientId !== selectedPatient.id)
      : drafts;
    persistDrafts([draft, ...updatedDrafts]);
    logActivity("draft saved", selectedPatient?.id, selectedPatient?.name);
    showFeedback("Draft saved successfully.", "success");
  }

  function handleLoadDraft(draft: PrescriptionDraft) {
    if (draft.patientId) {
      const patient = patients.find(p => p.id === draft.patientId);
      if (patient) setSelectedPatient(patient);
    }
    setDoctor(draft.doctor);
    setMedications(draft.medications.map(m => ({ ...m, id: `m${Date.now()}-${Math.random()}` })));
    setNotes(draft.notes);
    logActivity("draft loaded", draft.patientId, draft.patientName);
    showFeedback("Draft loaded.", "info");
  }

  function handleDeleteDraft(draftId: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this draft?",
      onConfirm: () => {
        const updated = drafts.filter(d => d.id !== draftId);
        persistDrafts(updated);
        logActivity("draft deleted");
        showFeedback("Draft deleted.", "info");
        setConfirmModal(null);
      },
    });
  }

  function handleCreatePrescription() {
    // Validation
    if (!selectedPatient) {
      showFeedback("Please select a patient.", "error");
      return;
    }
    if (!doctor) {
      showFeedback("Please select a doctor.", "error");
      return;
    }
    const filledMeds = medications.filter(m => m.name.trim());
    if (filledMeds.length === 0) {
      showFeedback("Add at least one medication.", "error");
      return;
    }

    // Check for duplicate medications
    const medNames = filledMeds.map(m => m.name.toLowerCase().trim());
    const duplicates = medNames.filter((name, index) => medNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      showFeedback(`Duplicate medication(s): ${[...new Set(duplicates)].join(", ")}`, "warning");
    }

    // Check for missing recommended fields
    const missingFields = filledMeds.filter(m => !m.dosage || !m.frequency || !m.duration);
    if (missingFields.length > 0) {
      showFeedback("Some medications are missing dosage, frequency, or duration. Please review.", "warning");
    }

    // Check patient allergies
    if (selectedPatient.allergies && selectedPatient.allergies !== "None") {
      const allergyWarning = filledMeds.some(m =>
        selectedPatient.allergies?.toLowerCase().includes(m.name.toLowerCase())
      );
      if (allergyWarning) {
        showFeedback("Warning: Patient has allergies. Please review medications.", "warning");
      }
    }

    const newRx: Prescription = {
      id: `rx_${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      doctor,
      medications: filledMeds,
      createdAt: new Date().toISOString(),
      status: "active",
      notes,
    };
    persistPrescriptions([newRx, ...prescriptions]);

    // Clear draft for this patient
    const updatedDrafts = drafts.filter(d => d.patientId !== selectedPatient.id);
    persistDrafts(updatedDrafts);

    // Note: Patient prescription update skipped due to type mismatch between Medication and Patient.prescription types
    // Prescriptions are stored in localStorage separately

    logActivity("prescription created", selectedPatient.id, selectedPatient.name, `${filledMeds.length} medication(s)`);
    showFeedback("Prescription created successfully.", "success");
    clearForm();
    setActiveTab("history");
  }

  function handleApplyTemplate(template: PrescriptionTemplate) {
    setMedications(template.medications.map(m => ({ ...m, id: `m${Date.now()}-${Math.random()}` })));
    if (template.notes) setNotes(template.notes);
    logActivity("template applied", undefined, undefined, `Template: ${template.name}`);
    showFeedback(`Template "${template.name}" applied.`, "success");
  }

  function handleSaveTemplate() {
    const filledMeds = medications.filter(m => m.name.trim());
    if (filledMeds.length === 0) {
      showFeedback("Add at least one medication to save as template.", "warning");
      return;
    }
    const newTemplate: PrescriptionTemplate = {
      id: `tpl-${Date.now()}`,
      name: `Custom Template ${templates.length + 1}`,
      category: "Custom",
      medications: filledMeds.map(({ id, ...rest }) => rest),
      notes: notes || undefined,
    };
    persistTemplates([...templates, newTemplate]);
    logActivity("template saved", undefined, undefined, `Template: ${newTemplate.name}`);
    showFeedback("Template saved successfully.", "success");
    setShowTemplateModal(false);
  }

  function handleDeleteTemplate(templateId: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this template?",
      onConfirm: () => {
        const updated = templates.filter(t => t.id !== templateId);
        persistTemplates(updated);
        logActivity("template deleted", undefined, undefined, `Template ID: ${templateId}`);
        showFeedback("Template deleted.", "info");
        setConfirmModal(null);
      },
    });
  }

  function handleDuplicatePrescription(rx: Prescription) {
    setSelectedPatient(patients.find(p => p.id === rx.patientId) || null);
    setDoctor(rx.doctor);
    setMedications(rx.medications.map(m => ({ ...m, id: `m${Date.now()}-${Math.random()}` })));
    setNotes(rx.notes);
    setActiveTab("create");
    logActivity("prescription duplicated", rx.patientId, rx.patientName);
    showFeedback("Prescription duplicated. Review and save as new.", "info");
  }

  function handleEditPrescription(rx: Prescription) {
    if (rx.status !== "active") {
      showFeedback("Only active prescriptions can be edited.", "warning");
      return;
    }
    setEditingRx(rx);
    setSelectedPatient(patients.find(p => p.id === rx.patientId) || null);
    setDoctor(rx.doctor);
    setMedications(rx.medications.map(m => ({ ...m, id: `m${Date.now()}-${Math.random()}` })));
    setNotes(rx.notes);
    setActiveTab("create");
    logActivity("prescription editing started", rx.patientId, rx.patientName);
  }

  function handleUpdatePrescription() {
    if (!editingRx) return;
    const filledMeds = medications.filter(m => m.name.trim());
    if (filledMeds.length === 0) {
      showFeedback("Add at least one medication.", "error");
      return;
    }
    const updated: Prescription = {
      ...editingRx,
      medications: filledMeds,
      doctor,
      notes,
    };
    const updatedList = prescriptions.map(p => p.id === editingRx.id ? updated : p);
    persistPrescriptions(updatedList);
    logActivity("prescription updated", editingRx.patientId, editingRx.patientName);
    showFeedback("Prescription updated successfully.", "success");
    setEditingRx(null);
    clearForm();
    setActiveTab("history");
  }

  function handleMarkCompleted(rxId: string) {
    const rx = prescriptions.find(p => p.id === rxId);
    if (!rx) return;
    const updated = { ...rx, status: "completed" as const };
    persistPrescriptions(prescriptions.map(p => p.id === rxId ? updated : p));
    logActivity("prescription marked completed", rx.patientId, rx.patientName);
    showFeedback("Prescription marked as completed.", "success");
  }

  function handleCancelPrescription(rxId: string) {
    setConfirmModal({
      message: "Are you sure you want to cancel this prescription?",
      onConfirm: () => {
        const rx = prescriptions.find(p => p.id === rxId);
        if (!rx) return;
        const updated = { ...rx, status: "cancelled" as const };
        persistPrescriptions(prescriptions.map(p => p.id === rxId ? updated : p));
        logActivity("prescription cancelled", rx.patientId, rx.patientName);
        showFeedback("Prescription cancelled.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handleDeletePrescription(rxId: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this prescription? This cannot be undone.",
      onConfirm: () => {
        const rx = prescriptions.find(p => p.id === rxId);
        const updated = prescriptions.filter(p => p.id !== rxId);
        persistPrescriptions(updated);
        if (viewingRx?.id === rxId) setViewingRx(null);
        logActivity("prescription deleted", rx?.patientId, rx?.patientName);
        showFeedback("Prescription deleted.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handleCreateRefillRequest() {
    if (!refillForm.prescriptionId || !refillForm.patientName || !refillForm.medication) {
      showFeedback("Please fill in all required fields.", "error");
      return;
    }
    const newRefill: RefillRequest = {
      id: `refill-${Date.now()}`,
      prescriptionId: refillForm.prescriptionId,
      patientName: refillForm.patientName,
      medication: refillForm.medication,
      requestedAt: new Date().toISOString(),
      status: "pending",
      notes: refillForm.notes,
    };
    persistRefills([newRefill, ...refillRequests]);
    logActivity("refill request created", undefined, refillForm.patientName, refillForm.medication);
    showFeedback("Refill request created.", "success");
    setShowRefillModal(false);
    setRefillForm({ prescriptionId: "", patientName: "", medication: "", notes: "" });
  }

  function handleRefillDecision(id: string, decision: "approved" | "rejected" | "pending") {
    const refill = refillRequests.find(r => r.id === id);
    if (!refill) return;

    if (decision === "approved") {
      const rx = prescriptions.find(p => p.id === refill.prescriptionId);
      if (rx && (rx.status === "cancelled" || rx.status === "completed")) {
        setConfirmModal({
          message: "This prescription is cancelled or completed. Are you sure you want to approve the refill?",
          onConfirm: () => {
            persistRefills(refillRequests.map(r => r.id === id ? { ...r, status: decision } : r));
            logActivity("refill approved", undefined, refill.patientName, refill.medication);
            showFeedback("Refill approved.", "success");
            setConfirmModal(null);
          },
        });
        return;
      }
    }

    persistRefills(refillRequests.map(r => r.id === id ? { ...r, status: decision } : r));
    logActivity(`refill ${decision}`, undefined, refill.patientName, refill.medication);
    showFeedback(`Refill ${decision}.`, "success");
  }

  function handleDeleteRefill(refillId: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this refill request?",
      onConfirm: () => {
        const updated = refillRequests.filter(r => r.id !== refillId);
        persistRefills(updated);
        logActivity("refill request deleted");
        showFeedback("Refill request deleted.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handleExportPrescriptionsCSV() {
    const filtered = prescriptions.filter(p => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterDoctor && p.doctor !== filterDoctor) return false;
      if (filterDateFrom && new Date(p.createdAt) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(p.createdAt) > new Date(filterDateTo + "T23:59:59")) return false;
      if (historySearch) {
        const searchLower = historySearch.toLowerCase();
        if (!p.patientName.toLowerCase().includes(searchLower) &&
            !p.medications.some(m => m.name.toLowerCase().includes(searchLower)) &&
            !p.doctor.toLowerCase().includes(searchLower) &&
            !p.notes?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      showFeedback("No prescriptions to export with current filters.", "info");
      return;
    }

    const header = "ID,Patient ID,Patient Name,Doctor,Created Date,Status,Medications,Notes\n";
    const rows = filtered.map(p => [
      `"${p.id}"`,
      `"${p.patientId}"`,
      `"${p.patientName}"`,
      `"${p.doctor}"`,
      `"${new Date(p.createdAt).toLocaleString()}"`,
      `"${p.status}"`,
      `"${p.medications.map(m => `${m.name} ${m.dosage}`).join("; ").replace(/"/g, '""')}"`,
      `"${(p.notes || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescriptions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("prescriptions exported as CSV", undefined, undefined, `${filtered.length} records`);
    showFeedback(`Exported ${filtered.length} prescription(s) as CSV.`, "success");
  }

  function handleExportPrescriptionTXT(rx: Prescription) {
    const txt = `
PRESCRIPTION
============
Patient: ${rx.patientName} (${rx.patientId})
Doctor: ${rx.doctor}
Date: ${new Date(rx.createdAt).toLocaleString()}
Status: ${rx.status}

MEDICATIONS
${rx.medications.map((m, i) => `
${i + 1}. ${m.name} ${m.dosage}
   Frequency: ${m.frequency}
   Duration: ${m.duration}
   Instructions: ${m.instructions || "None"}
`).join("")}

NOTES
${rx.notes || "None"}

Generated by Clinic CRM
    `.trim();

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${rx.patientId}-${new Date(rx.createdAt).toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("prescription exported as TXT", rx.patientId, rx.patientName);
    showFeedback("Prescription exported as TXT.", "success");
  }

  function handleExportRefillsCSV() {
    if (refillRequests.length === 0) {
      showFeedback("No refill requests to export.", "info");
      return;
    }

    const header = "ID,Prescription ID,Patient Name,Medication,Requested Date,Status,Notes\n";
    const rows = refillRequests.map(r => [
      `"${r.id}"`,
      `"${r.prescriptionId}"`,
      `"${r.patientName}"`,
      `"${r.medication}"`,
      `"${new Date(r.requestedAt).toLocaleString()}"`,
      `"${r.status}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `refill-requests-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("refill requests exported as CSV", undefined, undefined, `${refillRequests.length} records`);
    showFeedback(`Exported ${refillRequests.length} refill request(s) as CSV.`, "success");
  }

  function handleExportActivityCSV() {
    if (activity.length === 0) {
      showFeedback("No activity to export.", "info");
      return;
    }

    const header = "Timestamp,Action,Patient ID,Patient Name,Details\n";
    const rows = activity.map(a => [
      `"${new Date(a.timestamp).toLocaleString()}"`,
      `"${a.action}"`,
      `"${a.patientId || ""}"`,
      `"${(a.patientName || "").replace(/"/g, '""')}"`,
      `"${(a.details || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-activity-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showFeedback("Activity log exported.", "success");
  }

  function handleClearActivity() {
    setConfirmModal({
      message: "Are you sure you want to clear all activity logs?",
      onConfirm: () => {
        setActivity([]);
        writeJSON(ACTIVITY_KEY, []);
        showFeedback("Activity log cleared.", "success");
        setConfirmModal(null);
      },
    });
  }

  const activePrescriptions = prescriptions.filter((p: Prescription) => p.status === "active");
  const pendingRefills = refillRequests.filter((r: RefillRequest) => r.status === "pending");

  function handlePrint(p: Prescription) {
    const win = window.open("", "_blank");
    if (!win) return;
    const medsHtml = p.medications.map(m => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.dosage}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.frequency}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.duration}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.instructions || "—"}</td>
      </tr>`).join("");
    win.document.write(`
      <html><head><title>Prescription — ${p.patientName}</title></head>
      <body style="font-family:sans-serif;padding:32px;color:#111;">
        <h2 style="margin-bottom:4px;">Prescription</h2>
        <div style="color:#555;margin-bottom:20px;">${fmtDate(p.createdAt)} · Dr. ${p.doctor.replace(/^Dr\.\s*/, "")}</div>
        <div style="margin-bottom:16px;"><strong>Patient:</strong> ${p.patientName} (${p.patientId})</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead><tr style="text-align:left;background:#f3f3f3;">
            <th style="padding:6px 10px;">Medication</th><th style="padding:6px 10px;">Dosage</th>
            <th style="padding:6px 10px;">Frequency</th><th style="padding:6px 10px;">Duration</th>
            <th style="padding:6px 10px;">Instructions</th>
          </tr></thead>
          <tbody>${medsHtml}</tbody>
        </table>
        ${p.notes ? `<div><strong>Notes:</strong> ${p.notes}</div>` : ""}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  async function handleShare(p: Prescription) {
    const summary = `Prescription for ${p.patientName} — ${p.medications.map(m => `${m.name} ${m.dosage}`).join(", ")} (${p.doctor}, ${fmtDate(p.createdAt)})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Prescription", text: summary });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(summary);
      }
    } catch {
      // user cancelled the share sheet or clipboard was blocked — nothing to recover from here
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
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

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
            Prescriptions
          </h1>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            Create prescriptions, view history, manage refill requests, print/share prescriptions
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowActivity(!showActivity)}>
            <i className="ti ti-history" style={{ marginRight: 4, fontSize: 12 }} />Activity
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowTemplateModal(!showTemplateModal)}>
            <i className="ti ti-template" style={{ marginRight: 4, fontSize: 12 }} />Templates
          </button>
        </div>
      </div>

      <div className="cs-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Active Prescriptions" value={activePrescriptions.length} color="var(--blue)" icon="ti-pill" bg="var(--blue-bg)" />
        <StatCard label="Today's Prescriptions" value={prescriptions.filter((p: Prescription) => new Date(p.createdAt).toDateString() === new Date().toDateString()).length} color="var(--green)" icon="ti-calendar-plus" bg="var(--green-bg)" />
        <StatCard label="Pending Refills" value={pendingRefills.length} color="var(--amber)" icon="ti-refresh" bg="var(--amber-bg)" />
        <StatCard label="Total Prescriptions" value={prescriptions.length} color="var(--accent)" icon="ti-file-text" bg="var(--accent-soft)" />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .cs-stats {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .cs-stats {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .tbl {
            font-size: var(--font-xs);
          }
          .tbl th, .tbl td {
            padding: 8px 6px;
          }
        }
        @media (max-width: 480px) {
          .tbl {
            display: block;
            overflow-x: auto;
          }
        }
        @media (max-width: 768px) {
          .med-row-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Activity Panel */}
      {showActivity && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>Activity Log ({activity.length})</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleExportActivityCSV}>
                <i className="ti ti-download" style={{ fontSize: 11, marginRight: 4 }} />Export CSV
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", color: "var(--red)" }} onClick={handleClearActivity}>
                <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 4 }} />Clear
              </button>
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
                  {a.patientName && <div style={{ color: "var(--muted)" }}>Patient: {a.patientName}</div>}
                  {a.details && <div style={{ color: "var(--muted)", fontStyle: "italic" }}>{a.details}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Panel */}
      {showTemplateModal && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>Clinical Templates</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleSaveTemplate}>
                <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 4 }} />Save Current as Template
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setShowTemplateModal(false)}>
                <i className="ti ti-x" style={{ fontSize: 11 }} />
              </button>
            </div>
          </div>
          {templates.length === 0 ? (
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>
              No templates saved. Add medications to the form and save as a template.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
              {templates.map(t => (
                <div key={t.id} style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>{t.category}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>{t.medications.length} medication(s)</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", flex: 1 }} onClick={() => handleApplyTemplate(t)}>
                      Apply
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }} onClick={() => handleDeleteTemplate(t.id)}>
                      <i className="ti ti-trash" style={{ fontSize: 11 }} />
                    </button>
                  </div>
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

      {/* Pending Refill Requests Alert */}
      {pendingRefills.length > 0 && (
        <div className="card card-padded" style={{ marginBottom: 24, border: "2px solid var(--amber-border)", background: "var(--amber-bg)" }}>
          <div className="section-label" style={{ color: "var(--amber)", marginBottom: 12 }}>
            <i className="ti ti-refresh-exclamation" style={{ marginRight: 4 }} />
            Pending Refill Requests ({pendingRefills.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingRefills.map((r: RefillRequest) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "#fff", borderRadius: "var(--radius)",
                border: "1px solid var(--amber-border)"
              }}>
                <i className="ti ti-refresh" style={{ fontSize: 20, color: "var(--amber)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{r.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {r.medication} · Requested {fmtDate(r.requestedAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "approved")}>Approve</button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "rejected")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "create"} onClick={() => setActiveTab("create")}>Create Prescription</TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>Prescription History</TabButton>
          <TabButton active={activeTab === "refills"} onClick={() => setActiveTab("refills")}>Refill Requests</TabButton>
        </div>
      </div>

      {activeTab === "create" && (
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-pill" style={{ marginRight: 4 }} />
            Create New Prescription
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
            <select
              value={selectedPatient?.id || ""}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            >
              <option value="">Select patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Doctor</label>
            <select
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            >
              <option value="">Select doctor...</option>
              <option value="Dr. Sarah Johnson">Dr. Sarah Johnson</option>
              <option value="Dr. Michael Chen">Dr. Michael Chen</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Medications</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {medications.map((med) => (
                <div key={med.id} style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)", position: "relative" }}>
                  {medications.length > 1 && (
                    <button
                      className="btn-icon"
                      onClick={() => removeMedicationRow(med.id)}
                      title="Remove medication"
                      style={{ position: "absolute", top: 8, right: 8, padding: 4 }}
                    >
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </button>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }} className="med-row-grid">
                    <input
                      type="text" placeholder="Medication name"
                      value={med.name}
                      onChange={(e) => updateMedication(med.id, "name", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    />
                    <input
                      type="text" placeholder="Dosage (e.g., 500mg)"
                      value={med.dosage}
                      onChange={(e) => updateMedication(med.id, "dosage", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }} className="med-row-grid">
                    <select
                      value={med.frequency}
                      onChange={(e) => updateMedication(med.id, "frequency", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    >
                      <option value="">Frequency...</option>
                      <option value="once-daily">Once daily (OD)</option>
                      <option value="twice-daily">Twice daily (BD)</option>
                      <option value="three-times-daily">Three times daily (TDS)</option>
                      <option value="four-times-daily">Four times daily (QID)</option>
                      <option value="as-needed">As needed (SOS)</option>
                    </select>
                    <input
                      type="text" placeholder="Duration (e.g., 7 days)"
                      value={med.duration}
                      onChange={(e) => updateMedication(med.id, "duration", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>Quick presets:</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {["OD", "BD", "TDS", "QID", "SOS", "Before food", "After food"].map(preset => (
                        <button
                          key={preset}
                          className="btn btn-ghost"
                          style={{ fontSize: "var(--font-xs)", padding: "2px 8px", border: "1px solid var(--border)" }}
                          onClick={() => {
                            const currentFreq = med.frequency || "";
                            const currentInstr = med.instructions || "";
                            if (["OD", "BD", "TDS", "QID", "SOS"].includes(preset)) {
                              updateMedication(med.id, "frequency", currentFreq ? `${currentFreq}, ${preset}` : preset);
                            } else {
                              updateMedication(med.id, "instructions", currentInstr ? `${currentInstr}, ${preset}` : preset);
                            }
                          }}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="Special instructions..." rows={2}
                    value={med.instructions}
                    onChange={(e) => updateMedication(med.id, "instructions", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                  />
                </div>
              ))}
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={addMedicationRow}>
                <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
                Add Medication
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Additional Notes</label>
            <textarea
              placeholder="Any additional notes or instructions..." rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
            />
          </div>
          {/* Draft indicator */}
          {selectedPatient && drafts.some(d => d.patientId === selectedPatient.id) && (
            <div style={{ marginBottom: 12, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              <i className="ti ti-device-floppy" style={{ marginRight: 4 }} />
              Draft saved for this patient
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {editingRx ? (
              <>
                <button className="btn btn-ghost" onClick={() => { setEditingRx(null); clearForm(); }}>Cancel Edit</button>
                <button className="btn btn-primary" onClick={handleUpdatePrescription}>Update Prescription</button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={handleSaveDraft}>Save Draft</button>
                <button className="btn btn-ghost" onClick={clearForm}>Clear</button>
                <button className="btn btn-primary" disabled={!selectedPatient || !doctor} onClick={handleCreatePrescription}>Create Prescription</button>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search by patient, medication, doctor, notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", flex: 1, minWidth: 200 }}
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "")}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Doctors</option>
                <option value="Dr. Sarah Johnson">Dr. Sarah Johnson</option>
                <option value="Dr. Michael Chen">Dr. Michael Chen</option>
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              {(filterStatus || filterDoctor || filterDateFrom || filterDateTo || historySearch) && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => { setFilterStatus(""); setFilterDoctor(""); setFilterDateFrom(""); setFilterDateTo(""); setHistorySearch(""); }}>
                  Clear Filters
                </button>
              )}
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={handleExportPrescriptionsCSV}>
                <i className="ti ti-download" style={{ marginRight: 4, fontSize: 11 }} />Export CSV
              </button>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Medications</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = prescriptions.filter(p => {
                  if (filterStatus && p.status !== filterStatus) return false;
                  if (filterDoctor && p.doctor !== filterDoctor) return false;
                  if (filterDateFrom && new Date(p.createdAt) < new Date(filterDateFrom)) return false;
                  if (filterDateTo && new Date(p.createdAt) > new Date(filterDateTo + "T23:59:59")) return false;
                  if (historySearch) {
                    const searchLower = historySearch.toLowerCase();
                    if (!p.patientName.toLowerCase().includes(searchLower) &&
                        !p.medications.some(m => m.name.toLowerCase().includes(searchLower)) &&
                        !p.doctor.toLowerCase().includes(searchLower) &&
                        !p.notes?.toLowerCase().includes(searchLower)) {
                      return false;
                    }
                  }
                  return true;
                });
                if (filtered.length === 0) {
                  return (
                    <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-pill-off empty-state-icon" /><div className="empty-state-sub">No prescriptions found with current filters</div></div></td></tr>
                  );
                }
                return filtered.map((p: Prescription) => (
                  <tr key={p.id} className="tbl-row">
                    <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(p.createdAt)}</td>
                    <td>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.patientName}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.patientId}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{p.doctor}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>
                      {p.medications.slice(0, 2).map(m => m.name).join(", ")}
                      {p.medications.length > 2 && <span style={{ color: "var(--muted)" }}> +{p.medications.length - 2} more</span>}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: p.status === "active" ? "var(--green-bg)" : p.status === "completed" ? "var(--blue-bg)" : "var(--red-bg)",
                        color: p.status === "active" ? "var(--green)" : p.status === "completed" ? "var(--blue)" : "var(--red)",
                        border: p.status === "active" ? "1px solid var(--green-border)" : p.status === "completed" ? "1px solid var(--blue-border)" : "1px solid var(--red-border)"
                      }}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setViewingRx(p)}>View</button>
                        {p.status === "active" && userRole !== "receptionist" && (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleEditPrescription(p)}>Edit</button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleDuplicatePrescription(p)}>Duplicate</button>
                        {p.status === "active" && (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--green)" }} onClick={() => handleMarkCompleted(p.id)}>Complete</button>
                        )}
                        {p.status === "active" && userRole !== "receptionist" && (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleCancelPrescription(p.id)}>Cancel</button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handlePrint(p)}>Print</button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleExportPrescriptionTXT(p)}>Export</button>
                        {userRole !== "receptionist" && (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleDeletePrescription(p.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "refills" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Refill Requests ({refillRequests.length})</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => setShowRefillModal(true)}>
                <i className="ti ti-plus" style={{ marginRight: 4, fontSize: 11 }} />New Refill Request
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={handleExportRefillsCSV}>
                <i className="ti ti-download" style={{ marginRight: 4, fontSize: 11 }} />Export CSV
              </button>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Patient</th>
                <th>Medication</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {refillRequests.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><i className="ti ti-refresh-off empty-state-icon" /><div className="empty-state-sub">No refill requests. Click "New Refill Request" to add one.</div></div></td></tr>
              ) : refillRequests.map((r: RefillRequest) => (
                <tr key={r.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(r.requestedAt)}</td>
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{r.patientName}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{r.medication}</td>
                  <td>
                    <span className="badge" style={{
                      background: r.status === "pending" ? "var(--amber-bg)" : r.status === "approved" ? "var(--green-bg)" : "var(--red-bg)",
                      color: r.status === "pending" ? "var(--amber)" : r.status === "approved" ? "var(--green)" : "var(--red)",
                      border: r.status === "pending" ? "1px solid var(--amber-border)" : r.status === "approved" ? "1px solid var(--green-border)" : "1px solid var(--red-border)"
                    }}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {r.status === "pending" && userRole !== "receptionist" && (
                        <>
                          <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "approved")}>Approve</button>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleRefillDecision(r.id, "rejected")}>Reject</button>
                        </>
                      )}
                      {r.status !== "pending" && userRole !== "receptionist" && (
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "pending")}>Mark Pending</button>
                      )}
                      {userRole !== "receptionist" && (
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleDeleteRefill(r.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View prescription modal */}
      {viewingRx && (
        <div
          onClick={() => setViewingRx(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card card-padded"
            style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>
                  <i className="ti ti-pill" style={{ marginRight: 4 }} />
                  Prescription
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{fmtDate(viewingRx.createdAt)}</div>
              </div>
              <button className="btn-icon" onClick={() => setViewingRx(null)} title="Close">
                <i className="ti ti-x" style={{ fontSize: 14 }} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{viewingRx.patientName}</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{viewingRx.patientId} · {viewingRx.doctor}</div>
              <div style={{ marginTop: 4 }}>
                <span className="badge" style={{
                  background: viewingRx.status === "active" ? "var(--green-bg)" : viewingRx.status === "completed" ? "var(--blue-bg)" : "var(--red-bg)",
                  color: viewingRx.status === "active" ? "var(--green)" : viewingRx.status === "completed" ? "var(--blue)" : "var(--red)",
                  border: viewingRx.status === "active" ? "1px solid var(--green-border)" : viewingRx.status === "completed" ? "1px solid var(--blue-border)" : "1px solid var(--red-border)"
                }}>
                  {viewingRx.status.charAt(0).toUpperCase() + viewingRx.status.slice(1)}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {viewingRx.medications.map((m) => (
                <div key={m.id} style={{ padding: 10, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{m.name} {m.dosage && `· ${m.dosage}`}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {[m.frequency, m.duration].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {m.instructions && (
                    <div style={{ fontSize: "var(--font-xs)", marginTop: 4 }}>{m.instructions}</div>
                  )}
                </div>
              ))}
            </div>

            {viewingRx.notes && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>Notes</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{viewingRx.notes}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => handleShare(viewingRx)}>
                <i className="ti ti-share" style={{ fontSize: 13, marginRight: 4 }} />
                Share
              </button>
              <button className="btn btn-ghost" onClick={() => handleExportPrescriptionTXT(viewingRx)}>
                <i className="ti ti-download" style={{ fontSize: 13, marginRight: 4 }} />
                Export
              </button>
              <button className="btn btn-ghost" onClick={() => handleDuplicatePrescription(viewingRx)}>
                <i className="ti ti-copy" style={{ fontSize: 13, marginRight: 4 }} />
                Duplicate
              </button>
              {viewingRx.status === "active" && userRole !== "receptionist" && (
                <button className="btn btn-ghost" style={{ color: "var(--green)" }} onClick={() => handleMarkCompleted(viewingRx.id)}>
                  <i className="ti ti-check" style={{ fontSize: 13, marginRight: 4 }} />
                  Complete
                </button>
              )}
              {viewingRx.status === "active" && userRole !== "receptionist" && (
                <button className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={() => handleCancelPrescription(viewingRx.id)}>
                  <i className="ti ti-x" style={{ fontSize: 13, marginRight: 4 }} />
                  Cancel
                </button>
              )}
              <button className="btn btn-primary" onClick={() => handlePrint(viewingRx)}>
                <i className="ti ti-printer" style={{ fontSize: 13, marginRight: 4 }} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refill Request Modal */}
      {showRefillModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 400, width: "90%" }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 12 }}>New Refill Request</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Prescription</label>
                <select
                  value={refillForm.prescriptionId}
                  onChange={(e) => {
                    const rx = prescriptions.find(p => p.id === e.target.value);
                    setRefillForm({
                      ...refillForm,
                      prescriptionId: e.target.value,
                      patientName: rx?.patientName || "",
                      medication: rx?.medications[0]?.name || "",
                    });
                  }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select prescription...</option>
                  {prescriptions.filter(p => p.status === "active").map(p => (
                    <option key={p.id} value={p.id}>{p.patientName} - {p.medications[0]?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
                <input
                  type="text"
                  value={refillForm.patientName}
                  onChange={(e) => setRefillForm({ ...refillForm, patientName: e.target.value })}
                  placeholder="Patient name"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Medication</label>
                <input
                  type="text"
                  value={refillForm.medication}
                  onChange={(e) => setRefillForm({ ...refillForm, medication: e.target.value })}
                  placeholder="Medication name"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Notes</label>
                <textarea
                  placeholder="Additional notes..."
                  rows={2}
                  value={refillForm.notes}
                  onChange={(e) => setRefillForm({ ...refillForm, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowRefillModal(false); setRefillForm({ prescriptionId: "", patientName: "", medication: "", notes: "" }); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateRefillRequest}>Create Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "var(--radius)",
        border: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--muted)",
        fontSize: "var(--font-sm)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, color, icon, bg }: {
  label: string;
  value: number;
  color: string;
  icon: string;
  bg: string;
}) {
  return (
    <div className="card card-padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
        </div>
        <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "var(--font-xl)", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

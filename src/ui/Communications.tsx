import React, { useState, useEffect, useRef } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

interface Feedback {
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface CommunicationActivity {
  timestamp: string;
  action: string;
  patientId?: string;
  patientName?: string;
  details?: string;
}

interface Communication {
  id: string;
  patientId: string;
  patientName: string;
  type: "sms" | "email" | "whatsapp" | "call" | "draft" | "scheduled";
  status: "opened_sms_app" | "opened_email_app" | "opened_whatsapp" | "opened_phone_dialer" | "logged" | "scheduled" | "draft" | "cancelled" | "failed_locally" | "sent";
  message?: string;
  notes?: string;
  date: string;
  scheduledDate?: string;
  callDirection?: "outgoing" | "incoming" | "missed";
  callOutcome?: "connected" | "no_answer" | "busy" | "wrong_number" | "left_voicemail";
  followUpNeeded?: boolean;
  followUpDate?: string;
  subject?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  body: string;
}

interface ScheduledCommunication {
  id: string;
  patientId: string;
  patientName: string;
  type: "sms" | "email" | "whatsapp";
  message: string;
  subject?: string;
  scheduledDate: string;
  status: "scheduled" | "cancelled" | "sent";
  createdAt: string;
}

// ─── Safe localStorage helpers ────────────────────────────────────────────────
const COMMUNICATIONS_KEY = "clinic_crm_communications";
const TEMPLATES_KEY = "clinic_crm_communication_templates";
const SCHEDULED_KEY = "clinic_crm_scheduled_communications";
const ACTIVITY_KEY = "clinic_crm_communication_activity";
const PREFERENCES_KEY = "clinic_crm_communication_preferences";

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

export default function CommunicationsPage({ patients, onUpdatePatient, userRole = "admin" }: { patients: Patient[]; onUpdatePatient?: (updated: Patient, action?: string) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  const [activeTab, setActiveTab] = useState<"compose" | "templates" | "history" | "automation">("compose");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messageType, setMessageType] = useState<"sms" | "email" | "whatsapp">("sms");
  const [messageText, setMessageText] = useState("");
  const [subject, setSubject] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showCallLogModal, setShowCallLogModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [draftStatus, setDraftStatus] = useState<"saved" | "unsaved" | null>(null);

  // Call log modal state
  const [callPatient, setCallPatient] = useState<Patient | null>(null);
  const [callDirection, setCallDirection] = useState<"outgoing" | "incoming" | "missed">("outgoing");
  const [callOutcome, setCallOutcome] = useState<"connected" | "no_answer" | "busy" | "wrong_number" | "left_voicemail">("connected");
  const [callNotes, setCallNotes] = useState("");
  const [callFollowUpNeeded, setCallFollowUpNeeded] = useState(false);
  const [callFollowUpDate, setCallFollowUpDate] = useState("");

  // Template editing state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const [communications, setCommunications] = useState<Communication[]>(() =>
    readJSON<Communication[]>(COMMUNICATIONS_KEY, [])
  );
  const [templates, setTemplates] = useState<Template[]>(() => readJSON<Template[]>(TEMPLATES_KEY, []));
  const [scheduled, setScheduled] = useState<ScheduledCommunication[]>(() => readJSON<ScheduledCommunication[]>(SCHEDULED_KEY, []));
  const [activity, setActivity] = useState<CommunicationActivity[]>(() => readJSON<CommunicationActivity[]>(ACTIVITY_KEY, []));
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set(readJSON<string[]>(PREFERENCES_KEY, []).filter(s => s.startsWith("dismissed_")).map(s => s.replace("dismissed_", ""))));

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState<Communication["type"] | "">("");
  const [historyFilterStatus, setHistoryFilterStatus] = useState<Communication["status"] | "">("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  // Auto-clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCallLogModal) setShowCallLogModal(false);
        if (showDetailModal) setShowDetailModal(false);
        if (confirmModal) setConfirmModal(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && activeTab === "compose") {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCallLogModal, showDetailModal, confirmModal, activeTab, selectedPatient, messageType, messageText, subject, scheduledDate]);

  function showFeedback(message: string, type: "success" | "error" | "info" | "warning" = "info") {
    setFeedback({ type, message });
  }

  function logActivity(action: string, patientId?: string, patientName?: string, details?: string) {
    const entry: CommunicationActivity = {
      timestamp: new Date().toISOString(),
      action,
      patientId,
      patientName,
      details,
    };
    const next = [entry, ...activity].slice(0, 50);
    setActivity(next);
    writeJSON(ACTIVITY_KEY, next);
  }

  function handleSaveDraft() {
    if (!selectedPatient) {
      showFeedback("Please select a patient first.", "error");
      return;
    }
    if (!messageText.trim() && !subject.trim()) {
      showFeedback("Nothing to save.", "info");
      return;
    }

    const entry: Communication = {
      id: `draft-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      type: "draft",
      status: "draft",
      message: messageText.trim(),
      subject: subject.trim(),
      date: new Date().toISOString(),
    };

    saveCommunication(entry);
    logActivity("draft saved", selectedPatient.id, selectedPatient.name);
    setDraftStatus("saved");
    showFeedback("Draft saved.", "success");
  }

  function saveCommunication(entry: Communication) {
    const next = [...communications, entry];
    writeJSON(COMMUNICATIONS_KEY, next);
    setCommunications(next);
  }

  function saveScheduled(entry: ScheduledCommunication) {
    const next = [...scheduled, entry];
    writeJSON(SCHEDULED_KEY, next);
    setScheduled(next);
  }

  function saveTemplate(entry: Template) {
    const next = [...templates, entry];
    writeJSON(TEMPLATES_KEY, next);
    setTemplates(next);
  }

  function handleSendMessage() {
    if (!selectedPatient) {
      showFeedback("Please select a patient.", "error");
      return;
    }
    if (!messageText.trim()) {
      showFeedback("Please enter a message.", "error");
      return;
    }

    const phone = (selectedPatient as any).phone || "";
    const email = (selectedPatient as any).email || "";

    // Validation
    if (messageType === "sms" || messageType === "whatsapp") {
      if (!phone) {
        showFeedback("Patient has no phone number on file.", "error");
        return;
      }
    }
    if (messageType === "email") {
      if (!email) {
        showFeedback("Patient has no email on file.", "error");
        return;
      }
    }

    // Privacy warning for sensitive content
    const sensitiveKeywords = ["diagnosis", "lab result", "insurance", "medical", "test result", "condition"];
    const hasSensitive = sensitiveKeywords.some(kw => messageText.toLowerCase().includes(kw));
    if (hasSensitive) {
      showFeedback("Avoid sending sensitive medical details over unsecured channels.", "warning");
    }

    const encodedMessage = encodeURIComponent(messageText);
    const encodedSubject = encodeURIComponent(subject);

    let status: Communication["status"] = "failed_locally";
    let openedWindow: Window | null = null;

    if (messageType === "sms") {
      const url = `sms:${phone}?body=${encodedMessage}`;
      openedWindow = window.open(url, "_blank");
      if (openedWindow) status = "opened_sms_app";
    } else if (messageType === "email") {
      const url = `mailto:${email}?subject=${encodedSubject}&body=${encodedMessage}`;
      openedWindow = window.open(url, "_blank");
      if (openedWindow) status = "opened_email_app";
    } else if (messageType === "whatsapp") {
      const cleanPhone = phone.replace(/\D/g, "");
      const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      openedWindow = window.open(url, "_blank");
      if (openedWindow) status = "opened_whatsapp";
    }

    if (!openedWindow) {
      showFeedback("Please allow pop-ups to send messages.", "error");
      return;
    }

    const entry: Communication = {
      id: `comm-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      type: messageType,
      status,
      message: messageText.trim(),
      subject: messageType === "email" ? subject : undefined,
      date: new Date().toISOString(),
    };

    saveCommunication(entry);
    logActivity("message opened", selectedPatient.id, selectedPatient.name, `${messageType}: ${status}`);
    showFeedback(`Opened ${messageType} app. Delivery not guaranteed.`, "info");

    // Clear compose
    setMessageText("");
    setSubject("");
    setSelectedPatient(null);
    setScheduledDate("");
    setDraftStatus(null);
  }

  function handleScheduleMessage() {
    if (!selectedPatient) {
      showFeedback("Please select a patient.", "error");
      return;
    }
    if (!messageText.trim()) {
      showFeedback("Please enter a message.", "error");
      return;
    }
    if (!scheduledDate) {
      showFeedback("Please select a scheduled date/time.", "error");
      return;
    }

    const scheduledDateObj = new Date(scheduledDate);
    if (scheduledDateObj <= new Date()) {
      showFeedback("Scheduled date must be in the future.", "error");
      return;
    }

    const entry: ScheduledCommunication = {
      id: `sched-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      type: messageType,
      message: messageText.trim(),
      subject: messageType === "email" ? subject : undefined,
      scheduledDate: scheduledDate,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    saveScheduled(entry);
    logActivity("message scheduled", selectedPatient.id, selectedPatient.name, `Due: ${fmtDate(scheduledDate)}`);
    showFeedback("Message scheduled locally.", "success");

    setMessageText("");
    setSubject("");
    setSelectedPatient(null);
    setScheduledDate("");
    setDraftStatus(null);
  }

  function handleLoadDraft(draft: Communication) {
    const patient = patients.find(p => p.id === draft.patientId);
    if (patient) {
      setSelectedPatient(patient);
      setMessageText(draft.message || "");
      setSubject(draft.subject || "");
      setActiveTab("compose");
      setDraftStatus("unsaved");
      showFeedback("Draft loaded.", "info");
    }
  }

  function handleDeleteDraft(id: string) {
    setConfirmModal({
      message: "Delete this draft?",
      onConfirm: () => {
        const next = communications.filter(c => c.id !== id);
        writeJSON(COMMUNICATIONS_KEY, next);
        setCommunications(next);
        logActivity("draft deleted");
        showFeedback("Draft deleted.", "success");
      },
    });
  }

  function handleSendScheduled(id: string) {
    const sched = scheduled.find(s => s.id === id);
    if (!sched) return;

    const patient = patients.find(p => p.id === sched.patientId);
    if (!patient) {
      showFeedback("Patient not found.", "error");
      return;
    }

    setSelectedPatient(patient);
    setMessageType(sched.type);
    setMessageText(sched.message);
    setSubject(sched.subject || "");
    setActiveTab("compose");

    // Remove from scheduled
    const next = scheduled.filter(s => s.id !== id);
    writeJSON(SCHEDULED_KEY, next);
    setScheduled(next);
    logActivity("scheduled message moved to compose", sched.patientId, sched.patientName);
    showFeedback("Scheduled message loaded. Send when ready.", "info");
  }

  function handleCancelScheduled(id: string) {
    setConfirmModal({
      message: "Cancel this scheduled message?",
      onConfirm: () => {
        const next = scheduled.filter(s => s.id !== id);
        writeJSON(SCHEDULED_KEY, next);
        setScheduled(next);
        logActivity("scheduled message cancelled");
        showFeedback("Scheduled message cancelled.", "success");
      },
    });
  }

  function handleDeleteScheduled(id: string) {
    setConfirmModal({
      message: "Delete this scheduled message?",
      onConfirm: () => {
        const next = scheduled.filter(s => s.id !== id);
        writeJSON(SCHEDULED_KEY, next);
        setScheduled(next);
        logActivity("scheduled message deleted");
        showFeedback("Scheduled message deleted.", "success");
      },
    });
  }

  function handleAddTemplate(name: string, category: string, body: string) {
    const entry: Template = {
      id: `tpl-${Date.now()}`,
      name,
      category,
      body,
    };
    saveTemplate(entry);
    logActivity("template added", undefined, undefined, name);
    showFeedback("Template added.", "success");
  }

  function handleEditTemplate(id: string, name: string, category: string, body: string) {
    const next = templates.map(t => t.id === id ? { ...t, name, category, body } : t);
    writeJSON(TEMPLATES_KEY, next);
    setTemplates(next);
    logActivity("template edited", undefined, undefined, name);
    showFeedback("Template updated.", "success");
  }

  function handleDeleteTemplate(id: string) {
    setConfirmModal({
      message: "Delete this template?",
      onConfirm: () => {
        const next = templates.filter(t => t.id !== id);
        writeJSON(TEMPLATES_KEY, next);
        setTemplates(next);
        logActivity("template deleted");
        showFeedback("Template deleted.", "success");
      },
    });
  }

  function handleResetTemplates() {
    setConfirmModal({
      message: "Reset to default templates? Custom templates will be lost.",
      onConfirm: () => {
        writeJSON(TEMPLATES_KEY, []);
        setTemplates([]);
        logActivity("templates reset");
        showFeedback("Templates reset to defaults.", "success");
      },
    });
  }

  function handleUseTemplate(template: Template, replace = false) {
    if (replace) {
      setMessageText(template.body);
    } else {
      setMessageText(prev => prev + (prev ? " " : "") + template.body);
    }
    setActiveTab("compose");
    setDraftStatus("unsaved");
    showFeedback("Template loaded.", "info");
  }

  function handleQuickTemplate(template: string, replace = false) {
    if (replace) {
      setMessageText(template);
    } else {
      setMessageText(prev => prev + (prev ? " " : "") + template);
    }
    setDraftStatus("unsaved");
  }

  function handlePreviewTemplate(template: string) {
    if (!selectedPatient) {
      showFeedback("Select a patient to preview placeholders.", "info");
      return template;
    }

    const now = new Date();
    const placeholders: Record<string, string> = {
      "{name}": selectedPatient.name,
      "{firstName}": selectedPatient.name.split(" ")[0],
      "{date}": fmtDate(now.toISOString()),
      "{time}": now.toLocaleTimeString(),
      "{doctor}": "Dr. Smith",
      "{phone}": (selectedPatient as any).phone || "",
      "{amount}": "$0.00",
      "{clinicName}": "My Clinic",
    };

    let preview = template;
    Object.entries(placeholders).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key, "g"), value);
    });

    return preview;
  }

  function handleDeleteCommunication(id: string) {
    setConfirmModal({
      message: "Delete this communication record?",
      onConfirm: () => {
        const next = communications.filter(c => c.id !== id);
        writeJSON(COMMUNICATIONS_KEY, next);
        setCommunications(next);
        logActivity("communication deleted");
        showFeedback("Communication deleted.", "success");
      },
    });
  }

  function handleDuplicateToCompose(comm: Communication) {
    const patient = patients.find(p => p.id === comm.patientId);
    if (patient) {
      setSelectedPatient(patient);
      setMessageType(comm.type === "draft" ? "sms" : comm.type as "sms" | "email" | "whatsapp");
      setMessageText(comm.message || "");
      setSubject(comm.subject || "");
      setActiveTab("compose");
      setDraftStatus("unsaved");
      showFeedback("Duplicated to compose.", "info");
    }
  }

  function handleMarkFollowedUp(id: string) {
    const next = communications.map(c => c.id === id ? { ...c, followUpNeeded: false } : c);
    writeJSON(COMMUNICATIONS_KEY, next);
    setCommunications(next);
    logActivity("communication marked as followed up");
    showFeedback("Marked as followed up.", "success");
  }

  function handleLogCall() {
    if (!callPatient) {
      showFeedback("Please select a patient.", "error");
      return;
    }

    const entry: Communication = {
      id: `call-${Date.now()}`,
      patientId: callPatient.id,
      patientName: callPatient.name,
      type: "call",
      status: "logged",
      notes: callNotes.trim() || undefined,
      callDirection,
      callOutcome,
      followUpNeeded: callFollowUpNeeded,
      followUpDate: callFollowUpNeeded && callFollowUpDate ? callFollowUpDate : undefined,
      date: new Date().toISOString(),
    };

    saveCommunication(entry);
    logActivity("call logged", callPatient.id, callPatient.name, `${callDirection} - ${callOutcome}`);
    showFeedback("Call logged.", "success");

    // Reset modal
    setCallPatient(null);
    setCallDirection("outgoing");
    setCallOutcome("connected");
    setCallNotes("");
    setCallFollowUpNeeded(false);
    setCallFollowUpDate("");
    setShowCallLogModal(false);
  }

  function handleCallNow(patient: Patient) {
    const phone = (patient as any).phone;
    if (!phone) {
      showFeedback("Patient has no phone number.", "error");
      return;
    }
    const opened = window.open(`tel:${phone}`, "_blank");
    if (opened) {
      logActivity("opened_phone_dialer", patient.id, patient.name);
      showFeedback("Opened phone dialer.", "info");
    } else {
      showFeedback("Please allow pop-ups to dial.", "error");
    }
  }

  function handleEditTemplate(template: Template) {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateCategory(template.category);
    setTemplateBody(template.body);
    setShowTemplateModal(true);
  }

  function handleSaveTemplate() {
    if (!templateName.trim() || !templateBody.trim()) {
      showFeedback("Name and body are required.", "error");
      return;
    }

    if (editingTemplate) {
      // Update existing
      const next = templates.map(t => t.id === editingTemplate.id ? { ...t, name: templateName.trim(), category: templateCategory.trim(), body: templateBody.trim() } : t);
      setTemplates(next);
      saveTemplate(next.find(t => t.id === editingTemplate.id)!);
      logActivity("template updated", undefined, undefined, templateName.trim());
      showFeedback("Template updated.", "success");
    } else {
      // Create new
      const newTemplate: Template = {
        id: `template-${Date.now()}`,
        name: templateName.trim(),
        category: templateCategory.trim(),
        body: templateBody.trim(),
      };
      const next = [...templates, newTemplate];
      setTemplates(next);
      saveTemplate(newTemplate);
      logActivity("template created", undefined, undefined, templateName.trim());
      showFeedback("Template created.", "success");
    }

    // Reset modal
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateCategory("");
    setTemplateBody("");
  }

  function handleDuplicateTemplate(template: Template) {
    const newTemplate: Template = {
      id: `template-${Date.now()}`,
      name: `${template.name} (copy)`,
      category: template.category,
      body: template.body,
    };
    const next = [...templates, newTemplate];
    setTemplates(next);
    saveTemplate(newTemplate);
    logActivity("template duplicated", undefined, undefined, newTemplate.name);
    showFeedback("Template duplicated.", "success");
  }

  function handleExportHistoryCSV() {
    const filtered = getFilteredHistory();
    if (filtered.length === 0) {
      showFeedback("No communications to export.", "info");
      return;
    }
    const headers = ["ID", "Patient", "Patient ID", "Type", "Status", "Date", "Scheduled Date", "Message", "Notes"];
    const rows = filtered.map((c: Communication) => [
      c.id,
      c.patientName,
      c.patientId,
      c.type,
      c.status,
      fmtDate(c.date),
      c.scheduledDate ? fmtDate(c.scheduledDate) : "",
      c.message || "",
      c.notes || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `communications_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity("communications exported");
    showFeedback(`Exported ${filtered.length} communication(s).`, "success");
  }

  function handleExportScheduledCSV() {
    if (scheduled.length === 0) {
      showFeedback("No scheduled messages to export.", "info");
      return;
    }
    const headers = ["ID", "Patient", "Patient ID", "Type", "Scheduled Date", "Status", "Created At", "Message"];
    const rows = scheduled.map((s: ScheduledCommunication) => [
      s.id,
      s.patientName,
      s.patientId,
      s.type,
      fmtDate(s.scheduledDate),
      s.status,
      fmtDate(s.createdAt),
      s.message,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scheduled_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity("scheduled messages exported");
    showFeedback(`Exported ${scheduled.length} scheduled message(s).`, "success");
  }

  function handleExportCallsCSV() {
    const calls = communications.filter((c: Communication) => c.type === "call");
    if (calls.length === 0) {
      showFeedback("No call logs to export.", "info");
      return;
    }
    const headers = ["ID", "Patient", "Patient ID", "Direction", "Outcome", "Date", "Notes", "Follow-up Needed", "Follow-up Date"];
    const rows = calls.map((c: Communication) => [
      c.id,
      c.patientName,
      c.patientId,
      c.callDirection || "",
      c.callOutcome || "",
      fmtDate(c.date),
      c.notes || "",
      c.followUpNeeded ? "Yes" : "No",
      c.followUpDate ? fmtDate(c.followUpDate) : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calls_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity("call logs exported");
    showFeedback(`Exported ${calls.length} call log(s).`, "success");
  }

  function handleExportActivityCSV() {
    if (activity.length === 0) {
      showFeedback("No activity to export.", "info");
      return;
    }
    const headers = ["Timestamp", "Action", "Patient ID", "Patient Name", "Details"];
    const rows = activity.map((a: CommunicationActivity) => [
      fmtDate(a.timestamp),
      a.action,
      a.patientId || "",
      a.patientName || "",
      a.details || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported ${activity.length} activity entries.`, "success");
  }

  function handlePrintHistory() {
    const filtered = getFilteredHistory();
    if (filtered.length === 0) {
      showFeedback("No communications to print.", "info");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      showFeedback("Please allow pop-ups to print.", "error");
      return;
    }
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = filtered.map((c: Communication) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${esc(fmtDate(c.date))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${esc(c.patientName)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${esc(c.type)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${esc(c.status)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${esc(c.message || c.notes || "")}</td>
      </tr>`).join("");
    w.document.write(`
      <html><head><title>Communication History</title></head>
      <body style="font-family:Arial,sans-serif;padding:20px;">
        <h2>Communication History</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead><tr>
            <th style="padding:8px;border-bottom:2px solid #333;text-align:left;">Date</th>
            <th style="padding:8px;border-bottom:2px solid #333;text-align:left;">Patient</th>
            <th style="padding:8px;border-bottom:2px solid #333;text-align:left;">Type</th>
            <th style="padding:8px;border-bottom:2px solid #333;text-align:left;">Status</th>
            <th style="padding:8px;border-bottom:2px solid #333;text-align:left;">Message/Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
    logActivity("communications printed");
  }

  function handleClearActivity() {
    setConfirmModal({
      message: "Clear all activity logs?",
      onConfirm: () => {
        setActivity([]);
        writeJSON(ACTIVITY_KEY, []);
        showFeedback("Activity cleared.", "success");
      },
    });
  }

  function getFilteredHistory(): Communication[] {
    return communications.filter((c: Communication) => {
      if (historyFilterType && c.type !== historyFilterType) return false;
      if (historyFilterStatus && c.status !== historyFilterStatus) return false;
      if (historyDateFrom && new Date(c.date) < new Date(historyDateFrom)) return false;
      if (historyDateTo && new Date(c.date) > new Date(historyDateTo + "T23:59:59")) return false;
      if (historySearch) {
        const searchLower = historySearch.toLowerCase();
        if (!c.patientName.toLowerCase().includes(searchLower) &&
            !c.message?.toLowerCase().includes(searchLower) &&
            !c.notes?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }

  const smsLogs = communications.filter((c: Communication) => c.type === "sms" || c.status === "opened_sms_app");
  const emailLogs = communications.filter((c: Communication) => c.type === "email" || c.status === "opened_email_app");
  const whatsappLogs = communications.filter((c: Communication) => c.type === "whatsapp" || c.status === "opened_whatsapp");
  const callLogs = communications.filter((c: Communication) => c.type === "call");
  const scheduledMessages = scheduled.filter(s => s.status === "scheduled" && new Date(s.scheduledDate) > new Date());
  const dueNow = scheduled.filter(s => s.status === "scheduled" && new Date(s.scheduledDate) <= new Date());
  const visibleHistory = historyExpanded ? getFilteredHistory() : getFilteredHistory().slice(0, 10);

  return (
    <div style={{ padding: "clamp(12px, 4vw, 24px)", maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Communications
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Send SMS, email &amp; WhatsApp · log calls · schedule reminders
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="SMS Opened" value={smsLogs.length} color="var(--blue)" icon="ti-message" bg="var(--blue-bg)" />
        <StatCard label="Emails Opened" value={emailLogs.length} color="var(--green)" icon="ti-mail" bg="var(--green-bg)" />
        <StatCard label="WhatsApp Opened" value={whatsappLogs.length} color="var(--green)" icon="ti-brand-whatsapp" bg="var(--green-bg)" />
        <StatCard label="Calls Logged" value={callLogs.length} color="var(--amber)" icon="ti-phone" bg="var(--amber-bg)" />
        <StatCard label="Scheduled" value={scheduledMessages.length} color="var(--purple)" icon="ti-clock" bg="var(--purple-bg)" />
        <StatCard label="Due Now" value={dueNow.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Total" value={communications.length} color="var(--accent)" icon="ti-send" bg="var(--accent-soft)" />
      </div>

      {/* Feedback Display */}
      {feedback && (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius)", marginBottom: 16,
          background: feedback.type === "success" ? "var(--green-bg)" :
                   feedback.type === "error" ? "var(--red-bg)" :
                   feedback.type === "warning" ? "var(--amber-bg)" : "var(--blue-bg)",
          color: feedback.type === "success" ? "var(--green)" :
                 feedback.type === "error" ? "var(--red)" :
                 feedback.type === "warning" ? "var(--amber)" : "var(--blue)",
          border: `1px solid ${feedback.type === "success" ? "var(--green-border)" :
                              feedback.type === "error" ? "var(--red-border)" :
                              feedback.type === "warning" ? "var(--amber-border)" : "var(--blue-border)"}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className={`ti ${feedback.type === "success" ? "ti-check" : feedback.type === "error" ? "ti-x" : feedback.type === "warning" ? "ti-alert-triangle" : "ti-info-circle"}`} style={{ fontSize: 16 }} />
          <span style={{ fontSize: "var(--font-sm)" }}>{feedback.message}</span>
        </div>
      )}

      {/* Activity Feed Toggle */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowActivity(!showActivity)}>
          <i className="ti ti-history" style={{ marginRight: 4, fontSize: 12 }} />Activity ({activity.length})
        </button>
      </div>

      {/* Activity Feed Panel */}
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
            </div>
          </div>
          {activity.length === 0 ? (
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>No activity yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
              {activity.map((a: CommunicationActivity, idx: number) => (
                <div key={idx} style={{ fontSize: "var(--font-xs)", padding: 8, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{a.action}</span>
                    <span style={{ color: "var(--muted)" }}>{fmtDate(a.timestamp)}</span>
                  </div>
                  {a.patientName && <div style={{ color: "var(--muted)" }}>Patient: {a.patientName}</div>}
                  {a.details && <div style={{ color: "var(--muted)" }}>{a.details}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal" style={{ maxWidth: 400, width: "95vw" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 12 }}>Confirm Action</div>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 16, color: "var(--muted)" }}>{confirmModal.message}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Log Modal */}
      {showCallLogModal && (
        <div className="modal-backdrop" onClick={() => setShowCallLogModal(false)}>
          <div className="modal" style={{ maxWidth: 500, width: "95vw", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Log Call</div>
              <button className="btn-icon" onClick={() => setShowCallLogModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
                <select
                  value={callPatient?.id || ""}
                  onChange={(e) => setCallPatient(patients.find(p => p.id === e.target.value) || null)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select patient...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Direction</label>
                <select
                  value={callDirection}
                  onChange={(e) => setCallDirection(e.target.value as any)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="outgoing">Outgoing</option>
                  <option value="incoming">Incoming</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Outcome</label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value as any)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="connected">Connected</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="wrong_number">Wrong Number</option>
                  <option value="left_voicemail">Left Voicemail</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Notes</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={callFollowUpNeeded}
                    onChange={(e) => setCallFollowUpNeeded(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Follow-up needed
                </label>
              </div>
              {callFollowUpNeeded && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Follow-up Date</label>
                  <input
                    type="date"
                    value={callFollowUpDate}
                    onChange={(e) => setCallFollowUpDate(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                  />
                </div>
              )}
              {callPatient && (callPatient as any).phone && (
                <div style={{ marginBottom: 12 }}>
                  <button className="btn btn-ghost" style={{ width: "100%", fontSize: "var(--font-xs)" }} onClick={() => handleCallNow(callPatient)}>
                    <i className="ti ti-phone" style={{ fontSize: 12, marginRight: 4 }} />Call Now
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowCallLogModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleLogCall} disabled={!callPatient}>Log Call</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Communication Detail Modal */}
      {showDetailModal && selectedCommunication && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: 500, width: "95vw", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Communication Details</div>
              <button className="btn-icon" onClick={() => setShowDetailModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Patient</div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{selectedCommunication.patientName}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Type</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{selectedCommunication.type.toUpperCase()}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Status</div>
                <span className="badge" style={{
                  background: selectedCommunication.status === "logged" || selectedCommunication.status === "opened_sms_app" || selectedCommunication.status === "opened_email_app" || selectedCommunication.status === "opened_whatsapp" ? "var(--green-bg)" :
                           selectedCommunication.status === "draft" ? "var(--gray-bg)" : "var(--amber-bg)",
                  color: selectedCommunication.status === "logged" || selectedCommunication.status === "opened_sms_app" || selectedCommunication.status === "opened_email_app" || selectedCommunication.status === "opened_whatsapp" ? "var(--green)" :
                         selectedCommunication.status === "draft" ? "var(--gray)" : "var(--amber)",
                  border: selectedCommunication.status === "logged" || selectedCommunication.status === "opened_sms_app" || selectedCommunication.status === "opened_email_app" || selectedCommunication.status === "opened_whatsapp" ? "1px solid var(--green-border)" :
                           selectedCommunication.status === "draft" ? "1px solid var(--gray-border)" : "1px solid var(--amber-border)",
                  fontSize: "var(--font-xs)"
                }}>{selectedCommunication.status.replace(/_/g, " ")}</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Date</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{fmtDate(selectedCommunication.date)}</div>
              </div>
              {selectedCommunication.scheduledDate && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Scheduled Date</div>
                  <div style={{ fontSize: "var(--font-sm)" }}>{fmtDate(selectedCommunication.scheduledDate)}</div>
                </div>
              )}
              {selectedCommunication.message && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Message</div>
                  <div style={{ fontSize: "var(--font-sm)", whiteSpace: "pre-wrap", background: "var(--surface2)", padding: 8, borderRadius: "var(--radius)" }}>{selectedCommunication.message}</div>
                </div>
              )}
              {selectedCommunication.notes && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Notes</div>
                  <div style={{ fontSize: "var(--font-sm)", whiteSpace: "pre-wrap", background: "var(--surface2)", padding: 8, borderRadius: "var(--radius)" }}>{selectedCommunication.notes}</div>
                </div>
              )}
              {selectedCommunication.callDirection && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Call Direction</div>
                  <div style={{ fontSize: "var(--font-sm)" }}>{selectedCommunication.callDirection}</div>
                </div>
              )}
              {selectedCommunication.callOutcome && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Call Outcome</div>
                  <div style={{ fontSize: "var(--font-sm)" }}>{selectedCommunication.callOutcome}</div>
                </div>
              )}
              {selectedCommunication.followUpNeeded && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 2 }}>Follow-up</div>
                  <div style={{ fontSize: "var(--font-sm)" }}>
                    {selectedCommunication.followUpNeeded ? "Needed" : "Not needed"}
                    {selectedCommunication.followUpDate && ` · Due: ${fmtDate(selectedCommunication.followUpDate)}`}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => handleDuplicateToCompose(selectedCommunication)}>
                  <i className="ti ti-copy" style={{ fontSize: 12, marginRight: 4 }} />Duplicate
                </button>
                {selectedCommunication.type !== "draft" && selectedCommunication.type !== "scheduled" && (
                  <button className="btn btn-ghost" onClick={() => handleDuplicateToCompose(selectedCommunication)}>
                    <i className="ti ti-send" style={{ fontSize: 12, marginRight: 4 }} />Send Again
                  </button>
                )}
                {userRole !== "doctor" && (
                  <button className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={() => { handleDeleteCommunication(selectedCommunication.id); setShowDetailModal(false); }}>
                    <i className="ti ti-trash" style={{ fontSize: 12, marginRight: 4 }} />Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      {showTemplateModal && (
        <div className="modal-backdrop" onClick={() => setShowTemplateModal(false)}>
          <div className="modal" style={{ maxWidth: 500, width: "95vw", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>{editingTemplate ? "Edit Template" : "Add Template"}</div>
              <button className="btn-icon" onClick={() => setShowTemplateModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Category</label>
                <input
                  type="text"
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  placeholder="e.g., Appointment, Follow-up, General"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Body</label>
                <textarea
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  placeholder="Template body... Use {name}, {date}, {time}, {doctor}, {phone}, {amount}, {clinicName} as placeholders"
                  rows={6}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!templateName.trim() || !templateBody.trim()}>
                  {editingTemplate ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <TabButton active={activeTab === "compose"} onClick={() => setActiveTab("compose")}>Compose</TabButton>
          <TabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")}>Templates</TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>History</TabButton>
          <TabButton active={activeTab === "automation"} onClick={() => setActiveTab("automation")}>Automation</TabButton>
        </div>
      </div>

      {activeTab === "compose" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Send Message */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-send" style={{ marginRight: 4 }} />
            Send Message
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
            <select
              value={selectedPatient?.id || ""}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const }}
            >
              <option value="">Select patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Message Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setMessageType("sms")}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: messageType === "sms" ? "var(--accent-soft)" : "transparent",
                  color: messageType === "sms" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-sm)", cursor: "pointer"
                }}
              >
                <i className="ti ti-message" style={{ fontSize: 14, marginRight: 4 }} />
                SMS
              </button>
              <button
                onClick={() => setMessageType("email")}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: messageType === "email" ? "var(--accent-soft)" : "transparent",
                  color: messageType === "email" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-sm)", cursor: "pointer"
                }}
              >
                <i className="ti ti-mail" style={{ fontSize: 14, marginRight: 4 }} />
                Email
              </button>
              <button
                onClick={() => setMessageType("whatsapp")}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: messageType === "whatsapp" ? "var(--accent-soft)" : "transparent",
                  color: messageType === "whatsapp" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-sm)", cursor: "pointer"
                }}
              >
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 14, marginRight: 4 }} />
                WhatsApp
              </button>
            </div>
          </div>
          {messageType === "email" && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }}
              />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Message</label>
            <textarea
              value={messageText}
              onChange={(e) => { setMessageText(e.target.value); setDraftStatus("unsaved"); }}
              placeholder="Type your message..."
              rows={4}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Schedule (Optional)</label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const }}
            />
          </div>
          {selectedPatient && (
            <div style={{ marginBottom: 12 }}>
              {messageType === "sms" || messageType === "whatsapp" ? (
                !(selectedPatient as any).phone && (
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
                    <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                    Patient has no phone number on file.
                  </div>
                )
              ) : messageType === "email" && !(selectedPatient as any).email && (
                <div style={{ fontSize: "var(--font-xs)", color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                  Patient has no email on file.
                </div>
              )}
              {(selectedPatient as any).consentSigned === false && (
                <div style={{ fontSize: "var(--font-xs)", color: "var(--amber)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />
                  Patient consent not signed. Proceed with caution.
                </div>
              )}
            </div>
          )}
          {draftStatus && (
            <div style={{ marginBottom: 12, fontSize: "var(--font-xs)", color: draftStatus === "saved" ? "var(--green)" : "var(--muted)" }}>
              {draftStatus === "saved" ? "Draft saved" : "Unsaved changes"}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => { setMessageText(""); setSubject(""); setSelectedPatient(null); setScheduledDate(""); setDraftStatus(null); }}>Clear</button>
            <button className="btn btn-ghost" onClick={handleSaveDraft} disabled={!selectedPatient}>Save Draft</button>
            {scheduledDate ? (
              <button className="btn btn-primary" onClick={handleScheduleMessage} disabled={!selectedPatient || !messageText.trim()}>Schedule</button>
            ) : (
              <button className="btn btn-primary" onClick={handleSendMessage} disabled={!selectedPatient || !messageText.trim()}>Send/Open</button>
            )}
          </div>
        </div>

        {/* Quick Templates */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-template" style={{ marginRight: 4 }} />
            Quick Templates
          </div>
          <div style={{ marginBottom: 8, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
            Click to append. Shift+Click to replace.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TemplateButton
              icon="ti-calendar-check"
              label="Appointment Reminder"
              template="Reminder: You have an appointment scheduled for {date} at {time}. Please arrive 15 minutes early."
              onClick={(t, replace) => handleQuickTemplate(t, replace)}
            />
            <TemplateButton
              icon="ti-phone"
              label="Follow-up Call"
              template="Hi {name}, this is a follow-up call regarding your recent visit. How are you feeling?"
              onClick={(t, replace) => handleQuickTemplate(t, replace)}
            />
            <TemplateButton
              icon="ti-pill"
              label="Medication Reminder"
              template="Reminder: Please take your medication as prescribed. Contact us if you have any questions."
              onClick={(t, replace) => handleQuickTemplate(t, replace)}
            />
            <TemplateButton
              icon="ti-file-text"
              label="Lab Results Ready"
              template="Your lab results are ready. Please log in to view them or contact us for more details."
              onClick={(t, replace) => handleQuickTemplate(t, replace)}
            />
            <TemplateButton
              icon="ti-receipt"
              label="Payment Reminder"
              template="Reminder: You have an outstanding balance of ${amount}. Please complete payment at your earliest convenience."
              onClick={(t, replace) => handleQuickTemplate(t, replace)}
            />
          </div>
        </div>

        {/* Drafts */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-file-draft" style={{ marginRight: 4 }} />
            Drafts
          </div>
          {communications.filter((c: Communication) => c.type === "draft").length === 0 ? (
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>No drafts saved.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {communications.filter((c: Communication) => c.type === "draft").map((d: Communication) => (
                <div key={d.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: 8, background: "var(--surface2)", borderRadius: "var(--radius)"
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{d.patientName}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.subject || d.message || "Empty draft"}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleLoadDraft(d)} title="Load">
                    <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                  </button>
                  {userRole !== "doctor" && (
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--red)" }} onClick={() => handleDeleteDraft(d.id)} title="Delete">
                    <i className="ti ti-trash" style={{ fontSize: 12 }} />
                  </button>
                )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled Messages */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-clock" style={{ marginRight: 4 }} />
            Scheduled
          </div>
          {scheduled.length === 0 ? (
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>No scheduled messages.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scheduled.map((s: ScheduledCommunication) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: 8, background: "var(--surface2)", borderRadius: "var(--radius)",
                  border: new Date(s.scheduledDate) <= new Date() ? "1px solid var(--amber)" : "none"
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{s.patientName}</span>
                      {new Date(s.scheduledDate) <= new Date() && (
                        <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)", fontSize: "var(--font-xs)" }}>Due now</span>
                      )}
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {s.type.toUpperCase()} · Due: {fmtDate(s.scheduledDate)}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleSendScheduled(s.id)} title="Send now">
                    <i className="ti ti-send" style={{ fontSize: 12 }} />
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--amber)" }} onClick={() => handleCancelScheduled(s.id)} title="Cancel">
                    <i className="ti ti-x" style={{ fontSize: 12 }} />
                  </button>
                  {userRole !== "doctor" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--red)" }} onClick={() => handleDeleteScheduled(s.id)} title="Delete">
                      <i className="ti ti-trash" style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log Call */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-phone" style={{ marginRight: 4 }} />
            Log Call
          </div>
          <button className="btn btn-primary" style={{ width: "100%", fontSize: "var(--font-xs)" }} onClick={() => setShowCallLogModal(true)}>
            <i className="ti ti-phone" style={{ fontSize: 12, marginRight: 4 }} />Log Call
          </button>
        </div>
      </div>
      )}

      {activeTab === "templates" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-template" style={{ marginRight: 4 }} />
              Message Templates
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {userRole !== "doctor" && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleResetTemplates}>
                  <i className="ti ti-refresh" style={{ fontSize: 11, marginRight: 4 }} />Reset Defaults
                </button>
              )}
              {userRole !== "doctor" && (
                <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => { setEditingTemplate(null); setTemplateName(""); setTemplateCategory(""); setTemplateBody(""); setShowTemplateModal(true); }}>
                  <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 4 }} />Add Template
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
            Shift+Click to replace, Click to append. Placeholders: {"{name}"}, {"{firstName}"}, {"{date}"}, {"{time}"}, {"{doctor}"}, {"{phone}"}, {"{amount}"}, {"{clinicName}"}
          </p>
          {templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-template-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No custom templates. Using defaults.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((t: Template) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{t.name}</span>
                      <span className="badge" style={{ background: "var(--surface3)", color: "var(--muted)", border: "1px solid var(--border)", fontSize: "var(--font-xs)" }}>{t.category}</span>
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.body}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={(e) => handleUseTemplate(t, e.shiftKey)} title="Use template">
                    <i className="ti ti-send" style={{ fontSize: 12 }} />
                  </button>
                  {userRole !== "doctor" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleEditTemplate(t)} title="Edit">
                      <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                    </button>
                  )}
                  {userRole !== "doctor" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleDuplicateTemplate(t)} title="Duplicate">
                      <i className="ti ti-copy" style={{ fontSize: 12 }} />
                    </button>
                  )}
                  {userRole !== "doctor" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--red)" }} onClick={() => handleDeleteTemplate(t.id)} title="Delete">
                      <i className="ti ti-trash" style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {templates.length === 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Default Templates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <TemplateButton icon="ti-calendar-check" label="Appointment Reminder"
                  template="Reminder: You have an appointment scheduled for {date} at {time}. Please arrive 15 minutes early."
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Appointment Reminder", category: "Appointment", body: t }, replace)} />
                <TemplateButton icon="ti-phone" label="Follow-up Call"
                  template="Hi {name}, this is a follow-up call regarding your recent visit. How are you feeling?"
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Follow-up Call", category: "Follow-up", body: t }, replace)} />
                <TemplateButton icon="ti-pill" label="Medication Reminder"
                  template="Reminder: Please take your medication as prescribed. Contact us if you have any questions."
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Medication Reminder", category: "Medication", body: t }, replace)} />
                <TemplateButton icon="ti-file-text" label="Lab Results Ready"
                  template="Your lab results are ready. Please log in to view them or contact us for more details."
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Lab Results Ready", category: "Lab", body: t }, replace)} />
                <TemplateButton icon="ti-receipt" label="Payment Reminder"
                  template="Reminder: You have an outstanding balance of ${amount}. Please complete payment at your earliest convenience."
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Payment Reminder", category: "Billing", body: t }, replace)} />
                <TemplateButton icon="ti-heart" label="Post-Visit Thank You"
                  template="Thank you for visiting us, {name}. We hope you're feeling well. Don't hesitate to reach out if you need anything."
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Post-Visit Thank You", category: "General", body: t }, replace)} />
                <TemplateButton icon="ti-alert-circle" label="Missed Appointment"
                  template="Hi {name}, we noticed you missed your appointment. Please call us to reschedule at your earliest convenience."
                  onClick={(t, replace) => handleUseTemplate({ id: "default", name: "Missed Appointment", category: "Appointment", body: t }, replace)} />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-history" style={{ marginRight: 4 }} />
              Communication History
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handlePrintHistory}>
                <i className="ti ti-print" style={{ fontSize: 11, marginRight: 4 }} />Print
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleExportHistoryCSV}>
                <i className="ti ti-download" style={{ fontSize: 11, marginRight: 4 }} />Export CSV
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search patient, message, notes..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ flex: 1, minWidth: 150, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            />
            <select
              value={historyFilterType}
              onChange={(e) => setHistoryFilterType(e.target.value as Communication["type"] | "")}
              style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", minWidth: 100 }}
            >
              <option value="">All Types</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="call">Call</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select
              value={historyFilterStatus}
              onChange={(e) => setHistoryFilterStatus(e.target.value as Communication["status"] | "")}
              style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", minWidth: 100 }}
            >
              <option value="">All Status</option>
              <option value="opened_sms_app">Opened SMS</option>
              <option value="opened_email_app">Opened Email</option>
              <option value="opened_whatsapp">Opened WhatsApp</option>
              <option value="logged">Logged</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            />
            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            />
            {(historySearch || historyFilterType || historyFilterStatus || historyDateFrom || historyDateTo) && (
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", padding: "8px 12px" }} onClick={() => { setHistorySearch(""); setHistoryFilterType(""); setHistoryFilterStatus(""); setHistoryDateFrom(""); setHistoryDateTo(""); }}>
                Clear
              </button>
            )}
          </div>
        {getFilteredHistory().length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
            <i className="ti ti-message-off" style={{ fontSize: 32, marginBottom: 8 }} />
            <div>No communication history found</div>
            {communications.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop: 12, fontSize: "var(--font-xs)" }} onClick={() => setActiveTab("compose")}>
                <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />Compose Message
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleHistory.map((c: Communication) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: c.type === "sms" || c.status === "opened_sms_app" ? "var(--blue-bg)" :
                           c.type === "email" || c.status === "opened_email_app" ? "var(--green-bg)" :
                           c.type === "whatsapp" || c.status === "opened_whatsapp" ? "var(--green-bg)" :
                           c.type === "call" ? "var(--amber-bg)" : "var(--surface3)",
                  color: c.type === "sms" || c.status === "opened_sms_app" ? "var(--blue)" :
                         c.type === "email" || c.status === "opened_email_app" ? "var(--green)" :
                         c.type === "whatsapp" || c.status === "opened_whatsapp" ? "var(--green)" :
                         c.type === "call" ? "var(--amber)" : "var(--muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${c.type === "sms" || c.status === "opened_sms_app" ? "ti-message" :
                                 c.type === "email" || c.status === "opened_email_app" ? "ti-mail" :
                                 c.type === "whatsapp" || c.status === "opened_whatsapp" ? "ti-brand-whatsapp" :
                                 c.type === "call" ? "ti-phone" : "ti-file"}`} style={{ fontSize: 15 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{c.patientName}</span>
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{c.type.toUpperCase()} · {fmtDate(c.date)}</span>
                    {c.followUpNeeded && (
                      <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)", fontSize: "var(--font-xs)" }}>Follow-up needed</span>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.message || c.notes || ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => { setSelectedCommunication(c); setShowDetailModal(true); }} title="View details">
                    <i className="ti ti-eye" style={{ fontSize: 12 }} />
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleDuplicateToCompose(c)} title="Duplicate to compose">
                    <i className="ti ti-copy" style={{ fontSize: 12 }} />
                  </button>
                  {c.type !== "draft" && c.type !== "scheduled" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleDuplicateToCompose(c)} title="Send again">
                      <i className="ti ti-send" style={{ fontSize: 12 }} />
                    </button>
                  )}
                  {c.followUpNeeded && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--green)" }} onClick={() => handleMarkFollowedUp(c.id)} title="Mark followed up">
                      <i className="ti ti-check" style={{ fontSize: 12 }} />
                    </button>
                  )}
                  {userRole !== "doctor" && (
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--red)" }} onClick={() => handleDeleteCommunication(c.id)} title="Delete">
                      <i className="ti ti-trash" style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {getFilteredHistory().length > 10 && (
              <button
                onClick={() => setHistoryExpanded(e => !e)}
                style={{ width: "100%", padding: "10px 0", background: "none", border: "1px dashed var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontSize: "var(--font-xs)", color: "var(--muted)" }}
              >
                {historyExpanded ? "Show less" : `Show ${getFilteredHistory().length - 10} more`}
              </button>
            )}
          </div>
        )}
        </div>
      )}

      {activeTab === "automation" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-robot" style={{ marginRight: 4 }} />
            Automation Suggestions
          </div>
          <p style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
            Patient-based suggestions for follow-ups and reminders. No background sending - actions require manual trigger.
          </p>
          {patients.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-users" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No patients to generate suggestions</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {patients.filter((p: Patient) => {
                const suggestionId = `${p.id}_followup`;
                if (dismissedSuggestions.has(suggestionId)) return false;
                const followUpDate = (p as any).followUpDate;
                return followUpDate && new Date(followUpDate) <= new Date();
              }).map((p: Patient) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--amber-bg)", borderRadius: "var(--radius)",
                  border: "1px solid var(--amber-border)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--amber)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className="ti ti-calendar" style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Follow-up due: {fmtDate((p as any).followUpDate)}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => { setSelectedPatient(p); setActiveTab("compose"); }}>
                    <i className="ti ti-send" style={{ fontSize: 12, marginRight: 4 }} />Message
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", color: "var(--red)" }} onClick={() => {
                    const next = new Set(dismissedSuggestions);
                    next.add(`${p.id}_followup`);
                    setDismissedSuggestions(next);
                    writeJSON(PREFERENCES_KEY, Array.from(next).map(id => `dismissed_${id}`));
                  }}>
                    <i className="ti ti-x" style={{ fontSize: 12 }} />
                  </button>
                </div>
              ))}
              {patients.filter((p: Patient) => {
                const suggestionId = `${p.id}_insurance`;
                if (dismissedSuggestions.has(suggestionId)) return false;
                const insuranceExpiry = (p as any).insuranceExpiry;
                return insuranceExpiry && new Date(insuranceExpiry) <= new Date();
              }).map((p: Patient) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--red-bg)", borderRadius: "var(--radius)",
                  border: "1px solid var(--red-border)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--red)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className="ti ti-shield-x" style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Insurance expired: {fmtDate((p as any).insuranceExpiry)}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => { setSelectedPatient(p); setActiveTab("compose"); }}>
                    <i className="ti ti-send" style={{ fontSize: 12, marginRight: 4 }} />Message
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", color: "var(--red)" }} onClick={() => {
                    const next = new Set(dismissedSuggestions);
                    next.add(`${p.id}_insurance`);
                    setDismissedSuggestions(next);
                    writeJSON(PREFERENCES_KEY, Array.from(next).map(id => `dismissed_${id}`));
                  }}>
                    <i className="ti ti-x" style={{ fontSize: 12 }} />
                  </button>
                </div>
              ))}
              {patients.filter((p: Patient) => {
                const suggestionId = `${p.id}_consent`;
                if (dismissedSuggestions.has(suggestionId)) return false;
                return (p as any).consentSigned === false;
              }).map((p: Patient) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)",
                  border: "1px solid var(--border)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--muted)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className="ti ti-file-off" style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Consent not signed</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => { setSelectedPatient(p); setActiveTab("compose"); }}>
                    <i className="ti ti-send" style={{ fontSize: 12, marginRight: 4 }} />Message
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => {
                    const next = new Set(dismissedSuggestions);
                    next.add(`${p.id}_consent`);
                    setDismissedSuggestions(next);
                    writeJSON(PREFERENCES_KEY, Array.from(next).map(id => `dismissed_${id}`));
                  }}>
                    <i className="ti ti-x" style={{ fontSize: 12 }} />
                  </button>
                </div>
              ))}
              {patients.filter((p: Patient) => {
                const suggestionId = `${p.id}_appointment`;
                if (dismissedSuggestions.has(suggestionId)) return false;
                const nextAppointment = (p as any).nextAppointment;
                return nextAppointment && new Date(nextAppointment) <= new Date(Date.now() + 24 * 60 * 60 * 1000);
              }).map((p: Patient) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--blue-bg)", borderRadius: "var(--radius)",
                  border: "1px solid var(--blue-border)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--blue)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className="ti ti-calendar-check" style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Appointment: {fmtDate((p as any).nextAppointment)}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => { setSelectedPatient(p); setActiveTab("compose"); }}>
                    <i className="ti ti-send" style={{ fontSize: 12, marginRight: 4 }} />Message
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => {
                    const next = new Set(dismissedSuggestions);
                    next.add(`${p.id}_appointment`);
                    setDismissedSuggestions(next);
                    writeJSON(PREFERENCES_KEY, Array.from(next).map(id => `dismissed_${id}`));
                  }}>
                    <i className="ti ti-x" style={{ fontSize: 12 }} />
                  </button>
                </div>
              ))}
              {patients.filter((p: Patient) => {
                const suggestionId = `${p.id}_followup`;
                const suggestionId2 = `${p.id}_insurance`;
                const suggestionId3 = `${p.id}_consent`;
                const suggestionId4 = `${p.id}_appointment`;
                return !dismissedSuggestions.has(suggestionId) && !dismissedSuggestions.has(suggestionId2) && !dismissedSuggestions.has(suggestionId3) && !dismissedSuggestions.has(suggestionId4) &&
                       !(p as any).followUpDate &&
                       !((p as any).insuranceExpiry && new Date((p as any).insuranceExpiry) <= new Date()) &&
                       (p as any).consentSigned !== false &&
                       !((p as any).nextAppointment && new Date((p as any).nextAppointment) <= new Date(Date.now() + 24 * 60 * 60 * 1000));
              }).length === patients.length && (
                <div style={{ textAlign: "center", padding: 32, color: "var(--green)" }}>
                  <i className="ti ti-check-circle" style={{ fontSize: 32, marginBottom: 8 }} />
                  <div>No pending suggestions</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateButton({ icon, label, template, onClick }: {
  icon: string;
  label: string;
  template: string;
  onClick: (t: string, replace: boolean) => void;
}) {
  return (
    <button
      onClick={(e) => onClick(template, e.shiftKey)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)",
        border: "none", cursor: "pointer", textAlign: "left", width: "100%",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface3)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16, color: "var(--accent)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{template}</div>
      </div>
      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--muted)", flexShrink: 0 }} />
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
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function AutomationRule({ title, description, enabled: initialEnabled, type }: {
  title: string;
  description: string;
  enabled: boolean;
  type: "sms" | "email";
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)",
      border: "1px solid var(--border)"
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: type === "sms" ? "var(--blue-bg)" : "var(--green-bg)",
        color: type === "sms" ? "var(--blue)" : "var(--green)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ${type === "sms" ? "ti-message" : "ti-mail"}`} style={{ fontSize: 16 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{description}</div>
      </div>
      <div
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled(e => !e)}
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: enabled ? "var(--green)" : "var(--gray)",
          position: "relative", cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "#fff",
          position: "absolute", top: 2,
          left: enabled ? 22 : 2,
          transition: "left 0.15s",
        }} />
      </div>
    </div>
  );
}

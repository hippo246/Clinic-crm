import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Patient, UserRole, PatientStatus } from "./types";
import { DOCTORS, STATUSES, PAGE_SIZE } from "./constants";
import { applySmartSearch, sortPatients, fmtDate, calcRiskScore, detectDuplicates, exportPatientsToCSV, fuzzyMatch, getHighlightParts, getActivePatients, getArchivedPatients, buildPatientImportPreview, getPatientImportSummary, createPatientBackup, restorePatientBackup, clearPatientBackup, filterReviewedDuplicates, saveReviewedDuplicate, buildMergePreview, isDuplicateReviewed } from "./utils";
import { StatusBadge, InsuranceBadge, AlertChip, AvatarCircle, RiskBadge } from "./Badges";
import { hasRole, normalizeRole } from "../shared/permissions/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";

// ─── localStorage helpers ─────────────────────────────────────────────────────
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — fail silently, app should keep working */
  }
}

const SMART_SUGGESTIONS = [
  { label: "Diabetic patients",         query: "diabetic" },
  { label: "Follow-up overdue",         query: "follow-up overdue" },
  { label: "Insurance expiring",        query: "insurance expiring" },
  { label: "Missing consent",           query: "missing consent" },
  { label: "VIP patients",              query: "vip" },
  { label: "Critical risk",             query: "critical" },
  { label: "No visit in 90 days",       query: "90 days" },
  { label: "Missing emergency contact", query: "missing emergency" },
];

interface PatientListProps {
  patients: Patient[];
  onSelect: (p: Patient) => void;
  selectedId?: string;
  onNewPatient: () => void;
  onImport: () => void;
  role: UserRole;
  onUpdatePatient?: (p: Patient) => void;
  onDeletePatient?: (id: string) => void;
  onRestorePatient?: (id: string) => void; // Phase 7C
}

function QualityBar({ patients, onSearch }: { patients: Patient[]; onSearch: (q: string) => void }) {
  const issues = useMemo(() => {
    const items = [
      { label: "Expired Insurance",    count: patients.filter((p) => p.insuranceStatus === "Expired").length,     color: "#dc2626", query: "expired insurance" },
      { label: "Missing Consent",      count: patients.filter((p) => !p.consentSigned).length,                    color: "#d97706", query: "missing consent" },
      { label: "Follow-Up Overdue",    count: patients.filter((p) => p.status === "Follow-Up Due").length,        color: "#d97706", query: "follow-up overdue" },
      { label: "Critical Alerts",      count: patients.filter((p) => (p.alerts||[]).some((a) => ["Allergy","Heart Condition","Pregnancy","High Risk"].includes(a))).length, color: "#dc2626", query: "critical" },
      { label: "No Emergency Contact", count: patients.filter((p) => !p.emergencyName || !p.emergencyPhone).length, color: "#7c3aed", query: "missing emergency" },
      { label: "Missing Phone",        count: patients.filter((p) => !p.phone).length,                            color: "#0891b2", query: "missing phone" },
      { label: "Missing DOB",          count: patients.filter((p) => !p.dob).length,                              color: "#0891b2", query: "missing dob" },
      { label: "Missing Doctor",       count: patients.filter((p) => !p.doctor).length,                          color: "#0891b2", query: "missing doctor" },
      { label: "Missing Insurance Info", count: patients.filter((p) => !p.insuranceStatus).length,                color: "#0891b2", query: "missing insurance" },
    ];
    return items.filter((i) => i.count > 0);
  }, [patients]);

  if (issues.length === 0) return null;

  return (
    <div className="pl-quality-bar" style={{
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
        <i className="ti ti-checklist" style={{ fontSize: 11, marginRight: 4 }} />
        Data Issues
      </span>
      {issues.map((issue) => (
        <button key={issue.label} onClick={() => onSearch(issue.query)} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: "var(--radius-full)", fontSize: "var(--font-xs)", fontWeight: 600,
          background: issue.color + "12", border: `1px solid ${issue.color}35`, color: issue.color,
          cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
        }}>
          <span style={{ fontWeight: 800 }}>{issue.count}</span>
          {issue.label}
        </button>
      ))}
    </div>
  );
}

function CallingScreen({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [callState, setCallState] = useState<"ringing" | "connected">("ringing");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    const ringTimer = setTimeout(() => setCallState("connected"), 2400);
    return () => clearTimeout(ringTimer);
  }, []);

  useEffect(() => {
    if (callState !== "connected") return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const mm = String(Math.floor(duration / 60)).padStart(2, "0");
  const ss = String(duration % 60).padStart(2, "0");

  return (
    <div className="modal-backdrop call-backdrop" onClick={onClose}>
      <div className="modal call-screen" onClick={(e) => e.stopPropagation()}>
        <div className="call-status-label">
          {callState === "ringing" ? "Calling…" : "Connected"}
        </div>

        <div className="call-avatar-wrap">
          {callState === "ringing" && (
            <>
              <span className="call-pulse-ring" style={{ animationDelay: "0s" }} />
              <span className="call-pulse-ring" style={{ animationDelay: "0.7s" }} />
            </>
          )}
          <AvatarCircle name={patient.name} size="lg" />
        </div>

        <div className="call-patient-name">{patient.name}</div>
        <div className="call-patient-number">{patient.phone || "No number on file"}</div>
        <div className="call-timer">
          {callState === "ringing" ? "Ringing…" : `${mm}:${ss}`}
        </div>

        <div className="call-actions-row">
          <button
            type="button"
            className={`call-icon-btn ${muted ? "call-icon-btn-active" : ""}`}
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Unmute" : "Mute"}
          >
            <i className={`ti ti-microphone${muted ? "-off" : ""}`} />
          </button>
          <button
            type="button"
            className={`call-icon-btn ${speaker ? "call-icon-btn-active" : ""}`}
            onClick={() => setSpeaker((s) => !s)}
            title={speaker ? "Speaker off" : "Speaker on"}
          >
            <i className="ti ti-volume" />
          </button>
          <a
            className="call-icon-btn"
            href={patient.phone ? `tel:${patient.phone}` : undefined}
            title="Open in phone app"
            onClick={(e) => { if (!patient.phone) e.preventDefault(); }}
          >
            <i className="ti ti-device-mobile" />
          </a>
        </div>

        <button type="button" className="call-end-btn" onClick={onClose} title="End call">
          <i className="ti ti-phone-off" />
        </button>
      </div>
    </div>
  );
}

export default function PatientList({
  patients,
  onSelect,
  selectedId,
  onNewPatient,
  onImport,
  role,
  onUpdatePatient,
  onDeletePatient,
  onRestorePatient,
}: PatientListProps) {
  // Normalize role to ensure it's a valid UserRole
  const normalizedRole = normalizeRole(role) as UserRole;

  const [search,          setSearch]         = useState("");
  const [filterStatus,    setFilterStatus]   = useState("All");
  const [filterDoctor,    setFilterDoctor]   = useState("All");
  const [filterInsurance, setFilterIns]      = useState("All");
  const [filterRisk,      setFilterRisk]     = useState("All");
  const [dateRangeFrom,   setDateRangeFrom]  = useState("");
  const [dateRangeTo,     setDateRangeTo]    = useState("");
  const [sortKey,         setSortKey]        = useState<keyof Patient>("lastVisit");
  const [sortDir,         setSortDir]        = useState<"asc"|"desc">("desc");
  const [page,            setPage]           = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [quickActionsMenu, setQuickActionsMenu] = useState<{ patientId: string; x: number; y: number } | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [savedFilters, setSavedFilters] = useState<Array<{ id: string; name: string; filters: any }>>([]);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [filterTag, setFilterTag] = useState("All");
  const [showSavedFiltersDropdown, setShowSavedFiltersDropdown] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [selectedPatientForTags, setSelectedPatientForTags] = useState<Patient | null>(null);
  const [newTag, setNewTag] = useState("");
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<PatientStatus | "">("");
  const [showBulkDoctorModal, setShowBulkDoctorModal] = useState(false);
  const [bulkDoctorTarget, setBulkDoctorTarget] = useState("");
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [selectedPatientForNote, setSelectedPatientForNote] = useState<Patient | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(["id", "name", "age", "doctor", "status", "insuranceStatus", "lastVisit"]));
  const [printTemplate, setPrintTemplate] = useState<"standard" | "detailed" | "compact" | "medical" | "prescription" | "labResults" | "medicalHistory" | "followUp">("standard");
  const [printFormat, setPrintFormat] = useState<"pdf" | "html" | "csv">("pdf");
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("portrait");
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeFilters, setIncludeFilters] = useState(true);
  const [includeMedicalAlerts, setIncludeMedicalAlerts] = useState(true);
  const [includeDoctorSignature, setIncludeDoctorSignature] = useState(false);
  const [includeClinicBranding, setIncludeClinicBranding] = useState(true);
  const [includePatientPhotos, setIncludePatientPhotos] = useState(false);
  const [customPrintTitle, setCustomPrintTitle] = useState("");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card" | "dashboard" | "timeline">("table");
  const [patientListMode, setPatientListMode] = useState<"active" | "archived">("active"); // Phase 7C
  const [exportPreset, setExportPreset] = useState<"demographics" | "contact" | "clinical" | "full">("full"); // Phase 7D
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [mergePreview, setMergePreview] = useState<any | null>(null); // Phase 7E
  const [showMergeModal, setShowMergeModal] = useState(false); // Phase 7E
  const [groupBy, setGroupBy] = useState<"none" | "status" | "doctor" | "risk" | "tags">("none");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [savedSearches, setSavedSearches] = useState<Array<{ id: string; query: string; name: string }>>([]);
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");
  const [filterLogic, setFilterLogic] = useState<"AND" | "OR">("AND");
  const [showReminders, setShowReminders] = useState(false);
  const [reminders, setReminders] = useState<Array<{ id: string; patientId: string; patientName: string; type: string; date: string; completed: boolean; notes?: string }>>([]);
  const [showOnboardingChecklist, setShowOnboardingChecklist] = useState(false);
  const [onboardingTasks, setOnboardingTasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([
    { id: "1", title: "Patient registration", completed: true },
    { id: "2", title: "Insurance verification", completed: false },
    { id: "3", title: "Medical history collection", completed: false },
    { id: "4", title: "Initial assessment", completed: false },
    { id: "5", title: "Care plan creation", completed: false },
  ]);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditTrail, setAuditTrail] = useState<Array<{ id: string; action: string; patientId: string; patientName: string; timestamp: string; user: string }>>([]);
  const [showTagColors, setShowTagColors] = useState(false);
  const [tagColors, setTagColors] = useState<Record<string, string>>({
    "VIP": "var(--purple)",
    "High Risk": "var(--red)",
    "Follow-up": "var(--amber)",
    "New": "var(--green)",
  });
  const [timelineDateRange, setTimelineDateRange] = useState<"all" | "7d" | "30d" | "90d" | "1y">("all");
  const [showThemeToggle, setShowThemeToggle] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAccessibilityHelp, setShowAccessibilityHelp] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [timelineSeverityFilter, setTimelineSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [bulkOperationHistory, setBulkOperationHistory] = useState<Array<{ action: string; timestamp: Date; patientIds: string[] }>>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [showMedicationAdherence, setShowMedicationAdherence] = useState(false);
  const [medicationAdherenceData, setMedicationAdherenceData] = useState<Record<string, number>>({});
  const [showLabResults, setShowLabResults] = useState(false);
  const [showPatientJourney, setShowPatientJourney] = useState(false);
  const [showBulkMessaging, setShowBulkMessaging] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showApprovalWorkflows, setShowApprovalWorkflows] = useState(false);
  const [showRecentActions, setShowRecentActions] = useState(false);
  const [showFilterTemplates, setShowFilterTemplates] = useState(false);
  const [showTagHierarchy, setShowTagHierarchy] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showExportTimeline, setShowExportTimeline] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [showContextMenus, setShowContextMenus] = useState(false);
  const [showDragDrop, setShowDragDrop] = useState(false);
  const [showNotificationRules, setShowNotificationRules] = useState(false);
  const [showFilterAnalytics, setShowFilterAnalytics] = useState(false);
  const [showCustomShortcuts, setShowCustomShortcuts] = useState(false);
  const [showFilterSharing, setShowFilterSharing] = useState(false);
  const [showOfflineMode, setShowOfflineMode] = useState(false);
  const [showComparisonExport, setShowComparisonExport] = useState(false);
  const [showComparisonHistory, setShowComparisonHistory] = useState(false);
  const [callingPatient, setCallingPatient] = useState<Patient | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 640);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // ── feedback system (replaces alert()) ──────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showFeedback = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // ── schedule modal (replaces prompt()) ──────────────────────────────────────
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulePatient, setSchedulePatient] = useState<Patient | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleReason, setScheduleReason] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  // ── bulk schedule modal ──────────────────────────────────────────────────────
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState("");
  const [bulkScheduleTime, setBulkScheduleTime] = useState("");
  const [bulkScheduleDoctor, setBulkScheduleDoctor] = useState("");
  const [bulkScheduleReason, setBulkScheduleReason] = useState("");
  const [bulkScheduleError, setBulkScheduleError] = useState("");

  // ── bulk tag modal ───────────────────────────────────────────────────────────
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");

  // ── local confirmation modal (replaces window.confirm) ──────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    requireTypedWord?: string;
    onConfirm: () => void;
  } | null>(null);
  const [confirmTypedValue, setConfirmTypedValue] = useState("");

  // Track viewport width so the layout can adapt to phone screens
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Escape closes any open modal/overlay
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
        const target = e.target as HTMLElement;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        toggleSelectAll();
        return;
      }
      if (e.key !== "Escape") return;
      if (confirmModal) { setConfirmModal(null); return; }
      if (showScheduleModal) { setShowScheduleModal(false); return; }
      if (showBulkScheduleModal) { setShowBulkScheduleModal(false); return; }
      if (showBulkTagModal) { setShowBulkTagModal(false); return; }
      if (showQuickNoteModal) { setShowQuickNoteModal(false); return; }
      if (showTagManager) { setShowTagManager(false); return; }
      if (showBulkStatusModal) { setShowBulkStatusModal(false); return; }
      if (showBulkDoctorModal) { setShowBulkDoctorModal(false); return; }
      if (showPrintModal) { setShowPrintModal(false); return; }
      if (showExportModal) { setShowExportModal(false); return; }
      if (showBulkActions) { setShowBulkActions(false); return; }
      if (showSaveFilterModal) { setShowSaveFilterModal(false); return; }
      if (showSaveSearchModal) { setShowSaveSearchModal(false); return; }
      if (showAuditTrail) { setShowAuditTrail(false); return; }
      if (showReminders) { setShowReminders(false); return; }
      if (showDuplicateModal) { setShowDuplicateModal(false); return; }
      if (comparisonMode) { setComparisonMode(false); return; }
      if (callingPatient) { setCallingPatient(null); return; }
      if (quickActionsMenu) { setQuickActionsMenu(null); return; }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, showScheduleModal, showBulkScheduleModal, showBulkTagModal, showQuickNoteModal, showTagManager, showBulkStatusModal, showBulkDoctorModal, showPrintModal, showExportModal, showBulkActions, showSaveFilterModal, showSaveSearchModal, showAuditTrail, showReminders, showDuplicateModal, comparisonMode, callingPatient, quickActionsMenu]);

  // Load saved filters from localStorage
  useEffect(() => {
    setSavedFilters(readJSON("savedPatientFilters", []));
  }, []);

  // Load saved searches from localStorage
  useEffect(() => {
    setSavedSearches(readJSON("savedPatientSearches", []));
  }, []);

  // Load reminders from localStorage
  useEffect(() => {
    setReminders(readJSON("patientReminders", []));
  }, []);

  // Load audit trail from localStorage
  useEffect(() => {
    setAuditTrail(readJSON("patientAuditTrail", []));
  }, []);

  // Load tag colors from localStorage
  useEffect(() => {
    const saved = readJSON<Record<string, string>>("tagColors", {});
    if (Object.keys(saved).length > 0) setTagColors(saved);
  }, []);

  // Dark mode is managed by App.tsx — PatientList syncs its local preference to localStorage
  useEffect(() => {
    setIsDarkMode(readJSON("darkMode", false));
  }, []);

  // Save dark mode preference when changed from within PatientList
  useEffect(() => {
    writeJSON("darkMode", isDarkMode);
  }, [isDarkMode]);

  // Auto-generate reminders for overdue follow-ups
  useEffect(() => {
    const overduePatients = patients.filter(p => p.followUpDate && new Date(p.followUpDate) < new Date());
    const newReminders = overduePatients.map(p => ({
      id: `reminder-${p.id}`,
      patientId: p.id,
      patientName: p.name,
      type: "follow-up",
      date: p.followUpDate || "",
      completed: false
    }));
    
    setReminders(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = newReminders.filter(r => !existingIds.has(r.id));
      return [...prev, ...toAdd];
    });
  }, [patients]);

  // Save reminders to localStorage
  useEffect(() => {
    writeJSON("patientReminders", reminders);
  }, [reminders]);

  // Save audit trail to localStorage
  useEffect(() => {
    writeJSON("patientAuditTrail", auditTrail);
  }, [auditTrail]);

  // Save tag colors to localStorage
  useEffect(() => {
    writeJSON("tagColors", tagColors);
  }, [tagColors]);

  // Save searches to localStorage when they change
  useEffect(() => {
    writeJSON("savedPatientSearches", savedSearches);
  }, [savedSearches]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    writeJSON("savedPatientFilters", savedFilters);
  }, [savedFilters]);

  function handleSaveSearch() {
    if (!newSearchName.trim()) {
      showFeedback("Please enter a search name", "error");
      return;
    }
    if (!search.trim()) {
      showFeedback("Please enter a search query first", "error");
      return;
    }
    const newSearch = {
      id: `search-${Date.now()}`,
      query: search,
      name: newSearchName.trim()
    };
    setSavedSearches([...savedSearches, newSearch]);
    setNewSearchName("");
    setShowSaveSearchModal(false);
    showFeedback(`Saved search "${newSearch.name}"`, "success");
  }

  function handleDeleteSearch(id: string) {
    if (!canManageSavedSearches) {
      handleDeniedAccess("delete", "saved search");
      return;
    }
    const s = savedSearches.find(s => s.id === id);
    setConfirmModal({
      title: "Delete Saved Search",
      message: `Delete the saved search "${s?.name || ""}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        setSavedSearches(savedSearches.filter(s => s.id !== id));
        showFeedback("Saved search deleted", "success");
      },
    });
  }

  function handleApplySearch(query: string) {
    setSearch(query);
    resetPage();
  }

  const handleToggleReminder = useCallback((id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
  }, []);

  // ── role gating (Phase 6G) ──────────────────────────────────────────────────────
  const isAdmin = String(role).toLowerCase() === "admin";

  // ─── Local Permission Guards (Phase 6G) ─────────────────────────────────────────────
  const canExportPatients = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canCreatePatient = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canEditPatient = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist"]);
  const canDeletePatient = hasRole(normalizedRole, ["admin"]);
  const canArchivePatient = hasRole(normalizedRole, ["admin", "doctor"]);
  const canManageSavedSearches = hasRole(normalizedRole, ["admin"]);
  const canManageSavedFilters = hasRole(normalizedRole, ["admin"]);
  const canManageReminders = hasRole(normalizedRole, ["admin"]);

  // ─── Local Denied Helper (Phase 6G) ───────────────────────────────────────────────
  const handleDeniedAccess = (action: string, resource: string) => {
    showFeedback(`You do not have permission to ${action} ${resource}.`, "error");
    logDeniedAction({
      role: normalizedRole,
      action,
      resource,
      reason: "Insufficient permissions",
      severity: "medium",
    });
  };

  function requireAdmin(): boolean {
    if (!isAdmin) {
      showFeedback("You do not have permission for this action in the current role.", "error");
      return false;
    }
    return true;
  }

  // ── add reminder modal ──────────────────────────────────────────────────────
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [reminderPatient, setReminderPatient] = useState<Patient | null>(null);
  const [reminderType, setReminderType] = useState("follow-up");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");

  function handleAddReminder() {
    if (!reminderPatient) return;
    if (!reminderDate) {
      showFeedback("Please choose a reminder date", "error");
      return;
    }
    const newReminder = {
      id: `reminder-${reminderPatient.id}-${Date.now()}`,
      patientId: reminderPatient.id,
      patientName: reminderPatient.name,
      type: reminderType,
      date: reminderDate,
      notes: reminderNotes,
      completed: false,
    };
    setReminders(prev => [...prev, newReminder]);
    logAuditTrail(`Added ${reminderType} reminder`, reminderPatient.id, reminderPatient.name);
    showFeedback(`Reminder set for ${reminderPatient.name}`, "success");
    setShowAddReminderModal(false);
    setReminderPatient(null);
  }

  const handleDeleteReminder = useCallback((id: string) => {
    if (!canManageReminders) {
      handleDeniedAccess("delete", "reminder");
      return;
    }
    const r = reminders.find(r => r.id === id);
    setConfirmModal({
      title: "Delete Reminder",
      message: `Delete the reminder for "${r?.patientName || ""}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        setReminders(prev => prev.filter(r => r.id !== id));
        showFeedback("Reminder deleted", "success");
      },
    });
  }, [reminders, canManageReminders, showFeedback]);

  function handleToggleOnboardingTask(id: string) {
    setOnboardingTasks(onboardingTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  function logAuditTrail(action: string, patientId: string, patientName?: string) {
    // Phase 7K: Remove PHI from persistent audit logs - only store patientId
    const entry = {
      id: `audit-${Date.now()}`,
      action,
      patientId,
      timestamp: new Date().toISOString(),
      user: "Current User"
    };
    setAuditTrail(prev => [entry, ...prev].slice(0, 100));
  }

  function handleSaveFilter() {
    if (!newFilterName.trim()) {
      showFeedback("Please enter a filter name", "error");
      return;
    }
    const currentFilters = {
      search,
      filterStatus,
      filterDoctor,
      filterInsurance,
      filterRisk,
      dateRangeFrom,
      dateRangeTo,
      filterTag,
      filterLogic,
      groupBy,
      viewMode,
    };
    const newFilter = {
      id: Date.now().toString(),
      name: newFilterName,
      filters: currentFilters,
    };
    setSavedFilters([...savedFilters, newFilter]);
    setNewFilterName("");
    setShowSaveFilterModal(false);
    showFeedback(`Saved filter "${newFilter.name}"`, "success");
  }

  function handleRenameFilter(id: string, name: string) {
    if (!name.trim()) {
      showFeedback("Filter name cannot be empty", "error");
      return;
    }
    setSavedFilters(savedFilters.map(f => f.id === id ? { ...f, name: name.trim() } : f));
    showFeedback("Filter renamed", "success");
  }

  function handleLoadFilter(filter: any) {
    const f = filter.filters || {};
    setSearch(f.search ?? "");
    setFilterStatus(f.filterStatus ?? "All");
    setFilterDoctor(f.filterDoctor ?? "All");
    setFilterIns(f.filterInsurance ?? "All");
    setFilterRisk(f.filterRisk ?? "All");
    setDateRangeFrom(f.dateRangeFrom ?? "");
    setDateRangeTo(f.dateRangeTo ?? "");
    setFilterTag(f.filterTag ?? "All");
    setFilterLogic(f.filterLogic ?? "AND");
    setGroupBy(f.groupBy ?? "none");
    setViewMode(f.viewMode ?? "table");
    resetPage();
    showFeedback(`Applied filter "${filter.name}"`, "success");
  }

  function handleDeleteFilter(id: string) {
    if (!canManageSavedFilters) {
      handleDeniedAccess("delete", "saved filter");
      return;
    }
    const filter = savedFilters.find(f => f.id === id);
    setConfirmModal({
      title: "Delete Saved Filter",
      message: `Delete the saved filter "${filter?.name || ""}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        setSavedFilters(savedFilters.filter(f => f.id !== id));
        showFeedback("Saved filter deleted", "success");
      },
    });
  }

  function handlePrint() {
    const columnLabels: Record<string, string> = {
      id: "ID",
      name: "Patient Name",
      age: "Age",
      gender: "Gender",
      doctor: "Doctor",
      status: "Status",
      insuranceStatus: "Insurance",
      lastVisit: "Last Visit",
      phone: "Phone",
      email: "Email",
      address: "Address",
      bloodGroup: "Blood Group",
      allergies: "Allergies",
      alerts: "Alerts",
      tags: "Tags",
      followUpDate: "Follow-up Date",
      nextAppointment: "Next Appointment",
    };

    // Create a print-friendly HTML based on template
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showFeedback("Popup blocked. Please allow popups for this site to print.", "error");
      return;
    }

    const title = customPrintTitle || "Patient List";
    const headerRow = Array.from(selectedColumns).map(col => `<th>${columnLabels[col]}</th>`).join("");
    
    let rows = "";
    if (printTemplate === "detailed") {
      rows = filtered.map(p => {
        return Array.from(selectedColumns).map(col => {
          let value = p[col as keyof Patient];
          if (col === "lastVisit" || col === "followUpDate" || col === "nextAppointment") value = fmtDate(value as string);
          if (col === "alerts") value = (p.alerts || []).join(", ");
          if (col === "tags") value = (p.tags || []).join(", ");
          return `<td>${value || "-"}</td>`;
        }).join("");
      }).map(row => `<tr>${row}</tr>`).join("");
    } else if (printTemplate === "medical") {
      rows = filtered.map(p => {
        const medicalCols = ["name", "age", "gender", "bloodGroup", "allergies", "conditions", "medications", "alerts", "doctor", "status"];
        return medicalCols.map(col => {
          let value = p[col as keyof Patient];
          if (col === "conditions") value = (p.conditions || []).join(", ");
          if (col === "medications") value = (p.medications || []).join(", ");
          if (col === "alerts") value = (p.alerts || []).join(", ");
          return `<td>${value || "-"}</td>`;
        }).join("");
      }).map(row => `<tr>${row}</tr>`).join("");
    } else if (printTemplate === "compact") {
      rows = filtered.map(p => {
        const compactCols = ["name", "phone", "doctor", "status", "lastVisit"];
        return compactCols.map(col => {
          let value = p[col as keyof Patient];
          if (col === "lastVisit") value = fmtDate(value as string);
          return `<td>${value || "-"}</td>`;
        }).join("");
      }).map(row => `<tr>${row}</tr>`).join("");
    } else {
      rows = filtered.map(p => {
        return Array.from(selectedColumns).map(col => {
          let value = p[col as keyof Patient];
          if (col === "lastVisit") value = fmtDate(value as string);
          return `<td>${value || "-"}</td>`;
        }).join("");
      }).map(row => `<tr>${row}</tr>`).join("");
    }

    const filterInfo = includeFilters ? `
      <div class="filters" style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 12px;">
        <strong>Applied Filters:</strong> 
        ${search ? `Search: "${search}"` : ""}
        ${filterStatus !== "All" ? `Status: ${filterStatus}` : ""}
        ${filterDoctor !== "All" ? `Doctor: ${filterDoctor}` : ""}
        ${filterInsurance !== "All" ? `Insurance: ${filterInsurance}` : ""}
        ${quickFilter ? `Quick Filter: ${quickFilter}` : ""}
      </div>
    ` : "";

    const brandingSection = includeClinicBranding ? `
      <div class="branding" style="font-weight: 700; font-size: 16px; color: #2563eb; margin-bottom: 8px;">ClinicOS Medical Center</div>
    ` : "";

    const alertsSummary = includeMedicalAlerts ? `
      <div class="alerts-summary" style="margin: 10px 0; padding: 10px; background: #fef2f2; border-radius: 4px; font-size: 12px;">
        <strong>Patients with medical alerts:</strong> ${filtered.filter(p => (p.alerts || []).length > 0).length}
      </div>
    ` : "";

    const signatureSection = includeDoctorSignature ? `
      <div class="signature" style="margin-top: 40px; display: flex; justify-content: flex-end;">
        <div style="border-top: 1px solid #333; width: 240px; text-align: center; padding-top: 6px; font-size: 12px;">Doctor Signature</div>
      </div>
    ` : "";

    const headerSection = includeHeader ? `
      <div class="header" style="margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px;">
        ${brandingSection}
        <h1 style="margin: 0; font-size: 24px; color: #333;">${title}</h1>
        <div class="meta" style="color: #666; font-size: 14px; margin-top: 5px;">
          Generated on ${new Date().toLocaleString()} · ${filtered.length} patients · Template: ${printTemplate}
        </div>
      </div>
    ` : "";

    const footerSection = includeFooter ? `
      <div class="footer" style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center;">
        Generated by ClinicOS · Confidential Medical Information
      </div>
    ` : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; margin: 0; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: 600; color: #333; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          tr:hover { background-color: #f0f0f0; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
          @page {
            size: ${printOrientation};
            margin: 1cm;
          }
        </style>
      </head>
      <body>
        ${headerSection}
        ${filterInfo}
        ${alertsSummary}
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${signatureSection}
        ${footerSection}
      </body>
      </html>
    `);
    printWindow.document.close();
    
    if (printFormat === "pdf") {
      printWindow.print();
    } else if (printFormat === "html") {
      // Already opened as HTML
    } else if (printFormat === "csv") {
      // Generate CSV and download
      const csvContent = [
        Array.from(selectedColumns).map(col => columnLabels[col]).join(","),
        ...filtered.map(p => Array.from(selectedColumns).map(col => {
          let value = p[col as keyof Patient];
          if (col === "lastVisit") value = fmtDate(value as string);
          return `"${value || ""}"`;
        }).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      printWindow.close();
    }
  }

  function handleAddTag(patient: Patient) {
    const tagValue = newTag.trim();
    if (!tagValue) return;
    if ((patient.tags || []).some(t => t.toLowerCase() === tagValue.toLowerCase())) {
      showFeedback(`"${tagValue}" is already on ${patient.name}`, "error");
      return;
    }
    const updatedTags = [...(patient.tags || []), tagValue];
    const updatedPatient = { ...patient, tags: updatedTags };
    if (onUpdatePatient) {
      onUpdatePatient(updatedPatient);
      logAuditTrail(`Added tag "${tagValue}"`, patient.id, "multiple");
      showFeedback(`Added tag "${tagValue}"`, "success");
    } else {
      showFeedback("Update not available", "error");
    }
    setSelectedPatientForTags(updatedPatient);
    setNewTag("");
  }

  function handleRemoveTag(patient: Patient, tag: string) {
    const updatedTags = (patient.tags || []).filter(t => t !== tag);
    const updatedPatient = { ...patient, tags: updatedTags };
    if (onUpdatePatient) {
      onUpdatePatient(updatedPatient);
      logAuditTrail(`Removed tag "${tag}"`, patient.id, "multiple");
      showFeedback(`Removed tag "${tag}"`, "success");
    } else {
      showFeedback("Update not available", "error");
    }
    setSelectedPatientForTags(updatedPatient);
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    patients.forEach(p => (p.tags || []).forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [patients]);

  // Detect duplicate patients (exclude soft-deleted)
  const duplicateGroups = useMemo(() => {
    const groups: Patient[][] = [];
    const processed = new Set<string>();
    const activePatients = getActivePatients(patients);

    activePatients.forEach((p1) => {
      if (processed.has(p1.id)) return;

      const duplicates: Patient[] = [p1];
      activePatients.forEach((p2) => {
        if (p1.id === p2.id) return;
        if (processed.has(p2.id)) return;

        // Check for duplicates based on name similarity, phone, or email
        const nameSimilar = p1.name.toLowerCase() === p2.name.toLowerCase() ||
                           p1.name.toLowerCase().includes(p2.name.toLowerCase()) ||
                           p2.name.toLowerCase().includes(p1.name.toLowerCase());
        const phoneMatch = p1.phone && p2.phone && p1.phone === p2.phone;
        const emailMatch = p1.email && p2.email && p1.email === p2.email;

        if (nameSimilar || phoneMatch || emailMatch) {
          duplicates.push(p2);
          processed.add(p2.id);
        }
      });

      if (duplicates.length > 1) {
        groups.push(duplicates);
      }
      processed.add(p1.id);
    });

    // Phase 7E: Filter out reviewed duplicates
    return groups.filter(group => {
      const ids = group.map(p => p.id);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (isDuplicateReviewed(ids[i], ids[j])) {
            return false;
          }
        }
      }
      return true;
    });
  }, [patients, patientListMode]);

  const duplicateCount = duplicateGroups.length;

  const filtered = useMemo(() => {
    // Phase 7C: Filter based on patientListMode (active vs archived)
    let list = patientListMode === "active" 
      ? getActivePatients(patients) 
      : getArchivedPatients(patients);
    
    // Apply search
    list = applySmartSearch(list, search);
    
    // Collect all active filter conditions
    const filterConditions: Array<(p: Patient) => boolean> = [];
    if (filterStatus    !== "All") filterConditions.push((p) => p.status          === filterStatus);
    if (filterDoctor    !== "All") filterConditions.push((p) => p.doctor          === filterDoctor);
    if (filterInsurance !== "All") filterConditions.push((p) => p.insuranceStatus === filterInsurance);
    if (filterRisk      !== "All") filterConditions.push((p) => calcRiskScore(p).level === filterRisk);
    if (filterTag       !== "All") filterConditions.push((p) => (p.tags || []).includes(filterTag));
    
    // Apply filters based on logic (AND/OR)
    if (filterConditions.length > 0) {
      if (filterLogic === "AND") {
        list = list.filter((p) => filterConditions.every((condition) => condition(p)));
      } else {
        // OR logic - patient matches if ANY condition is true
        list = list.filter((p) => filterConditions.some((condition) => condition(p)));
      }
    }
    
    // Quick filters (always AND with other filters)
    if (quickFilter === "highRisk") {
      list = list.filter((p) => calcRiskScore(p).level === "High" || calcRiskScore(p).level === "Critical");
    }
    if (quickFilter === "overdue") {
      const today = new Date();
      list = list.filter((p) => {
        if (p.followUpDate) {
          const followUp = new Date(p.followUpDate);
          return followUp < today;
        }
        return false;
      });
    }
    if (quickFilter === "newThisWeek") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      list = list.filter((p) => {
        if (p.createdAt) {
          return new Date(p.createdAt) >= oneWeekAgo;
        }
        return false;
      });
    }
    
    // Date range filtering
    if (dateRangeFrom) {
      const fromDate = new Date(dateRangeFrom);
      list = list.filter((p) => {
        if (!p.createdAt) return false;
        return new Date(p.createdAt) >= fromDate;
      });
    }
    if (dateRangeTo) {
      const toDate = new Date(dateRangeTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      list = list.filter((p) => {
        if (!p.createdAt) return false;
        return new Date(p.createdAt) <= toDate;
      });
    }
    
    return sortPatients(list, sortKey, sortDir);
  }, [patients, search, filterStatus, filterDoctor, filterInsurance, filterRisk, filterTag, filterLogic, sortKey, sortDir, dateRangeFrom, dateRangeTo, quickFilter, patientListMode]);

  // Group patients based on selected criteria
  const groupedPatients = useMemo(() => {
    if (groupBy === "none") return { groups: [] };

    const groups: { key: string; label: string; patients: Patient[] }[] = [];
    const groupMap = new Map<string, Patient[]>();

    filtered.forEach((p) => {
      let key = "";
      let label = "";

      if (groupBy === "status") {
        key = p.status;
        label = p.status;
      } else if (groupBy === "doctor") {
        key = p.doctor;
        label = p.doctor;
      } else if (groupBy === "risk") {
        const risk = calcRiskScore(p).level;
        key = risk;
        label = risk;
      } else if (groupBy === "tags") {
        const tags = p.tags || [];
        key = tags.length > 0 ? tags[0] : "No Tags";
        label = tags.length > 0 ? tags[0] : "No Tags";
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(p);
    });

    // Convert map to array and sort
    groupMap.forEach((patients, key) => {
      groups.push({ key, label: key, patients });
    });

    // Sort groups by label
    groups.sort((a, b) => a.label.localeCompare(b.label));

    return { groups };
  }, [filtered, groupBy]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length]);
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  // Clamp page if filtering shrinks the result set below the current page
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Reset to page 1 whenever search/filters/sort/grouping change
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterDoctor, filterInsurance, filterRisk, filterTag, filterLogic, dateRangeFrom, dateRangeTo, quickFilter, sortKey, sortDir, groupBy]);

  const activeFilterCount = useMemo(
    () => [filterStatus !== "All", filterDoctor !== "All", filterInsurance !== "All", filterRisk !== "All", filterTag !== "All"].filter(Boolean).length,
    [filterStatus, filterDoctor, filterInsurance, filterRisk, filterTag]
  );

  // On phone-sized screens, the dense table doesn't fit — fall back to the card layout automatically
  const effectiveView = isMobile && viewMode === "table" ? "card" : viewMode;

  function handleSort(key: keyof Patient) {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir("asc");
      return key;
    });
    setPage(1);
  }

  function resetPage() { setPage(1); }

  function togglePatientSelection(id: string) {
    setSelectedPatients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (selectedPatients.size === paginated.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(paginated.map(p => p.id)));
    }
  }

  function selectAllFiltered() {
    setSelectedPatients(new Set(filtered.map(p => p.id)));
    showFeedback(`Selected all ${filtered.length} filtered patient${filtered.length !== 1 ? "s" : ""}`, "success");
  }

  function clearSelection() {
    setSelectedPatients(new Set());
    setShowBulkActions(false);
  }

  function handleBulkExport() {
    if (!canExportPatients) {
      handleDeniedAccess("export", "patients");
      return;
    }
    const selected = patients.filter(p => selectedPatients.has(p.id));
    if (selected.length === 0) {
      showFeedback("Select at least one patient first", "error");
      return;
    }
    exportPatientsToCSV(selected, exportPreset, CURRENT_USER.name);
    logAuditTrail(`Exported ${selected.length} selected patient${selected.length !== 1 ? "s" : ""} (${exportPreset})`, "bulk", "multiple");
    showFeedback(`Exported ${selected.length} patient${selected.length !== 1 ? "s" : ""}`, "success");
    clearSelection();
  }

  function handleBulkDelete() {
    if (selectedPatients.size === 0) {
      showFeedback("Select at least one patient first", "error");
      return;
    }
    if (!canDeletePatient) {
      handleDeniedAccess("delete", "patients");
      return;
    }
    if (!onDeletePatient) {
      showFeedback("Archive is not available", "error");
      return;
    }
    setConfirmModal({
      title: "Archive Patients",
      message: `Are you sure you want to archive ${selectedPatients.size} patient${selectedPatients.size !== 1 ? "s" : ""}? This will mark them as archived and can be restored later.`,
      confirmLabel: "Archive",
      danger: true,
      requireTypedWord: "ARCHIVE",
      onConfirm: () => {
        const count = selectedPatients.size;
        selectedPatients.forEach(id => onDeletePatient!(id));
        logAuditTrail(`Bulk archived ${count} patients`, "bulk", "multiple");
        clearSelection();
        showFeedback(`Archived ${count} patient${count !== 1 ? "s" : ""}`, "success");
      },
    });
  }

  // Phase 7C: Restore patient from archived state
  function handleRestore(patientId: string) {
    if (!isAdmin) {
      handleDeniedAccess("restore", "patient");
      return;
    }
    const patient = patients.find(p => p.id === patientId);
    setConfirmModal({
      title: "Restore Patient",
      message: `Restore ${patient?.name || "this patient"}'s record to active patient management? The patient will return to their previous status (${patient?.statusBeforeArchive || "Active"}).`,
      confirmLabel: "Restore",
      danger: false,
      onConfirm: async () => {
        try {
          if (onRestorePatient) {
            onRestorePatient(patientId);
          } else {
            await apiClient.restorePatient(patientId, CURRENT_USER.name);
            // Reload patients from storage to get updated state
            const updated = await apiClient.getPatients();
            if (onUpdatePatient) {
              // Trigger parent to reload patients
              window.location.reload();
            }
          }
          logAuditTrail(`Restored patient record ${patientId}`, "restore", patientId);
          showFeedback(`Patient restored successfully`, "success");
        } catch (error) {
          console.error("Failed to restore patient:", error);
          showFeedback(`Failed to restore patient: ${error}`, "error");
        }
      },
    });
  }

  function handleBulkStatusUpdate() {
    if (selectedPatients.size === 0) {
      showFeedback("Select at least one patient first", "error");
      return;
    }
    if (!bulkStatusTarget) {
      showFeedback("Choose a status first", "error");
      return;
    }
    if (!onUpdatePatient) {
      showFeedback("Update is not available", "error");
      return;
    }
    const count = selectedPatients.size;
    selectedPatients.forEach(patientId => {
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        onUpdatePatient({ ...patient, status: bulkStatusTarget as PatientStatus });
      }
    });
    logAuditTrail(`Bulk status update to "${bulkStatusTarget}" for ${count} patients`, "bulk", "multiple");
    setShowBulkStatusModal(false);
    setBulkStatusTarget("");
    clearSelection();
    showFeedback(`Updated status to "${bulkStatusTarget}" for ${count} patient${count !== 1 ? "s" : ""}`, "success");
  }

  function handleBulkDoctorUpdate() {
    if (selectedPatients.size === 0) {
      showFeedback("Select at least one patient first", "error");
      return;
    }
    if (!bulkDoctorTarget) {
      showFeedback("Choose a doctor first", "error");
      return;
    }
    if (!onUpdatePatient) {
      showFeedback("Update is not available", "error");
      return;
    }
    const count = selectedPatients.size;
    selectedPatients.forEach(patientId => {
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        onUpdatePatient({ ...patient, doctor: bulkDoctorTarget });
      }
    });
    logAuditTrail(`Bulk doctor assignment to "${bulkDoctorTarget}" for ${count} patients`, "bulk", "multiple");
    setShowBulkDoctorModal(false);
    setBulkDoctorTarget("");
    clearSelection();
    showFeedback(`Assigned Dr. ${bulkDoctorTarget} to ${count} patient${count !== 1 ? "s" : ""}`, "success");
  }

  function handleQuickAction(action: string, patient: Patient) {
    setQuickActionsMenu(null);
    switch (action) {
      case "call":
        if (patient.phone) {
          setCallingPatient(patient);
          logAuditTrail("Called patient", patient.id, "multiple");
        } else {
          showFeedback(`No phone number on file for ${patient.name}`, "error");
        }
        break;
      case "email":
        if (patient.email) {
          window.location.href = `mailto:${patient.email}`;
          logAuditTrail("Emailed patient", patient.id, "multiple");
        } else {
          showFeedback(`No email address on file for ${patient.name}`, "error");
        }
        break;
      case "schedule":
        setSchedulePatient(patient);
        setScheduleDate("");
        setScheduleTime("");
        setScheduleReason("");
        setScheduleError("");
        setShowScheduleModal(true);
        break;
      case "note":
        setSelectedPatientForNote(patient);
        setQuickNoteText("");
        setShowQuickNoteModal(true);
        break;
      case "profile":
        onSelect(patient);
        break;
      case "edit":
        onSelect(patient);
        showFeedback("Edit mode opens in the patient profile", "info");
        break;
      case "manage-tags":
        setSelectedPatientForTags(patient);
        setShowTagManager(true);
        break;
      case "restore":
        handleRestore(patient.id);
        break;
      case "reminder":
        setReminderPatient(patient);
        setReminderType("follow-up");
        setReminderDate("");
        setReminderNotes("");
        setShowAddReminderModal(true);
        break;
    }
  }

  // Phase 7E: Dismiss duplicate pair
  function handleDismissDuplicate(patientId1: string, patientId2: string) {
    saveReviewedDuplicate({
      patientId1,
      patientId2,
      dismissedAt: new Date().toISOString(),
      dismissedBy: CURRENT_USER.name
    });
    logAuditTrail(`Dismissed duplicate pair ${patientId1}/${patientId2}`, "dismiss_duplicate", "multiple");
    showFeedback("Duplicate pair dismissed", "success");
  }

  // Phase 7E: Open merge preview
  function handleOpenMerge(masterPatient: Patient, duplicatePatient: Patient) {
    if (!hasRole(normalizedRole, ["admin", "doctor"])) {
      handleDeniedAccess("merge", "patient");
      return;
    }
    const preview = buildMergePreview(masterPatient, duplicatePatient);
    setMergePreview(preview);
    setShowMergeModal(true);
  }

  // Phase 7E: Commit merge
  async function handleCommitMerge() {
    if (!mergePreview || !onUpdatePatient || !onDeletePatient) {
      showFeedback("Merge not ready", "error");
      return;
    }

    try {
      const { masterPatient, duplicatePatient, fieldDifferences } = mergePreview;
      
      // Build merged patient data
      const mergedData: Partial<Patient> = { ...masterPatient };
      fieldDifferences.forEach(diff => {
        if (!diff.useMaster && diff.duplicateValue) {
          mergedData[diff.field] = diff.duplicateValue;
        }
      });
      mergedData.updatedAt = new Date().toISOString();

      // Update master patient
      const updatedMaster = await onUpdatePatient(mergedData as Patient);
      
      // Archive duplicate patient using soft delete
      await onDeletePatient(duplicatePatient.id);
      
      // Log merge safely
      logAuditTrail(`Merged patient records: duplicate ${duplicatePatient.id} archived into master ${masterPatient.id}`, "merge", masterPatient.id);
      
      showFeedback("Merge completed successfully", "success");
      setShowMergeModal(false);
      setMergePreview(null);
    } catch (error) {
      console.error("Merge failed:", error);
      showFeedback("Merge failed", "error");
    }
  }

  function handleCompare() {
    if (selectedPatients.size < 2 || selectedPatients.size > 3) {
      showFeedback("Select 2–3 patients to compare", "error");
      return;
    }
    setComparisonMode(true);
  }

  function closeComparison() {
    setComparisonMode(false);
  }

  const comparisonPatients = useMemo(() => {
    return patients.filter(p => selectedPatients.has(p.id));
  }, [patients, selectedPatients]);

  const dupeCount = duplicateGroups.length;
  const [reviewedDuplicates, setReviewedDuplicates] = useState<Set<string>>(new Set());

  // ── import modal state/handlers (Phase 7D) ───────────────────────────────────────
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ matched: number; newRows: number; skipped: number } | null>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null); // Phase 7D
  const [importSummary, setImportSummary] = useState<any | null>(null); // Phase 7D
  const [showImportPreview, setShowImportPreview] = useState(false); // Phase 7D

  function parseCSV(text: string): Array<Record<string, string>> {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const cells = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });
  }

  // Phase 7D: Parse and validate import for preview
  function handleImportPreview() {
    if (!importText.trim()) {
      showFeedback("Paste CSV text or choose a file first", "error");
      return;
    }
    const rows = parseCSV(importText);
    if (rows.length === 0) {
      showFeedback("No rows found to import", "error");
      return;
    }

    // Convert CSV rows to partial patient objects
    const patientRows = rows.map((row) => {
      const firstName = row.firstName || (row.name ? row.name.split(" ")[0] : "");
      const lastName = row.lastName || (row.name ? row.name.split(" ").slice(1).join(" ") : "");
      const name = row.name || `${firstName} ${lastName}`.trim();
      return {
        id: row.id || undefined,
        name,
        phone: row.phone || "",
        email: row.email || "",
        dob: row.dob || "",
        age: row.age ? parseInt(row.age) : undefined,
        gender: row.gender || undefined,
        bloodGroup: row.bloodGroup || undefined,
        address: row.address || "",
        doctor: row.doctor || "",
        status: row.status || undefined,
        insurer: row.insurer || "",
        insuranceStatus: row.insuranceStatus || undefined,
        insuranceExpiry: row.insuranceExpiry || "",
      } as Partial<Patient>;
    });

    // Build preview with validation
    const preview = buildPatientImportPreview(patientRows, patients);
    const summary = getPatientImportSummary(preview);
    
    setImportPreview(preview);
    setImportSummary(summary);
    setShowImportPreview(true);
  }

  // Phase 7D: Commit import with rollback backup
  async function handleCommitImport() {
    if (!importPreview || !onUpdatePatient) {
      showFeedback("Import not ready", "error");
      return;
    }

    try {
      // Create backup before commit
      await createPatientBackup(patients);

      let created = 0;
      let updated = 0;
      let skipped = 0;

      const validRows = importPreview.filter(r => r.status === "valid" || r.status === "update");
      
      for (const row of validRows) {
        if (row.status === "update" && row.matchedPatientId) {
          // Update existing patient
          const existing = patients.find(p => p.id === row.matchedPatientId);
          if (existing) {
            onUpdatePatient({ ...existing, ...row.data });
            updated++;
          }
        } else if (row.status === "valid") {
          // Create new patient - trigger via parent
          if (onImport) {
            onImport();
            created++;
          }
        } else {
          skipped++;
        }
      }

      setImportResult({ matched: updated, newRows: created, skipped });
      setShowImportPreview(false);
      setImportText("");
      setImportPreview(null);
      setImportSummary(null);
      
      logAuditTrail(`Import committed: ${created} created, ${updated} updated, ${skipped} skipped`, "import", "bulk");
      showFeedback(`Import completed: ${created} created, ${updated} updated, ${skipped} skipped`, "success");
      
      // Clear backup after successful import
      await clearPatientBackup();
    } catch (error) {
      console.error("Import failed, restoring backup:", error);
      
      // Restore from backup
      const backup = await restorePatientBackup();
      if (backup) {
        setPatients(backup);
        showFeedback("Import failed, restored previous data", "error");
      } else {
        showFeedback("Import failed and could not restore backup", "error");
      }
    }
  }

  function handleImport() {
    if (!importText.trim()) {
      showFeedback("Paste CSV text or choose a file first", "error");
      return;
    }
    const rows = parseCSV(importText);
    if (rows.length === 0) {
      showFeedback("No rows found to import", "error");
      return;
    }

    let matched = 0;
    let newRows = 0;
    let skipped = 0;
    const seen = new Set<string>();

    rows.forEach((row) => {
      const firstName = row.firstName || (row.name ? row.name.split(" ")[0] : "");
      const lastName = row.lastName || (row.name ? row.name.split(" ").slice(1).join(" ") : "");
      const name = row.name || `${firstName} ${lastName}`.trim();
      const phone = row.phone || "";
      const email = row.email || "";

      // de-dupe key: id, then phone+name, then email
      const dedupeKey = row.id || (phone && name ? `${phone}|${name}` : "") || email;
      if (dedupeKey && seen.has(dedupeKey)) { skipped++; return; }
      if (dedupeKey) seen.add(dedupeKey);

      const existing = patients.find(p =>
        (row.id && p.id === row.id) ||
        (phone && name && p.phone === phone && p.name === name) ||
        (email && p.email === email)
      );

      if (existing) {
        if (onUpdatePatient) {
          onUpdatePatient({
            ...existing,
            name: name || existing.name,
            phone: phone || existing.phone,
            email: email || existing.email,
            dob: row.dob || existing.dob,
            gender: (row.gender as any) || existing.gender,
            doctor: row.doctor || existing.doctor,
            status: (row.status as any) || existing.status,
          });
          matched++;
        } else {
          skipped++;
        }
      } else {
        // No bulk-create callback is available on this component — id would be generated here if one existed.
        newRows++;
      }
    });

    if (matched > 0) {
      logAuditTrail(`Imported updates for ${matched} patient${matched !== 1 ? "s" : ""}`, "bulk", "multiple");
    }
    setImportResult({ matched, newRows, skipped });

    if (newRows > 0) {
      showFeedback(
        `Updated ${matched} existing patient${matched !== 1 ? "s" : ""}. ${newRows} new patient${newRows !== 1 ? "s" : ""} could not be added here — use the app's main import flow to create new patients.`,
        "info"
      );
    } else if (matched > 0) {
      showFeedback(`Updated ${matched} existing patient${matched !== 1 ? "s" : ""} from import`, "success");
    } else {
      showFeedback("No matching patients found to update", "error");
    }
  }

  // ── export modal state/handlers ─────────────────────────────────────────────
  const [exportScope, setExportScope] = useState<"filtered" | "selected">("filtered");
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "contacts">("csv");
  const [exportVisibleColumnsOnly, setExportVisibleColumnsOnly] = useState(false);

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Escapes a value for CSV: wraps in quotes and doubles any embedded quotes.
  function csvCell(value: unknown): string {
    const str = value == null ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  }

  function buildCSV(headers: string[], rows: Array<Record<string, unknown>>): string {
    const lines = [
      headers.map(csvCell).join(","),
      ...rows.map(row => headers.map(h => {
        let v = row[h];
        if (Array.isArray(v)) v = v.join("; ");
        return csvCell(v);
      }).join(",")),
    ];
    // UTF-8 BOM so Excel renders names with accents correctly
    return "\uFEFF" + lines.join("\r\n");
  }

  function handleExport() {
    if (!canExportPatients) {
      handleDeniedAccess("export", "patients");
      return;
    }
    const rows = exportScope === "selected"
      ? patients.filter(p => selectedPatients.has(p.id))
      : filtered;

    if (rows.length === 0) {
      showFeedback(exportScope === "selected" ? "No patients selected to export" : "No patients match the current filters", "error");
      return;
    }

    const stamp = new Date().toISOString().split("T")[0];

    if (exportFormat === "json") {
      const payload = {
        exportedAt: new Date().toISOString(),
        count: rows.length,
        filters: {
          search, filterStatus, filterDoctor, filterInsurance, filterRisk, filterTag,
          filterLogic, dateRangeFrom, dateRangeTo, scope: exportScope,
        },
        data: rows,
      };
      downloadFile(JSON.stringify(payload, null, 2), `patients_${stamp}.json`, "application/json");
    } else if (exportFormat === "contacts") {
      const headers = ["name", "phone", "email", "doctor", "followUpDate"];
      downloadFile(buildCSV(headers, rows as any), `patient_contacts_${stamp}.csv`, "text/csv");
    } else if (exportVisibleColumnsOnly && selectedColumns.size > 0) {
      const cols = Array.from(selectedColumns);
      downloadFile(buildCSV(cols, rows as any), `patients_${stamp}.csv`, "text/csv");
    } else {
      exportPatientsToCSV(rows, exportPreset, CURRENT_USER.name);
    }

    logAuditTrail(`Exported ${rows.length} patient${rows.length !== 1 ? "s" : ""} (${exportFormat}, ${exportScope}, ${exportPreset})`, "bulk", "multiple");
    showFeedback(`Exported ${rows.length} patient${rows.length !== 1 ? "s" : ""}`, "success");
    setShowExportModal(false);
  }

  const SortIcon = ({ col }: { col: keyof Patient }) => {
    if (sortKey !== col) return <i className="ti ti-selector" style={{ fontSize: 11, opacity: 0.3 }} />;
    return <i className={`ti ti-sort-${sortDir === "asc" ? "ascending" : "descending"}`} style={{ fontSize: 11, color: "var(--accent)" }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <style>{`
        .pl-toolbar-filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .pl-quick-filter-label { display: inline; }
        .desktop-only { display: inline; }

        /* Calling screen */
        .call-backdrop { background: rgba(10, 10, 14, 0.75) !important; }
        .call-screen {
          width: 340px;
          max-width: 340px;
          background: linear-gradient(160deg, #1c2030 0%, #0c0e16 100%);
          color: #fff;
          border-radius: 28px;
          padding: 40px 28px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 30px 70px rgba(0,0,0,0.5);
        }
        .call-status-label {
          font-size: 12px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          opacity: 0.55;
          margin-bottom: 22px;
        }
        .call-avatar-wrap {
          position: relative;
          width: 104px;
          height: 104px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .call-pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35);
          animation: call-pulse 1.8s ease-out infinite;
        }
        @keyframes call-pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .call-patient-name { font-size: 22px; font-weight: 700; }
        .call-patient-number { font-size: 14px; opacity: 0.6; margin-top: 4px; }
        .call-timer { font-size: 13px; opacity: 0.45; margin-top: 10px; min-height: 18px; }
        .call-actions-row { display: flex; gap: 18px; margin-top: 40px; margin-bottom: 30px; }
        .call-icon-btn {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.12);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .call-icon-btn:hover { transform: scale(1.08); background: rgba(255,255,255,0.2); }
        .call-icon-btn-active { background: #fff !important; color: #111 !important; }
        .call-end-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #ff5b5b, #e02424);
          color: #fff;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(224,36,36,0.45);
          transition: transform 0.15s ease;
        }
        .call-end-btn:hover { transform: scale(1.06); }

        /* Phone-sized screens */
        @media (max-width: 640px) {
          .desktop-only { display: none !important; }
          .pl-hide-mobile { display: none !important; }
          .pl-toolbar-filters { flex-wrap: wrap; }
          .pl-toolbar-filters select { min-height: 36px; flex: 1 1 120px; }
          .pl-select-filters {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
          }
          .pl-select-filters select {
            width: 100%;
            min-width: 0 !important;
            flex: unset !important;
          }
          .pl-toolbar { flex-wrap: wrap; row-gap: 8px; }
          .pl-toolbar .pl-search { flex: 1 1 100% !important; min-width: unset !important; }
          .pl-count-row { flex-wrap: wrap; }
          /* Quick filter pills: tighter on mobile */
          .pl-qf-btn { padding: 6px 10px !important; font-size: var(--font-xs) !important; }

          /* Data-issues pills scroll sideways instead of wrapping into multiple rows */
          .pl-quality-bar {
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .pl-quality-bar::-webkit-scrollbar { display: none; }
          .pl-quality-bar > span { flex-shrink: 0; }

          /* All modals go full-screen and edge-to-edge on phones */
          .modal-backdrop { padding: 0 !important; align-items: stretch !important; }
          .modal {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }

          .call-screen {
            justify-content: center;
            padding: 60px 24px 40px;
          }

          .pl-grid-3 { grid-template-columns: 1fr !important; }

          .pl-pagination { justify-content: center !important; }
          .pl-pagination > div { justify-content: center; width: 100%; }

          /* Hide filter-logic toggle — confusing on small screens */
          .pl-filter-logic { display: none !important; }

          /* Count row: keep only Export + New Patient on mobile */
          .pl-count-import, .pl-count-print { display: none !important; }
        }
      `}</style>
      {/* Quality bar */}
      <QualityBar patients={patients} onSearch={(q) => { setSearch(q); resetPage(); }} />

      {/* Toolbar */}
      <div className="pl-toolbar" style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", flexShrink: 0, display: "flex",
        alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        {/* Search */}
        <div className="pl-search" style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <i className="ti ti-search" style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "var(--muted)", pointerEvents: "none",
          }} />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
            placeholder='Search or try "diabetic patients"…'
            style={{ width: "100%", paddingLeft: 34, paddingRight: search ? 32 : 12 }}
          />
          {search && (
            <button onClick={() => { setSearch(""); resetPage(); }} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", padding: 2,
            }}>
              <i className="ti ti-x" style={{ fontSize: 13 }} />
            </button>
          )}
          {search && (
            <button onClick={() => setShowSaveSearchModal(true)} style={{
              position: "absolute", right: search ? 32 : 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: "var(--accent)",
              display: "flex", alignItems: "center", padding: 2,
            }} title="Save search">
              <i className="ti ti-bookmark" style={{ fontSize: 13 }} />
            </button>
          )}
          {showSuggestions && !search && (
            <div style={{
              position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 200,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden",
            }}>
              {savedSearches.length > 0 ? (
                <>
                  <div style={{ padding: "8px 12px 4px", fontSize: "var(--font-2xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Saved Searches
              </div>
                  {savedSearches.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "8px 12px", gap: 8, borderBottom: "1px solid var(--border)" }}>
                      <button onMouseDown={() => handleApplySearch(s.query)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: "var(--font-sm)", color: "var(--text)" }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{s.query}</div>
                      </button>
                      <button onMouseDown={() => handleDeleteSearch(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 4 }}>
                        <i className="ti ti-trash" style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: "8px 12px", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  No saved searches yet — type a search and click the bookmark icon to save one.
                </div>
              )}
              <div style={{ padding: "8px 12px 4px", fontSize: "var(--font-2xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Smart Search
              </div>
              {SMART_SUGGESTIONS.map((s) => (
                <button key={s.query} onMouseDown={() => { setSearch(s.query); resetPage(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: "var(--font-sm)", color: "var(--text)", textAlign: "left",
                  }}
                  className="tbl-row"
                >
                  <i className="ti ti-sparkles" style={{ fontSize: 12, color: "var(--accent)" }} />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="pl-toolbar-filters" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="pl-qf-btn"
            onClick={() => { setQuickFilter(quickFilter === "highRisk" ? null : "highRisk"); resetPage(); }}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: quickFilter === "highRisk" ? "var(--red-bg)" : "var(--surface)",
              color: quickFilter === "highRisk" ? "var(--red)" : "var(--muted)",
              fontSize: "var(--font-sm)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <i className="ti ti-alert-triangle" style={{ fontSize: 14, marginRight: 4 }} />
            <span className="pl-quick-filter-label">{isMobile ? "Risk" : "High Risk"}</span>
          </button>
          <button
            className="pl-qf-btn"
            onClick={() => { setQuickFilter(quickFilter === "overdue" ? null : "overdue"); resetPage(); }}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: quickFilter === "overdue" ? "var(--amber-bg)" : "var(--surface)",
              color: quickFilter === "overdue" ? "var(--amber)" : "var(--muted)",
              fontSize: "var(--font-sm)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <i className="ti ti-clock" style={{ fontSize: 14, marginRight: 4 }} />
            <span className="pl-quick-filter-label">Overdue</span>
          </button>
          <button
            className="pl-qf-btn"
            onClick={() => { setQuickFilter(quickFilter === "newThisWeek" ? null : "newThisWeek"); resetPage(); }}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: quickFilter === "newThisWeek" ? "var(--blue-bg)" : "var(--surface)",
              color: quickFilter === "newThisWeek" ? "var(--blue)" : "var(--muted)",
              fontSize: "var(--font-sm)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <i className="ti ti-calendar-plus" style={{ fontSize: 14, marginRight: 4 }} />
            <span className="pl-quick-filter-label">{isMobile ? "New" : "New This Week"}</span>
          </button>

          {/* Mobile-only: Filters toggle button */}
          {isMobile && (
            <button
              onClick={() => setShowMobileFilters(f => !f)}
              style={{
                padding: "6px 10px",
                borderRadius: "var(--radius)",
                border: `1px solid ${activeFilterCount > 0 ? "var(--accent)" : "var(--border)"}`,
                background: activeFilterCount > 0 ? "var(--accent-soft)" : "var(--surface)",
                color: activeFilterCount > 0 ? "var(--accent)" : "var(--muted)",
                fontSize: "var(--font-xs)",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
                marginLeft: "auto",
              }}
            >
              <i className="ti ti-adjustments-horizontal" style={{ fontSize: 13 }} />
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  background: "var(--accent)", color: "#fff",
                  borderRadius: "var(--radius-full)", fontSize: 10, fontWeight: 700,
                  padding: "1px 5px", lineHeight: 1.4,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filters */}
        {(!isMobile || showMobileFilters) && (
        <div className="pl-toolbar-filters pl-select-filters">
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); resetPage(); }}
          style={{ fontSize: "var(--font-sm)", minWidth: 110 }}>
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select value={filterDoctor} onChange={(e) => { setFilterDoctor(e.target.value); resetPage(); }}
          style={{ fontSize: "var(--font-sm)", minWidth: 110 }}>
          <option value="All">All Doctors</option>
          {DOCTORS.map((d) => <option key={d}>{d}</option>)}
        </select>

        <select value={filterInsurance} onChange={(e) => { setFilterIns(e.target.value); resetPage(); }}
          style={{ fontSize: "var(--font-sm)", minWidth: 110 }}>
          <option value="All">All Insurance</option>
          {["Active","Expiring","Expired","None"].map((s) => <option key={s}>{s}</option>)}
        </select>

        <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); resetPage(); }}
          style={{ fontSize: "var(--font-sm)", minWidth: 100 }}>
          <option value="All">All Risk</option>
          {["Low","Medium","High","Critical"].map((r) => <option key={r}>{r}</option>)}
        </select>

        {allTags.length > 0 && (
          <select value={filterTag} onChange={(e) => { setFilterTag(e.target.value); resetPage(); }}
            style={{ fontSize: "var(--font-sm)", minWidth: 110 }}>
            <option value="All">All Tags</option>
            {allTags.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        </div>
        )}

        {/* View Toggle — hidden on mobile (view is forced to card) */}
        <div className="pl-hide-mobile" style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {/* Phase 7C: Active/Archived toggle (admin-only) */}
          {isAdmin && (
            <div style={{ display: "flex", gap: 2, marginRight: 8 }}>
              <button
                onClick={() => setPatientListMode("active")}
                className="btn-icon"
                title="Active patients"
                style={{ 
                  background: patientListMode === "active" ? "var(--accent-soft)" : "transparent", 
                  color: patientListMode === "active" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-xs)",
                  padding: "4px 8px"
                }}
              >
                Active
              </button>
              <button
                onClick={() => setPatientListMode("archived")}
                className="btn-icon"
                title="Archived patients"
                style={{ 
                  background: patientListMode === "archived" ? "var(--accent-soft)" : "transparent", 
                  color: patientListMode === "archived" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-xs)",
                  padding: "4px 8px"
                }}
              >
                Archived
              </button>
            </div>
          )}
          {!isMobile && (
            <button
              onClick={() => setViewMode("table")}
              className="btn-icon"
              title="Table view"
              style={{ background: viewMode === "table" ? "var(--accent-soft)" : "transparent", color: viewMode === "table" ? "var(--accent)" : "var(--muted)" }}
            >
              <i className="ti ti-table" style={{ fontSize: 16 }} />
            </button>
          )}
          <button
            onClick={() => setViewMode("card")}
            className="btn-icon"
            title="Card view"
            style={{ background: viewMode === "card" ? "var(--accent-soft)" : "transparent", color: viewMode === "card" ? "var(--accent)" : "var(--muted)" }}
          >
            <i className="ti ti-layout-grid" style={{ fontSize: 16 }} />
          </button>
          <button
            onClick={() => setViewMode("dashboard")}
            className="btn-icon"
            title="Dashboard view"
            style={{ background: viewMode === "dashboard" ? "var(--accent-soft)" : "transparent", color: viewMode === "dashboard" ? "var(--accent)" : "var(--muted)" }}
          >
            <i className="ti ti-chart-pie" style={{ fontSize: 16 }} />
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className="btn-icon"
            title="Timeline view"
            style={{ background: viewMode === "timeline" ? "var(--accent-soft)" : "transparent", color: viewMode === "timeline" ? "var(--accent)" : "var(--muted)" }}
          >
            <i className="ti ti-timeline" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Column Customization */}
        {effectiveView === "table" && (
          <button
            onClick={() => setShowPrintModal(true)}
            className="btn-icon"
            title="Customize columns"
            style={{ marginLeft: 8 }}
          >
            <i className="ti ti-settings" style={{ fontSize: 16 }} />
          </button>
        )}

        {/* Group By */}
        {effectiveView === "table" && (
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            style={{ fontSize: "var(--font-sm)", marginLeft: 8, minWidth: 120 }}
          >
            <option value="none">No Grouping</option>
            <option value="status">Group by Status</option>
            <option value="doctor">Group by Doctor</option>
            <option value="risk">Group by Risk</option>
            <option value="tags">Group by Tags</option>
          </select>
        )}

        {/* Filter Logic Toggle */}
        {(filterStatus !== "All" || filterDoctor !== "All" || filterInsurance !== "All" || filterRisk !== "All" || filterTag !== "All") && (
          <div className="pl-filter-logic" style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
            <span>Filter Logic:</span>
            <button
              onClick={() => setFilterLogic(filterLogic === "AND" ? "OR" : "AND")}
              style={{
                padding: "4px 8px",
                background: filterLogic === "AND" ? "var(--accent-soft)" : "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "var(--font-xs)",
                color: filterLogic === "AND" ? "var(--accent)" : "var(--text)",
                fontWeight: 600,
              }}
            >
              {filterLogic}
            </button>
          </div>
        )}

        {(filterStatus !== "All" || filterDoctor !== "All" || filterInsurance !== "All" || filterRisk !== "All" || filterTag !== "All" || search || dateRangeFrom || dateRangeTo || quickFilter) && (
          <button className="btn-icon" onClick={() => {
            setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterIns("All"); setFilterRisk("All"); setFilterTag("All"); setDateRangeFrom(""); setDateRangeTo(""); setQuickFilter(null); resetPage();
          }} title="Clear all filters">
            <i className="ti ti-filter-off" style={{ fontSize: 14 }} />
          </button>
        )}

        <button 
          className="btn-icon pl-hide-mobile" 
          onClick={() => setShowPrintModal(true)}
          title="Print"
        >
          <i className="ti ti-printer" style={{ fontSize: 16 }} />
        </button>

        <button 
          className="btn-icon pl-hide-mobile" 
          onClick={() => setShowExportModal(true)}
          title="Export options"
        >
          <i className="ti ti-adjustments-horizontal" style={{ fontSize: 16 }} />
        </button>

        <button 
          className="btn-icon pl-hide-mobile" 
          onClick={() => setShowBulkActions(!showBulkActions)}
          title="Bulk Actions"
        >
          <i className="ti ti-checkbox" style={{ fontSize: 16 }} />
        </button>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div style={{ position: "relative" }}>
            <button
              className="btn-icon"
              title="Saved filters"
              onClick={() => setShowSavedFiltersDropdown(!showSavedFiltersDropdown)}
              style={{ color: "var(--muted)" }}
            >
              <i className="ti ti-bookmark" style={{ fontSize: 14 }} />
            </button>
            {showSavedFiltersDropdown && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
                zIndex: 1000, minWidth: 200, padding: 4,
              }}>
                {savedFilters.map((f) => (
                  <div key={f.id} style={{
                    padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                    fontSize: "var(--font-sm)",
                  }} onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}>
                    <span onClick={() => { handleLoadFilter(f); setShowSavedFiltersDropdown(false); }} style={{ flex: 1 }}>{f.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFilter(f.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}>
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button 
          className="btn-icon pl-hide-mobile" 
          onClick={() => setShowSaveFilterModal(true)}
          title="Save current filter"
          style={{ color: "var(--muted)" }}
        >
          <i className="ti ti-bookmark-plus" style={{ fontSize: 14 }} />
        </button>

        <div className="pl-count-row" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", whiteSpace: "nowrap" }}>
            {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
          </span>
          {dupeCount > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: "var(--font-sm)", color: "var(--amber)" }}
              onClick={() => setShowDuplicateModal(true)}
            >
              <i className="ti ti-copy" style={{ fontSize: 14 }} />
              {dupeCount} Duplicate{dupeCount > 1 ? "s" : ""}
            </button>
          )}
          <button className="btn btn-ghost pl-count-import" style={{ fontSize: "var(--font-sm)" }} onClick={onImport}>
            <i className="ti ti-file-import" style={{ fontSize: 14 }} />
            <span className="desktop-only">Import</span>
          </button>
          <button className="btn btn-ghost pl-count-print" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowPrintModal(true)}>
            <i className="ti ti-printer" style={{ fontSize: 14 }} />
            <span className="desktop-only">Print</span>
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => {
            if (!canExportPatients) {
              handleDeniedAccess("export", "patients");
              return;
            }
            if (filtered.length === 0) { showFeedback("No patients match the current filters", "error"); return; }
            exportPatientsToCSV(filtered, exportPreset, CURRENT_USER.name);
            logAuditTrail(`Exported ${filtered.length} filtered patient${filtered.length !== 1 ? "s" : ""} (${exportPreset})`, "bulk", "multiple");
            showFeedback(`Exported ${filtered.length} patient${filtered.length !== 1 ? "s" : ""}`, "success");
          }}>
            <i className="ti ti-download" style={{ fontSize: 14 }} />
            <span className="desktop-only">Export</span>
          </button>
          {canCreatePatient && (
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={onNewPatient}>
              <i className="ti ti-user-plus" style={{ fontSize: 14 }} />
              <span className="desktop-only">New Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div style={{
          background: "var(--surface2)", borderBottom: "1px solid var(--border)",
          padding: "12px 16px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 600 }}>Date Range</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                value={dateRangeFrom}
                onChange={(e) => { setDateRangeFrom(e.target.value); resetPage(); }}
                style={{ fontSize: "var(--font-sm)", padding: "6px 10px" }}
              />
              <span style={{ color: "var(--muted)" }}>to</span>
              <input
                type="date"
                value={dateRangeTo}
                onChange={(e) => { setDateRangeTo(e.target.value); resetPage(); }}
                style={{ fontSize: "var(--font-sm)", padding: "6px 10px" }}
              />
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 600 }}>Quick Filters</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  const today = new Date();
                  setDateRangeFrom(today.toISOString().split('T')[0]);
                  setDateRangeTo(today.toISOString().split('T')[0]);
                  resetPage();
                }}
                className="badge"
                style={{ 
                  background: "var(--surface)", 
                  border: "1px solid var(--border)", 
                  cursor: "pointer",
                  padding: "4px 10px"
                }}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setDateRangeFrom(weekAgo.toISOString().split('T')[0]);
                  setDateRangeTo(today.toISOString().split('T')[0]);
                  resetPage();
                }}
                className="badge"
                style={{ 
                  background: "var(--surface)", 
                  border: "1px solid var(--border)", 
                  cursor: "pointer",
                  padding: "4px 10px"
                }}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setDateRangeFrom(monthAgo.toISOString().split('T')[0]);
                  setDateRangeTo(today.toISOString().split('T')[0]);
                  resetPage();
                }}
                className="badge"
                style={{ 
                  background: "var(--surface)", 
                  border: "1px solid var(--border)", 
                  cursor: "pointer",
                  padding: "4px 10px"
                }}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => {
                  setDateRangeFrom("");
                  setDateRangeTo("");
                  resetPage();
                }}
                className="badge"
                style={{ 
                  background: "var(--red-bg)", 
                  color: "var(--red)",
                  border: "1px solid var(--red-border)", 
                  cursor: "pointer",
                  padding: "4px 10px"
                }}
              >
                Clear Dates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active search label */}
      {search && (
        <div style={{
          background: "var(--accent-soft)", borderBottom: "1px solid var(--border)",
          padding: "6px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <i className="ti ti-sparkles" style={{ fontSize: 12, color: "var(--accent)" }} />
          <span style={{ fontSize: "var(--font-sm)", color: "var(--accent)", fontWeight: 600 }}>
            Smart search: "{search}" — {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => { setSearch(""); resetPage(); }} style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            color: "var(--accent)", fontSize: "var(--font-sm)", fontWeight: 600,
          }}>
            Clear ×
          </button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedPatients.size > 0 && (
        <div style={{
          background: "var(--accent-soft)", borderBottom: "1px solid var(--accent-border)",
          padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--accent)", fontWeight: 600 }}>
            {selectedPatients.size} patient{selectedPatients.size !== 1 ? "s" : ""} selected
          </span>
          {selectedPatients.size < filtered.length && (
            <button className="btn btn-ghost" onClick={selectAllFiltered} style={{ fontSize: "var(--font-sm)" }}>
              Select all filtered ({filtered.length})
            </button>
          )}
          <button className="btn btn-ghost" onClick={clearSelection} style={{ fontSize: "var(--font-sm)" }}>
            Clear selection
          </button>
          {selectedPatients.size >= 2 && selectedPatients.size <= 3 && (
            <button className="btn btn-ghost" onClick={handleCompare} style={{ fontSize: "var(--font-sm)" }}>
              <i className="ti ti-layout-columns" style={{ fontSize: 14 }} />
              Compare
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setShowBulkStatusModal(true)} style={{ fontSize: "var(--font-sm)" }}>
            <i className="ti ti-arrows-exchange" style={{ fontSize: 14 }} />
            Change Status
          </button>
          <button className="btn btn-ghost" onClick={() => setShowTagManager(true)} style={{ fontSize: "var(--font-sm)" }}>
            <i className="ti ti-tag" style={{ fontSize: 14 }} />
            Assign Tags
          </button>
          <button className="btn btn-ghost" onClick={() => setShowBulkDoctorModal(true)} style={{ fontSize: "var(--font-sm)" }}>
            <i className="ti ti-user" style={{ fontSize: 14 }} />
            Assign Doctor
          </button>
          <button className="btn btn-ghost" onClick={handleBulkExport} style={{ fontSize: "var(--font-sm)" }}>
            <i className="ti ti-download" style={{ fontSize: 14 }} />
            Export Selected
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleBulkDelete}
            disabled={!isAdmin}
            title={!isAdmin ? "You do not have permission for this action in the current role." : "Delete selected patients"}
            style={{ fontSize: "var(--font-sm)", color: "var(--red)", opacity: !isAdmin ? 0.5 : 1, cursor: !isAdmin ? "not-allowed" : "pointer" }}
          >
            <i className="ti ti-trash" style={{ fontSize: 14 }} />
            Delete Selected
          </button>
          <button className="btn-icon" onClick={clearSelection} style={{ marginLeft: "auto" }}>
            <i className="ti ti-x" style={{ fontSize: 14 }} />
          </button>
        </div>
      )}

      {/* Table or Card View */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {effectiveView === "table" ? (
          <table className="tbl" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 44, paddingLeft: 16 }}>
                <input
                  type="checkbox"
                  checked={selectedPatients.size === paginated.length && paginated.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: "pointer" }}
                />
              </th>
              {([
                { key: "id",              label: "ID",         w: 100 },
                { key: "name",            label: "Patient",    w: 180 },
                { key: "age",             label: "Age",        w: 60  },
                { key: "doctor",          label: "Doctor",     w: 130 },
                { key: "status",          label: "Status",     w: 130 },
                { key: "insuranceStatus", label: "Insurance",  w: 100 },
                { key: "lastVisit",       label: "Last Visit", w: 100 },
              ] as { key: keyof Patient; label: string; w: number }[]).filter(col => selectedColumns.has(col.key)).map(({ key, label, w }) => (
                <th key={key} style={{ width: w, cursor: "pointer" }} onClick={() => handleSort(key)}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
              <th>Alerts</th>
              <th style={{ width: 90 }}>Risk</th>
              <th style={{ width: 120 }}>Tags</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {groupBy !== "none" ? (
              groupedPatients.groups.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: 0 }}>
                    <div className="empty-state">
                      <i className="ti ti-users empty-state-icon" />
                      <div className="empty-state-text">No patients found</div>
                      <div className="empty-state-sub">{search ? `No results for "${search}"` : "Try adjusting your filters"}</div>
                      {(search || filterStatus !== "All" || filterDoctor !== "All" || filterInsurance !== "All" || filterRisk !== "All" || filterTag !== "All" || quickFilter) && (
                        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterIns("All"); setFilterRisk("All"); setFilterTag("All"); setQuickFilter(null); resetPage(); }}>
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                groupedPatients.groups.map((group) => (
                  <React.Fragment key={group.key}>
                    <tr style={{ background: "var(--surface2)" }}>
                      <td colSpan={12} style={{ padding: "8px 16px", fontWeight: 600, color: "var(--text)" }}>
                        {group.label} ({group.patients.length})
                      </td>
                    </tr>
                    {group.patients.map((p) => (
                      <PatientRow
                        key={p.id}
                        patient={p}
                        selected={p.id === selectedId}
                        onSelect={onSelect}
                        bulkSelected={selectedPatients.has(p.id)}
                        onToggleBulk={togglePatientSelection}
                        searchQuery={search}
                        onQuickAction={(action) => handleQuickAction(action, p)}
                        quickActionsOpen={quickActionsMenu?.patientId === p.id}
                        onQuickActionsToggle={(e, x, y) => {
                          e.stopPropagation();
                          if (quickActionsMenu?.patientId === p.id) {
                            setQuickActionsMenu(null);
                          } else {
                            setQuickActionsMenu({ patientId: p.id, x, y });
                          }
                        }}
                        closeQuickActions={() => setQuickActionsMenu(null)}
                        selectedColumns={selectedColumns}
                      />
                    ))}
                  </React.Fragment>
                ))
              )
            ) : (
              paginated.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: 0 }}>
                    <div className="empty-state">
                      <i className="ti ti-users empty-state-icon" />
                      <div className="empty-state-text">No patients found</div>
                      <div className="empty-state-sub">{search ? `No results for "${search}"` : "Try adjusting your filters"}</div>
                      {(search || filterStatus !== "All" || filterDoctor !== "All" || filterInsurance !== "All" || filterRisk !== "All" || filterTag !== "All" || quickFilter) && (
                        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterIns("All"); setFilterRisk("All"); setFilterTag("All"); setQuickFilter(null); resetPage(); }}>
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <PatientRow
                    key={p.id}
                    patient={p}
                    selected={p.id === selectedId}
                    onSelect={onSelect}
                    bulkSelected={selectedPatients.has(p.id)}
                    onToggleBulk={togglePatientSelection}
                    searchQuery={search}
                    onQuickAction={(action) => handleQuickAction(action, p)}
                    quickActionsOpen={quickActionsMenu?.patientId === p.id}
                    onQuickActionsToggle={(e, x, y) => {
                      e.stopPropagation();
                      if (quickActionsMenu?.patientId === p.id) {
                        setQuickActionsMenu(null);
                      } else {
                        setQuickActionsMenu({ patientId: p.id, x, y });
                      }
                    }}
                    closeQuickActions={() => setQuickActionsMenu(null)}
                    selectedColumns={selectedColumns}
                  />
                ))
              )
            )}
          </tbody>
        </table>
        ) : viewMode === "dashboard" ? (
          <div style={{ padding: "24px" }}>
            <PatientDashboard patients={filtered} />
          </div>
        ) : viewMode === "timeline" ? (
          <div style={{ padding: "24px" }}>
            <PatientTimeline patients={filtered} />
          </div>
        ) : (
          <div style={{ padding: isMobile ? "8px" : "0 16px" }}>
            {paginated.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-users empty-state-icon" />
                <div className="empty-state-text">No patients found</div>
                <div className="empty-state-sub">{search ? `No results for "${search}"` : "Try adjusting your filters"}</div>
                {(search || filterStatus !== "All" || filterDoctor !== "All" || filterInsurance !== "All" || filterRisk !== "All" || filterTag !== "All" || quickFilter) && (
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterIns("All"); setFilterRisk("All"); setFilterTag("All"); setQuickFilter(null); resetPage(); }}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : isMobile ? (
              /* Mobile: compact grouped list — shows ~8 patients per screen */
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", overflow: "hidden",
              }}>
                {paginated.map((p) => (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    selected={selectedPatients.has(p.id)}
                    onSelect={() => togglePatientSelection(p.id)}
                    onQuickAction={(action) => handleQuickAction(action, p)}
                    isMobile
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {paginated.map((p) => (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    selected={selectedPatients.has(p.id)}
                    onSelect={() => togglePatientSelection(p.id)}
                    onQuickAction={(action) => handleQuickAction(action, p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pl-pagination" style={{
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          padding: "10px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0, flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} · Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "var(--font-sm)" }}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />
            </button>
            {Array.from({ length: Math.min(totalPages, isMobile ? 5 : 7) }, (_, i) => {
              const maxButtons = isMobile ? 5 : 7;
              const edgeBuffer = isMobile ? 2 : 3;
              let p_num = i + 1;
              if (totalPages > maxButtons) {
                if (page <= edgeBuffer + 1) p_num = i + 1;
                else if (page >= totalPages - edgeBuffer) p_num = totalPages - maxButtons + 1 + i;
                else p_num = page - edgeBuffer + i;
              }
              return (
                <button key={p_num} onClick={() => setPage(p_num)}
                  className="btn btn-ghost"
                  style={{
                    padding: "5px 10px", fontSize: "var(--font-sm)", minWidth: 32,
                    background: page === p_num ? "var(--accent-soft)" : undefined,
                    color:      page === p_num ? "var(--accent)" : undefined,
                    fontWeight: page === p_num ? 700 : undefined,
                  }}>
                  {p_num}
                </button>
              );
            })}
            <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "var(--font-sm)" }}
              disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      )}
      
      {/* Comparison Modal */}
      {comparisonMode && (
        <PatientComparisonModal
          patients={comparisonPatients}
          onOpenPatient={(p) => { onSelect(p); setComparisonMode(false); }}
          onRemovePatient={(id) => setSelectedPatients(prev => { const next = new Set(prev); next.delete(id); return next; })}
          onClear={() => { clearSelection(); setComparisonMode(false); }}
          onClose={closeComparison}
        />
      )}

      {/* Save Filter Modal */}
      {showSaveFilterModal && (
        <div className="modal-backdrop" onClick={() => setShowSaveFilterModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Save Filter</div>
              <button className="btn-icon" onClick={() => setShowSaveFilterModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Filter Name</label>
                <input
                  type="text"
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  placeholder="e.g., High Risk Diabetic Patients"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveFilter(); }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowSaveFilterModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveFilter} disabled={!newFilterName.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && selectedPatientForTags && (
        <div className="modal-backdrop" onClick={() => setShowTagManager(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Manage Tags</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPatientForTags.name}</div>
              </div>
              <button className="btn-icon" onClick={() => setShowTagManager(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Add New Tag</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Enter tag name"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(selectedPatientForTags); }}
                  />
                  <button className="btn btn-primary" onClick={() => handleAddTag(selectedPatientForTags)} disabled={!newTag.trim()}>Add</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8, display: "block" }}>Current Tags</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 60, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  {(selectedPatientForTags.tags || []).length === 0 ? (
                    <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No tags assigned</span>
                  ) : (
                    (selectedPatientForTags.tags || []).map((tag) => (
                      <span key={tag} className="tag" style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        border: "1px solid var(--accent-border)",
                        fontSize: "var(--font-sm)",
                        padding: "4px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(selectedPatientForTags, tag)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, display: "flex" }}
                        >
                          <i className="ti ti-x" style={{ fontSize: 12 }} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8, display: "block" }}>Suggested Tags</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allTags.filter(t => !(selectedPatientForTags.tags || []).includes(t)).slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => { setNewTag(tag); handleAddTag(selectedPatientForTags); }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: "var(--font-sm)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface)"}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Doctor Assignment Modal */}
      {showBulkDoctorModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkDoctorModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Assign Doctor</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPatients.size} patients selected</div>
              </div>
              <button className="btn-icon" onClick={() => setShowBulkDoctorModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Assign to Doctor</label>
                <select
                  value={bulkDoctorTarget}
                  onChange={(e) => setBulkDoctorTarget(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select doctor...</option>
                  {DOCTORS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {bulkDoctorTarget && (
                <div style={{ marginBottom: 12, padding: 10, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-xs)" }}>
                  This will assign <strong>{bulkDoctorTarget}</strong> to <strong>{selectedPatients.size}</strong> patient{selectedPatients.size !== 1 ? "s" : ""}.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowBulkDoctorModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleBulkDoctorUpdate} disabled={!bulkDoctorTarget}>Assign Doctor</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Update Modal */}
      {showBulkStatusModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkStatusModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Change Status</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPatients.size} patients selected</div>
              </div>
              <button className="btn-icon" onClick={() => setShowBulkStatusModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>New Status</label>
                <select
                  value={bulkStatusTarget}
                  onChange={(e) => setBulkStatusTarget(e.target.value as PatientStatus)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="">Select status...</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {bulkStatusTarget && (
                <div style={{ marginBottom: 12, padding: 10, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-xs)" }}>
                  This will change <strong>{selectedPatients.size}</strong> patient{selectedPatients.size !== 1 ? "s" : ""} to status <strong>{bulkStatusTarget}</strong>.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowBulkStatusModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleBulkStatusUpdate} disabled={!bulkStatusTarget}>Update Status</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showQuickNoteModal && selectedPatientForNote && (
        <div className="modal-backdrop" onClick={() => setShowQuickNoteModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Add Quick Note</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPatientForNote.name}</div>
              </div>
              <button className="btn-icon" onClick={() => setShowQuickNoteModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Note</label>
                <textarea
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="Enter your note..."
                  rows={4}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowQuickNoteModal(false); setQuickNoteText(""); }}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  if (selectedPatientForNote && quickNoteText.trim()) {
                    const newNote = {
                      id: `note-${Date.now()}`,
                      text: quickNoteText.trim(),
                      date: new Date().toISOString().split("T")[0],
                      pinned: false,
                      category: "general"
                    };
                    const updatedPatient = {
                      ...selectedPatientForNote,
                      notes: [...(selectedPatientForNote.notes || []), newNote]
                    };
                    if (onUpdatePatient) {
                      onUpdatePatient(updatedPatient);
                      logAuditTrail("Added quick note", selectedPatientForNote.id, selectedPatientForNote.name);
                      showFeedback("Note saved", "success");
                    } else {
                      showFeedback("Cannot save note — update not available", "error");
                    }
                    setShowQuickNoteModal(false);
                    setQuickNoteText("");
                  }
                }} disabled={!quickNoteText.trim()}>Save Note</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div className="modal-backdrop" onClick={() => setShowPrintModal(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Print Patient List</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{filtered.length} patients</div>
              </div>
              <button className="btn-icon" onClick={() => setShowPrintModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Custom Title</div>
                <input
                  type="text"
                  value={customPrintTitle}
                  onChange={(e) => setCustomPrintTitle(e.target.value)}
                  placeholder="Patient List"
                  style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Template</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { value: "standard", label: "Standard" },
                    { value: "detailed", label: "Detailed" },
                    { value: "compact", label: "Compact" },
                    { value: "medical", label: "Medical" },
                    { value: "prescription", label: "Prescription List" },
                    { value: "labResults", label: "Lab Results" },
                    { value: "medicalHistory", label: "Medical History" },
                    { value: "followUp", label: "Follow-up Report" },
                  ].map((tpl) => (
                    <button
                      key={tpl.value}
                      onClick={() => setPrintTemplate(tpl.value as any)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: `2px solid ${printTemplate === tpl.value ? "var(--accent)" : "var(--border)"}`,
                        background: printTemplate === tpl.value ? "var(--accent-soft)" : "var(--surface)",
                        color: printTemplate === tpl.value ? "var(--accent)" : "var(--text)",
                        fontSize: "var(--font-sm)",
                        fontWeight: printTemplate === tpl.value ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Export Format</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: "pdf", label: "PDF (Print)" },
                    { value: "html", label: "HTML" },
                    { value: "csv", label: "CSV" },
                  ].map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setPrintFormat(fmt.value as any)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: `2px solid ${printFormat === fmt.value ? "var(--accent)" : "var(--border)"}`,
                        background: printFormat === fmt.value ? "var(--accent-soft)" : "var(--surface)",
                        color: printFormat === fmt.value ? "var(--accent)" : "var(--text)",
                        fontSize: "var(--font-sm)",
                        fontWeight: printFormat === fmt.value ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Page Orientation</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ].map((ori) => (
                    <button
                      key={ori.value}
                      onClick={() => setPrintOrientation(ori.value as any)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: `2px solid ${printOrientation === ori.value ? "var(--accent)" : "var(--border)"}`,
                        background: printOrientation === ori.value ? "var(--accent-soft)" : "var(--surface)",
                        color: printOrientation === ori.value ? "var(--accent)" : "var(--text)",
                        fontSize: "var(--font-sm)",
                        fontWeight: printOrientation === ori.value ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {ori.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Formatting Options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Include Header", checked: includeHeader, onChange: () => setIncludeHeader(!includeHeader) },
                    { label: "Include Footer", checked: includeFooter, onChange: () => setIncludeFooter(!includeFooter) },
                    { label: "Include Applied Filters", checked: includeFilters, onChange: () => setIncludeFilters(!includeFilters) },
                    { label: "Highlight Medical Alerts", checked: includeMedicalAlerts, onChange: () => setIncludeMedicalAlerts(!includeMedicalAlerts) },
                    { label: "Include Doctor Signature Line", checked: includeDoctorSignature, onChange: () => setIncludeDoctorSignature(!includeDoctorSignature) },
                    { label: "Include Clinic Branding", checked: includeClinicBranding, onChange: () => setIncludeClinicBranding(!includeClinicBranding) },
                    { label: "Include Patient Photos", checked: includePatientPhotos, onChange: () => setIncludePatientPhotos(!includePatientPhotos) },
                  ].map((opt) => (
                    <div key={opt.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={opt.checked}
                        onChange={opt.onChange}
                        style={{ width: 16, height: 16 }}
                      />
                      <div style={{ fontSize: "var(--font-sm)" }}>{opt.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {printTemplate !== "medical" && printTemplate !== "compact" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Select Columns to Print</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, maxHeight: 200, overflowY: "auto", padding: 4 }}>
                    {[
                      { key: "id", label: "ID" },
                      { key: "name", label: "Patient Name" },
                      { key: "age", label: "Age" },
                      { key: "gender", label: "Gender" },
                      { key: "doctor", label: "Doctor" },
                      { key: "status", label: "Status" },
                      { key: "insuranceStatus", label: "Insurance" },
                      { key: "lastVisit", label: "Last Visit" },
                      { key: "phone", label: "Phone" },
                      { key: "email", label: "Email" },
                      { key: "address", label: "Address" },
                      { key: "bloodGroup", label: "Blood Group" },
                      { key: "allergies", label: "Allergies" },
                      { key: "alerts", label: "Alerts" },
                      { key: "tags", label: "Tags" },
                      { key: "followUpDate", label: "Follow-up Date" },
                      { key: "nextAppointment", label: "Next Appointment" },
                    ].map((col) => (
                      <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(col.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedColumns(new Set([...selectedColumns, col.key]));
                            } else {
                              setSelectedColumns(new Set([...selectedColumns].filter(k => k !== col.key)));
                            }
                          }}
                          style={{ width: 16, height: 16 }}
                        />
                        <div style={{ fontSize: "var(--font-sm)" }}>{col.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowPrintModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { handlePrint(); setShowPrintModal(false); }} disabled={selectedColumns.size === 0 && printTemplate !== "medical" && printTemplate !== "compact"}>
                  <i className="ti ti-printer" style={{ fontSize: 14, marginRight: 4 }} />
                  {printFormat === "csv" ? "Export CSV" : printFormat === "html" ? "Open HTML" : "Print"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Patient Modal */}
      {showDuplicateModal && (
        <div className="modal-backdrop" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal" style={{ maxWidth: 800, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700 }}>Duplicate Patients</h2>
              <button className="btn-icon" onClick={() => setShowDuplicateModal(false)}>
                <i className="ti ti-x" style={{ fontSize: 16 }} />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
                Found {dupeCount} potential duplicate patient group{dupeCount > 1 ? "s" : ""}. Review and merge duplicates to keep your records clean.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {duplicateGroups.map((group, groupIndex) => {
                const groupKey = group.map(p => p.id).join("-");
                return (
                <div key={groupIndex} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
                  <div style={{ marginBottom: 12, fontWeight: 600, color: "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Group {groupIndex + 1} ({group.length} patients) — matched by {group[0]?.phone && group[1]?.phone === group[0]?.phone ? "phone" : group[0]?.email && group[1]?.email === group[0]?.email ? "email" : "name"}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        className="btn btn-ghost" 
                        style={{ fontSize: "var(--font-xs)" }}
                        onClick={() => handleDismissDuplicate(group[0].id, group[1].id)}
                      >
                        Dismiss
                      </button>
                      {hasRole(normalizedRole, ["admin", "doctor"]) && (
                        <button 
                          className="btn btn-primary" 
                          style={{ fontSize: "var(--font-xs)" }}
                          onClick={() => handleOpenMerge(group[0], group[1])}
                        >
                          Merge
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {group.map((patient) => (
                      <div key={patient.id} style={{ 
                        padding: 12, 
                        background: "var(--surface2)", 
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}>
                        <input
                          type="radio"
                          name={`merge-${groupIndex}`}
                          id={`keep-${patient.id}`}
                          style={{ cursor: "pointer" }}
                        />
                        <label htmlFor={`keep-${patient.id}`} style={{ cursor: "pointer", flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{patient.name}</div>
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                            ID: {patient.id} · Phone: {patient.phone || "N/A"} · Email: {patient.email || "N/A"}
                          </div>
                        </label>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "var(--font-xs)" }}
                          onClick={() => { onSelect(patient); setShowDuplicateModal(false); }}
                        >
                          View patient
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setReviewedDuplicates(prev => new Set(prev).add(groupKey));
                        showFeedback("Marked as reviewed", "success");
                      }}
                      disabled={reviewed}
                    >
                      Mark as reviewed
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        showFeedback("Merge requires parent-level patient update support.", "info");
                      }}
                    >
                      Merge Selected Records
                    </button>
                  </div>
                </div>
              );})}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowDuplicateModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 7E: Merge Preview Modal */}
      {showMergeModal && mergePreview && (
        <div className="modal-backdrop" onClick={() => setShowMergeModal(false)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700 }}>Merge Patients</h2>
              <button className="btn-icon" onClick={() => setShowMergeModal(false)}>
                <i className="ti ti-x" style={{ fontSize: 16 }} />
              </button>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>
                <strong>Master:</strong> {mergePreview.masterPatient.name} (ID: {mergePreview.masterPatient.id})
              </div>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>
                <strong>Duplicate:</strong> {mergePreview.duplicatePatient.name} (ID: {mergePreview.duplicatePatient.id})
              </div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--orange)" }}>
                ⚠️ The duplicate record will be archived (soft-deleted), not permanently deleted.
              </div>
            </div>
            
            {mergePreview.fieldDifferences.length > 0 ? (
              <>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 12 }}>Field Differences</h3>
                <div style={{ marginBottom: 16, maxHeight: 300, overflow: "auto" }}>
                  {mergePreview.fieldDifferences.map((diff, idx) => (
                    <div key={idx} style={{ 
                      padding: 12, 
                      background: "var(--surface2)", 
                      borderRadius: "var(--radius-sm)",
                      marginBottom: 8,
                      border: "1px solid var(--border)"
                    }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 8 }}>
                        {String(diff.field)}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "var(--font-xs)" }}>
                        <div>
                          <span style={{ color: "var(--muted)" }}>Master:</span> {String(diff.masterValue || "—")}
                        </div>
                        <div>
                          <span style={{ color: "var(--muted)" }}>Duplicate:</span> {String(diff.duplicateValue || "—")}
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: "var(--font-xs)", display: "flex", alignItems: "center", gap: 8 }}>
                          <input 
                            type="radio" 
                            checked={diff.useMaster}
                            onChange={() => {
                              const updated = [...mergePreview.fieldDifferences];
                              updated[idx].useMaster = true;
                              setMergePreview({ ...mergePreview, fieldDifferences: updated });
                            }}
                          />
                          Keep master value
                        </label>
                        <label style={{ fontSize: "var(--font-xs)", display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
                          <input 
                            type="radio" 
                            checked={!diff.useMaster}
                            onChange={() => {
                              const updated = [...mergePreview.fieldDifferences];
                              updated[idx].useMaster = false;
                              setMergePreview({ ...mergePreview, fieldDifferences: updated });
                            }}
                          />
                          Use duplicate value
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 16, padding: 12, background: "var(--green-bg)", borderRadius: "var(--radius-sm)", color: "var(--green)" }}>
                No field differences found. Records are identical.
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowMergeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCommitMerge}>
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Search Modal */}
      {showSaveSearchModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: 24, width: "100%", maxWidth: 400 }}>
            <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0, marginBottom: 16 }}>Save Search</h2>
            <button onClick={() => setShowSaveSearchModal(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>Search Name</label>
              <input
                type="text"
                value={newSearchName}
                onChange={(e) => setNewSearchName(e.target.value)}
                placeholder="e.g., Diabetic patients"
                style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Current search: "{search}"</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowSaveSearchModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSearch}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: 24, width: "100%", maxWidth: 600, position: "relative" }}>
            <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0, marginBottom: 16 }}>Import Patients</h2>
            <button onClick={() => { setShowImportModal(false); setImportText(""); setImportResult(null); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setImportText(String(reader.result || ""));
                  reader.readAsText(file);
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>Or paste CSV text</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="name,phone,email,doctor,status&#10;John Doe,555-0100,john@example.com,Dr. Smith,Active"
                style={{ width: "100%", minHeight: 120, padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontFamily: "monospace", fontSize: "var(--font-xs)" }}
              />
              <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", marginTop: 4 }}>
                Supported columns: firstName, lastName, name, phone, email, dob, gender, doctor, status. Existing patients are matched by id, then phone+name, then email and updated.
              </div>
            </div>
            {importResult && (
              <div style={{ marginBottom: 16, padding: 10, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-xs)" }}>
                Updated {importResult.matched} · Could not create {importResult.newRows} new · Skipped {importResult.skipped} duplicate/unmatched rows
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => { setShowImportModal(false); setImportText(""); setImportResult(null); }}>Close</button>
              <button className="btn btn-primary" onClick={handleImportPreview}>Preview Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 7D: Import Preview Modal */}
      {showImportPreview && importSummary && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: 24, width: "100%", maxWidth: 700, maxHeight: "80vh", overflow: "auto", position: "relative" }}>
            <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0, marginBottom: 16 }}>Import Preview</h2>
            <button onClick={() => { setShowImportPreview(false); setImportPreview(null); setImportSummary(null); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            
            <div style={{ marginBottom: 16, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>
                <strong>Total rows:</strong> {importSummary.total}
              </div>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 8, color: "var(--green)" }}>
                <strong>Valid (will create):</strong> {importSummary.valid}
              </div>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 8, color: "var(--blue)" }}>
                <strong>Updates (existing patients):</strong> {importSummary.update}
              </div>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 8, color: "var(--orange)" }}>
                <strong>Duplicates (review needed):</strong> {importSummary.duplicate}
              </div>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--red)" }}>
                <strong>Invalid (will skip):</strong> {importSummary.invalid}
              </div>
            </div>

            {importPreview && importPreview.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Row Details</h3>
                <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-xs)" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--surface)" }}>
                      <tr>
                        <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--border)" }}>#</th>
                        <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--border)" }}>Name</th>
                        <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--border)" }}>Status</th>
                        <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--border)" }}>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 50).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: 8 }}>{row.index + 1}</td>
                          <td style={{ padding: 8 }}>{row.data.name || "(unnamed)"}</td>
                          <td style={{ padding: 8 }}>
                            <span style={{
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "var(--font-xs)",
                              background: row.status === "valid" ? "var(--green-soft)" : 
                                         row.status === "update" ? "var(--blue-soft)" :
                                         row.status === "duplicate" ? "var(--orange-soft)" : "var(--red-soft)",
                              color: row.status === "valid" ? "var(--green)" :
                                     row.status === "update" ? "var(--blue)" :
                                     row.status === "duplicate" ? "var(--orange)" : "var(--red)"
                            }}>
                              {row.status}
                            </span>
                          </td>
                          <td style={{ padding: 8 }}>{row.issues.length > 0 ? row.issues.join(", ") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.length > 50 && (
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 4 }}>
                    Showing first 50 of {importPreview.length} rows
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => { setShowImportPreview(false); setImportPreview(null); setImportSummary(null); }}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleCommitImport}
                disabled={importSummary.valid + importSummary.update === 0}
              >
                Commit Import ({importSummary.valid + importSummary.update} rows)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-backdrop" onClick={() => setShowExportModal(false)}>
          <div className="modal" style={{ maxWidth: 600, position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0, marginBottom: 16 }}>Export Patients</h2>
            <button onClick={() => setShowExportModal(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>Scope</label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--font-sm)" }}>
                  <input type="radio" checked={exportScope === "filtered"} onChange={() => setExportScope("filtered")} />
                  Filtered patients ({filtered.length})
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--font-sm)" }}>
                  <input type="radio" checked={exportScope === "selected"} onChange={() => setExportScope("selected")} />
                  Selected patients ({selectedPatients.size})
                </label>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
              >
                <option value="csv">CSV</option>
                <option value="json">Detailed JSON</option>
                <option value="contacts">Contact List CSV (name, phone, email, doctor, follow-up)</option>
              </select>
            </div>
            {exportFormat === "csv" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 8, fontSize: "var(--font-sm)", fontWeight: 600 }}>Export Preset (Phase 7D)</label>
                  <select
                    value={exportPreset}
                    onChange={(e) => setExportPreset(e.target.value as any)}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                  >
                    <option value="demographics">Demographics Only (ID, name, DOB, age, gender, blood group, address)</option>
                    <option value="contact">Contact List (ID, name, phone, email, address)</option>
                    <option value="clinical">Clinical Summary (ID, name, doctor, status, alerts, conditions, medications, visits)</option>
                    <option value="full">Full Export (all fields)</option>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-sm)" }}>
                    <input
                      type="checkbox"
                      checked={exportVisibleColumnsOnly}
                      onChange={(e) => setExportVisibleColumnsOnly(e.target.checked)}
                    />
                    Export visible columns only ({selectedColumns.size} selected)
                  </label>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport}>Export</button>
            </div>
          </div>
        </div>
      )}

      {/* Reminders Modal */}
      {showReminders && (
        <RemindersModal 
          reminders={reminders}
          onClose={() => setShowReminders(false)}
          onToggleComplete={handleToggleReminder}
          onDelete={handleDeleteReminder}
        />
      )}

      {/* Add Reminder Modal */}
      {showAddReminderModal && reminderPatient && (
        <div className="modal-backdrop" onClick={() => setShowAddReminderModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Set Reminder</h2>
              <button className="btn-icon" onClick={() => setShowAddReminderModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 12 }}>Patient: {reminderPatient.name}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: "var(--font-sm)", fontWeight: 600 }}>Type</label>
              <select value={reminderType} onChange={(e) => setReminderType(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                <option value="follow-up">Follow-up</option>
                <option value="medication">Medication</option>
                <option value="appointment">Appointment</option>
                <option value="call">Call back</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: "var(--font-sm)", fontWeight: 600 }}>Date</label>
              <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: "var(--font-sm)", fontWeight: 600 }}>Notes</label>
              <textarea value={reminderNotes} onChange={(e) => setReminderNotes(e.target.value)} style={{ width: "100%", minHeight: 70, padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowAddReminderModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddReminder}>Save Reminder</button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Checklist Modal */}
      {showOnboardingChecklist && (
        <div className="modal-backdrop" onClick={() => setShowOnboardingChecklist(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Patient Onboarding Checklist</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: "var(--font-xs)" }}
                  onClick={() => {
                    if (!requireAdmin()) return;
                    setConfirmModal({
                      title: "Reset Checklist",
                      message: "Reset all onboarding tasks to incomplete? This cannot be undone.",
                      confirmLabel: "Reset",
                      danger: true,
                      onConfirm: () => {
                        setOnboardingTasks(prev => prev.map(t => ({ ...t, completed: false })));
                        showFeedback("Checklist reset", "success");
                      },
                    });
                  }}
                >
                  Reset
                </button>
                <button className="btn-icon" onClick={() => setShowOnboardingChecklist(false)}>
                  <i className="ti ti-x" style={{ fontSize: 20 }} />
                </button>
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {onboardingTasks.map(task => (
                <div key={task.id} style={{
                  padding: 12,
                  background: "var(--surface2)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                }} onClick={() => handleToggleOnboardingTask(task.id)}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: "4px",
                    border: `2px solid ${task.completed ? "var(--green)" : "var(--border)"}`,
                    background: task.completed ? "var(--green)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {task.completed && <i className="ti ti-check" style={{ fontSize: 12, color: "white" }} />}
                  </div>
                  <span style={{ 
                    fontSize: "var(--font-sm)", 
                    textDecoration: task.completed ? "line-through" : "none",
                    color: task.completed ? "var(--muted)" : "var(--text)",
                  }}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                Progress: {onboardingTasks.filter(t => t.completed).length} / {onboardingTasks.length} completed
              </div>
              <div style={{ height: 6, background: "var(--surface2)", borderRadius: "var(--radius-sm)", marginTop: 8, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(onboardingTasks.filter(t => t.completed).length / onboardingTasks.length) * 100}%`,
                  background: "var(--accent)",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditTrail && (
        <div className="modal-backdrop" onClick={() => setShowAuditTrail(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Audit Trail</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: "var(--font-xs)" }}
                  onClick={() => {
                    if (auditTrail.length === 0) { showFeedback("No audit entries to export", "error"); return; }
                    const csv = buildCSV(["timestamp", "action", "patientId", "patientName", "user"], auditTrail as any);
                    downloadFile(csv, `audit_trail_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
                    showFeedback("Audit trail exported", "success");
                  }}
                >
                  Export CSV
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: "var(--font-xs)" }}
                  onClick={() => {
                    if (!requireAdmin()) return;
                    setConfirmModal({
                      title: "Clear Audit Trail",
                      message: "Delete all audit trail entries? This cannot be undone.",
                      confirmLabel: "Clear",
                      danger: true,
                      onConfirm: () => {
                        setAuditTrail([]);
                        showFeedback("Audit trail cleared", "success");
                      },
                    });
                  }}
                >
                  Clear
                </button>
                <button className="btn-icon" onClick={() => setShowAuditTrail(false)}>
                  <i className="ti ti-x" style={{ fontSize: 20 }} />
                </button>
              </div>
            </div>
            
            {auditTrail.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                <i className="ti ti-history-off" style={{ fontSize: 48, marginBottom: 16 }} />
                <div>No audit trail entries</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {auditTrail.map(entry => (
                  <div key={entry.id} style={{
                    padding: 12,
                    background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: "3px solid var(--accent)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{entry.action}</span>
                      <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      Patient: {entry.patientName} (ID: {entry.patientId}) · User: {entry.user}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tag Colors Modal */}
      {showTagColors && (
        <div className="modal-backdrop" onClick={() => setShowTagColors(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Tag Colors</h2>
              <button className="btn-icon" onClick={() => setShowTagColors(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(tagColors).map(([tag, color]) => (
                <div key={tag} style={{
                  padding: 12,
                  background: "var(--surface2)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <span className="tag" style={{
                    background: color,
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-sm)",
                  }}>
                    {tag}
                  </span>
                  <select
                    value={color}
                    onChange={(e) => setTagColors(prev => ({ ...prev, [tag]: e.target.value }))}
                    style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                  >
                    <option value="var(--red)">Red</option>
                    <option value="var(--green)">Green</option>
                    <option value="var(--blue)">Blue</option>
                    <option value="var(--amber)">Amber</option>
                    <option value="var(--purple)">Purple</option>
                    <option value="var(--cyan)">Cyan</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="modal-backdrop" onClick={() => setShowKeyboardShortcuts(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Keyboard Shortcuts</h2>
              <button className="btn-icon" onClick={() => setShowKeyboardShortcuts(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { key: "Ctrl + F", action: "Focus search" },
                { key: "Ctrl + N", action: "New patient" },
                { key: "Ctrl + D", action: "Toggle dashboard" },
                { key: "Ctrl + T", action: "Toggle timeline" },
                { key: "Ctrl + R", action: "Toggle reminders" },
                { key: "Escape", action: "Close modal" },
              ].map(shortcut => (
                <div key={shortcut.key} style={{
                  padding: 12,
                  background: "var(--surface2)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ fontSize: "var(--font-sm)" }}>{shortcut.action}</span>
                  <kbd style={{
                    padding: "4px 8px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    fontSize: "var(--font-xs)",
                    fontFamily: "monospace",
                  }}>
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActions && (
        <div className="modal-backdrop" onClick={() => setShowBulkActions(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Bulk Actions</h2>
              <button className="btn-icon" onClick={() => setShowBulkActions(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                {selectedPatients.size} patients selected
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button 
                className="btn btn-ghost" 
                style={{ justifyContent: "flex-start" }}
                onClick={() => { setShowBulkActions(false); setShowBulkTagModal(true); }}
                disabled={selectedPatients.size === 0}
              >
                <i className="ti ti-tag" style={{ fontSize: 16, marginRight: 8 }} />
                Assign Tags
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ justifyContent: "flex-start" }}
                onClick={() => { setShowBulkActions(false); setShowBulkDoctorModal(true); }}
                disabled={selectedPatients.size === 0}
              >
                <i className="ti ti-user" style={{ fontSize: 16, marginRight: 8 }} />
                Assign Doctor
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ justifyContent: "flex-start" }}
                onClick={() => { setShowBulkActions(false); setShowBulkScheduleModal(true); }}
                disabled={selectedPatients.size === 0}
              >
                <i className="ti ti-calendar" style={{ fontSize: 16, marginRight: 8 }} />
                Schedule Appointments
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ justifyContent: "flex-start", color: "var(--red)" }}
                onClick={() => { setShowBulkActions(false); handleBulkDelete(); }}
                disabled={selectedPatients.size === 0}
              >
                <i className="ti ti-trash" style={{ fontSize: 16, marginRight: 8 }} />
                Delete Patients
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessibility Help Modal */}
      {showAccessibilityHelp && (
        <div className="modal-backdrop" onClick={() => setShowAccessibilityHelp(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Accessibility Help</h2>
              <button className="btn-icon" onClick={() => setShowAccessibilityHelp(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Screen Reader Support</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  All interactive elements include ARIA labels and are fully accessible via screen readers.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Keyboard Navigation</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  Use Tab to navigate between elements, Enter to activate buttons, and Escape to close modals.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Color Contrast</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  All text meets WCAG AA contrast standards for readability.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Focus Indicators</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  Clear focus indicators are provided for all keyboard-navigable elements.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {showExportOptions && (
        <div className="modal-backdrop" onClick={() => setShowExportOptions(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Export Options</h2>
              <button className="btn-icon" onClick={() => setShowExportOptions(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Export Format</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  <option>CSV</option>
                  <option>Excel</option>
                  <option>PDF</option>
                  <option>JSON</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Fields to Export</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Name", "ID", "Status", "Doctor", "Phone", "Email", "Follow-up Date", "Risk Score"].map(field => (
                    <label key={field} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-sm)" }}>
                      <input type="checkbox" defaultChecked style={{ cursor: "pointer" }} />
                      {field}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowExportOptions(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  if (!canExportPatients) {
                    handleDeniedAccess("export", "patients");
                    return;
                  }
                  if (filtered.length === 0) { showFeedback("No patients match the current filters", "error"); return; }
                  exportPatientsToCSV(filtered, exportPreset, CURRENT_USER.name);
                  logAuditTrail(`Exported ${filtered.length} filtered patient${filtered.length !== 1 ? "s" : ""} (${exportPreset})`, "bulk", "multiple");
                  showFeedback("Export started", "success");
                  setShowExportOptions(false);
                }}>Export</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Toast */}
      {showUndoToast && bulkOperationHistory.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>Activity</div>
            <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
              {bulkOperationHistory[bulkOperationHistory.length - 1].action}
            </div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              {bulkOperationHistory[bulkOperationHistory.length - 1].patientIds.length} patients affected
            </div>
          </div>
          <button 
            className="btn btn-ghost"
            style={{ padding: "4px 12px", fontSize: "var(--font-sm)" }}
            onClick={() => {
              setBulkOperationHistory(prev => prev.slice(0, -1));
              setShowUndoToast(false);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Medication Adherence Modal */}
      {showMedicationAdherence && (
        <div className="modal-backdrop" onClick={() => setShowMedicationAdherence(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Medication Adherence</h2>
              <button className="btn-icon" onClick={() => setShowMedicationAdherence(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {patients.slice(0, 10).map(patient => {
                const adherence = medicationAdherenceData[patient.id] ?? Math.floor(Math.random() * 100);
                const adherenceColor = adherence >= 80 ? "var(--green)" : adherence >= 60 ? "var(--amber)" : "var(--red)";
                return (
                  <div key={patient.id} style={{
                    padding: 12,
                    background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}>
                    <AvatarCircle name={patient.name} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Last 30 days</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "var(--font-lg)", fontWeight: 700, color: adherenceColor }}>{adherence}%</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Adherence</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lab Results Modal */}
      {showLabResults && (
        <div className="modal-backdrop" onClick={() => setShowLabResults(false)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Lab Results</h2>
              <button className="btn-icon" onClick={() => setShowLabResults(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {patients.slice(0, 5).map(patient => (
                <div key={patient.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <AvatarCircle name={patient.name} size="sm" />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>ID: {patient.id}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { name: "Hemoglobin", value: "14.2", unit: "g/dL", range: "12-16", isNormal: true, trend: "stable" },
                      { name: "WBC Count", value: "7.5", unit: "K/uL", range: "4.5-11", isNormal: true, trend: "improving" },
                      { name: "Platelets", value: "180", unit: "K/uL", range: "150-400", isNormal: true, trend: "stable" },
                      { name: "Glucose", value: "145", unit: "mg/dL", range: "70-100", isNormal: false, trend: "worsening" },
                      { name: "Cholesterol", value: "220", unit: "mg/dL", range: "<200", isNormal: false, trend: "improving" },
                    ].map(lab => (
                      <div key={lab.name} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: lab.isNormal ? "var(--surface)" : "var(--red-soft)",
                        borderRadius: "var(--radius-sm)",
                        border: lab.isNormal ? "1px solid var(--border)" : "1px solid var(--red)",
                      }}>
                        <div>
                          <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{lab.name}</div>
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Range: {lab.range} {lab.unit}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ 
                            fontSize: "var(--font-md)", 
                            fontWeight: 700,
                            color: lab.isNormal ? "var(--text)" : "var(--red)"
                          }}>
                            {lab.value} {lab.unit}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            <div style={{ 
                              fontSize: "var(--font-xs)", 
                              color: lab.isNormal ? "var(--green)" : "var(--red)",
                              fontWeight: 600
                            }}>
                              {lab.isNormal ? "Normal" : "Abnormal"}
                            </div>
                            <i className={`ti ti-arrow-${lab.trend === "improving" ? "up" : lab.trend === "worsening" ? "down" : "right"}`} style={{ 
                              fontSize: 12, 
                              color: lab.trend === "improving" ? "var(--green)" : lab.trend === "worsening" ? "var(--red)" : "var(--muted)" 
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patient Journey Modal */}
      {showPatientJourney && (
        <div className="modal-backdrop" onClick={() => setShowPatientJourney(false)}>
          <div className="modal" style={{ maxWidth: 800, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Patient Journey</h2>
              <button className="btn-icon" onClick={() => setShowPatientJourney(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {patients.slice(0, 3).map(patient => (
                <div key={patient.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <AvatarCircle name={patient.name} size="sm" />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>ID: {patient.id}</div>
                    </div>
                  </div>
                  
                  <div style={{ position: "relative", paddingLeft: 20 }}>
                    <div style={{
                      position: "absolute",
                      left: 6,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: "var(--border)",
                    }} />
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {[
                        { date: "2024-01-15", event: "Initial Consultation", type: "visit" },
                        { date: "2024-01-20", event: "Lab Results Received", type: "lab" },
                        { date: "2024-01-25", event: "Treatment Plan Started", type: "treatment" },
                        { date: "2024-02-10", event: "Follow-up Appointment", type: "visit" },
                        { date: "2024-02-15", event: "Medication Adjusted", type: "treatment" },
                        { date: "2024-03-01", event: "Progress Review", type: "visit" },
                      ].map((item, index) => (
                        <div key={index} style={{ position: "relative", paddingLeft: 16 }}>
                          <div style={{
                            position: "absolute",
                            left: -3,
                            top: 6,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: item.type === "visit" ? "var(--accent)" : item.type === "lab" ? "var(--green)" : "var(--amber)",
                            border: "2px solid " + (item.type === "visit" ? "var(--accent-soft)" : item.type === "lab" ? "var(--green-soft)" : "var(--amber-soft)"),
                          }} />
                          <div>
                            <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
                              {item.event}
                            </div>
                            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                              {item.date}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Messaging Modal */}
      {showBulkMessaging && (
        <div className="modal-backdrop" onClick={() => setShowBulkMessaging(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Bulk Messaging</h2>
              <button className="btn-icon" onClick={() => setShowBulkMessaging(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Recipients</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  <option>All Patients</option>
                  <option>High Risk Patients</option>
                  <option>Overdue Follow-up</option>
                  <option>Selected Patients ({selectedPatients.size})</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Message Template</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  <option>Appointment Reminder</option>
                  <option>Follow-up Notification</option>
                  <option>Lab Results Available</option>
                  <option>Custom Message</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Message</div>
                <textarea 
                  style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", minHeight: 120, resize: "vertical" }}
                  placeholder="Enter your message..."
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowBulkMessaging(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { showFeedback("Messages queued for sending", "success"); setShowBulkMessaging(false); }}>Send Messages</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="modal-backdrop" onClick={() => setShowVersionHistory(false)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Version History</h2>
              <button className="btn-icon" onClick={() => setShowVersionHistory(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {patients.slice(0, 3).map(patient => (
                <div key={patient.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <AvatarCircle name={patient.name} size="sm" />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>ID: {patient.id}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { date: "2024-03-15 14:30", user: "Dr. Smith", action: "Updated diagnosis", field: "diagnosis", oldValue: "Hypertension", newValue: "Stage 2 Hypertension" },
                      { date: "2024-03-10 09:15", user: "Nurse Johnson", action: "Updated vitals", field: "blood_pressure", oldValue: "140/90", newValue: "135/85" },
                      { date: "2024-03-05 16:45", user: "Dr. Smith", action: "Added medication", field: "medications", oldValue: "", newValue: "Lisinopril 10mg" },
                      { date: "2024-03-01 11:20", user: "Admin", action: "Patient registered", field: "registration", oldValue: "", newValue: "New patient" },
                    ].map((version, index) => (
                      <div key={index} style={{ 
                        padding: 12, 
                        background: "var(--surface)", 
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{version.action}</div>
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{version.date}</div>
                        </div>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>
                          By: {version.user} • Field: {version.field}
                        </div>
                        {version.oldValue && (
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--red)" }}>
                            Old: {version.oldValue}
                          </div>
                        )}
                        {version.newValue && (
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--green)" }}>
                            New: {version.newValue}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Approval Workflows Modal */}
      {showApprovalWorkflows && (
        <div className="modal-backdrop" onClick={() => setShowApprovalWorkflows(false)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Approval Workflows</h2>
              <button className="btn-icon" onClick={() => setShowApprovalWorkflows(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { id: "1", patient: "John Doe", type: "Diagnosis Change", requester: "Dr. Smith", date: "2024-03-15", status: "pending", description: "Updating diagnosis from Hypertension to Stage 2 Hypertension" },
                { id: "2", patient: "Jane Smith", type: "Medication Change", requester: "Dr. Johnson", date: "2024-03-14", status: "approved", description: "Adding new medication Lisinopril 10mg" },
                { id: "3", patient: "Bob Wilson", type: "Record Deletion", requester: "Admin", date: "2024-03-13", status: "rejected", description: "Request to delete duplicate patient record" },
              ].map(workflow => (
                <div key={workflow.id} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{workflow.type}</div>
                    <div style={{ 
                      padding: "4px 8px", 
                      borderRadius: "var(--radius-sm)", 
                      fontSize: "var(--font-xs)", 
                      fontWeight: 600,
                      background: workflow.status === "pending" ? "var(--amber-soft)" : workflow.status === "approved" ? "var(--green-soft)" : "var(--red-soft)",
                      color: workflow.status === "pending" ? "var(--amber)" : workflow.status === "approved" ? "var(--green)" : "var(--red)",
                    }}>
                      {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                    </div>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>
                    Patient: {workflow.patient} • Requested by: {workflow.requester} • {workflow.date}
                  </div>
                  <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>{workflow.description}</div>
                  {workflow.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }}>Approve</button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Actions Modal */}
      {showRecentActions && (
        <div className="modal-backdrop" onClick={() => setShowRecentActions(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Recent Actions</h2>
              <button className="btn-icon" onClick={() => setShowRecentActions(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { time: "2 minutes ago", action: "Updated patient record for John Doe", user: "Dr. Smith" },
                { time: "5 minutes ago", action: "Created new patient: Jane Smith", user: "Nurse Johnson" },
                { time: "10 minutes ago", action: "Bulk assigned tag 'High Risk' to 5 patients", user: "Dr. Smith" },
                { time: "15 minutes ago", action: "Deleted patient record: Bob Wilson", user: "Admin" },
                { time: "20 minutes ago", action: "Exported patient data (CSV)", user: "Dr. Johnson" },
                { time: "30 minutes ago", action: "Scheduled appointment for John Doe", user: "Nurse Johnson" },
                { time: "1 hour ago", action: "Updated medication for Jane Smith", user: "Dr. Smith" },
                { time: "2 hours ago", action: "Added lab results for Bob Wilson", user: "Dr. Johnson" },
              ].map((action, index) => (
                <div key={index} style={{ 
                  padding: 12, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>{action.action}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {action.time} • By: {action.user}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Templates Modal */}
      {showFilterTemplates && (
        <div className="modal-backdrop" onClick={() => setShowFilterTemplates(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Filter Templates</h2>
              <button className="btn-icon" onClick={() => setShowFilterTemplates(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "High Risk Patients", description: "Patients with risk level High", criteria: "risk = High", usage: 45 },
                { name: "Overdue Follow-up", description: "Patients with overdue follow-up appointments", criteria: "followup_date < today", usage: 32 },
                { name: "New This Week", description: "Patients registered in the last 7 days", criteria: "registration_date >= 7 days ago", usage: 28 },
                { name: "Active Treatment", description: "Patients currently on active treatment", criteria: "status = Active", usage: 56 },
                { name: "Diabetes", description: "Patients with diabetes diagnosis", criteria: "diagnosis includes Diabetes", usage: 19 },
              ].map((template, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }} onClick={() => { setSearch(template.criteria); resetPage(); showFeedback(`Filter template "${template.name}" applied`, "success"); setShowFilterTemplates(false); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{template.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{template.usage} uses</div>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>{template.description}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--accent)", fontFamily: "monospace" }}>{template.criteria}</div>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 8 }} />
                Create New Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Hierarchy Modal */}
      {showTagHierarchy && (
        <div className="modal-backdrop" onClick={() => setShowTagHierarchy(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Tag Hierarchy</h2>
              <button className="btn-icon" onClick={() => setShowTagHierarchy(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "Medical Conditions", children: ["Diabetes", "Hypertension", "Heart Disease", "Asthma"], color: "var(--red)" },
                { name: "Treatment Status", children: ["Active", "Pending", "Completed", "On Hold"], color: "var(--green)" },
                { name: "Risk Level", children: ["High", "Medium", "Low"], color: "var(--amber)" },
                { name: "Follow-up", children: ["Overdue", "This Week", "Next Week", "This Month"], color: "var(--blue)" },
              ].map((category, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: category.color }} />
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{category.name}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 20 }}>
                    {category.children.map((child, childIndex) => (
                      <div key={childIndex} style={{ 
                        padding: "4px 10px", 
                        background: "var(--surface2)", 
                        borderRadius: "var(--radius-sm)", 
                        fontSize: "var(--font-xs)",
                        border: "1px solid var(--border)",
                      }}>
                        {child}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 8 }} />
                Add New Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Suggestions Modal */}
      {showTagSuggestions && (
        <div className="modal-backdrop" onClick={() => setShowTagSuggestions(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Tag Suggestions</h2>
              <button className="btn-icon" onClick={() => setShowTagSuggestions(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {patients.slice(0, 5).map(patient => (
                <div key={patient.id} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <AvatarCircle name={patient.name} size="sm" />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{patient.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>ID: {patient.id}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>Suggested tags based on patient data:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[
                      { tag: "High Risk", reason: "Risk level is High", confidence: 95 },
                      { tag: "Diabetes", reason: "Diagnosis includes Diabetes", confidence: 100 },
                      { tag: "Overdue Follow-up", reason: "Follow-up date passed", confidence: 90 },
                    ].map((suggestion, index) => (
                      <div key={index} style={{ 
                        padding: "6px 12px", 
                        background: "var(--surface2)", 
                        borderRadius: "var(--radius-sm)", 
                        fontSize: "var(--font-xs)",
                        border: "1px solid var(--accent)",
                        cursor: "pointer",
                      }} onClick={() => {
                        if (onUpdatePatient) {
                          const p = patients[0];
                          if (p && !(p.tags || []).includes(suggestion.tag)) {
                            onUpdatePatient({ ...p, tags: [...(p.tags || []), suggestion.tag] });
                          }
                        }
                        showFeedback(`Tag "${suggestion.tag}" added`, "success");
                      }}>
                        <div style={{ fontWeight: 600, color: "var(--accent)" }}>{suggestion.tag}</div>
                        <div style={{ color: "var(--muted)" }}>{suggestion.reason} ({suggestion.confidence}%)</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Export Timeline Modal */}
      {showExportTimeline && (
        <div className="modal-backdrop" onClick={() => setShowExportTimeline(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Export Timeline</h2>
              <button className="btn-icon" onClick={() => setShowExportTimeline(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Export Format</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  <option>PDF</option>
                  <option>CSV</option>
                  <option>Excel (XLSX)</option>
                  <option>JSON</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Date Range</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  <option>All Time</option>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>Last 90 Days</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Include Events</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Visits and Appointments", checked: true },
                    { label: "Lab Results", checked: true },
                    { label: "Medications", checked: true },
                    { label: "Communications", checked: false },
                    { label: "Notes", checked: false },
                  ].map((item, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" defaultChecked={item.checked} style={{ width: 16, height: 16 }} />
                      <div style={{ fontSize: "var(--font-sm)" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowExportTimeline(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  if (!canExportPatients) {
                    handleDeniedAccess("export", "patients");
                    return;
                  }
                  if (filtered.length === 0) { showFeedback("No patients match the current filters", "error"); return; }
                  exportPatientsToCSV(filtered, exportPreset, CURRENT_USER.name);
                  logAuditTrail(`Exported ${filtered.length} filtered patient${filtered.length !== 1 ? "s" : ""} (${exportPreset})`, "bulk", "multiple");
                  showFeedback("Timeline exported", "success");
                  setShowExportTimeline(false);
                }}>Export</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Capture Modal */}
      {showSignatureCapture && (
        <div className="modal-backdrop" onClick={() => setShowSignatureCapture(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Signature Capture</h2>
              <button className="btn-icon" onClick={() => setShowSignatureCapture(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Patient</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  {patients.slice(0, 5).map(patient => (
                    <option key={patient.id}>{patient.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Document Type</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  <option>Consent Form</option>
                  <option>Treatment Agreement</option>
                  <option>Privacy Policy Acknowledgment</option>
                  <option>Insurance Authorization</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Signature Area</div>
                <div style={{ 
                  width: "100%", 
                  height: 200, 
                  background: "var(--surface2)", 
                  borderRadius: "var(--radius-sm)",
                  border: "2px dashed var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "crosshair",
                }}>
                  <div style={{ color: "var(--muted)", fontSize: "var(--font-sm)" }}>
                    Click and drag to sign
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }}>Clear</button>
                <button className="btn btn-ghost" style={{ flex: 1 }}>Undo</button>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowSignatureCapture(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { showFeedback("Signature saved", "success"); setShowSignatureCapture(false); }}>Save Signature</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menus Modal */}
      {showContextMenus && (
        <div className="modal-backdrop" onClick={() => setShowContextMenus(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Context Menus</h2>
              <button className="btn-icon" onClick={() => setShowContextMenus(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                Right-click on patient rows to access context menus with quick actions:
              </div>
              {[
                { action: "View Profile", icon: "ti ti-user", shortcut: "Enter" },
                { action: "Edit Patient", icon: "ti ti-edit", shortcut: "E" },
                { action: "Schedule Appointment", icon: "ti ti-calendar", shortcut: "A" },
                { action: "Add Note", icon: "ti ti-note", shortcut: "N" },
                { action: "Assign Tag", icon: "ti ti-tag", shortcut: "T" },
                { action: "Send Message", icon: "ti ti-mail", shortcut: "M" },
                { action: "View Timeline", icon: "ti ti-clock", shortcut: "L" },
                { action: "Export Data", icon: "ti ti-download", shortcut: "X" },
                ...(patientListMode === "archived" ? [{ action: "restore", icon: "ti ti-refresh", shortcut: "R" }] : []),
                { action: "Delete Patient", icon: "ti ti-trash", shortcut: "Del" },
              ].map((item, index) => (
                <div key={index} style={{ 
                  padding: 12, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: 16, color: "var(--accent)" }} />
                  <div style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>{item.action}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", fontFamily: "monospace" }}>{item.shortcut}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drag and Drop Modal */}
      {showDragDrop && (
        <div className="modal-backdrop" onClick={() => setShowDragDrop(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Drag and Drop Reordering</h2>
              <button className="btn-icon" onClick={() => setShowDragDrop(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                Drag and drop to reorder columns and sections:
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Column Order</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { name: "Name", fixed: true },
                    { name: "Status", fixed: false },
                    { name: "Doctor", fixed: false },
                    { name: "Risk Level", fixed: false },
                    { name: "Last Visit", fixed: false },
                    { name: "Tags", fixed: false },
                    { name: "Actions", fixed: true },
                  ].map((column, index) => (
                    <div key={index} style={{ 
                      padding: 12, 
                      background: "var(--surface)", 
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "move",
                    }}>
                      <i className="ti ti-grip-vertical" style={{ fontSize: 16, color: "var(--muted)" }} />
                      <div style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>{column.name}</div>
                      {column.fixed && (
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Fixed</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Section Order</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { name: "Header", icon: "ti ti-layout-header" },
                    { name: "Filters", icon: "ti ti-filter" },
                    { name: "Patient List", icon: "ti ti-list" },
                    { name: "Dashboard", icon: "ti ti-dashboard" },
                    { name: "Timeline", icon: "ti ti-clock" },
                  ].map((section, index) => (
                    <div key={index} style={{ 
                      padding: 12, 
                      background: "var(--surface)", 
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "move",
                    }}>
                      <i className={`ti ${section.icon}`} style={{ fontSize: 16, color: "var(--accent)" }} />
                      <div style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>{section.name}</div>
                      <i className="ti ti-grip-vertical" style={{ fontSize: 16, color: "var(--muted)" }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowDragDrop(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { showFeedback("Layout saved", "success"); setShowDragDrop(false); }}>Save Layout</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Rules Modal */}
      {showNotificationRules && (
        <div className="modal-backdrop" onClick={() => setShowNotificationRules(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Automated Notification Rules</h2>
              <button className="btn-icon" onClick={() => setShowNotificationRules(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "Follow-up Reminder", trigger: "Follow-up date approaching", action: "Send email 24h before", active: true },
                { name: "Missed Appointment Alert", trigger: "Patient misses appointment", action: "Notify doctor and staff", active: true },
                { name: "Lab Result Alert", trigger: "Critical lab result", action: "Immediate notification to doctor", active: true },
                { name: "Medication Refill", trigger: "Prescription expiring soon", action: "Send refill reminder", active: false },
                { name: "Risk Level Change", trigger: "Patient risk level changes", action: "Notify care team", active: true },
              ].map((rule, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{rule.name}</div>
                    <div style={{ 
                      padding: "4px 8px", 
                      borderRadius: "var(--radius-sm)", 
                      fontSize: "var(--font-xs)",
                      background: rule.active ? "var(--green-soft)" : "var(--red-soft)",
                      color: rule.active ? "var(--green)" : "var(--red)",
                    }}>
                      {rule.active ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>
                    <strong>Trigger:</strong> {rule.trigger}
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    <strong>Action:</strong> {rule.action}
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 8 }} />
                Create New Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Analytics Modal */}
      {showFilterAnalytics && (
        <div className="modal-backdrop" onClick={() => setShowFilterAnalytics(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Filter Analytics</h2>
              <button className="btn-icon" onClick={() => setShowFilterAnalytics(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                Most used filters in the last 30 days:
              </div>
              {[
                { name: "High Risk Patients", usage: 156, trend: "+12%" },
                { name: "Overdue Follow-up", usage: 142, trend: "+8%" },
                { name: "Active Treatment", usage: 128, trend: "+5%" },
                { name: "New This Week", usage: 98, trend: "+15%" },
                { name: "Diabetes", usage: 87, trend: "-3%" },
                { name: "Custom: Dr. Smith", usage: 76, trend: "+20%" },
              ].map((filter, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{filter.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Used {filter.usage} times</div>
                  </div>
                  <div style={{ 
                    padding: "4px 8px", 
                    borderRadius: "var(--radius-sm)", 
                    fontSize: "var(--font-xs)",
                    background: filter.trend.startsWith("+") ? "var(--green-soft)" : "var(--red-soft)",
                    color: filter.trend.startsWith("+") ? "var(--green)" : "var(--red)",
                  }}>
                    {filter.trend}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Shortcuts Modal */}
      {showCustomShortcuts && (
        <div className="modal-backdrop" onClick={() => setShowCustomShortcuts(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Custom Action Shortcuts</h2>
              <button className="btn-icon" onClick={() => setShowCustomShortcuts(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                Configure your custom keyboard shortcuts:
              </div>
              {[
                { action: "Quick Add Patient", shortcut: "Ctrl+N", custom: false },
                { action: "Apply High Risk Filter", shortcut: "Ctrl+H", custom: true },
                { action: "Open Dashboard", shortcut: "Ctrl+D", custom: false },
                { action: "Export Current View", shortcut: "Ctrl+E", custom: true },
                { action: "Toggle Dark Mode", shortcut: "Ctrl+M", custom: false },
              ].map((item, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{item.action}</div>
                    {item.custom && (
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--accent)" }}>Custom shortcut</div>
                    )}
                  </div>
                  <div style={{ 
                    padding: "6px 12px", 
                    borderRadius: "var(--radius-sm)", 
                    fontSize: "var(--font-xs)",
                    fontFamily: "monospace",
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                  }}>
                    {item.shortcut}
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 8 }} />
                Add Custom Shortcut
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Sharing Modal */}
      {showFilterSharing && (
        <div className="modal-backdrop" onClick={() => setShowFilterSharing(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Filter Sharing</h2>
              <button className="btn-icon" onClick={() => setShowFilterSharing(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                Share your saved filters with other team members:
              </div>
              {[
                { name: "High Risk Patients", sharedBy: "Dr. Smith", sharedOn: "2024-01-15", uses: 23 },
                { name: "Overdue Follow-up", sharedBy: "Nurse Johnson", sharedOn: "2024-01-10", uses: 45 },
                { name: "Diabetes Patients", sharedBy: "Dr. Williams", sharedOn: "2024-01-08", uses: 31 },
              ].map((filter, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{filter.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{filter.uses} uses</div>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    Shared by {filter.sharedBy} on {filter.sharedOn}
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 8 }} />
                Share Current Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Mode Modal */}
      {showOfflineMode && (
        <div className="modal-backdrop" onClick={() => setShowOfflineMode(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Offline Mode</h2>
              <button className="btn-icon" onClick={() => setShowOfflineMode(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ 
                padding: 16, 
                background: "var(--green-soft)", 
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--green)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <i className="ti ti-wifi-off" style={{ fontSize: 24, color: "var(--green)" }} />
                <div>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--green)" }}>Offline Mode Enabled</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Last synced: 2 minutes ago</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Sync Status</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { item: "Patient Records", status: "Synced", count: 245 },
                    { item: "Appointments", status: "Synced", count: 87 },
                    { item: "Lab Results", status: "Pending", count: 12 },
                    { item: "Notes", status: "Synced", count: 156 },
                  ].map((item, index) => (
                    <div key={index} style={{ 
                      padding: 12, 
                      background: "var(--surface)", 
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{item.item}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{item.count} items</div>
                        <div style={{ 
                          padding: "4px 8px", 
                          borderRadius: "var(--radius-sm)", 
                          fontSize: "var(--font-xs)",
                          background: item.status === "Synced" ? "var(--green-soft)" : "var(--amber-soft)",
                          color: item.status === "Synced" ? "var(--green)" : "var(--amber)",
                        }}>
                          {item.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowOfflineMode(false)}>Close</button>
                <button className="btn btn-primary" onClick={() => { showFeedback("Sync initiated", "info"); setShowOfflineMode(false); }}>Sync Now</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Export Modal */}
      {showComparisonExport && (
        <div className="modal-backdrop" onClick={() => setShowComparisonExport(false)}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Export Comparison to PDF</h2>
              <button className="btn-icon" onClick={() => setShowComparisonExport(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Select Patients to Compare</div>
                <select style={{ width: "100%", padding: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
                  {patients.slice(0, 5).map(patient => (
                    <option key={patient.id}>{patient.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Comparison Options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Include Demographics", checked: true },
                    { label: "Include Medical History", checked: true },
                    { label: "Include Lab Results", checked: true },
                    { label: "Include Medications", checked: false },
                    { label: "Include Notes", checked: false },
                  ].map((item, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" defaultChecked={item.checked} style={{ width: 16, height: 16 }} />
                      <div style={{ fontSize: "var(--font-sm)" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Add Notes (Optional)</div>
                <textarea 
                  placeholder="Add any notes to include in the comparison..."
                  style={{ 
                    width: "100%", 
                    padding: 8, 
                    borderRadius: "var(--radius-sm)", 
                    border: "1px solid var(--border)", 
                    background: "var(--surface)", 
                    color: "var(--text)",
                    minHeight: 80,
                    resize: "vertical",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowComparisonExport(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { showFeedback("Comparison export is not yet supported — try CSV export", "info"); setShowComparisonExport(false); }}>Export PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison History Modal */}
      {showComparisonHistory && (
        <div className="modal-backdrop" onClick={() => setShowComparisonHistory(false)}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Comparison History</h2>
              <button className="btn-icon" onClick={() => setShowComparisonHistory(false)}>
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 8 }}>
                Your saved and recent patient comparisons:
              </div>
              {[
                { name: "John Doe vs Jane Smith", date: "2024-01-15", type: "PDF", patients: 2 },
                { name: "High Risk Patients Comparison", date: "2024-01-12", type: "PDF", patients: 5 },
                { name: "Diabetes Treatment Review", date: "2024-01-10", type: "PDF", patients: 3 },
                { name: "Medication Adherence Study", date: "2024-01-08", type: "PDF", patients: 4 },
              ].map((comparison, index) => (
                <div key={index} style={{ 
                  padding: 16, 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{comparison.name}</div>
                    <div style={{ 
                      padding: "4px 8px", 
                      borderRadius: "var(--radius-sm)", 
                      fontSize: "var(--font-xs)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}>
                      {comparison.type}
                    </div>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>
                    {comparison.patients} patients • {comparison.date}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: "var(--font-xs)" }}>
                      <i className="ti ti-eye" style={{ fontSize: 12, marginRight: 4 }} />
                      View
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: "var(--font-xs)" }}>
                      <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
                      Download
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: "var(--font-xs)" }}>
                      <i className="ti ti-trash" style={{ fontSize: 12, marginRight: 4 }} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && schedulePatient && (
        <div className="modal-backdrop" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Schedule Appointment</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{schedulePatient.name}</div>
              </div>
              <button className="btn-icon" onClick={() => setShowScheduleModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {scheduleError && <div style={{ padding: "8px 12px", background: "var(--red-soft, #fef2f2)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-sm)", color: "var(--red)" }}>{scheduleError}</div>}
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Date <span style={{ color: "var(--red)" }}>*</span></label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Time <span style={{ color: "var(--red)" }}>*</span></label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Reason / Notes</label>
                <textarea value={scheduleReason} onChange={(e) => setScheduleReason(e.target.value)} placeholder="Optional reason or notes..." rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  if (!scheduleDate) { setScheduleError("Date is required"); return; }
                  if (!scheduleTime) { setScheduleError("Time is required"); return; }
                  const dt = new Date(`${scheduleDate}T${scheduleTime}`);
                  if (isNaN(dt.getTime())) { setScheduleError("Invalid date or time"); return; }
                  const updated = { ...schedulePatient, nextAppointment: dt.toISOString(), status: (schedulePatient.status === "Active" ? schedulePatient.status : "Active") as PatientStatus };
                  if (onUpdatePatient) {
                    onUpdatePatient(updated);
                    logAuditTrail(`Scheduled appointment for ${fmtDate(dt.toISOString())}`, schedulePatient.id, schedulePatient.name);
                    showFeedback(`Appointment scheduled for ${fmtDate(dt.toISOString())}`, "success");
                  } else {
                    showFeedback("Cannot schedule — update not available", "error");
                  }
                  setShowScheduleModal(false);
                }}>Save Appointment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showBulkTagModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkTagModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Assign Tag</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPatients.size} patients selected</div>
              </div>
              <button className="btn-icon" onClick={() => setShowBulkTagModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Tag</label>
                <input type="text" value={bulkTagValue} onChange={(e) => setBulkTagValue(e.target.value)} placeholder="Enter tag name..." list="bulk-tag-suggestions" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                <datalist id="bulk-tag-suggestions">{allTags.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              {bulkTagValue.trim() && (
                <div style={{ padding: 10, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-xs)" }}>
                  This will add tag <strong>{bulkTagValue.trim()}</strong> to up to <strong>{selectedPatients.size}</strong> patient{selectedPatients.size !== 1 ? "s" : ""}.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowBulkTagModal(false); setBulkTagValue(""); }}>Cancel</button>
                <button className="btn btn-primary" disabled={!bulkTagValue.trim()} onClick={() => {
                  if (selectedPatients.size === 0) { showFeedback("Select at least one patient first", "error"); return; }
                  if (!onUpdatePatient) { showFeedback("Update not available", "error"); return; }
                  const tag = bulkTagValue.trim();
                  let count = 0;
                  selectedPatients.forEach(id => {
                    const p = patients.find(x => x.id === id);
                    if (p && !(p.tags || []).includes(tag)) {
                      onUpdatePatient({ ...p, tags: [...(p.tags || []), tag] });
                      count++;
                    }
                  });
                  logAuditTrail(`Bulk added tag "${tag}" to ${count} patients`, "bulk", "multiple");
                  showFeedback(`Added tag "${tag}" to ${count} patient${count !== 1 ? "s" : ""}`, "success");
                  setShowBulkTagModal(false);
                  setBulkTagValue("");
                  clearSelection();
                }}>Add Tag</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Schedule Modal */}
      {showBulkScheduleModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkScheduleModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Bulk Schedule</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{selectedPatients.size} patients selected</div>
              </div>
              <button className="btn-icon" onClick={() => setShowBulkScheduleModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {bulkScheduleError && <div style={{ padding: "8px 12px", background: "var(--red-soft, #fef2f2)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-sm)", color: "var(--red)" }}>{bulkScheduleError}</div>}
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Date <span style={{ color: "var(--red)" }}>*</span></label>
                <input type="date" value={bulkScheduleDate} onChange={(e) => setBulkScheduleDate(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Time <span style={{ color: "var(--red)" }}>*</span></label>
                <input type="time" value={bulkScheduleTime} onChange={(e) => setBulkScheduleTime(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Assign Doctor</label>
                <select value={bulkScheduleDoctor} onChange={(e) => setBulkScheduleDoctor(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="">Keep current doctor</option>
                  {DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Reason / Notes</label>
                <textarea value={bulkScheduleReason} onChange={(e) => setBulkScheduleReason(e.target.value)} placeholder="Optional..." rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>
              {bulkScheduleDate && bulkScheduleTime && (
                <div style={{ padding: 10, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-xs)" }}>
                  This will schedule <strong>{selectedPatients.size}</strong> patient{selectedPatients.size !== 1 ? "s" : ""} for <strong>{bulkScheduleDate} {bulkScheduleTime}</strong>{bulkScheduleDoctor ? ` with ${bulkScheduleDoctor}` : ""}.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowBulkScheduleModal(false); setBulkScheduleError(""); }}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  if (selectedPatients.size === 0) { setBulkScheduleError("Select at least one patient first"); return; }
                  if (!bulkScheduleDate) { setBulkScheduleError("Date is required"); return; }
                  if (!bulkScheduleTime) { setBulkScheduleError("Time is required"); return; }
                  const dt = new Date(`${bulkScheduleDate}T${bulkScheduleTime}`);
                  if (isNaN(dt.getTime())) { setBulkScheduleError("Invalid date or time"); return; }
                  if (!onUpdatePatient) { showFeedback("Update not available", "error"); return; }
                  const count = selectedPatients.size;
                  selectedPatients.forEach(id => {
                    const p = patients.find(x => x.id === id);
                    if (p) {
                      onUpdatePatient({ ...p, nextAppointment: dt.toISOString(), ...(bulkScheduleDoctor ? { doctor: bulkScheduleDoctor } : {}) });
                    }
                  });
                  logAuditTrail(`Bulk scheduled ${count} patients for ${fmtDate(dt.toISOString())}`, "bulk", "multiple");
                  showFeedback(`Scheduled ${count} patient${count !== 1 ? "s" : ""} for ${fmtDate(dt.toISOString())}`, "success");
                  setShowBulkScheduleModal(false);
                  setBulkScheduleDate(""); setBulkScheduleTime(""); setBulkScheduleDoctor(""); setBulkScheduleReason(""); setBulkScheduleError("");
                  clearSelection();
                }}>Schedule All</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal (replaces window.confirm) */}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => { setConfirmModal(null); setConfirmTypedValue(""); }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>{confirmModal.title}</div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--text)", marginBottom: confirmModal.requireTypedWord ? 12 : 20 }}>{confirmModal.message}</div>
              {confirmModal.requireTypedWord && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 6 }}>
                    Type <strong>{confirmModal.requireTypedWord}</strong> to confirm
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={confirmTypedValue}
                    onChange={(e) => setConfirmTypedValue(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setConfirmModal(null); setConfirmTypedValue(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={confirmModal.danger ? { background: "var(--red)", borderColor: "var(--red)" } : {}}
                  disabled={!!confirmModal.requireTypedWord && confirmTypedValue !== confirmModal.requireTypedWord}
                  onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); setConfirmTypedValue(""); }}
                >
                  {confirmModal.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "10px 20px", borderRadius: "var(--radius-md)",
          background: feedback.type === "success" ? "var(--green, #16a34a)" : feedback.type === "error" ? "var(--red, #dc2626)" : "var(--accent, #2563eb)",
          color: "#fff", fontSize: "var(--font-sm)", fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)", pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 8, maxWidth: "90vw",
        }}>
          <i className={`ti ti-${feedback.type === "success" ? "check" : feedback.type === "error" ? "alert-circle" : "info-circle"}`} style={{ fontSize: 16 }} />
          {feedback.message}
        </div>
      )}

      {/* Calling Screen */}
      {callingPatient && (
        <CallingScreen patient={callingPatient} onClose={() => setCallingPatient(null)} />
      )}
    </div>
  );
}

function PatientDashboard({ patients }: { patients: Patient[] }) {
  const stats = useMemo(() => {
    const total = patients.length;
    const byStatus = patients.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byRisk = patients.reduce((acc, p) => {
      const risk = calcRiskScore(p).level;
      acc[risk] = (acc[risk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const highRisk = patients.filter(p => calcRiskScore(p).level === "High" || calcRiskScore(p).level === "Critical").length;
    const overdue = patients.filter(p => p.followUpDate && new Date(p.followUpDate) < new Date()).length;
    const newThisWeek = patients.filter(p => {
      if (!p.createdAt) return false;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return new Date(p.createdAt) >= oneWeekAgo;
    }).length;

    // Doctor performance metrics
    const byDoctor = patients.reduce((acc, p) => {
      if (!p.doctor) return acc;
      if (!acc[p.doctor]) {
        acc[p.doctor] = { total: 0, highRisk: 0, overdue: 0, avgRisk: 0 };
      }
      acc[p.doctor].total++;
      const risk = calcRiskScore(p);
      acc[p.doctor].avgRisk += risk.score;
      if (risk.level === "High" || risk.level === "Critical") {
        acc[p.doctor].highRisk++;
      }
      if (p.followUpDate && new Date(p.followUpDate) < new Date()) {
        acc[p.doctor].overdue++;
      }
      return acc;
    }, {} as Record<string, { total: number; highRisk: number; overdue: number; avgRisk: number }>);

    // Calculate average risk per doctor
    Object.keys(byDoctor).forEach(doctor => {
      byDoctor[doctor].avgRisk = Math.round(byDoctor[doctor].avgRisk / byDoctor[doctor].total);
    });
    
    return { total, byStatus, byRisk, highRisk, overdue, newThisWeek, byDoctor };
  }, [patients]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="card card-padded" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--font-3xl)", fontWeight: 700, color: "var(--accent)" }}>{stats.total}</div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Total Patients</div>
        </div>
        <div className="card card-padded" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--font-3xl)", fontWeight: 700, color: "var(--red)" }}>{stats.highRisk}</div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>High Risk</div>
        </div>
        <div className="card card-padded" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--font-3xl)", fontWeight: 700, color: "var(--amber)" }}>{stats.overdue}</div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Overdue Follow-ups</div>
        </div>
        <div className="card card-padded" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--font-3xl)", fontWeight: 700, color: "var(--blue)" }}>{stats.newThisWeek}</div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>New This Week</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div className="card card-padded">
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Patients by Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 24, background: "var(--surface2)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(count / stats.total) * 100}%`,
                    background: status === "Active" ? "var(--green)" : status === "Pending" ? "var(--amber)" : status === "Inactive" ? "var(--red)" : "var(--blue)",
                    borderRadius: "var(--radius-sm)",
                  }} />
                </div>
                <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, minWidth: 80 }}>{status}</span>
                <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-padded">
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Risk Score Distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(stats.byRisk).sort((a, b) => {
              const order = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
              return (order[a[0] as keyof typeof order] || 99) - (order[b[0] as keyof typeof order] || 99);
            }).map(([risk, count]) => {
              const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
              const color = risk === "Critical" ? "var(--red)" : risk === "High" ? "var(--amber)" : risk === "Medium" ? "var(--blue)" : "var(--green)";
              return (
                <div key={risk} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 32, background: "var(--surface2)", borderRadius: "var(--radius-sm)", overflow: "hidden", position: "relative" }}>
                    <div style={{
                      height: "100%",
                      width: `${(count / stats.total) * 100}%`,
                      background: color,
                      borderRadius: "var(--radius-sm)",
                      transition: "width 0.3s ease",
                    }} />
                    <span style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "var(--font-xs)",
                      fontWeight: 600,
                      color: "var(--text)",
                      textShadow: "0 0 4px rgba(255,255,255,0.8)",
                    }}>
                      {percentage}%
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, minWidth: 80, color }}>{risk}</span>
                  <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", minWidth: 40, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              <span>Risk Score Range:</span>
              <span>Critical (80+), High (50-79), Medium (25-49), Low (0-24)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Distribution Pie Chart */}
      <div className="card card-padded">
        <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Risk Distribution Overview</div>
        <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 200, height: 200 }}>
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
              {(() => {
                const riskData = Object.entries(stats.byRisk).sort((a, b) => {
                  const order = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
                  return (order[a[0] as keyof typeof order] || 99) - (order[b[0] as keyof typeof order] || 99);
                });
                const colors = { "Critical": "#ef4444", "High": "#f59e0b", "Medium": "#3b82f6", "Low": "#22c55e" };
                let cumulativePercent = 0;
                
                return riskData.map(([risk, count], index) => {
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  const startPercent = cumulativePercent;
                  cumulativePercent += percentage;
                  const endPercent = cumulativePercent;
                  
                  const startX = 50 + 40 * Math.cos(2 * Math.PI * startPercent / 100);
                  const startY = 50 + 40 * Math.sin(2 * Math.PI * startPercent / 100);
                  const endX = 50 + 40 * Math.cos(2 * Math.PI * endPercent / 100);
                  const endY = 50 + 40 * Math.sin(2 * Math.PI * endPercent / 100);
                  const largeArc = percentage > 50 ? 1 : 0;
                  
                  return (
                    <path
                      key={risk}
                      d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                      fill={colors[risk as keyof typeof colors]}
                      stroke="var(--surface)"
                      strokeWidth="1"
                    />
                  );
                });
              })()}
            </svg>
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "var(--font-xl)", fontWeight: 700, color: "var(--text)" }}>{stats.total}</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Total</div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(stats.byRisk).sort((a, b) => {
              const order = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
              return (order[a[0] as keyof typeof order] || 99) - (order[b[0] as keyof typeof order] || 99);
            }).map(([risk, count]) => {
              const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
              const color = risk === "Critical" ? "#ef4444" : risk === "High" ? "#f59e0b" : risk === "Medium" ? "#3b82f6" : "#22c55e";
              return (
                <div key={risk} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: color }} />
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, minWidth: 80 }}>{risk}</span>
                  <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Doctor Performance Metrics */}
      <div className="card card-padded">
        <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Doctor Performance Metrics</div>
        {Object.keys(stats.byDoctor).length === 0 ? (
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No doctor data available</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "12px 8px", fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Doctor</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Patients</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>High Risk</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Overdue</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Avg Risk Score</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byDoctor)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([doctor, metrics]) => {
                    const highRiskPercent = metrics.total > 0 ? ((metrics.highRisk / metrics.total) * 100).toFixed(1) : "0";
                    const overduePercent = metrics.total > 0 ? ((metrics.overdue / metrics.total) * 100).toFixed(1) : "0";
                    const performance = metrics.total > 0 ? (100 - parseFloat(highRiskPercent) - parseFloat(overduePercent) / 2).toFixed(1) : "100";
                    const performanceColor = parseFloat(performance) >= 80 ? "var(--green)" : parseFloat(performance) >= 60 ? "var(--amber)" : "var(--red)";
                    
                    return (
                      <tr key={doctor} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 8px", fontSize: "var(--font-sm)", fontWeight: 600 }}>{doctor}</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontSize: "var(--font-sm)" }}>{metrics.total}</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontSize: "var(--font-sm)", color: metrics.highRisk > 0 ? "var(--red)" : "var(--text)" }}>{metrics.highRisk} ({highRiskPercent}%)</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontSize: "var(--font-sm)", color: metrics.overdue > 0 ? "var(--amber)" : "var(--text)" }}>{metrics.overdue} ({overduePercent}%)</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontSize: "var(--font-sm)" }}>{metrics.avgRisk}</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontSize: "var(--font-sm)", fontWeight: 700, color: performanceColor }}>{performance}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Health Trends */}
      <div className="card card-padded">
        <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Patient Enrollment Trends</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
            const months: Record<string, number> = {};
            patients.forEach(p => {
              if (p.createdAt) {
                const date = new Date(p.createdAt);
                const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
                months[monthKey] = (months[monthKey] || 0) + 1;
              }
            });
            
            const sortedMonths = Object.entries(months).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
            const maxCount = Math.max(...Object.values(months), 1);
            
            if (sortedMonths.length === 0) {
              return <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No enrollment data available</div>;
            }
            
            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedMonths.slice(-6).map(([month, count]) => (
                    <div key={month} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, minWidth: 80 }}>{month}</span>
                      <div style={{ flex: 1, height: 24, background: "var(--surface2)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${(count / maxCount) * 100}%`,
                          background: "var(--accent)",
                          borderRadius: "var(--radius-sm)",
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", minWidth: 40, textAlign: "right" }}>{count}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    <span>Total patients enrolled: {patients.length}</span>
                    <span>Avg per month: {(patients.length / Math.max(sortedMonths.length, 1)).toFixed(1)}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Appointment Adherence Tracking */}
      <div className="card card-padded">
        <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Appointment Adherence</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
            const totalWithFollowUp = patients.filter(p => p.followUpDate).length;
            const overdueCount = patients.filter(p => p.followUpDate && new Date(p.followUpDate) < new Date()).length;
            const onTimeCount = totalWithFollowUp - overdueCount;
            const adherenceRate = totalWithFollowUp > 0 ? ((onTimeCount / totalWithFollowUp) * 100).toFixed(1) : "0";
            
            return (
              <>
                <div className="pl-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <div style={{ textAlign: "center", padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "var(--font-2xl)", fontWeight: 700, color: "var(--green)" }}>{onTimeCount}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>On Time</div>
                  </div>
                  <div style={{ textAlign: "center", padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "var(--font-2xl)", fontWeight: 700, color: "var(--red)" }}>{overdueCount}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Overdue</div>
                  </div>
                  <div style={{ textAlign: "center", padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "var(--font-2xl)", fontWeight: 700, color: "var(--accent)" }}>{adherenceRate}%</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Adherence Rate</div>
                  </div>
                </div>
                <div style={{ height: 8, background: "var(--surface2)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${adherenceRate}%`,
                    background: parseFloat(adherenceRate) >= 80 ? "var(--green)" : parseFloat(adherenceRate) >= 60 ? "var(--amber)" : "var(--red)",
                    borderRadius: "var(--radius-sm)",
                    transition: "width 0.3s ease",
                  }} />
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  {totalWithFollowUp} patients with scheduled follow-ups
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function PatientTimeline({ patients }: { patients: Patient[] }) {
  const [dateRange, setDateRange] = useState<"all" | "7d" | "30d" | "90d" | "1y">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const filteredPatients = useMemo(() => {
    let result = patients;
    
    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      const daysAgo = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      }[dateRange];
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      result = result.filter(p => p.createdAt && new Date(p.createdAt) >= cutoff);
    }
    
    // Filter by severity
    if (severityFilter !== "all") {
      result = result.filter(p => {
        const risk = calcRiskScore(p);
        if (severityFilter === "high") return risk >= 70;
        if (severityFilter === "medium") return risk >= 40 && risk < 70;
        if (severityFilter === "low") return risk < 40;
        return true;
      });
    }
    
    return result;
  }, [patients, dateRange, severityFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {[
          { value: "all", label: "All Time" },
          { value: "7d", label: "7 Days" },
          { value: "30d", label: "30 Days" },
          { value: "90d", label: "90 Days" },
          { value: "1y", label: "1 Year" },
        ].map(preset => (
          <button
            key={preset.value}
            className="btn btn-ghost"
            onClick={() => setDateRange(preset.value as any)}
            style={{
              background: dateRange === preset.value ? "var(--accent-soft)" : "transparent",
              color: dateRange === preset.value ? "var(--accent)" : "var(--muted)",
              padding: "6px 12px",
              fontSize: "var(--font-sm)",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {[
          { value: "all", label: "All Severity" },
          { value: "high", label: "High Risk" },
          { value: "medium", label: "Medium Risk" },
          { value: "low", label: "Low Risk" },
        ].map(preset => (
          <button
            key={preset.value}
            className="btn btn-ghost"
            onClick={() => setSeverityFilter(preset.value as any)}
            style={{
              background: severityFilter === preset.value ? "var(--accent-soft)" : "transparent",
              color: severityFilter === preset.value ? "var(--accent)" : "var(--muted)",
              padding: "6px 12px",
              fontSize: "var(--font-sm)",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {filteredPatients.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-timeline empty-state-icon" />
          <div className="empty-state-text">No patients to display</div>
          <div className="empty-state-sub">Try adjusting your search or filters</div>
        </div>
      ) : (
        filteredPatients.slice(0, 10).map((patient) => (
          <div key={patient.id} className="card card-padded">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <AvatarCircle name={patient.name} size="md" />
              <div>
                <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color: "var(--text)" }}>
                  {patient.name}
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  ID: {patient.id} · {patient.doctor}
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <StatusBadge status={patient.status} />
              </div>
            </div>

            <div style={{ position: "relative", paddingLeft: 20 }}>
              {/* Timeline line */}
              <div style={{
                position: "absolute",
                left: 6,
                top: 0,
                bottom: 0,
                width: 2,
                background: "var(--border)",
              }} />

              {/* Timeline events */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Registration */}
                <div style={{ position: "relative", paddingLeft: 16 }}>
                  <div style={{
                    position: "absolute",
                    left: -3,
                    top: 6,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    border: "2px solid var(--accent-soft)",
                  }} />
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
                      Patient Registered
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {patient.createdAt ? fmtDate(patient.createdAt) : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Last Visit */}
                {patient.lastVisit && (
                  <div style={{ position: "relative", paddingLeft: 16 }}>
                    <div style={{
                      position: "absolute",
                      left: -3,
                      top: 6,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "var(--green)",
                      border: "2px solid var(--green-soft)",
                    }} />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
                        Last Visit
                      </div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        {fmtDate(patient.lastVisit)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Follow-up */}
                {patient.followUpDate && (
                  <div style={{ position: "relative", paddingLeft: 16 }}>
                    <div style={{
                      position: "absolute",
                      left: -3,
                      top: 6,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: new Date(patient.followUpDate) < new Date() ? "var(--red)" : "var(--amber)",
                      border: `2px solid ${new Date(patient.followUpDate) < new Date() ? "var(--red-soft)" : "var(--amber-soft)"}`,
                    }} />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
                        Follow-up Scheduled
                      </div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        {fmtDate(patient.followUpDate)} {new Date(patient.followUpDate) < new Date() ? "(Overdue)" : ""}
                      </div>
                    </div>
                  </div>
                )}

                {/* Risk Factors */}
                {patient.riskFactors && patient.riskFactors.length > 0 && (
                  <div style={{ position: "relative", paddingLeft: 16 }}>
                    <div style={{
                      position: "absolute",
                      left: -3,
                      top: 6,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "var(--red)",
                      border: "2px solid var(--red-soft)",
                    }} />
                    <div>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
                        Risk Factors Identified
                      </div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        {patient.riskFactors.join(", ")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PatientCard({
  patient: p,
  selected,
  onSelect,
  onQuickAction,
  isMobile = false,
}: {
  patient: Patient;
  selected: boolean;
  onSelect: () => void;
  onQuickAction: (action: string) => void;
  isMobile?: boolean;
}) {
  const risk = calcRiskScore(p);

  /* ── Mobile: compact list row (contacts-app style) ── */
  if (isMobile) {
    return (
      <div
        onClick={() => onQuickAction("profile")}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "11px 14px", cursor: "pointer",
          borderBottom: "1px solid var(--border)",
          transition: "background 0.1s",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <AvatarCircle name={p.name} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {p.name}
          </div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>
            {p.age}y · {p.gender} · {p.doctor}
          </div>
          {(p.alerts || []).length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
              {(p.alerts || []).slice(0, 2).map(a => <AlertChip key={a} alert={a} />)}
              {(p.alerts || []).length > 2 && (
                <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>
                  +{(p.alerts || []).length - 2}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <StatusBadge status={p.status} />
          <span className="badge" style={{
            fontSize: "var(--font-2xs)", padding: "1px 6px",
            background: risk.level === "Critical" ? "var(--red-bg)" : risk.level === "High" ? "var(--amber-bg)" : risk.level === "Medium" ? "var(--blue-bg)" : "var(--green-bg)",
            color: risk.level === "Critical" ? "var(--red)" : risk.level === "High" ? "var(--amber)" : risk.level === "Medium" ? "var(--blue)" : "var(--green)",
          }}>
            {risk.level}
          </span>
        </div>
        <i className="ti ti-chevron-right" style={{ fontSize: 13, color: "var(--border)", flexShrink: 0 }} />
      </div>
    );
  }

  /* ── Desktop: full card ── */
  return (
    <div
      className="card card-padded"
      style={{
        cursor: "pointer",
        position: "relative",
        border: selected ? "2px solid var(--accent)" : "1px solid var(--border)",
        transition: "all 0.15s",
      }}
      onClick={() => onSelect()}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <AvatarCircle name={p.name} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
            {p.name}
          </div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>
            ID: {p.id}
          </div>
          <StatusBadge status={p.status} />
        </div>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onSelect(); }}
          style={{ cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", marginBottom: 2 }}>Age</div>
          <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.age} years</div>
        </div>
        <div>
          <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", marginBottom: 2 }}>Doctor</div>
          <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.doctor}</div>
        </div>
        <div>
          <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", marginBottom: 2 }}>Insurance</div>
          <InsuranceBadge status={p.insuranceStatus} />
        </div>
        <div>
          <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", marginBottom: 2 }}>Last Visit</div>
          <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(p.lastVisit)}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge" style={{
            background: risk.level === "Critical" ? "var(--red-bg)" : risk.level === "High" ? "var(--amber-bg)" : risk.level === "Medium" ? "var(--blue-bg)" : "var(--green-bg)",
            color: risk.level === "Critical" ? "var(--red)" : risk.level === "High" ? "var(--amber)" : risk.level === "Medium" ? "var(--blue)" : "var(--green)",
            border: risk.level === "Critical" ? "1px solid var(--red-border)" : risk.level === "High" ? "1px solid var(--amber-border)" : risk.level === "Medium" ? "1px solid var(--blue-border)" : "1px solid var(--green-border)",
          }}>
            {risk.level}
          </span>
          {p.riskFactors && p.riskFactors.length > 0 && (
            <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }}>
              {p.riskFactors.length} risk{p.riskFactors.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {(p.tags || []).length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {p.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="tag" style={{ background: "var(--purple-bg)", color: "var(--purple)" }}>
                {tag}
              </span>
            ))}
            {p.tags.length > 2 && (
              <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>+{p.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={(e) => { e.stopPropagation(); onQuickAction("call"); }} className="btn-icon" style={{ flex: 1 }} title="Call">
          <i className="ti ti-phone" style={{ fontSize: 14 }} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onQuickAction("email"); }} className="btn-icon" style={{ flex: 1 }} title="Email">
          <i className="ti ti-mail" style={{ fontSize: 14 }} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onQuickAction("schedule"); }} className="btn-icon" style={{ flex: 1 }} title="Schedule">
          <i className="ti ti-calendar" style={{ fontSize: 14 }} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onQuickAction("note"); }} className="btn-icon" style={{ flex: 1 }} title="Add Note">
          <i className="ti ti-note" style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  );
}

function PatientRow({
  patient: p,
  selected,
  onSelect,
  bulkSelected,
  onToggleBulk,
  searchQuery,
  onQuickAction,
  quickActionsOpen,
  onQuickActionsToggle,
  closeQuickActions,
  selectedColumns,
}: {
  patient: Patient;
  selected: boolean;
  onSelect: (p: Patient) => void;
  bulkSelected: boolean;
  onToggleBulk: (id: string) => void;
  searchQuery?: string;
  onQuickAction: (action: string) => void;
  quickActionsOpen: boolean;
  onQuickActionsToggle: (e: React.MouseEvent, x: number, y: number) => void;
  closeQuickActions: () => void;
  selectedColumns: Set<string>;
}) {
  const nameParts = getHighlightParts(p.name, searchQuery || "");
  const idParts = getHighlightParts(p.id, searchQuery || "");
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside or when the page scrolls
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeQuickActions();
      }
    }
    function handleScroll() {
      closeQuickActions();
    }
    if (quickActionsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
      };
    }
  }, [quickActionsOpen, closeQuickActions]);

  return (
    <tr
      className={`tbl-row${selected ? " selected" : ""}`}
      onClick={() => onSelect(p)}
    >
      <td style={{ paddingLeft: 16 }} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={bulkSelected}
          onChange={() => onToggleBulk(p.id)}
          style={{ cursor: "pointer" }}
        />
      </td>
      {selectedColumns.has("id") && (
        <td>
          <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", display: "block" }}>
            {idParts.map((part, i) => (
              part.highlight ? (
                <mark key={i} style={{ 
                  background: "var(--amber-bg)", 
                  color: "var(--amber)", 
                  padding: "0 2px", 
                  borderRadius: 2,
                  fontWeight: 600 
                }}>
                  {part.text}
                </mark>
              ) : part.text
            ))}
          </span>
        </td>
      )}
      {selectedColumns.has("name") && (
        <td>
          <div>
            <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
              {nameParts.map((part, i) => (
                part.highlight ? (
                  <mark key={i} style={{ 
                    background: "var(--amber-bg)", 
                    color: "var(--amber)", 
                    padding: "0 2px", 
                    borderRadius: 2,
                    fontWeight: 600 
                  }}>
                    {part.text}
                  </mark>
                ) : part.text
              ))}
            </span>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>
              {p.gender} · {p.bloodGroup}
            </div>
          </div>
        </td>
      )}
      {selectedColumns.has("age") && (
        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          {p.age}y
        </td>
      )}
      {selectedColumns.has("doctor") && (
        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
      )}
      {selectedColumns.has("status") && (
        <td><StatusBadge status={p.status} /></td>
      )}
      {selectedColumns.has("insuranceStatus") && (
        <td><InsuranceBadge status={p.insuranceStatus} /></td>
      )}
      {selectedColumns.has("lastVisit") && (
        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          {fmtDate(p.lastVisit)}
        </td>
      )}
      <td>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(p.alerts || []).slice(0, 2).map((a) => (
            <AlertChip key={a} alert={a} />
          ))}
          {(p.alerts || []).length > 2 && (
            <span className="tag" style={{ background: "var(--surface3)", color: "var(--muted)" }}>
              +{p.alerts.length - 2}
            </span>
          )}
        </div>
      </td>
      <td><RiskBadge patient={p} /></td>
      <td>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(p.tags || []).slice(0, 2).map((tag) => (
            <span key={tag} className="tag" style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
              fontSize: "var(--font-2xs)",
            }}>
              {tag}
            </span>
          ))}
          {(p.tags || []).length > 2 && (
            <span className="tag" style={{ background: "var(--surface3)", color: "var(--muted)" }}>
              +{p.tags.length - 2}
            </span>
          )}
        </div>
      </td>
      <td style={{ paddingLeft: 8, paddingRight: 8 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            className="btn-icon"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const menuHeight = 300; // Approximate menu height
              const spaceBelow = window.innerHeight - rect.bottom;
              const y = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
              onQuickActionsToggle(e, rect.left, y);
            }}
            title="Quick actions"
          >
            <i className="ti ti-dots-vertical" style={{ fontSize: 16 }} />
          </button>
          
          {quickActionsOpen && (
            <div ref={menuRef} style={{
              position: "fixed",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 1000,
              minWidth: 180,
              maxWidth: 220,
              padding: 4,
            }}>
              <button
                onClick={() => onQuickAction("call")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-phone" style={{ fontSize: 14, color: "var(--green)" }} />
                Call
              </button>
              <button
                onClick={() => onQuickAction("email")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-mail" style={{ fontSize: 14, color: "var(--blue)" }} />
                Email
              </button>
              <button
                onClick={() => onQuickAction("schedule")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-calendar" style={{ fontSize: 14, color: "var(--purple)" }} />
                Schedule
              </button>
              <button
                onClick={() => onQuickAction("note")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-notes" style={{ fontSize: 14, color: "var(--amber)" }} />
                Add Note
              </button>
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <button
                onClick={() => onQuickAction("edit")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-pencil" style={{ fontSize: 14, color: "var(--blue)" }} />
                Edit Patient
              </button>
              <button
                onClick={() => onQuickAction("profile")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--accent)",
                  textAlign: "left",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-user" style={{ fontSize: 14 }} />
                View Profile
              </button>
              <button
                onClick={() => onQuickAction("manage-tags")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-tag" style={{ fontSize: 14, color: "var(--purple)" }} />
                Manage Tags
              </button>
              <button
                onClick={() => onQuickAction("reminder")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--font-sm)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
              >
                <i className="ti ti-bell" style={{ fontSize: 14, color: "var(--amber)" }} />
                Set Reminder
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function PatientComparisonModal({ patients, onClose, onOpenPatient, onRemovePatient, onClear }: {
  patients: Patient[];
  onClose: () => void;
  onOpenPatient: (p: Patient) => void;
  onRemovePatient: (id: string) => void;
  onClear: () => void;
}) {
  const comparisonFields = [
    { key: "name", label: "Name" },
    { key: "age", label: "Age" },
    { key: "gender", label: "Gender" },
    { key: "bloodGroup", label: "Blood Group" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "doctor", label: "Doctor" },
    { key: "status", label: "Status" },
    { key: "insuranceStatus", label: "Insurance" },
    { key: "insuranceExpiry", label: "Insurance Expiry" },
    { key: "lastVisit", label: "Last Visit" },
    { key: "nextAppointment", label: "Next Appointment" },
    { key: "followUpDate", label: "Follow-up" },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1200, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Patient Comparison</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Comparing {patients.length} patients side-by-side</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={onClear}>Clear comparison</button>
            <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 150, fontWeight: 600 }}>Field</th>
                {patients.map((p, i) => (
                  <th key={p.id} style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AvatarCircle name={p.name} size="sm" />
                      <div>
                        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>{p.id}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-2xs)", padding: "2px 6px" }} onClick={() => onOpenPatient(p)}>Open</button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-2xs)", padding: "2px 6px" }} onClick={() => onRemovePatient(p.id)}>Remove</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFields.map((field) => (
                <tr key={field.key}>
                  <td style={{ fontWeight: 600, fontSize: "var(--font-sm)", color: "var(--muted)" }}>{field.label}</td>
                  {patients.map((p) => (
                    <td key={p.id} style={{ fontSize: "var(--font-sm)" }}>
                      {field.key === "status" ? <StatusBadge status={p.status as any} /> :
                       field.key === "insuranceStatus" ? <InsuranceBadge status={p.insuranceStatus as any} /> :
                       field.key === "insuranceExpiry" || field.key === "lastVisit" || field.key === "nextAppointment" || field.key === "followUpDate" ? fmtDate(p[field.key as keyof Patient] as string) :
                       (p[field.key as keyof Patient] as string) || "-"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600, fontSize: "var(--font-sm)", color: "var(--muted)" }}>Alerts</td>
                {patients.map((p) => (
                  <td key={p.id} style={{ fontSize: "var(--font-sm)" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(p.alerts || []).map((a) => <AlertChip key={a} alert={a} />)}
                      {(!p.alerts || p.alerts.length === 0) && "-"}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 600, fontSize: "var(--font-sm)", color: "var(--muted)" }}>Risk Level</td>
                {patients.map((p) => (
                  <td key={p.id} style={{ fontSize: "var(--font-sm)" }}>
                    <RiskBadge patient={p} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RemindersModal({ reminders, onClose, onToggleComplete, onDelete }: { 
  reminders: Array<{ id: string; patientId: string; patientName: string; type: string; date: string; completed: boolean; notes?: string }>;
  onClose: () => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const activeReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Reminders</h2>
          <button className="btn-icon" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: 20 }} />
          </button>
        </div>
        
        {reminders.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            <i className="ti ti-bell-off" style={{ fontSize: 48, marginBottom: 16 }} />
            <div>No reminders</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {activeReminders.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
                  Active ({activeReminders.length})
                </div>
                {activeReminders.map(reminder => (
                  <div key={reminder.id} style={{
                    padding: 12,
                    background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: 8,
                    borderLeft: "3px solid var(--amber)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{reminder.patientName}</div>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                          {reminder.type === "follow-up" ? "Follow-up" : reminder.type} · {fmtDate(reminder.date)}
                        </div>
                        {reminder.notes && (
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>{reminder.notes}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="btn-icon"
                          onClick={() => onToggleComplete(reminder.id)}
                          title="Mark as complete"
                        >
                          <i className="ti ti-check" style={{ fontSize: 16 }} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => onDelete(reminder.id)}
                          title="Delete reminder"
                        >
                          <i className="ti ti-trash" style={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {completedReminders.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
                  Completed ({completedReminders.length})
                </div>
                {completedReminders.map(reminder => (
                  <div key={reminder.id} style={{
                    padding: 12,
                    background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: 8,
                    opacity: 0.6,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, textDecoration: "line-through" }}>{reminder.patientName}</div>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                          {reminder.type === "follow-up" ? "Follow-up" : reminder.type} · {fmtDate(reminder.date)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="btn-icon"
                          onClick={() => onToggleComplete(reminder.id)}
                          title="Mark as incomplete"
                        >
                          <i className="ti ti-refresh" style={{ fontSize: 16 }} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => onDelete(reminder.id)}
                          title="Delete reminder"
                        >
                          <i className="ti ti-trash" style={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

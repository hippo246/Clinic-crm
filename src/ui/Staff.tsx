import React, { useState, useEffect, useCallback } from "react";
import { fmtDate } from "./utils";

// ─── localStorage helpers ─────────────────────────────────────────────────────
function readJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/disabled */ }
}

interface ActivityEntry {
  id: string;
  user: string;
  action: string;
  time: string; // ISO timestamp
}

const DEFAULT_STAFF: StaffMember[] = [
  { id: "STF001", name: "Dr. Sarah Johnson", role: "doctor", email: "sarah.johnson@clinic.com", phone: "+1 555-0101", department: "Internal Medicine", status: "active", joinDate: "2020-03-15", permissions: ["view_medical","edit_medical","prescribe","view_billing"] },
  { id: "STF002", name: "Dr. Michael Chen", role: "doctor", email: "michael.chen@clinic.com", phone: "+1 555-0102", department: "Cardiology", status: "active", joinDate: "2019-07-22", permissions: ["view_medical","edit_medical","prescribe","view_billing"] },
  { id: "STF003", name: "Emily Davis", role: "receptionist", email: "emily.davis@clinic.com", phone: "+1 555-0103", department: "Front Desk", status: "active", joinDate: "2021-01-10", permissions: ["view_patients","edit_patients","schedule","view_billing"] },
  { id: "STF004", name: "James Wilson", role: "nurse", email: "james.wilson@clinic.com", phone: "+1 555-0104", department: "Nursing", status: "active", joinDate: "2020-09-05", permissions: ["view_medical","edit_vitals","view_billing"] },
  { id: "STF005", name: "Admin User", role: "admin", email: "admin@clinic.com", phone: "+1 555-0100", department: "Administration", status: "active", joinDate: "2018-01-01", permissions: ["all"] },
];

const DEFAULT_ACTIVITY: ActivityEntry[] = [
  { id: "act-1", user: "Dr. Sarah Johnson", action: "Completed consultation for John Doe", time: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: "act-2", user: "Emily Davis", action: "Scheduled appointment for Jane Smith", time: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: "act-3", user: "Dr. Michael Chen", action: "Prescribed medication for Bob Wilson", time: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: "act-4", user: "James Wilson", action: "Updated vitals for Alice Brown", time: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "act-5", user: "Admin User", action: "Modified system settings", time: new Date(Date.now() - 60 * 60000).toISOString() },
];

const ALL_PERMISSIONS = ["view_patients","edit_patients","schedule","view_medical","edit_medical","prescribe","view_lab","edit_lab","view_billing","edit_billing","manage_staff","view_reports","manage_settings","edit_vitals","delete_patients","view_audit"];

const ROLE_PERMISSION_PRESETS: Record<StaffMember["role"], string[]> = {
  admin: ["all"],
  doctor: ["view_patients","view_medical","edit_medical","prescribe","view_lab","edit_lab","view_billing","view_reports","schedule"],
  nurse: ["view_patients","edit_vitals","view_medical","view_lab","edit_lab","view_reports","schedule"],
  receptionist: ["view_patients","edit_patients","schedule","view_billing","edit_billing","view_reports"],
};

function fmtRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface StaffMember {
  id: string;
  name: string;
  role: "doctor" | "receptionist" | "admin" | "nurse";
  email: string;
  phone: string;
  department: string;
  status: "active" | "inactive";
  joinDate: string;
  permissions: string[];
}

interface Schedule {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "consultation" | "surgery" | "admin" | "break";
  status: "scheduled" | "completed" | "cancelled";
}

interface PerformanceMetrics {
  staffId: string;
  staffName: string;
  patientsSeen: number;
  avgConsultTime: number;
  patientSatisfaction: number;
  onTimeRate: number;
  completedTasks: number;
}

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<"staff" | "schedule" | "performance" | "permissions">("staff");
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // ── persistent state ────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffMember[]>(() => readJSON<StaffMember[]>("clinic_crm_staff", DEFAULT_STAFF));
  const [schedules, setSchedules] = useState<Schedule[]>(() => readJSON<Schedule[]>("clinic_crm_staff_schedules", []));
  const [activity, setActivity] = useState<ActivityEntry[]>(() => {
    const stored = readJSON<ActivityEntry[]>("clinic_crm_staff_activity", []);
    return stored.length > 0 ? stored : DEFAULT_ACTIVITY;
  });

  const persistStaff = (next: StaffMember[]) => { setStaff(next); writeJSON("clinic_crm_staff", next); };
  const persistSchedules = (next: Schedule[]) => { setSchedules(next); writeJSON("clinic_crm_staff_schedules", next); };
  const persistActivity = (next: ActivityEntry[]) => { setActivity(next); writeJSON("clinic_crm_staff_activity", next); };

  const pushActivity = useCallback((user: string, action: string) => {
    setActivity(prev => {
      const next = [{ id: `act-${Date.now()}`, user, action, time: new Date().toISOString() }, ...prev].slice(0, 50);
      writeJSON("clinic_crm_staff_activity", next);
      return next;
    });
  }, []);

  // ── feedback ─────────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showFeedback = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // ── staff filters / search ──────────────────────────────────────────────────
  type StaffFilter = "all" | "doctor" | "receptionist" | "nurse" | "admin" | "active" | "inactive";
  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");
  const [staffSearch, setStaffSearch] = useState("");
  const hasActiveFilters = staffFilter !== "all" || staffSearch.trim() !== "";
  const clearFilters = () => { setStaffFilter("all"); setStaffSearch(""); };

  // ── sort ───────────────────────────────────────────────────────────────────
  type SortKey = "name" | "role" | "department" | "status" | "joinDate";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(true); } };

  // ── bulk select ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStaff.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStaff.map(s => s.id)));
  };

  // ── schedule week view ─────────────────────────────────────────────────────
  const [scheduleView, setScheduleView] = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = prev, +1 = next

  // ── view modal tabs ─────────────────────────────────────────────────────────
  const [viewTab, setViewTab] = useState<"overview" | "schedule" | "permissions" | "activity">("overview");

  // ── import state ──────────────────────────────────────────────────────────
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const filteredStaff = React.useMemo(() => {
    let list = staff.filter(s => {
      if (staffFilter === "active" && s.status !== "active") return false;
      if (staffFilter === "inactive" && s.status !== "inactive") return false;
      if (staffFilter !== "all" && staffFilter !== "active" && staffFilter !== "inactive" && s.role !== staffFilter) return false;
      if (staffSearch) {
        const q = staffSearch.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.role.includes(q) || s.email.toLowerCase().includes(q) || s.phone.includes(q) || s.department.toLowerCase().includes(q);
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const va = a[sortKey] ?? ""; const vb = b[sortKey] ?? "";
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [staff, staffFilter, staffSearch, sortKey, sortAsc]);

  // ── last-admin guard ────────────────────────────────────────────────────────
  const activeAdmins = staff.filter(s => s.role === "admin" && s.status === "active");
  const isLastActiveAdmin = (s: StaffMember) => s.role === "admin" && s.status === "active" && activeAdmins.length === 1;

  // ── schedule conflict detection ────────────────────────────────────────────
  const hasConflict = (staffId: string, date: string, start: string, end: string, excludeId?: string): boolean => {
    return schedules.some(s =>
      s.staffId === staffId && s.date === date && s.id !== excludeId &&
      s.status !== "cancelled" &&
      !(end <= s.startTime || start >= s.endTime)
    );
  };

  // ── week view helpers ──────────────────────────────────────────────────────
  const getWeekDates = (offset: number): Date[] => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  };
  const weekDates = getWeekDates(weekOffset);
  const weekDateStrings = weekDates.map(d => d.toISOString().split("T")[0]);

  // ── department summary ────────────────────────────────────────────────────
  const deptSummary = React.useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    staff.forEach(s => {
      const dept = s.department || "Unassigned";
      const existing = map.get(dept) || { total: 0, active: 0 };
      map.set(dept, { total: existing.total + 1, active: existing.active + (s.status === "active" ? 1 : 0) });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [staff]);

  // ── view modal ─────────────────────────────────────────────────────────────
  const [viewStaff, setViewStaff] = useState<StaffMember | null>(null);

  // ── edit/add modal state ───────────────────────────────────────────────────
  const [editMode, setEditMode] = useState<"add" | "edit">("add");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<StaffMember["role"]>("doctor");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formPerms, setFormPerms] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [presetApplied, setPresetApplied] = useState(false);

  const applyRoleDefaults = () => {
    setFormPerms([...ROLE_PERMISSION_PRESETS[formRole]]);
    setPresetApplied(true);
    showFeedback(`Applied ${formRole} default permissions.`, "info");
  };

  const openAddModal = () => {
    setEditMode("add"); setFormName(""); setFormRole("doctor"); setFormEmail("");
    setFormPhone(""); setFormDept(""); setFormStatus("active"); setFormPerms([]); setFormError(""); setPresetApplied(false);
    setShowAddStaff(true);
  };
  const openEditModal = (s: StaffMember) => {
    setEditMode("edit"); setFormName(s.name); setFormRole(s.role); setFormEmail(s.email);
    setFormPhone(s.phone); setFormDept(s.department); setFormStatus(s.status); setFormPerms([...s.permissions]); setFormError(""); setPresetApplied(false);
    setSelectedStaff(s); setShowAddStaff(true);
  };
  const closeStaffModal = () => { setShowAddStaff(false); setSelectedStaff(null); };

  const handleSaveStaff = () => {
    setFormError("");
    if (!formName.trim()) { setFormError("Name is required."); return; }
    if (!formEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) { setFormError("Valid email is required."); return; }
    if (!formRole) { setFormError("Role is required."); return; }
    // Last-admin guard
    if (editMode === "edit" && selectedStaff) {
      const wouldDeactivate = formStatus === "inactive" && selectedStaff.status === "active";
      const wouldChangeRole = formRole !== "admin" && selectedStaff.role === "admin";
      if ((wouldDeactivate || wouldChangeRole) && isLastActiveAdmin(selectedStaff)) {
        setFormError("At least one active admin is required.");
        return;
      }
    }
    if (editMode === "add") {
      const newMember: StaffMember = {
        id: `STF-${Date.now()}`, name: formName.trim(), role: formRole, email: formEmail.trim(),
        phone: formPhone.trim(), department: formDept.trim(), status: formStatus,
        joinDate: new Date().toISOString().split("T")[0], permissions: formPerms,
      };
      persistStaff([...staff, newMember]);
      pushActivity("System", `Added new staff member: ${newMember.name} (${newMember.role})`);
      showFeedback(`${newMember.name} added successfully.`);
    } else if (selectedStaff) {
      const updated: StaffMember = { ...selectedStaff, name: formName.trim(), role: formRole, email: formEmail.trim(), phone: formPhone.trim(), department: formDept.trim(), status: formStatus, permissions: formPerms };
      persistStaff(staff.map(s => s.id === selectedStaff.id ? updated : s));
      pushActivity("System", `Updated staff member: ${updated.name}`);
      showFeedback(`${updated.name} updated.`);
    }
    closeStaffModal();
  };

  const handleToggleStatus = (s: StaffMember) => {
    if (s.status === "active" && isLastActiveAdmin(s)) {
      showFeedback("At least one active admin is required.", "error");
      return;
    }
    const next = s.status === "active" ? "inactive" : "active";
    persistStaff(staff.map(m => m.id === s.id ? { ...m, status: next } : m));
    pushActivity("System", `${next === "inactive" ? "Deactivated" : "Reactivated"} ${s.name}`);
    showFeedback(`${s.name} ${next === "inactive" ? "deactivated" : "reactivated"}.`);
    if (viewStaff?.id === s.id) setViewStaff({ ...viewStaff, status: next });
  };

  // ── schedule modal ─────────────────────────────────────────────────────────
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [schStaffId, setSchStaffId] = useState("");
  const [schDate, setSchDate] = useState("");
  const [schStart, setSchStart] = useState("");
  const [schEnd, setSchEnd] = useState("");
  const [schType, setSchType] = useState<Schedule["type"]>("consultation");
  const [schError, setSchError] = useState("");

  const openScheduleModal = (sch?: Schedule) => {
    if (sch) {
      setEditSchedule(sch); setSchStaffId(sch.staffId); setSchDate(sch.date);
      setSchStart(sch.startTime); setSchEnd(sch.endTime); setSchType(sch.type);
    } else {
      setEditSchedule(null); setSchStaffId(""); setSchDate(""); setSchStart(""); setSchEnd(""); setSchType("consultation");
    }
    setSchError(""); setShowScheduleModal(true);
  };
  const closeScheduleModal = () => { setShowScheduleModal(false); setEditSchedule(null); };

  const handleSaveSchedule = () => {
    setSchError("");
    if (!schStaffId) { setSchError("Please select a staff member."); return; }
    if (!schDate) { setSchError("Please select a date."); return; }
    if (!schStart) { setSchError("Please set a start time."); return; }
    if (!schEnd) { setSchError("Please set an end time."); return; }
    if (schEnd <= schStart) { setSchError("End time must be after start time."); return; }
    // Conflict detection
    if (hasConflict(schStaffId, schDate, schStart, schEnd, editSchedule?.id)) {
      setSchError("Schedule conflict: staff member already has a shift at this time.");
      return;
    }
    const member = staff.find(s => s.id === schStaffId);
    const memberName = member?.name || schStaffId;
    if (editSchedule) {
      const updated: Schedule = { ...editSchedule, staffId: schStaffId, staffName: memberName, date: schDate, startTime: schStart, endTime: schEnd, type: schType };
      persistSchedules(schedules.map(sc => sc.id === editSchedule.id ? updated : sc));
      pushActivity("System", `Updated schedule for ${memberName} on ${schDate}`);
      showFeedback(`Schedule updated for ${memberName}.`);
    } else {
      const newSch: Schedule = { id: `SCH-${Date.now()}`, staffId: schStaffId, staffName: memberName, date: schDate, startTime: schStart, endTime: schEnd, type: schType, status: "scheduled" };
      persistSchedules([...schedules, newSch]);
      pushActivity("System", `Added ${schType} schedule for ${memberName} on ${schDate}`);
      showFeedback(`Schedule added for ${memberName}.`);
    }
    closeScheduleModal();
  };

  const handleDeleteSchedule = (sch: Schedule) => {
    if (!window.confirm(`Delete schedule for ${sch.staffName} on ${sch.date}?`)) return;
    persistSchedules(schedules.filter(s => s.id !== sch.id));
    pushActivity("System", `Deleted schedule for ${sch.staffName} on ${sch.date}`);
    showFeedback(`Schedule deleted.`, "info");
  };

  const handleScheduleStatus = (sch: Schedule, newStatus: Schedule["status"]) => {
    const updated = schedules.map(s => s.id === sch.id ? { ...s, status: newStatus } : s);
    persistSchedules(updated);
    pushActivity("System", `Marked ${sch.staffName}'s schedule on ${sch.date} as ${newStatus}`);
    showFeedback(`Schedule marked as ${newStatus}.`);
  };

  // ── bulk actions ──────────────────────────────────────────────────────────
  const handleBulkDeactivate = () => {
    const targets = staff.filter(s => selectedIds.has(s.id) && s.status === "active");
    if (targets.length === 0) { showFeedback("No active staff selected.", "info"); return; }
    const adminTargets = targets.filter(s => isLastActiveAdmin(s));
    if (adminTargets.length > 0) { showFeedback("At least one active admin is required.", "error"); return; }
    if (!window.confirm(`Deactivate ${targets.length} staff member(s)?`)) return;
    persistStaff(staff.map(s => selectedIds.has(s.id) && s.status === "active" ? { ...s, status: "inactive" } : s));
    pushActivity("System", `Bulk deactivated ${targets.length} staff member(s)`);
    showFeedback(`Deactivated ${targets.length} staff member(s).`);
    setSelectedIds(new Set());
  };
  const handleBulkReactivate = () => {
    const targets = staff.filter(s => selectedIds.has(s.id) && s.status === "inactive");
    if (targets.length === 0) { showFeedback("No inactive staff selected.", "info"); return; }
    if (!window.confirm(`Reactivate ${targets.length} staff member(s)?`)) return;
    persistStaff(staff.map(s => selectedIds.has(s.id) && s.status === "inactive" ? { ...s, status: "active" } : s));
    pushActivity("System", `Bulk reactivated ${targets.length} staff member(s)`);
    showFeedback(`Reactivated ${targets.length} staff member(s).`);
    setSelectedIds(new Set());
  };
  const handleBulkExport = () => {
    const targets = staff.filter(s => selectedIds.has(s.id));
    if (targets.length === 0) { showFeedback("No staff selected.", "info"); return; }
    const h = "ID,Name,Role,Department,Email,Phone,Status,Join Date,Permission Count\n";
    const rows = targets.map(s => [s.id, `"${s.name}"`, s.role, `"${s.department}"`, s.email, s.phone, s.status, s.joinDate, s.permissions.includes("all") ? "all" : s.permissions.length].join(",")).join("\n");
    const blob = new Blob([h + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "staff-selected.csv"; a.click();
    showFeedback(`Exported ${targets.length} staff member(s).`);
  };

  // ── import staff JSON ─────────────────────────────────────────────────────
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const incoming: StaffMember[] = Array.isArray(raw) ? raw : (raw.staff ?? []);
        if (!Array.isArray(incoming)) { showFeedback("Invalid JSON: expected array or {staff:[...]}", "error"); return; }
        let imported = 0; let skipped = 0;
        const next = [...staff];
        incoming.forEach((m: Partial<StaffMember>) => {
          if (!m.name || !m.email || !m.role) { skipped++; return; }
          const exists = next.findIndex(s => s.id === m.id || s.email === m.email);
          if (exists >= 0) { next[exists] = { ...next[exists], ...m } as StaffMember; imported++; }
          else { next.push({ id: m.id || `STF-${Date.now()}-${imported}`, name: m.name, email: m.email, role: m.role as StaffMember["role"], phone: m.phone || "", department: m.department || "", status: m.status || "active", joinDate: m.joinDate || new Date().toISOString().split("T")[0], permissions: m.permissions || [] }); imported++; }
        });
        persistStaff(next);
        pushActivity("System", `Imported ${imported} staff member(s) (${skipped} skipped)`);
        showFeedback(`Imported ${imported}, skipped ${skipped}.`);
      } catch { showFeedback("Failed to parse JSON file.", "error"); }
      if (importInputRef.current) importInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // ── reset demo staff ──────────────────────────────────────────────────────
  const handleResetDemoStaff = () => {
    if (!window.confirm("Restore default demo staff? This will overwrite current staff data.")) return;
    persistStaff(DEFAULT_STAFF);
    pushActivity("System", "Reset staff to demo defaults");
    showFeedback("Demo staff restored.");
  };

  // ── export helpers ─────────────────────────────────────────────────────────
  const exportStaffCSV = () => {
    if (staff.length === 0) { showFeedback("No staff to export.", "info"); return; }
    const h = "ID,Name,Role,Email,Phone,Department,Status,Join Date,Permission Count\n";
    const rows = staff.map(s => [s.id, `"${s.name}"`, s.role, s.email, s.phone, `"${s.department}"`, s.status, s.joinDate, s.permissions.includes("all") ? "all" : s.permissions.length].join(",")).join("\n");
    const blob = new Blob([h + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "staff.csv"; a.click();
    showFeedback(`Exported ${staff.length} staff member(s).`);
  };
  const exportScheduleCSV = () => {
    if (schedules.length === 0) { showFeedback("No schedules to export.", "info"); return; }
    const h = "ID,Staff Name,Date,Start,End,Type,Status\n";
    const rows = schedules.map(s => [s.id, `"${s.staffName}"`, s.date, s.startTime, s.endTime, s.type, s.status].join(",")).join("\n");
    const blob = new Blob([h + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "schedules.csv"; a.click();
    showFeedback(`Exported ${schedules.length} schedule(s).`);
  };
  const exportActivityCSV = () => {
    if (activity.length === 0) { showFeedback("No activity to export.", "info"); return; }
    const h = "ID,User,Action,Time\n";
    const rows = activity.map(a => [a.id, `"${a.user}"`, `"${a.action.replace(/"/g, '""')}"`, a.time].join(",")).join("\n");
    const blob = new Blob([h + rows], { type: "text/csv" });
    const a2 = document.createElement("a"); a2.href = URL.createObjectURL(blob); a2.download = "activity-log.csv"; a2.click();
    showFeedback(`Exported ${activity.length} activity entr${activity.length === 1 ? "y" : "ies"}.`);
  };

  // ── Escape key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key !== "Escape") return;
      if (showAddStaff) closeStaffModal();
      if (showScheduleModal) closeScheduleModal();
      if (viewStaff) setViewStaff(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAddStaff, showScheduleModal, viewStaff]);

  // ── derived counts ─────────────────────────────────────────────────────────
  const doctors = staff.filter(s => s.role === "doctor");
  const receptionists = staff.filter(s => s.role === "receptionist");
  const nurses = staff.filter(s => s.role === "nurse");
  const admins = staff.filter(s => s.role === "admin");

  const feedbackStyle = (type: "success" | "error" | "info") => ({
    padding: "6px 14px", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", fontWeight: 600,
    background: type === "success" ? "var(--green-bg)" : type === "error" ? "var(--red-bg)" : "var(--blue-bg)",
    color: type === "success" ? "var(--green)" : type === "error" ? "var(--red)" : "var(--blue)",
    border: `1px solid ${type === "success" ? "var(--green-border)" : type === "error" ? "var(--red-border)" : "var(--blue-border)"}`,
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>Staff & Roles</h1>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Doctors, receptionist, permissions, schedules, activity tracking</div>
        </div>
        {feedback && <div style={feedbackStyle(feedback.type)}>{feedback.message}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Staff" value={staff.length} color="var(--accent)" icon="ti-users" bg="var(--accent-soft)" />
        <StatCard label="Doctors" value={doctors.length} color="var(--blue)" icon="ti-stethoscope" bg="var(--blue-bg)" />
        <StatCard label="Receptionists" value={receptionists.length} color="var(--green)" icon="ti-user-shield" bg="var(--green-bg)" />
        <StatCard label="Nurses" value={nurses.length} color="var(--amber)" icon="ti-heart-pulse" bg="var(--amber-bg)" />
        <StatCard label="Active" value={staff.filter(s => s.status === "active").length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "staff"} onClick={() => setActiveTab("staff")}>Staff List</TabButton>
          <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}>Schedule</TabButton>
          <TabButton active={activeTab === "performance"} onClick={() => setActiveTab("performance")}>Performance</TabButton>
          <TabButton active={activeTab === "permissions"} onClick={() => setActiveTab("permissions")}>Permissions</TabButton>
        </div>
      </div>

      {/* Department Summary */}
      {activeTab === "staff" && (
        <div className="card card-padded" style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-building" style={{ marginRight: 4 }} />Department Summary
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {deptSummary.map(([dept, counts]) => (
              <div key={dept} style={{ padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius)", minWidth: 130 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600 }}>{dept}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{counts.active} active / {counts.total} total</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "staff" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all","doctor","receptionist","nurse","admin","active","inactive"] as StaffFilter[]).map(f => (
                <FilterButton key={f} active={staffFilter === f} onClick={() => setStaffFilter(f)}>
                  {f === "all" ? "All Staff" : f.charAt(0).toUpperCase() + f.slice(1) + (f === "active" || f === "inactive" ? "" : "s")}
                </FilterButton>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={exportStaffCSV} title="Export staff as CSV">
                <i className="ti ti-download" style={{ fontSize: 13, marginRight: 4 }} />Export CSV
              </button>
              <button className="btn btn-ghost" onClick={() => importInputRef.current?.click()} title="Import staff from JSON">
                <i className="ti ti-upload" style={{ fontSize: 13, marginRight: 4 }} />Import JSON
              </button>
              <input ref={importInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportJSON} />
              <button className="btn btn-ghost" onClick={handleResetDemoStaff} title="Restore default demo staff">
                <i className="ti ti-refresh" style={{ fontSize: 13, marginRight: 4 }} />Reset Demo Staff
              </button>
              <button className="btn btn-primary" onClick={openAddModal}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />Add Staff Member
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search by name, role, email, phone, department..."
              value={staffSearch}
              onChange={e => setStaffSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }}
            />
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12, padding: "8px 14px", background: "var(--accent-soft)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--accent)" }}>{selectedIds.size} selected</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={handleBulkDeactivate}>Deactivate Selected</button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={handleBulkReactivate}>Reactivate Selected</button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={handleBulkExport}>Export Selected CSV</button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setSelectedIds(new Set())}>Clear Selection</button>
              </div>
            </div>
          )}

          {/* Staff Table */}
          <div className="card" style={{ overflow: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input type="checkbox" checked={filteredStaff.length > 0 && selectedIds.size === filteredStaff.length} onChange={toggleSelectAll} />
                  </th>
                  {([
                    ["name", "Name"], ["role", "Role"], ["department", "Department"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(key)}>
                      {label}{sortKey === key && <i className={`ti ${sortAsc ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 12, marginLeft: 4 }} />}
                    </th>
                  ))}
                  <th>Email</th>
                  <th>Phone</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("status")}>
                    Status{sortKey === "status" && <i className={`ti ${sortAsc ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 12, marginLeft: 4 }} />}
                  </th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("joinDate")}>
                    Joined{sortKey === "joinDate" && <i className={`ti ${sortAsc ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 12, marginLeft: 4 }} />}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                    <div style={{ marginBottom: 10 }}>No staff found.</div>
                    {hasActiveFilters && <button className="btn btn-ghost" onClick={clearFilters}>Clear Filters</button>}
                  </td></tr>
                ) : filteredStaff.map(s => (
                  <tr key={s.id} className="tbl-row">
                    <td><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{s.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{s.id}</div>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: s.role === "doctor" ? "var(--blue-bg)" : s.role === "receptionist" ? "var(--green-bg)" : s.role === "nurse" ? "var(--amber-bg)" : "var(--purple-bg)",
                        color: s.role === "doctor" ? "var(--blue)" : s.role === "receptionist" ? "var(--green)" : s.role === "nurse" ? "var(--amber)" : "var(--purple)",
                        border: s.role === "doctor" ? "1px solid var(--blue-border)" : s.role === "receptionist" ? "1px solid var(--green-border)" : s.role === "nurse" ? "1px solid var(--amber-border)" : "1px solid var(--purple-border)"
                      }}>
                        {s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{s.department}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{s.email}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{s.phone}</td>
                    <td>
                      <span className="badge" style={{
                        background: s.status === "active" ? "var(--green-bg)" : "var(--red-bg)",
                        color: s.status === "active" ? "var(--green)" : "var(--red)",
                        border: s.status === "active" ? "1px solid var(--green-border)" : "1px solid var(--red-border)"
                      }}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(s.joinDate)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => { setViewStaff(s); setViewTab("overview"); }}>View</button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => openEditModal(s)}>Edit</button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: s.status === "active" ? "var(--red)" : "var(--green)" }}
                          onClick={() => handleToggleStatus(s)}>
                          {s.status === "active" ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "schedule" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-calendar" style={{ marginRight: 4 }} />Staff Schedule
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <button onClick={() => setScheduleView("list")} style={{ padding: "6px 12px", fontSize: "var(--font-xs)", border: "none", cursor: "pointer", background: scheduleView === "list" ? "var(--accent-soft)" : "transparent", color: scheduleView === "list" ? "var(--accent)" : "var(--muted)", fontWeight: scheduleView === "list" ? 600 : 400 }}>List</button>
                <button onClick={() => setScheduleView("week")} style={{ padding: "6px 12px", fontSize: "var(--font-xs)", border: "none", cursor: "pointer", background: scheduleView === "week" ? "var(--accent-soft)" : "transparent", color: scheduleView === "week" ? "var(--accent)" : "var(--muted)", fontWeight: scheduleView === "week" ? 600 : 400 }}>Week</button>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={exportScheduleCSV}>
                <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />Export CSV
              </button>
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => openScheduleModal()}>
                <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />Add Schedule
              </button>
            </div>
          </div>

          {schedules.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-calendar" style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No schedules yet</div>
              <div style={{ fontSize: "var(--font-xs)", marginBottom: 12 }}>Add a staff shift to get started.</div>
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => openScheduleModal()}>Add Schedule</button>
            </div>
          ) : scheduleView === "list" ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr><th>Staff</th><th>Date</th><th>Start</th><th>End</th><th>Type</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {[...schedules].sort((a, b) => a.date.localeCompare(b.date)).map(sch => (
                    <tr key={sch.id} className="tbl-row" style={{ opacity: sch.status === "cancelled" ? 0.6 : 1 }}>
                      <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{sch.staffName}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(sch.date)}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{sch.startTime}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{sch.endTime}</td>
                      <td>
                        <span className="badge" style={{
                          background: sch.type === "consultation" ? "var(--blue-bg)" : sch.type === "surgery" ? "var(--red-bg)" : sch.type === "admin" ? "var(--purple-bg)" : "var(--surface3)",
                          color: sch.type === "consultation" ? "var(--blue)" : sch.type === "surgery" ? "var(--red)" : sch.type === "admin" ? "var(--purple)" : "var(--muted)",
                        }}>
                          {sch.type.charAt(0).toUpperCase() + sch.type.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: sch.status === "completed" ? "var(--green-bg)" : sch.status === "cancelled" ? "var(--red-bg)" : "var(--blue-bg)",
                          color: sch.status === "completed" ? "var(--green)" : sch.status === "cancelled" ? "var(--red)" : "var(--blue)",
                        }}>
                          {sch.status.charAt(0).toUpperCase() + sch.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {sch.status === "scheduled" && (
                            <>
                              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--green)" }} onClick={() => handleScheduleStatus(sch, "completed")}>Mark Completed</button>
                              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleScheduleStatus(sch, "cancelled")}>Cancel</button>
                            </>
                          )}
                          {sch.status === "cancelled" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleScheduleStatus(sch, "scheduled")}>Restore</button>
                          )}
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => openScheduleModal(sch)}>Edit</button>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleDeleteSchedule(sch)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setWeekOffset(o => o - 1)}>← Previous Week</button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setWeekOffset(0)}>This Week</button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setWeekOffset(o => o + 1)}>Next Week →</button>
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  {fmtDate(weekDateStrings[0])} – {fmtDate(weekDateStrings[6])}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {weekDates.map((d, i) => {
                  const dateStr = weekDateStrings[i];
                  const daySchedules = schedules.filter(s => s.date === dateStr);
                  return (
                    <div key={dateStr} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 10, minHeight: 90 }}>
                      <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6 }}>
                        {d.toLocaleDateString(undefined, { weekday: "short" })} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{fmtDate(dateStr)}</span>
                      </div>
                      {daySchedules.length === 0 ? (
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>—</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {daySchedules.map(sch => (
                            <div key={sch.id} onClick={() => openScheduleModal(sch)} title="Click to edit"
                              style={{ fontSize: "var(--font-xs)", padding: "4px 6px", borderRadius: 4, cursor: "pointer", opacity: sch.status === "cancelled" ? 0.5 : 1,
                                background: sch.status === "completed" ? "var(--green-bg)" : sch.status === "cancelled" ? "var(--red-bg)" : "var(--blue-bg)",
                                color: sch.status === "completed" ? "var(--green)" : sch.status === "cancelled" ? "var(--red)" : "var(--blue)" }}>
                              <div style={{ fontWeight: 600 }}>{sch.staffName}</div>
                              <div>{sch.startTime}–{sch.endTime} · {sch.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "performance" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 4 }}>
            <i className="ti ti-chart-line" style={{ marginRight: 4 }} />Performance Metrics
          </div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 12 }}>
            Derived from logged schedules and activity. No fabricated figures.
          </div>
          {doctors.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No doctors on staff.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {doctors.map(doc => {
                const docSchedules = schedules.filter(s => s.staffId === doc.id);
                const totalShifts = docSchedules.length;
                const completed = docSchedules.filter(s => s.status === "completed").length;
                const cancelled = docSchedules.filter(s => s.status === "cancelled").length;
                const scheduledUpcoming = docSchedules.filter(s => s.status === "scheduled").length;
                const completedConsultations = docSchedules.filter(s => s.type === "consultation" && s.status === "completed").length;
                const surgeries = docSchedules.filter(s => s.type === "surgery").length;
                const estimatedPatients = completedConsultations * 4;
                return (
                  <div key={doc.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 4 }}>{doc.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 12 }}>{doc.department} · {doc.status === "active" ? "Active" : "Inactive"}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <MetricCard label="Total Shifts" value={totalShifts > 0 ? String(totalShifts) : "—"} color="var(--purple)" />
                      <MetricCard label="Completed" value={completed > 0 ? String(completed) : "—"} color="var(--green)" />
                      <MetricCard label="Cancelled" value={cancelled > 0 ? String(cancelled) : "—"} color="var(--red)" />
                      <MetricCard label="Upcoming" value={scheduledUpcoming > 0 ? String(scheduledUpcoming) : "—"} color="var(--blue)" />
                      <MetricCard label="Surgeries" value={surgeries > 0 ? String(surgeries) : "—"} color="var(--amber)" />
                      <MetricCard label="Est. Patients Seen" value={estimatedPatients > 0 ? String(estimatedPatients) : "—"} color="var(--blue)" />
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
                      Est. patients seen = completed consultation shifts × 4 (demo estimate).
                    </div>
                    {totalShifts === 0 && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 8, textAlign: "center" }}>No schedules added yet.</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "permissions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 8 }}>Permission Summary by Role</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
              {(["doctor","receptionist","nurse","admin"] as StaffMember["role"][]).map(role => {
                const count = staff.filter(s => s.role === role).reduce((acc, s) => Math.max(acc, s.permissions.length), 0);
                return (
                  <div key={role} style={{ padding: 10, background: "var(--surface2)", borderRadius: "var(--radius)", textAlign: "center" }}>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>{role.charAt(0).toUpperCase() + role.slice(1)}</div>
                    <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color: role === "admin" ? "var(--accent)" : "var(--text)" }}>
                      {role === "admin" ? "All" : `${count}`}
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{role === "admin" ? "full access" : "permissions"}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>
              <i className="ti ti-lock" style={{ marginRight: 4 }} />Role Permissions
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Permission</th><th>Doctor</th><th>Receptionist</th><th>Nurse</th><th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["View Medical Info", true, false, true, true],
                    ["Edit Medical Info", true, false, false, true],
                    ["Prescribe Medication", true, false, false, true],
                    ["View Patients", true, true, true, true],
                    ["Edit Patients", true, true, false, true],
                    ["Delete Patients", false, false, false, true],
                    ["View Billing", true, true, true, true],
                    ["Edit Billing", false, true, false, true],
                    ["Schedule Appointments", true, true, true, true],
                    ["View Audit Log", false, false, false, true],
                    ["Manage Staff", false, false, false, true],
                    ["System Settings", false, false, false, true],
                  ].map(([perm, doc, rec, nur, adm]) => (
                    <tr key={perm as string}>
                      <td style={{ fontSize: "var(--font-sm)" }}>{perm as string}</td>
                      <td><PermDot on={doc as boolean} /></td>
                      <td><PermDot on={rec as boolean} /></td>
                      <td><PermDot on={nur as boolean} /></td>
                      <td><PermDot on={adm as boolean} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              Staff permission counts (from their profile): {staff.map(s => `${s.name.split(" ")[0]}: ${s.permissions.includes("all") ? "all" : s.permissions.length}`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card card-padded" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div className="section-label" style={{ margin: 0 }}>
            <i className="ti ti-activity" style={{ marginRight: 4 }} />Recent Activity
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={exportActivityCSV}>
              <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />Export CSV
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }}
              onClick={() => {
                if (!window.confirm("Clear all activity? This cannot be undone.")) return;
                persistActivity([]);
                showFeedback("Activity cleared.", "info");
              }}>
              <i className="ti ti-trash" style={{ fontSize: 12, marginRight: 4 }} />Clear Activity
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activity.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: "var(--font-sm)" }}>No activity yet.</div>
          ) : activity.slice(0, 20).map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {a.user.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{a.user}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{a.action}</div>
              </div>
              <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtRelative(a.time)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* View Staff Modal */}
      {viewStaff && (
        <div className="modal-backdrop" onClick={() => setViewStaff(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Staff Details</div>
              <button className="btn-icon" onClick={() => setViewStaff(null)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: "12px 20px 0" }}>
              <div style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                  {viewStaff.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>{viewStaff.name}</div>
                  <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{viewStaff.id} · Joined {fmtDate(viewStaff.joinDate)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                {(["overview","schedule","permissions","activity"] as const).map(t => (
                  <TabButton key={t} active={viewTab === t} onClick={() => setViewTab(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </TabButton>
                ))}
              </div>
            </div>
            <div style={{ padding: 20, maxHeight: "55vh", overflowY: "auto" }}>
              {viewTab === "overview" && (
                <>
                  {[
                    ["Role", viewStaff.role.charAt(0).toUpperCase() + viewStaff.role.slice(1)],
                    ["Department", viewStaff.department || "—"],
                    ["Email", viewStaff.email || "—"],
                    ["Phone", viewStaff.phone || "—"],
                    ["Status", viewStaff.status.charAt(0).toUpperCase() + viewStaff.status.slice(1)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                      <span style={{ color: "var(--muted)" }}>{label}</span>
                      <span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                </>
              )}

              {viewTab === "schedule" && (
                schedules.filter(s => s.staffId === viewStaff.id).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: "var(--font-sm)" }}>
                    <div style={{ marginBottom: 10 }}>No schedules for this staff member.</div>
                    <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }}
                      onClick={() => { setViewStaff(null); openScheduleModal(); }}>Add Schedule</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...schedules].filter(s => s.staffId === viewStaff.id).sort((a, b) => a.date.localeCompare(b.date)).map(s => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--font-xs)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <span>{fmtDate(s.date)} · {s.startTime}–{s.endTime} · {s.type}</span>
                        <span className="badge" style={{
                          background: s.status === "completed" ? "var(--green-bg)" : s.status === "cancelled" ? "var(--red-bg)" : "var(--blue-bg)",
                          color: s.status === "completed" ? "var(--green)" : s.status === "cancelled" ? "var(--red)" : "var(--blue)",
                        }}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {viewTab === "permissions" && (
                viewStaff.permissions.includes("all") ? (
                  <div style={{ textAlign: "center", padding: 16 }}>
                    <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: "var(--font-sm)", padding: "6px 14px" }}>
                      <i className="ti ti-shield-check" style={{ marginRight: 6 }} />Full access
                    </span>
                  </div>
                ) : viewStaff.permissions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 16, color: "var(--muted)", fontSize: "var(--font-sm)" }}>No permissions assigned.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {viewStaff.permissions.map(p => (
                      <span key={p} className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{p}</span>
                    ))}
                  </div>
                )
              )}

              {viewTab === "activity" && (
                activity.filter(a => a.user === viewStaff.name).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: "var(--font-sm)" }}>No activity for this staff member.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activity.filter(a => a.user === viewStaff.name).slice(0, 15).map(a => (
                      <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "var(--font-xs)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <span>{a.action}</span>
                        <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtRelative(a.time)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "0 20px 20px" }}>
              <button className="btn btn-ghost" onClick={() => { setViewStaff(null); openEditModal(viewStaff); }}>Edit</button>
              <button className="btn btn-ghost" style={{ color: viewStaff.status === "active" ? "var(--red)" : "var(--green)" }}
                onClick={() => handleToggleStatus(viewStaff)}>
                {viewStaff.status === "active" ? "Deactivate" : "Reactivate"}
              </button>
              <button className="btn btn-primary" onClick={() => setViewStaff(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showAddStaff && (
        <div className="modal-backdrop" onClick={closeStaffModal}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>{editMode === "add" ? "Add Staff Member" : `Edit — ${selectedStaff?.name}`}</div>
              <button className="btn-icon" onClick={closeStaffModal}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20, maxHeight: "70vh", overflowY: "auto" }}>
              {formError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{formError}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Full Name *</label>
                <input type="text" value={formName} onChange={e => { setFormName(e.target.value); setFormError(""); }} placeholder="Enter full name..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Role *</label>
                <select value={formRole} onChange={e => { setFormRole(e.target.value as StaffMember["role"]); setFormError(""); setPresetApplied(false); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="nurse">Nurse</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="button" className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", marginTop: 6 }} onClick={applyRoleDefaults}>
                  <i className="ti ti-wand" style={{ fontSize: 12, marginRight: 4 }} />Apply role default permissions
                </button>
                {presetApplied && <span style={{ fontSize: "var(--font-xs)", color: "var(--green)", marginLeft: 8 }}>Defaults applied</span>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Email *</label>
                <input type="email" value={formEmail} onChange={e => { setFormEmail(e.target.value); setFormError(""); }} placeholder="Enter email..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Phone</label>
                <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Enter phone number..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Department</label>
                <input type="text" value={formDept} onChange={e => setFormDept(e.target.value)} placeholder="Enter department..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Status</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as "active" | "inactive")}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 6, display: "block" }}>Permissions</label>
                {formPerms.includes("all") ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--accent-soft)", borderRadius: "var(--radius)" }}>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--accent)" }}>
                      <i className="ti ti-shield-check" style={{ marginRight: 6 }} />Full access
                    </span>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setFormPerms([])}>Switch to custom</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {ALL_PERMISSIONS.map(p => (
                      <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--font-xs)", cursor: "pointer" }}>
                        <input type="checkbox" checked={formPerms.includes(p)} onChange={e => setFormPerms(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))} />
                        {p}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={closeStaffModal}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveStaff}>{editMode === "add" ? "Add Staff Member" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-backdrop" onClick={closeScheduleModal}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>{editSchedule ? "Edit Schedule" : "Add Schedule"}</div>
              <button className="btn-icon" onClick={closeScheduleModal}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {schError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)" }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{schError}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Staff Member *</label>
                <select value={schStaffId} onChange={e => { setSchStaffId(e.target.value); setSchError(""); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="">Select staff...</option>
                  {staff.filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Date *</label>
                <input type="date" value={schDate} onChange={e => { setSchDate(e.target.value); setSchError(""); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Start Time *</label>
                  <input type="time" value={schStart} onChange={e => { setSchStart(e.target.value); setSchError(""); }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>End Time *</label>
                  <input type="time" value={schEnd} onChange={e => { setSchEnd(e.target.value); setSchError(""); }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Type</label>
                <select value={schType} onChange={e => setSchType(e.target.value as Schedule["type"])}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="consultation">Consultation</option>
                  <option value="surgery">Surgery</option>
                  <option value="admin">Admin</option>
                  <option value="break">Break</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={closeScheduleModal}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveSchedule} disabled={!schStaffId || !schDate || !schStart || !schEnd}>
                  {editSchedule ? "Save Changes" : "Add Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
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

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 12, background: "var(--surface3)", borderRadius: "var(--radius)" }}>
      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function PermDot({ on }: { on: boolean }) {
  return (
    <span style={{ color: on ? "var(--green)" : "var(--border)", fontSize: 16 }}>
      <i className={`ti ${on ? "ti-circle-check-filled" : "ti-circle-x"}`} />
    </span>
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

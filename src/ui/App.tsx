import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Patient, AuditEntry, UserRole } from "./types";
import GlobalStyles from "./GlobalStyles";
import PatientList from "./PatientList";
import PatientProfile from "./PatientProfile";
import PatientForm from "./PatientForm";
import { AppointmentsPage, BillingPage, ReportsPage, SettingsPage } from "./StubPages";
import Dashboard from "./Dashboard";
import QueuePage from "./Queue";
import ConsultationsPage from "./Consultations";
import LabPage from "./Lab";
import DocumentsPage from "./Documents";
import CommunicationsPage from "./Communications";
import StaffPage from "./Staff";
import AuditPage from "./Audit";
import { ToastProvider, useToast } from "./Toast";
import { getInitialPatients } from "./mockData";
import { apiClient } from "./api";
import {
  getPatientStats,
  createAuditEntry,
  addAuditEntry,
  savePatients,
  loadPatients,
  saveAuditMap,
  loadAuditMap,
  fmtDate,
} from "./utils";
import { Notifications } from "./components/Notifications";

// ─── Nav Tabs ─────────────────────────────────────────────────────────────────
const NAV_TABS = [
  { id: "dashboard",     label: "Dashboard",     icon: "ti-layout-dashboard" },
  { id: "queue",         label: "Queue",         icon: "ti-users-group" },
  { id: "consultations", label: "Consultations", icon: "ti-stethoscope" },
  { id: "prescriptions", label: "Prescriptions", icon: "ti-pill" },
  { id: "lab",           label: "Lab",           icon: "ti-test-tube" },
  { id: "billing",       label: "Billing",       icon: "ti-receipt" },
  { id: "documents",     label: "Documents",     icon: "ti-files" },
  { id: "communications",label: "Communications",icon: "ti-message" },
  { id: "reports",       label: "Reports",       icon: "ti-chart-bar" },
  { id: "staff",         label: "Staff",         icon: "ti-user-shield" },
  { id: "settings",      label: "Settings",      icon: "ti-settings" },
  { id: "audit",         label: "Audit",         icon: "ti-shield-lock" },
  { id: "patients",      label: "Patients",      icon: "ti-users" },
] as const;
type NavTab = typeof NAV_TABS[number]["id"];

const CURRENT_USER = { name: "Dr. Admin", role: "admin" as UserRole };

// ─── Load initial data ────────────────────────────────────────────────────────
async function getPatients(): Promise<Patient[]> {
  const saved = await loadPatients();
  if (saved && saved.length > 0) return saved;
  return getInitialPatients();
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({
  dark, setDark, activeTab, setActiveTab, userRole, setUserRole, stats, patients, onLogout,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  activeTab: NavTab;
  setActiveTab: (t: NavTab) => void;
  userRole: UserRole;
  setUserRole: (r: UserRole) => void;
  stats: ReturnType<typeof getPatientStats>;
  patients: Patient[];
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{
      background: dark ? "#0c0f1a" : "#fff",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 16px", height: 54, flexShrink: 0,
      gap: 12, position: "relative", zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-heart-rate-monitor" style={{ color: "#fff", fontSize: 15 }} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>
          ClinicOS
        </span>
      </div>

      {/* Desktop nav */}
      <nav style={{
        display: "flex", gap: 2, flex: 1,
        overflow: "hidden",
      }} className="desktop-only">
        {NAV_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "var(--radius)",
              fontSize: "var(--font-sm)", fontWeight: activeTab === id ? 600 : 400,
              cursor: "pointer", border: "none", transition: "all 0.15s",
              color:      activeTab === id ? "var(--accent)" : "var(--muted)",
              background: activeTab === id ? "var(--accent-soft)" : "transparent",
            }}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 14 }} />
            {label}
          </button>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        {/* Urgent badge */}
        {(stats.followUpDue + stats.insExpiring) > 0 && (
          <div className="desktop-only" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: "var(--radius-full)",
            background: "var(--amber-bg)", border: "1px solid var(--amber-border)",
            fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />
            {stats.followUpDue + stats.insExpiring} urgent
          </div>
        )}

        {/* Role selector */}
        <select
          value={userRole}
          onChange={(e) => setUserRole(e.target.value as UserRole)}
          className="desktop-only"
          style={{ fontSize: "var(--font-xs)", padding: "5px 8px", borderRadius: "var(--radius)" }}
        >
          <option value="receptionist">Receptionist</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
        </select>

        {/* Notifications */}
        <Notifications patients={patients} />

        {/* Dark toggle */}
        <button
          className="btn-icon"
          onClick={() => setDark(!dark)}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 15 }} />
        </button>

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "var(--accent-soft)", color: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, cursor: "pointer",
          border: "2px solid var(--accent)30",
        }} title={CURRENT_USER.name}>
          {CURRENT_USER.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>

        {/* Logout button */}
        <button
          className="btn-icon"
          onClick={onLogout}
          title="Logout"
          style={{
            padding: "6px",
            background: "var(--error-bg)",
            color: "var(--error)",
            border: "1px solid var(--error-border)",
            borderRadius: "var(--radius)",
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: 15 }} />
        </button>
        </div>

        {/* Mobile hamburger */}
        <button className="btn-icon mobile-only" onClick={() => setMenuOpen((o) => !o)}>
          <i className="ti ti-menu-2" style={{ fontSize: 16 }} />
        </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mobile-only" style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: dark ? "#0c0f1a" : "#fff",
          borderBottom: "1px solid var(--border)",
          padding: "8px 12px", zIndex: 200,
          boxShadow: "var(--shadow-lg)",
        }}>
          {NAV_TABS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setMenuOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", borderRadius: "var(--radius)", marginBottom: 2,
              fontSize: "var(--font-base)", fontWeight: activeTab === id ? 600 : 400,
              color: activeTab === id ? "var(--accent)" : "var(--text)",
              background: activeTab === id ? "var(--accent-soft)" : "transparent",
              border: "none", cursor: "pointer",
            }}>
              <i className={`ti ${icon}`} style={{ fontSize: 16 }} />
              {label}
            </button>
          ))}
          <div style={{ padding: "8px 12px 4px", borderTop: "1px solid var(--border)", marginTop: 4 }}>
            <label style={{ fontSize: "var(--font-xs)", color: "var(--muted)", display: "block", marginBottom: 4 }}>Role</label>
            <select value={userRole} onChange={(e) => setUserRole(e.target.value as UserRole)}
              style={{ width: "100%", fontSize: "var(--font-sm)" }}>
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({
  stats,
  onFilter,
}: {
  stats: ReturnType<typeof getPatientStats>;
  onFilter: (q: string) => void;
}) {
  const items = [
    { label: "Total",           value: stats.total,          color: "var(--accent)", icon: "ti-users",              query: "" },
    { label: "Active",          value: stats.active,         color: "var(--green)",  icon: "ti-activity",           query: "active" },
    { label: "Follow-Up Due",   value: stats.followUpDue,    color: "var(--amber)",  icon: "ti-clock",              query: "follow-up overdue" },
    { label: "New",             value: stats.newPatients,    color: "#7c3aed",       icon: "ti-user-plus",          query: "new patient" },
    { label: "Ins. Expiring",   value: stats.insExpiring,    color: "var(--red)",    icon: "ti-shield-exclamation", query: "insurance expiring" },
    { label: "Critical Alerts", value: stats.criticalAlerts, color: "var(--red)",    icon: "ti-alert-triangle",     query: "critical" },
  ];

  return (
    <div style={{
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      display: "grid",
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      flexShrink: 0,
    }}>
      {items.map((s, i) => (
        <button
          key={s.label}
          onClick={() => s.query && onFilter(s.query)}
          style={{
            padding: "10px 14px",
            borderRight: i < items.length - 1 ? "1px solid var(--border)" : "none",
            background: "none", border: "none",
            cursor: s.query ? "pointer" : "default",
            textAlign: "left", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { if (s.query) (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
          title={s.query ? `Filter: ${s.label}` : undefined}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <i className={`ti ${s.icon}`} style={{ fontSize: 11, color: s.color }} />
            <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {s.label}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
            {s.value}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Import Wizard (simple inline) ────────────────────────────────────────────
function ImportModal({ onImport, onClose }: {
  onImport: (rows: Partial<Patient>[]) => void;
  onClose: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Partial<Patient>[]>([]);
  const [parsed, setParsed] = useState(false);

  function parseCsv() {
    const lines = csv.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return {
        firstName:     obj.firstname || obj["first name"] || obj.name?.split(" ")[0] || "",
        lastName:      obj.lastname  || obj["last name"]  || obj.name?.split(" ").slice(1).join(" ") || "",
        name:          obj.name || `${obj.firstname || ""} ${obj.lastname || ""}`.trim(),
        phone:         obj.phone || "",
        email:         obj.email || "",
        dob:           obj.dob || obj["date of birth"] || "",
        gender:        obj.gender || "Other",
        bloodGroup:    obj.bloodgroup || obj["blood group"] || "O+",
        doctor:        obj.doctor || "Dr. Sharma",
        insurer:       obj.insurer || obj.insurance || "None",
        address:       obj.address || "",
      } as Partial<Patient>;
    });
    setPreview(rows);
    setParsed(true);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 620 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Import Patients</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Paste CSV data below</div>
          </div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {!parsed ? (
            <>
              <div style={{
                padding: "12px", borderRadius: "var(--radius)", background: "var(--surface2)",
                border: "1px solid var(--border)", marginBottom: 12,
                fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.7,
              }}>
                <strong>Expected columns:</strong> name, phone, email, dob, gender, bloodGroup, doctor, insurer, address
                <br />
                <strong>Example:</strong> name,phone,dob,gender<br />Arjun Sharma,+91 9876543210,1985-04-12,Male
              </div>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder="Paste CSV data here…"
                rows={8}
                style={{ width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: "var(--font-xs)" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={parseCsv} disabled={!csv.trim()}>
                  <i className="ti ti-eye" style={{ fontSize: 13 }} /> Preview
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12, fontSize: "var(--font-sm)", color: "var(--muted)" }}>
                Found <strong>{preview.length}</strong> records to import.
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>DOB</th><th>Doctor</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: "var(--font-sm)" }}>{r.name}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{r.phone}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{r.dob}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{r.doctor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setParsed(false)}>Back</button>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={() => onImport(preview)}>
                  <i className="ti ti-file-import" style={{ fontSize: 13 }} />
                  Import {preview.length} Patients
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const { toast } = useToast();
  const [dark,            setDark]            = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [activeTab,       setActiveTab]       = useState<NavTab>("dashboard");
  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formMode,        setFormMode]        = useState<"create" | "edit" | null>(null);
  const [auditMap,        setAuditMap]        = useState<Record<string, AuditEntry[]>>({});
  const [importOpen,      setImportOpen]      = useState(false);
  const [userRole,        setUserRole]        = useState<UserRole>("receptionist");
  const [listSearch,      setListSearch]      = useState("");  // lifted search for stat bar clicks
  const [loading,         setLoading]         = useState(true);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Load initial data from localStorage
  useEffect(() => {
    async function loadData() {
      try {
        console.log("Loading patients...");
        const loadedPatients = await getPatients();
        console.log("Loaded patients:", loadedPatients.length);
        setPatients(loadedPatients);
      } catch (error) {
        console.error("Failed to load patients:", error);
        // Use mock data as fallback
        const mockPatients = getInitialPatients();
        setPatients(mockPatients);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Persist whenever patients or audit changes (now via localStorage)
  useEffect(() => { 
    savePatients(patients);
  }, [patients]);
  useEffect(() => { 
    saveAuditMap(auditMap);
  }, [auditMap]);

  // Keep selectedPatient in sync with patients array
  useEffect(() => {
    if (selectedPatient) {
      const fresh = patients.find((p) => p.id === selectedPatient.id);
      if (fresh && fresh !== selectedPatient) setSelectedPatient(fresh);
    }
  }, [patients]);

  // Ctrl+K / Cmd+K → focus search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setActiveTab("patients");
        setSelectedPatient(null);
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('input[type="search"]');
          input?.focus();
        }, 80);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const stats = getPatientStats(patients);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelect = useCallback((p: Patient) => {
    setSelectedPatient(p);
    setActiveTab("patients");
  }, []);

  const handleBack = useCallback(() => setSelectedPatient(null), []);

  const handleUpdatePatient = useCallback(async (updated: Patient, action = "edited") => {
    try {
      await apiClient.updatePatient(updated.id, updated);
      setPatients((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setSelectedPatient(updated);
      const entry = createAuditEntry({
        patientId: updated.id,
        message:   `${CURRENT_USER.name} ${action}: ${updated.name}`,
        type:      action,
        user:      CURRENT_USER.name,
      });
      setAuditMap((prev) => addAuditEntry(prev, updated.id, entry));
      toast(`${updated.name} updated`, "success");
    } catch (error) {
      console.error("Failed to update patient:", error);
      toast(`Failed to update patient: ${error}`, "error");
    }
  }, [toast]);

  const handleDeletePatient = useCallback(async (id: string) => {
    try {
      const p = patients.find((x) => x.id === id);
      await apiClient.deletePatient(id);
      setPatients((prev) => prev.filter((x) => x.id !== id));
      setSelectedPatient(null);
      if (p) {
        const entry = createAuditEntry({ patientId: id, message: `${CURRENT_USER.name} deleted ${p.name}`, type: "deleted", user: CURRENT_USER.name });
        setAuditMap((prev) => addAuditEntry(prev, id, entry));
        toast(`${p.name} deleted`, "error");
      }
    } catch (error) {
      console.error("Failed to delete patient:", error);
      toast(`Failed to delete patient: ${error}`, "error");
    }
  }, [patients, toast]);

  const handleSave = useCallback(async (data: Partial<Patient>) => {
    try {
      if (formMode === "create") {
        const newPatient = await apiClient.createPatient(data) as Patient;
        setPatients((prev) => [newPatient, ...prev]);
        setSelectedPatient(newPatient);
        const entry = createAuditEntry({ patientId: newPatient.id, message: `${CURRENT_USER.name} registered ${newPatient.name}`, type: "created", user: CURRENT_USER.name });
        setAuditMap((prev) => addAuditEntry(prev, newPatient.id, entry));
        toast(`${newPatient.name} registered`, "success");
      } else if (formMode === "edit" && selectedPatient) {
        const updated = { ...selectedPatient, ...data, updatedAt: new Date().toISOString() };
        const result = await apiClient.updatePatient(updated.id, updated) as Patient;
        setPatients((prev) => prev.map((p) => p.id === updated.id ? result : p));
        setSelectedPatient(result);
        const entry = createAuditEntry({ patientId: updated.id, message: `${CURRENT_USER.name} edited ${updated.name}`, type: "edited", user: CURRENT_USER.name });
        setAuditMap((prev) => addAuditEntry(prev, updated.id, entry));
        toast(`${updated.name} saved`, "success");
      }
      setFormMode(null);
    } catch (error) {
      console.error("Failed to save patient:", error);
      toast(`Failed to save patient: ${error}`, "error");
    }
  }, [formMode, selectedPatient, toast]);

  const handleImport = useCallback(async (rows: Partial<Patient>[]) => {
    try {
      const result = await apiClient.importPatients(rows) as { imported: number; errors: string[] };
      const importedCount = result.imported;
      setPatients((prev) => {
        // Reload patients from API after import
        apiClient.getPatients(1000, 0).then((patients) => {
          return patients as Patient[];
        }).catch(() => prev);
        return prev;
      });
      const entry = createAuditEntry({ patientId: "system", message: `${CURRENT_USER.name} imported ${importedCount} patients`, type: "import", user: CURRENT_USER.name });
      setAuditMap((prev) => addAuditEntry(prev, "system", entry));
      setImportOpen(false);
      toast(`${importedCount} patients imported`, "success");
    } catch (error) {
      console.error("Failed to import patients:", error);
      toast(`Failed to import patients: ${error}`, "error");
    }
  }, [toast]);

  // Handle logout (frontend-only mode - just clears data)
  const handleLogout = async () => {
    try {
      setPatients([]);
      setAuditMap({});
      setSelectedPatient(null);
      toast("Logged out successfully", "success");
    } catch (error) {
      console.error("Logout error:", error);
      toast("Failed to logout", "error");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  // Show main CRM interface (frontend-only mode)
  if (loading) {
    return (
      <div className="crm-root col" style={{ height: "100vh", overflow: "hidden" }}>
        <GlobalStyles dark={dark} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <div style={{ fontSize: "var(--font-lg)", color: "var(--muted)" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-root col" style={{ height: "100vh", overflow: "hidden" }}>
      <GlobalStyles dark={dark} />

      <TopBar
        dark={dark} setDark={setDark}
        activeTab={activeTab} setActiveTab={setActiveTab}
        userRole={userRole} setUserRole={setUserRole}
        stats={stats}
        patients={patients}
        onLogout={handleLogout}
      />

      {/* Stats bar — only on patients tab, only when not in profile view */}
      {activeTab === "patients" && !selectedPatient && (
        <StatsBar
          stats={stats}
          onFilter={(q) => { setListSearch(q); }}
        />
      )}

      {/* Ctrl+K hint */}
      {activeTab === "patients" && !selectedPatient && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 50, pointerEvents: "none",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-full)", padding: "5px 14px",
          fontSize: "var(--font-xs)", color: "var(--muted)", boxShadow: "var(--shadow)",
          display: "flex", alignItems: "center", gap: 6,
          opacity: 0.7,
        }}>
          <kbd style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 4, fontSize: "var(--font-2xs)", fontFamily: "monospace" }}>
            Ctrl+K
          </kbd>
          to focus search
        </div>
      )}

      {/* Page content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "dashboard" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <Dashboard patients={patients} />
          </div>
        )}
        {activeTab === "queue" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <QueuePage patients={patients} />
          </div>
        )}
        {activeTab === "consultations" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <ConsultationsPage patients={patients} />
          </div>
        )}
        {activeTab === "prescriptions" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <AppointmentsPage patients={patients} />
          </div>
        )}
        {activeTab === "lab" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <LabPage patients={patients} />
          </div>
        )}
        {activeTab === "billing" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <BillingPage patients={patients} />
          </div>
        )}
        {activeTab === "documents" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <DocumentsPage patients={patients} />
          </div>
        )}
        {activeTab === "communications" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <CommunicationsPage patients={patients} />
          </div>
        )}
        {activeTab === "reports" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <ReportsPage patients={patients} />
          </div>
        )}
        {activeTab === "staff" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <StaffPage />
          </div>
        )}
        {activeTab === "settings" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <SettingsPage dark={dark} setDark={setDark} role={userRole} setRole={setUserRole} />
          </div>
        )}
        {activeTab === "audit" && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <AuditPage />
          </div>
        )}
        {activeTab === "patients" && (
          selectedPatient ? (
            <PatientProfile
              patient={selectedPatient}
              auditEntries={auditMap[selectedPatient.id] || []}
              onBack={handleBack}
              onEditPatient={() => setFormMode("edit")}
              onUpdatePatient={handleUpdatePatient}
              onDeletePatient={handleDeletePatient}
              role={userRole}
            />
          ) : (
            <PatientList
              patients={patients}
              onSelect={handleSelect}
              selectedId={selectedPatient?.id}
              onNewPatient={() => setFormMode("create")}
              onImport={() => setImportOpen(true)}
              role={userRole}
            />
          )
        )}
      </div>

      {/* Modals */}
      {formMode && (
        <PatientForm
          mode={formMode}
          patient={formMode === "edit" ? selectedPatient : null}
          onSave={handleSave}
          onClose={() => setFormMode(null)}
          role={userRole}
        />
      )}
      {importOpen && (
        <ImportModal onImport={handleImport} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

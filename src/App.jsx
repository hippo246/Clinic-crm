import { useState, useCallback } from "react";
import GlobalStyles    from "./patients/components/GlobalStyles";
import PatientList     from "./patients/components/PatientList";
import PatientProfile  from "./patients/components/PatientProfile";
import PatientForm     from "./patients/components/PatientForm";
import ImportWizard    from "./patients/components/ImportWizard";
import MergePatients   from "./patients/components/MergePatients";
import { ALL_PATIENTS } from "./patients/data/mockPatients";
import { getPatientStats } from "./patients/utils/patientUtils";

const TABS = ["Patients", "Appointments", "Billing", "Reports", "Settings"];

// ─── TOP BAR ──────────────────────────────────────────────────────────────────
function TopBar({ dark, setDark, activeTab, setActiveTab }) {
  return (
    <div style={{
      background: dark ? "#13161f" : "#fff",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 20px", height: 52, flexShrink: 0,
      justifyContent: "space-between",
    }}>
      {/* Logo + nav tabs */}
      <div className="row gap-16">
        <div className="row gap-8">
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-heart-rate-monitor" style={{ color: "#fff", fontSize: 16 }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>ClinicOS</span>
        </div>

        <div className="row desktop-only" style={{ gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t}
              className="btn btn-ghost"
              onClick={() => setActiveTab(t)}
              style={{
                padding: "5px 12px", fontSize: 13, borderRadius: 6,
                background: activeTab === t ? "var(--accent-soft)" : "transparent",
                color:      activeTab === t ? "var(--accent)"      : "var(--muted)",
                border: "none",
                fontWeight: activeTab === t ? 600 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Right controls */}
      <div className="row gap-8">
        <button
          className="btn btn-ghost"
          style={{ padding: "6px 10px", fontSize: 12 }}
          onClick={() => setDark((d) => !d)}
        >
          <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 15 }} />
          {dark ? "Light" : "Dark"}
        </button>
        <div className="avatar" style={{ background: "#4f7cff22", color: "#4f7cff", cursor: "pointer" }}>
          AD
        </div>
      </div>
    </div>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────
function StatsBar({ patients }) {
  const { total, active, followUpDue, newPatients, insExpiring } = getPatientStats(patients);
  const stats = [
    { label: "Total Patients",      value: total,       color: "var(--accent)" },
    { label: "Active",              value: active,      color: "#22c55e"       },
    { label: "Follow-Up Due",       value: followUpDue, color: "#f59e0b"       },
    { label: "New",                 value: newPatients, color: "#7c4fff"       },
    { label: "Insurance Expiring",  value: insExpiring, color: "#ef4444"       },
  ];

  return (
    <div className="desktop-only" style={{
      display: "flex", gap: 1,
      background: "var(--border)",
      borderBottom: "1px solid var(--border)",
    }}>
      {stats.map((s) => (
        <div key={s.label} style={{
          flex: 1, padding: "8px 14px",
          background: "var(--surface)",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const CURRENT_USER = { name: "Admin (Dr. Desk)", role: "receptionist" };

export default function App() {
  const [dark,            setDark]            = useState(false);
  const [activeTab,       setActiveTab]       = useState("Patients");
  const [patients,        setPatients]        = useState(ALL_PATIENTS);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formMode,        setFormMode]        = useState(null);  // "create" | "edit" | null
  const [auditMap,        setAuditMap]        = useState({});    // { [patientId]: AuditEntry[] }
  const [importOpen,      setImportOpen]      = useState(false);
  const [mergeTargets,    setMergeTargets]    = useState(null);  // { primary, secondary } | null

  const handleSelect = useCallback((patient) => setSelectedPatient(patient), []);
  const handleBack   = useCallback(() => setSelectedPatient(null), []);

  // Import Wizard — bulk-add validated rows as new patients
  function handleImport(rows) {
    const startIdx = patients.length;
    const newPatients = rows.map((row, i) => ({
      id:                `CLN-${String(startIdx + i + 1001).padStart(5, "0")}`,
      firstName:         row.name?.split(" ")[0] || "",
      lastName:          row.name?.split(" ").slice(1).join(" ") || "",
      name:              row.name              || "",
      dob:               row.dob               || "",
      age:               row.dob ? Math.floor((new Date() - new Date(row.dob)) / 31557600000) : 0,
      gender:            row.gender            || "",
      bloodGroup:        row.bloodGroup        || "—",
      phone:             row.phone             || "",
      email:             row.email             || "",
      address:           row.address           || "",
      nationality:       "Indian",
      emergencyName:     row.emergencyName     || "",
      emergencyRelation: "",
      emergencyPhone:    row.emergencyPhone    || "",
      insurer:           row.insurer           || "None",
      policyNumber:      null,
      insuranceExpiry:   row.insuranceExpiry   || null,
      insuranceStatus:   row.insuranceExpiry
        ? (new Date(row.insuranceExpiry) < new Date() ? "Expired"
          : new Date(row.insuranceExpiry) < new Date(Date.now() + 30 * 86400000) ? "Expiring"
          : "Active")
        : "None",
      allergies:         "",
      conditions:        [],
      medications:       [],
      alerts:            [],
      status:            "New",
      doctor:            row.doctor            || "Dr. Sharma",
      lastVisit:         null,
      nextAppointment:   null,
      followUpDate:      null,
      followUpReason:    null,
      followUpStaff:     null,
      followUpPriority:  null,
      followUpStatus:    null,
      callAttempts:      0,
      lastContacted:     null,
      followUpNotes:     null,
      phoneVerified:     false,
      insuranceVerified: false,
      idVerified:        false,
      consentSigned:     false,
      documentsComplete: false,
      timeline:          [],
      documents:         [],
      notes:             [],
      family:            [],
    }));
    setPatients((prev) => [...newPatients, ...prev]);
    setImportOpen(false);
  }

  // Merge — keep primary, delete secondary, merge audit
  function handleMerge(mergedPatient, auditEntry, secondaryId) {
    setPatients((prev) =>
      prev
        .filter((p) => p.id !== secondaryId)
        .map((p) => p.id === mergedPatient.id ? mergedPatient : p)
    );
    setAuditMap((prev) => ({
      ...prev,
      [mergedPatient.id]: [...(prev[mergedPatient.id] || []), auditEntry],
    }));
    setMergeTargets(null);
    setSelectedPatient(mergedPatient);
  }

  function handleSave(patientData, auditEntries) {
    if (formMode === "create") {
      const newId      = `CLN-${String(patients.length + 1001).padStart(5, "0")}`;
      const newPatient = { ...patientData, id: newId };
      setPatients((prev) => [newPatient, ...prev]);
      setAuditMap((prev) => ({ ...prev, [newId]: auditEntries }));
    } else {
      setPatients((prev) => prev.map((p) => p.id === patientData.id ? patientData : p));
      setSelectedPatient(patientData);
      setAuditMap((prev) => ({
        ...prev,
        [patientData.id]: [...(prev[patientData.id] || []), ...auditEntries],
      }));
    }
    setFormMode(null);
  }

  return (
    <div className="crm-root col" style={{ height: "100vh", overflow: "hidden" }}>
      <GlobalStyles dark={dark} />
      <TopBar dark={dark} setDark={setDark} activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab !== "Patients" ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 15 }}>
          <div className="col gap-8" style={{ alignItems: "center" }}>
            <i className="ti ti-lock" style={{ fontSize: 32, color: "var(--border)" }} />
            <span>{activeTab} module — coming soon</span>
          </div>
        </div>
      ) : (
        <div className="col" style={{ flex: 1, overflow: "hidden" }}>
          {!selectedPatient && <StatsBar patients={patients} />}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {selectedPatient ? (
              <PatientProfile
                patient={selectedPatient}
                auditEntries={auditMap[selectedPatient.id] || []}
                onBack={handleBack}
                onEdit={() => setFormMode("edit")}
                role={CURRENT_USER.role}
              />
            ) : (
              <PatientList
                patients={patients}
                onSelect={handleSelect}
                selectedId={selectedPatient?.id}
                onNewPatient={() => setFormMode("create")}
              />
            )}
          </div>
        </div>
      )}

      {formMode && (
        <PatientForm
          mode={formMode}
          patient={formMode === "edit" ? selectedPatient : null}
          allPatients={patients}
          currentUser={CURRENT_USER}
          onSave={handleSave}
          onClose={() => setFormMode(null)}
          onViewDuplicate={(p) => { setFormMode(null); setSelectedPatient(p); }}
        />
      )}
    </div>
  );
}

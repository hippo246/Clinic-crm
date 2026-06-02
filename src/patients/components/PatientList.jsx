import { useState, useMemo, useCallback } from "react";
import { filterPatients, sortPatients, fmtDate, calcRiskScore } from "../utils/patientUtils";
import { LIST_COLUMNS, PAGE_SIZE, STATUSES, DOCTORS } from "../constants/patientConstants";
import { StatusBadge, InsuranceBadge, AlertChip, RiskBadge } from "./PatientBadges";

// ─── SMART SEARCH ─────────────────────────────────────────────────────────────
// Understands phrases like "diabetic patients", "insurance expiring this month",
// "follow-up overdue", "VIP patients", "no visit in 90 days"
function applySmartSearch(patients, query) {
  const q = query.trim().toLowerCase();
  if (!q) return patients;

  // Phrase matchers — checked before falling back to field search
  const phrases = [
    { match: ["diabetic", "diabetes"],                    fn: (p) => (p.alerts || []).includes("Diabetic") },
    { match: ["hypertension", "hypertensive", "bp"],      fn: (p) => (p.alerts || []).includes("Hypertension") },
    { match: ["heart", "cardiac"],                        fn: (p) => (p.alerts || []).includes("Heart Condition") },
    { match: ["pregnant", "pregnancy"],                   fn: (p) => (p.alerts || []).includes("Pregnancy") },
    { match: ["allerg"],                                  fn: (p) => (p.alerts || []).includes("Allergy") },
    { match: ["high risk"],                               fn: (p) => (p.alerts || []).includes("High Risk") },
    { match: ["vip"],                                     fn: (p) => p.status === "VIP" || p.flags?.vip },
    { match: ["follow-up overdue", "overdue followup", "followup overdue", "follow up overdue"],
                                                          fn: (p) => p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date()) },
    { match: ["follow-up", "followup", "follow up"],      fn: (p) => p.status === "Follow-Up Due" || !!p.followUpDate },
    { match: ["insurance expir"],                         fn: (p) => p.insuranceStatus === "Expiring" || p.insuranceStatus === "Expired" },
    { match: ["expired insurance", "insurance expired"],  fn: (p) => p.insuranceStatus === "Expired" },
    { match: ["no insurance", "uninsured"],               fn: (p) => p.insurer === "None" || !p.insurer },
    { match: ["missing consent", "no consent", "consent missing"],
                                                          fn: (p) => !p.consentSigned },
    { match: ["no visit in 90", "inactive", "90 days", "3 months"],
                                                          fn: (p) => p.lastVisit && Math.floor((new Date() - new Date(p.lastVisit)) / 86400000) >= 90 },
    { match: ["new patient", "new patients"],             fn: (p) => p.status === "New" },
    { match: ["active patient", "active"],                fn: (p) => p.status === "Active" },
    { match: ["under treatment", "treatment"],            fn: (p) => p.status === "Under Treatment" },
    { match: ["observation"],                             fn: (p) => p.status === "Observation" },
    { match: ["inactive"],                                fn: (p) => p.status === "Inactive" },
    { match: ["male"],                                    fn: (p) => p.gender === "Male" },
    { match: ["female"],                                  fn: (p) => p.gender === "Female" },
    { match: ["critical", "critical risk"],               fn: (p) => calcRiskScore(p).level === "Critical" },
    { match: ["high risk score"],                         fn: (p) => calcRiskScore(p).level === "High" },
    { match: ["missing emergency", "no emergency contact"],
                                                          fn: (p) => !p.emergencyName || !p.emergencyPhone },
    { match: ["missing phone", "no phone"],               fn: (p) => !p.phone },
    { match: ["missing dob", "no dob"],                   fn: (p) => !p.dob },
  ];

  for (const phrase of phrases) {
    if (phrase.match.some((m) => q.includes(m))) {
      return patients.filter(phrase.fn);
    }
  }

  // Field fallback
  return patients.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    p.phone?.includes(q) ||
    p.id.toLowerCase().includes(q) ||
    p.doctor?.toLowerCase().includes(q) ||
    (p.policyNumber && p.policyNumber.toLowerCase().includes(q)) ||
    p.email?.toLowerCase().includes(q)
  );
}

// ─── QUALITY ISSUES PANEL ────────────────────────────────────────────────────
function QualityIssuesPanel({ patients, onFilter }) {
  const now = new Date();

  const issues = useMemo(() => {
    const missingPhone     = patients.filter((p) => !p.phone || !p.phoneVerified).length;
    const missingDob       = patients.filter((p) => !p.dob).length;
    const missingGender    = patients.filter((p) => !p.gender).length;
    const expiredInsurance = patients.filter((p) => p.insuranceStatus === "Expired").length;
    const missingEmergency = patients.filter((p) => !p.emergencyName || !p.emergencyPhone).length;
    const missingConsent   = patients.filter((p) => !p.consentSigned).length;
    const duplicatePhones  = (() => {
      const seen = {}; let dupes = 0;
      patients.forEach((p) => {
        if (!p.phone) return;
        const n = p.phone.replace(/\D/g, "").slice(-10);
        if (seen[n]) dupes++;
        seen[n] = true;
      });
      return dupes;
    })();
    const criticalNoNotes = patients.filter((p) =>
      (p.alerts || []).some((a) => ["Allergy","Heart Condition","High Risk","Pregnancy"].includes(a)) &&
      (!p.notes || p.notes.length === 0)
    ).length;

    return [
      { label: "Missing / Unverified Phone",    count: missingPhone,     color: "#ef4444", icon: "ti-phone-off",          query: "missing phone"      },
      { label: "Missing Date of Birth",          count: missingDob,       color: "#f59e0b", icon: "ti-calendar-off",       query: "missing dob"        },
      { label: "Missing Gender",                 count: missingGender,    color: "#f59e0b", icon: "ti-gender-bigender",    query: null                 },
      { label: "Expired Insurance",              count: expiredInsurance, color: "#ef4444", icon: "ti-shield-exclamation", query: "expired insurance"  },
      { label: "Missing Emergency Contact",      count: missingEmergency, color: "#f97316", icon: "ti-phone-call",         query: "missing emergency"  },
      { label: "Consent Not Collected",          count: missingConsent,   color: "#7c4fff", icon: "ti-writing",            query: "missing consent"    },
      { label: "Duplicate Phone Numbers",        count: duplicatePhones,  color: "#ef4444", icon: "ti-copy",               query: null                 },
      { label: "Critical Alerts Without Notes",  count: criticalNoNotes,  color: "#ef4444", icon: "ti-alert-triangle",     query: null                 },
    ].filter((i) => i.count > 0);
  }, [patients]);

  if (issues.length === 0) return null;

  return (
    <div style={{
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      padding: "8px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <i className="ti ti-checklist" style={{ fontSize: 13, color: "#ef4444" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Data Quality Issues
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
          background: "#fee2e2", color: "#991b1b",
        }}>
          {issues.reduce((s, i) => s + i.count, 0)} total
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {issues.map((issue) => (
          <button
            key={issue.label}
            onClick={() => issue.query && onFilter(issue.query)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: issue.color + "15",
              border: `1px solid ${issue.color}40`,
              color: issue.color,
              cursor: issue.query ? "pointer" : "default",
            }}
          >
            <i className={`ti ${issue.icon}`} style={{ fontSize: 11 }} />
            <span style={{ fontWeight: 700 }}>{issue.count}</span> {issue.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── NEXT BEST ACTION CHIP ────────────────────────────────────────────────────
function NBAChip({ patient }) {
  const now = new Date();
  let label, color, icon;

  const hasCritical = (patient.alerts || []).some((a) =>
    ["Allergy","Heart Condition","Pregnancy","High Risk"].includes(a)
  );
  if (hasCritical && !patient.alertsReviewed) {
    label = "Review Alert"; color = "#ef4444"; icon = "ti-alert-triangle";
  } else if (patient.insuranceStatus === "Expired") {
    label = "Verify Insurance"; color = "#ef4444"; icon = "ti-shield-exclamation";
  } else if (patient.status === "Follow-Up Due" || (patient.followUpDate && new Date(patient.followUpDate) < now)) {
    label = "Call Follow-Up"; color = "#f59e0b"; icon = "ti-phone";
  } else if (!patient.consentSigned) {
    label = "Collect Consent"; color = "#f97316"; icon = "ti-writing";
  } else if (patient.insuranceStatus === "Expiring") {
    label = "Verify Insurance"; color = "#f59e0b"; icon = "ti-shield";
  } else if (!patient.emergencyName) {
    label = "Add Emergency"; color = "#7c4fff"; icon = "ti-phone-call";
  } else {
    return null;
  }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600,
      background: color + "15", color, border: `1px solid ${color}30`,
      whiteSpace: "nowrap",
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 10 }} />
      {label}
    </span>
  );
}

// ─── SEARCH SUGGESTIONS ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  "diabetic patients",
  "insurance expiring this month",
  "follow-up overdue",
  "VIP patients",
  "missing consent",
  "no visit in 90 days",
  "critical risk",
  "expired insurance",
  "missing emergency contact",
  "new patients",
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PatientList({ patients, onSelect, selectedId, onNewPatient }) {
  const [search,          setSearch]          = useState("");
  const [filterStatus,    setFilterStatus]    = useState("All");
  const [filterDoctor,    setFilterDoctor]    = useState("All");
  const [filterInsurance, setFilterInsurance] = useState("All");
  const [sortKey,         setSortKey]         = useState("lastVisit");
  const [sortDir,         setSortDir]         = useState("desc");
  const [page,            setPage]            = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir("asc");
      return key;
    });
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    let list = applySmartSearch(patients, search);
    if (filterStatus    !== "All") list = list.filter((p) => p.status          === filterStatus);
    if (filterDoctor    !== "All") list = list.filter((p) => p.doctor          === filterDoctor);
    if (filterInsurance !== "All") list = list.filter((p) => p.insuranceStatus === filterInsurance);
    return sortPatients(list, sortKey, sortDir);
  }, [patients, search, filterStatus, filterDoctor, filterInsurance, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <i className="ti ti-selector" style={{ fontSize: 11, opacity: 0.3 }} />;
    return <i className={`ti ti-sort-${sortDir === "asc" ? "ascending" : "descending"}`} style={{ fontSize: 11, color: "var(--accent)" }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Quality Issues ── */}
      <QualityIssuesPanel
        patients={patients}
        onFilter={(q) => { setSearch(q); resetPage(); }}
      />

      {/* ── Toolbar ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <i className="ti ti-search" style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "var(--muted)", pointerEvents: "none",
          }} />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder='Search or try "diabetic patients"…'
            style={{ width: "100%", paddingLeft: 32, paddingRight: search ? 28 : 12, fontSize: 13 }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); resetPage(); }}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2,
              }}
            >
              <i className="ti ti-x" style={{ fontSize: 12 }} />
            </button>
          )}
          {/* Smart search suggestions */}
          {showSuggestions && !search && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              overflow: "hidden",
            }}>
              <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Smart Search
              </div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onMouseDown={() => { setSearch(s); resetPage(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 13, color: "var(--text)", textAlign: "left",
                  }}
                  className="hover-row"
                >
                  <i className="ti ti-sparkles" style={{ fontSize: 12, color: "var(--accent)" }} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); resetPage(); }}
          style={{ fontSize: 12, padding: "6px 10px", minWidth: 130 }}>
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select value={filterDoctor} onChange={(e) => { setFilterDoctor(e.target.value); resetPage(); }}
          style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}>
          <option value="All">All Doctors</option>
          {["Dr. Sharma","Dr. Patel","Dr. Mehta","Dr. Iyer","Dr. Nair"].map((d) => <option key={d}>{d}</option>)}
        </select>

        <select value={filterInsurance} onChange={(e) => { setFilterInsurance(e.target.value); resetPage(); }}
          style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}>
          <option value="All">All Insurance</option>
          {["Active","Expiring","Expired","None"].map((s) => <option key={s}>{s}</option>)}
        </select>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
            {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
          </span>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={onNewPatient}>
            <i className="ti ti-user-plus" style={{ fontSize: 14 }} />
            New Patient
          </button>
        </div>
      </div>

      {/* ── Active search label ── */}
      {search && (
        <div style={{
          padding: "6px 16px", background: "var(--accent-soft)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="ti ti-sparkles" style={{ fontSize: 12, color: "var(--accent)" }} />
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
            Smart search: "{search}" — {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => { setSearch(""); resetPage(); }}
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Table (Desktop) ── */}
      <div className="desktop-only" style={{ flex: 1, overflow: "auto" }}>
        {(() => {
          const COLS = [
            { key: "id",              label: "ID",             w: 100 },
            { key: "name",            label: "Patient",        w: 180 },
            { key: "lastVisit",       label: "Last Visit",     w: 120 },
            { key: "doctor",          label: "Primary Doctor", w: 140 },
            { key: "_risk",           label: "Risk Level",     w: 110 },
            { key: "_followUp",       label: "Follow-Up",      w: 160 },
            { key: "insuranceStatus", label: "Insurance",      w: 110 },
            { key: "status",          label: "Status",         w: 130 },
            { key: "_nba",            label: "Next Action",    w: 140 },
          ];
          return (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            {COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => !col.key.startsWith("_") && handleSort(col.key)}
                  style={{
                    padding: "9px 12px", textAlign: "left",
                    cursor: col.key.startsWith("_") ? "default" : "pointer",
                    fontSize: 11, fontWeight: 600, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    borderBottom: "1px solid var(--border)",
                    userSelect: "none", whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {col.label}
                    {!col.key.startsWith("_") && <SortIcon col={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={LIST_COLUMNS.length + 1} style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <i className="ti ti-users-group" style={{ fontSize: 32, opacity: 0.3 }} />
                    <span>No patients match your filters</span>
                    {search && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }}
                        onClick={() => { setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterInsurance("All"); resetPage(); }}>
                        Clear all filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : paginated.map((patient) => (
              <PatientRow
                key={patient.id}
                patient={patient}
                isSelected={patient.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
          );
        })()}
      </div>

      {/* ── Mobile Cards ── */}
      <div className="mobile-only" style={{ flex: 1, overflow: "auto", padding: "12px" }}>
        {paginated.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <i className="ti ti-users-group" style={{ fontSize: 32, opacity: 0.3 }} />
              <span>No patients match your filters</span>
              {search && (
                <button className="btn btn-ghost" style={{ fontSize: 12 }}
                  onClick={() => { setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterInsurance("All"); resetPage(); }}>
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        ) : paginated.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            isSelected={patient.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Page {page} of {totalPages} · {filtered.length} patients
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="btn btn-ghost"
              style={{ padding: "5px 10px", fontSize: 12 }}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <i className="ti ti-chevron-left" style={{ fontSize: 13 }} /> Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 30, height: 30, borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border: p === page ? "none" : "1px solid var(--border)",
                    background: p === page ? "var(--accent)" : "transparent",
                    color: p === page ? "#fff" : "var(--muted)",
                    fontWeight: p === page ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="btn btn-ghost"
              style={{ padding: "5px 10px", fontSize: 12 }}
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROW ─────────────────────────────────────────────────────────────────────
const RISK_COLORS = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444", Critical: "#7f1d1d" };
const RISK_BG     = { Low: "#dcfce7", Medium: "#fef3c7", High: "#fee2e2", Critical: "#fca5a5" };

const FOLLOW_UP_COLOR = {
  Overdue:   { color: "#ef4444", bg: "#fee2e2" },
  "Due Soon":{ color: "#f59e0b", bg: "#fef3c7" },
  Scheduled: { color: "#4f7cff", bg: "#eff6ff" },
  None:      { color: "#94a3b8", bg: "#f1f5f9" },
};

function followUpStatus(patient) {
  const now = new Date();
  if (patient.status === "Follow-Up Due") return "Overdue";
  if (patient.followUpDate) {
    const d = Math.floor((new Date(patient.followUpDate) - now) / 86400000);
    if (d < 0)  return "Overdue";
    if (d <= 7) return "Due Soon";
    return "Scheduled";
  }
  return "None";
}

// ─── MOBILE CARD VIEW ───────────────────────────────────────────────────────────
function PatientCard({ patient, isSelected, onSelect }) {
  const { level: riskLevel } = calcRiskScore(patient);
  const fuStatus = followUpStatus(patient);
  const fuStyle  = FOLLOW_UP_COLOR[fuStatus];

  return (
    <div
      className={`mobile-only${isSelected ? " selected-row" : ""}`}
      onClick={() => onSelect(patient)}
      style={{
        padding: 14, borderRadius: 12,
        background: "var(--surface)", border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
        marginBottom: 10, cursor: "pointer",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <PatientAvatar name={patient.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {patient.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {patient.id} · {patient.age}y · {patient.gender || "—"}
          </div>
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: RISK_COLORS[riskLevel] || "#94a3b8",
        }} title={`${riskLevel} Risk`} />
      </div>

      {/* Info Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>Doctor</div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{patient.doctor || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>Last Visit</div>
          <LastVisitCell lastVisit={patient.lastVisit} />
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <StatusBadge status={patient.status} />
        <InsuranceBadge status={patient.insuranceStatus} />
        {fuStatus !== "None" && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            background: fuStyle.bg, color: fuStyle.color,
          }}>
            <i className="ti ti-clock" style={{ fontSize: 9 }} />
            {fuStatus}
          </span>
        )}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: RISK_BG[riskLevel] || "#f1f5f9",
          color: RISK_COLORS[riskLevel] || "#64748b",
        }}>
          {riskLevel}
        </span>
      </div>
    </div>
  );
}

function PatientRow({ patient, isSelected, onSelect }) {
  const { level: riskLevel } = calcRiskScore(patient);
  const fuStatus = followUpStatus(patient);
  const fuStyle  = FOLLOW_UP_COLOR[fuStatus];

  return (
    <tr
      className={`desktop-only hover-row${isSelected ? " selected-row" : ""}`}
      onClick={() => onSelect(patient)}
      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
    >
      {/* ID + Risk dot */}
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: RISK_COLORS[riskLevel] || "#94a3b8",
          }} title={`${riskLevel} Risk`} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--accent)" }}>
            {patient.id}
          </span>
        </div>
      </td>

      {/* Name + avatar */}
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PatientAvatar name={patient.name} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {patient.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
              {patient.age}y · {patient.gender || "—"}
            </div>
          </div>
        </div>
      </td>

      {/* Last Visit */}
      <td style={{ padding: "10px 12px" }}>
        <LastVisitCell lastVisit={patient.lastVisit} />
      </td>

      {/* Primary Doctor */}
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-stethoscope" style={{ fontSize: 12, color: "#7c4fff", flexShrink: 0 }} />
          <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {patient.doctor || "—"}
          </span>
        </div>
      </td>

      {/* Risk Level */}
      <td style={{ padding: "10px 12px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: RISK_BG[riskLevel] || "#f1f5f9",
          color: RISK_COLORS[riskLevel] || "#64748b",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: RISK_COLORS[riskLevel] || "#94a3b8" }} />
          {riskLevel}
        </span>
      </td>

      {/* Follow-Up Status */}
      <td style={{ padding: "10px 12px" }}>
        {fuStatus === "None" ? (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
        ) : (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: fuStyle.bg, color: fuStyle.color,
          }}>
            <i className="ti ti-clock" style={{ fontSize: 10 }} />
            {fuStatus}
            {patient.followUpDate && (
              <span style={{ opacity: 0.7, fontWeight: 400 }}>
                · {fmtDate(patient.followUpDate)}
              </span>
            )}
          </span>
        )}
      </td>

      {/* Insurance Status */}
      <td style={{ padding: "10px 12px" }}>
        <InsuranceBadge status={patient.insuranceStatus} />
      </td>

      {/* Patient Status */}
      <td style={{ padding: "10px 12px" }}>
        <StatusBadge status={patient.status} />
      </td>

      {/* Next Best Action */}
      <td style={{ padding: "10px 12px" }}>
        <NBAChip patient={patient} />
      </td>
    </tr>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#4f7cff","#7c4fff","#00b4a0","#f97316","#ec4899","#22c55e"];

function PatientAvatar({ name }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("");
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: color + "22", color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function LastVisitCell({ lastVisit }) {
  if (!lastVisit) return <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>;
  const days = Math.floor((new Date() - new Date(lastVisit)) / 86400000);
  const color = days > 90 ? "#ef4444" : days > 30 ? "#f59e0b" : "var(--muted)";
  return (
    <div>
      <div style={{ fontSize: 12 }}>{fmtDate(lastVisit)}</div>
      <div style={{ fontSize: 10, color, marginTop: 1 }}>{days}d ago</div>
    </div>
  );
}

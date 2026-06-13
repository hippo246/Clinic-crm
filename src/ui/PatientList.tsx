import React, { useState, useMemo, useCallback } from "react";
import type { Patient, UserRole } from "./types";
import { DOCTORS, STATUSES, PAGE_SIZE } from "./constants";
import { applySmartSearch, sortPatients, fmtDate, calcRiskScore, detectDuplicates } from "./utils";
import { StatusBadge, InsuranceBadge, AlertChip, AvatarCircle, RiskBadge } from "./Badges";

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
}

function QualityBar({ patients, onSearch }: { patients: Patient[]; onSearch: (q: string) => void }) {
  const issues = useMemo(() => {
    const items = [
      { label: "Expired Insurance",    count: patients.filter((p) => p.insuranceStatus === "Expired").length,     color: "#dc2626", query: "expired insurance" },
      { label: "Missing Consent",      count: patients.filter((p) => !p.consentSigned).length,                    color: "#d97706", query: "missing consent" },
      { label: "Follow-Up Overdue",    count: patients.filter((p) => p.status === "Follow-Up Due").length,        color: "#d97706", query: "follow-up overdue" },
      { label: "Critical Alerts",      count: patients.filter((p) => (p.alerts||[]).some((a) => ["Allergy","Heart Condition","Pregnancy","High Risk"].includes(a))).length, color: "#dc2626", query: "critical" },
      { label: "No Emergency Contact", count: patients.filter((p) => !p.emergencyName || !p.emergencyPhone).length, color: "#7c3aed", query: "missing emergency" },
    ];
    return items.filter((i) => i.count > 0);
  }, [patients]);

  if (issues.length === 0) return null;

  return (
    <div style={{
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
          cursor: "pointer",
        }}>
          <span style={{ fontWeight: 800 }}>{issue.count}</span>
          {issue.label}
        </button>
      ))}
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
}: PatientListProps) {
  const [search,          setSearch]         = useState("");
  const [filterStatus,    setFilterStatus]   = useState("All");
  const [filterDoctor,    setFilterDoctor]   = useState("All");
  const [filterInsurance, setFilterIns]      = useState("All");
  const [filterRisk,      setFilterRisk]     = useState("All");
  const [sortKey,         setSortKey]        = useState<keyof Patient>("lastVisit");
  const [sortDir,         setSortDir]        = useState<"asc"|"desc">("desc");
  const [page,            setPage]           = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = useMemo(() => {
    let list = applySmartSearch(patients, search);
    if (filterStatus    !== "All") list = list.filter((p) => p.status          === filterStatus);
    if (filterDoctor    !== "All") list = list.filter((p) => p.doctor          === filterDoctor);
    if (filterInsurance !== "All") list = list.filter((p) => p.insuranceStatus === filterInsurance);
    if (filterRisk      !== "All") list = list.filter((p) => calcRiskScore(p).level === filterRisk);
    return sortPatients(list, sortKey, sortDir);
  }, [patients, search, filterStatus, filterDoctor, filterInsurance, filterRisk, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(key: keyof Patient) {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir("asc");
      return key;
    });
    setPage(1);
  }

  function resetPage() { setPage(1); }

  const dupeCount = useMemo(() => detectDuplicates(patients).length, [patients]);

  const SortIcon = ({ col }: { col: keyof Patient }) => {
    if (sortKey !== col) return <i className="ti ti-selector" style={{ fontSize: 11, opacity: 0.3 }} />;
    return <i className={`ti ti-sort-${sortDir === "asc" ? "ascending" : "descending"}`} style={{ fontSize: 11, color: "var(--accent)" }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Quality bar */}
      <QualityBar patients={patients} onSearch={(q) => { setSearch(q); resetPage(); }} />

      {/* Toolbar */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", flexShrink: 0, display: "flex",
        alignItems: "center", gap: 10, flexWrap: "wrap",
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
          {showSuggestions && !search && (
            <div style={{
              position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 200,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden",
            }}>
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

        {/* Filters */}
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

        {(filterStatus !== "All" || filterDoctor !== "All" || filterInsurance !== "All" || filterRisk !== "All" || search) && (
          <button className="btn-icon" onClick={() => {
            setSearch(""); setFilterStatus("All"); setFilterDoctor("All"); setFilterIns("All"); setFilterRisk("All"); resetPage();
          }} title="Clear all filters">
            <i className="ti ti-filter-off" style={{ fontSize: 14 }} />
          </button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", whiteSpace: "nowrap" }}>
            {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
          </span>
          {dupeCount > 0 && (
            <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
              <i className="ti ti-copy" style={{ fontSize: 10 }} />
              {dupeCount} dupes
            </span>
          )}
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={onImport}>
            <i className="ti ti-file-import" style={{ fontSize: 14 }} />
            <span className="desktop-only">Import</span>
          </button>
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={onNewPatient}>
            <i className="ti ti-user-plus" style={{ fontSize: 14 }} />
            <span className="desktop-only">New Patient</span>
          </button>
        </div>
      </div>

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

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 44, paddingLeft: 16 }}></th>
              {([
                { key: "id",              label: "ID",         w: 100 },
                { key: "name",            label: "Patient",    w: 180 },
                { key: "age",             label: "Age",        w: 60  },
                { key: "doctor",          label: "Doctor",     w: 130 },
                { key: "status",          label: "Status",     w: 130 },
                { key: "insuranceStatus", label: "Insurance",  w: 100 },
                { key: "lastVisit",       label: "Last Visit", w: 100 },
              ] as { key: keyof Patient; label: string; w: number }[]).map(({ key, label, w }) => (
                <th key={key} style={{ width: w, cursor: "pointer" }} onClick={() => handleSort(key)}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
              <th>Alerts</th>
              <th style={{ width: 90 }}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 0 }}>
                  <div className="empty-state">
                    <i className="ti ti-users empty-state-icon" />
                    <div className="empty-state-text">No patients found</div>
                    <div className="empty-state-sub">Try adjusting your search or filters</div>
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          padding: "10px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            Page {page} of {totalPages} · {filtered.length} records
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "var(--font-sm)" }}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p_num = i + 1;
              if (totalPages > 7) {
                if (page <= 4) p_num = i + 1;
                else if (page >= totalPages - 3) p_num = totalPages - 6 + i;
                else p_num = page - 3 + i;
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
    </div>
  );
}

function PatientRow({
  patient: p,
  selected,
  onSelect,
}: {
  patient: Patient;
  selected: boolean;
  onSelect: (p: Patient) => void;
}) {
  return (
    <tr
      className={`tbl-row${selected ? " selected" : ""}`}
      onClick={() => onSelect(p)}
    >
      <td style={{ paddingLeft: 16 }}>
        <AvatarCircle name={p.name} size="sm" />
      </td>
      <td>
        <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", display: "block" }}>{p.id}</span>
      </td>
      <td>
        <div>
          <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>
            {p.gender} · {p.bloodGroup}
          </div>
        </div>
      </td>
      <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
        {p.age}y
      </td>
      <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
      <td><StatusBadge status={p.status} /></td>
      <td><InsuranceBadge status={p.insuranceStatus} /></td>
      <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
        {fmtDate(p.lastVisit)}
      </td>
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
    </tr>
  );
}

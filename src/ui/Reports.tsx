import React, { useState, useMemo } from "react";
import type { Patient } from "./types";
import { fmtDate, getPatientStats } from "./utils";

// ─── Date range helpers ────────────────────────────────────────────────────────
const MS_PER_DAY = 86400000;
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", INR: "₹", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$" };
function getRangeStart(range: string, customFrom: string): Date | null {
  const now = new Date();
  if (range === "today") { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (range === "month") { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d; }
  if (range === "custom" && customFrom) { const d = new Date(`${customFrom}T00:00:00`); return d; }
  return null;
}
function getRangeEnd(range: string, customTo: string): Date | null {
  if (range === "custom" && customTo) { const d = new Date(`${customTo}T00:00:00`); d.setHours(23,59,59,999); return d; }
  if (range === "custom") return null;
  const d = new Date(); d.setHours(23,59,59,999); return d;
}
function inRange(dateStr: string | undefined, start: Date | null, end: Date | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") console.warn("inRange: unparseable date", dateStr);
    return false;
  }
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}
function readLocalStorageJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") console.warn(`readLocalStorageJSON: corrupt value for "${key}"`);
    return fallback;
  }
}

export default function ReportsPage({ patients }: { patients: Patient[] }) {
  const [activeTab, setActiveTab] = useState<"patients" | "appointments" | "revenue" | "performance" | "followups">("patients");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [callModalPatient, setCallModalPatient] = useState<Patient | null>(null);
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());
  const [exportMsg, setExportMsg] = useState<string>("");
  const [exportStatus, setExportStatus] = useState<"success" | "empty">("success");

  const rangeStart = useMemo(() => getRangeStart(dateRange, customFrom), [dateRange, customFrom]);
  const rangeEnd = useMemo(() => getRangeEnd(dateRange, customTo), [dateRange, customTo]);

  const invoices: any[] = useMemo(() => readLocalStorageJSON("clinic_crm_invoices", [] as any[]), []);

  const prescriptions: any[] = useMemo(() => readLocalStorageJSON("clinic_crm_prescriptions", [] as any[]), []);

  const settings = useMemo(() => readLocalStorageJSON<Record<string, any>>("clinic_crm_settings", {}), []);
  const currencySymbol = CURRENCY_SYMBOLS[settings.currency as string] ?? "$";
  const fmt = (n: number) => `${currencySymbol}${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

  // ─── Filtered data by date range ──────────────────────────────────────────
  const filteredPatients = useMemo(() =>
    patients.filter(p => inRange(p.createdAt, rangeStart, rangeEnd)),
    [patients, rangeStart, rangeEnd]
  );

  const filteredInvoices = useMemo(() =>
    invoices.filter((inv: any) => inRange(inv.createdAt, rangeStart, rangeEnd)),
    [invoices, rangeStart, rangeEnd]
  );

  const filteredAppointments = useMemo(() =>
    patients
      .filter(p => p.nextAppointment && inRange(p.nextAppointment, rangeStart, rangeEnd))
      .sort((a, b) => new Date(a.nextAppointment!).getTime() - new Date(b.nextAppointment!).getTime()),
    [patients, rangeStart, rangeEnd]
  );

  const stats = useMemo(() => getPatientStats(filteredPatients), [filteredPatients]);
  const allStats = useMemo(() => getPatientStats(patients), [patients]);

  // ─── Revenue calculations ────────────────────────────────────────────────
  const totalRevenue = useMemo(() => filteredInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0), [filteredInvoices]);
  const paidRevenue = useMemo(() => filteredInvoices.filter((inv: any) => inv.status === "paid").reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0), [filteredInvoices]);
  const pendingRevenue = useMemo(() => filteredInvoices.filter((inv: any) => inv.status === "pending").reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0), [filteredInvoices]);

  // ─── Doctor performance derived from real data ───────────────────────────
  const activeDoctorsInPeriod = useMemo(() => new Set(filteredPatients.map(p => p.doctor).filter(Boolean)), [filteredPatients]);
  const doctorPerformance = useMemo(() => {
    const map: Record<string, { name: string; patientsSeen: number; prescriptions: number }> = {};
    patients.forEach(p => {
      if (!p.doctor) return;
      if (!map[p.doctor]) map[p.doctor] = { name: p.doctor, patientsSeen: 0, prescriptions: 0 };
      map[p.doctor].patientsSeen++;
    });
    prescriptions.forEach((rx: any) => {
      // prescriptions may be tagged with either field depending on which form created them
      const doc = rx.doctor || rx.prescribedBy;
      if (doc && map[doc]) map[doc].prescriptions++;
    });
    return Object.values(map).sort((a, b) => b.patientsSeen - a.patientsSeen);
  }, [patients, prescriptions]);

  // ─── Follow-up metrics ────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const followUpPatients = useMemo(() => patients.filter(p =>
    p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < now)
  ), [patients, now]);
  const followUpMetrics = useMemo(() => {
    let pending = 0, overdue = 0;
    for (const p of followUpPatients) {
      const isOverdue = !p.followUpDate || new Date(p.followUpDate) < now;
      if (isOverdue) overdue++; else pending++;
    }
    return {
      total: followUpPatients.length,
      completed: patients.filter(p => p.status === "Completed").length,
      pending,
      overdue,
    };
  }, [followUpPatients, patients, now]);

  // ─── Today's appointments ─────────────────────────────────────────────────
  const todayISO = now.toISOString().slice(0, 10);
  const todayAppts = patients.filter(p => {
    if (!p.nextAppointment) return false;
    const d = new Date(p.nextAppointment);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === todayISO;
  });

  // ─── Export ────────────────────────────────────────────────────────────────
  const exportTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const escapeCsvCell = (val: any) => {
    const s = val === null || val === undefined ? "" : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const handleExport = () => {
    const tabData: Record<string, any[]> = {
      patients: filteredPatients.map(p => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, doctor: p.doctor, status: p.status, createdAt: p.createdAt })),
      appointments: filteredAppointments.map(p => ({ patient: p.name, doctor: p.doctor, appointment: p.nextAppointment, status: p.status })),
      revenue: filteredInvoices,
      performance: doctorPerformance,
      followups: followUpPatients.map(p => ({ patient: p.name, doctor: p.doctor, followUpDate: p.followUpDate, reason: p.followUpReason })),
    };
    const rows = tabData[activeTab];
    if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    if (!rows || rows.length === 0) {
      setExportMsg("No data to export for this view.");
      setExportStatus("empty");
      exportTimeoutRef.current = setTimeout(() => setExportMsg(""), 3000);
      return;
    }
    // union of keys across all rows, since some rows (e.g. invoices) may be sparse
    const headers: string[] = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set<string>()));
    const csv = [headers.join(","), ...rows.map((r: any) => headers.map(h => escapeCsvCell(r[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clinic-report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMsg(`Exported ${rows.length} rows.`);
    setExportStatus("success");
    exportTimeoutRef.current = setTimeout(() => setExportMsg(""), 3000);
  };

  React.useEffect(() => () => { if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current); }, []);

  const safeWidth = (val: number, total: number) => total > 0 && Number.isFinite(val) ? `${Math.max(0, Math.min(100, (val / total) * 100))}%` : "0%";

  return (
    <div style={{ padding: "20px 24px 32px", width: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0 }}>Reports & Analytics</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as "today" | "week" | "month" | "custom")}
              style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", background: "var(--surface)", color: "var(--fg)", cursor: "pointer" }}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateRange === "custom" && (
              <>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", background: "var(--surface)", color: "var(--fg)" }} />
                <span style={{ alignSelf: "center", fontSize: "var(--font-sm)", color: "var(--muted)" }}>to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", background: "var(--surface)", color: "var(--fg)" }} />
              </>
            )}
            {exportMsg && (
              <span style={{ fontSize: "var(--font-xs)", color: exportStatus === "empty" ? "var(--amber)" : "var(--green)", fontWeight: 500 }}>
                {exportMsg}
              </span>
            )}
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={handleExport}>
              <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
              Export CSV
            </button>
          </div>
        </div>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Comprehensive clinic performance metrics and analytics
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 20, position: "sticky", top: 0, zIndex: 5, background: "var(--surface)", paddingTop: 2 }}>
        <div className="reports-tabbar" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <style>{`.reports-tabbar::-webkit-scrollbar { display: none; }`}</style>
          <TabButton active={activeTab === "patients"} onClick={() => setActiveTab("patients")} icon="ti-users">Patients</TabButton>
          <TabButton active={activeTab === "appointments"} onClick={() => setActiveTab("appointments")} icon="ti-calendar">Appointments</TabButton>
          <TabButton active={activeTab === "revenue"} onClick={() => setActiveTab("revenue")} icon="ti-receipt">Revenue</TabButton>
          <TabButton active={activeTab === "performance"} onClick={() => setActiveTab("performance")} icon="ti-stethoscope">Performance</TabButton>
          <TabButton active={activeTab === "followups"} onClick={() => setActiveTab("followups")} icon="ti-phone">Follow-ups</TabButton>
        </div>
      </div>

      {/* ── PATIENTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "patients" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Patients" value={stats.total} color="var(--accent)" icon="ti-users" bg="var(--accent-soft)" />
            <StatCard label="Active" value={stats.active} color="var(--green)" icon="ti-activity" bg="var(--green-bg)" />
            <StatCard label="New (period)" value={filteredPatients.length} color="var(--blue)" icon="ti-user-plus" bg="var(--blue-bg)" />
            <StatCard label="Inactive" value={stats.inactive} color="var(--muted)" icon="ti-user-off" bg="var(--surface3)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div className="card card-padded">
              <div className="section-label" style={{ marginBottom: 12 }}>Status Distribution</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Active", value: allStats.active, color: "var(--green)" },
                  { label: "Follow-Up Due", value: allStats.followUpDue, color: "var(--amber)" },
                  { label: "Inactive", value: allStats.inactive, color: "var(--muted)" },
                  { label: "Critical", value: allStats.criticalAlerts, color: "var(--red)" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 110, fontSize: "var(--font-sm)", color: "var(--muted)", flexShrink: 0 }}>{item.label}</div>
                    <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: item.color, borderRadius: 4, width: safeWidth(item.value, allStats.total), transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ width: 32, fontSize: "var(--font-sm)", fontWeight: 600, textAlign: "right", flexShrink: 0 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-padded">
              <div className="section-label" style={{ marginBottom: 12 }}>Demographics</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Male", value: patients.filter(p => p.gender === "Male").length },
                  { label: "Female", value: patients.filter(p => p.gender === "Female").length },
                  { label: "Other", value: patients.filter(p => p.gender !== "Male" && p.gender !== "Female").length },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 60, fontSize: "var(--font-sm)", color: "var(--muted)" }}>{row.label}</div>
                    <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "var(--accent)", borderRadius: 3, width: safeWidth(row.value, patients.length), transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ width: 32, fontSize: "var(--font-sm)", fontWeight: 600, textAlign: "right" }}>{row.value}</div>
                  </div>
                ))}
                <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Average Age</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                    {patients.length > 0 ? Math.round(patients.reduce((sum, p) => sum + (Number(p.age) || 0), 0) / patients.length) : 0} yrs
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Total Patients</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{patients.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>
              Recent Registrations
              <span style={{ marginLeft: 8, fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 400 }}>({filteredPatients.length} in period)</span>
            </div>
            {filteredPatients.length === 0 ? (
              <EmptyState icon="ti-users" msg="No patients registered in this period." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Doctor</th>
                    <th>Registered</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.slice(0, 15).map(p => (
                    <tr key={p.id} className="tbl-row">
                      <td>
                        <PatientCell name={p.name} id={p.id} />
                      </td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{p.age}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{p.gender}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{p.doctor}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(p.createdAt)}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── APPOINTMENTS TAB ──────────────────────────────────────────────────── */}
      {activeTab === "appointments" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="In Period" value={filteredAppointments.length} color="var(--blue)" icon="ti-calendar" bg="var(--blue-bg)" />
            <StatCard label="Today" value={todayAppts.length} color="var(--green)" icon="ti-calendar-check" bg="var(--green-bg)" />
            <StatCard label="Completed" value={patients.filter(p => p.status === "Completed").length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
            <StatCard label="No Shows" value={patients.filter(p => p.status === "No Show").length} color="var(--red)" icon="ti-circle-x" bg="var(--red-bg)" />
          </div>

          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>
              Appointments
              <span style={{ marginLeft: 8, fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 400 }}>({filteredAppointments.length} in period)</span>
            </div>
            {filteredAppointments.length === 0 ? (
              <EmptyState icon="ti-calendar" msg="No appointments found in this period." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.slice(0, 20).map(p => {
                    const apptDate = new Date(p.nextAppointment!);
                    return (
                    <tr key={p.id} className="tbl-row">
                      <td style={{ fontSize: "var(--font-sm)", whiteSpace: "nowrap" }}>
                        {apptDate.toLocaleDateString()} · {apptDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>
                        <PatientCell name={p.name} id={p.id} />
                      </td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{p.doctor}</td>
                      <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Consultation</td>
                      <td>
                        <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" }}>Scheduled</span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── REVENUE TAB ───────────────────────────────────────────────────────── */}
      {activeTab === "revenue" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Revenue" value={fmt(totalRevenue)} color="var(--green)" icon="ti-currency-dollar" bg="var(--green-bg)" />
            <StatCard label="Paid" value={fmt(paidRevenue)} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
            <StatCard label="Pending" value={fmt(pendingRevenue)} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
            <StatCard label="Collection Rate" value={`${totalRevenue > 0 ? ((paidRevenue / totalRevenue) * 100).toFixed(1) : "0.0"}%`} color="var(--blue)" icon="ti-percentage" bg="var(--blue-bg)" />
          </div>

          {filteredInvoices.length === 0 ? (
            <EmptyState icon="ti-receipt" msg="No invoices found in this period." />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
                <div className="card card-padded">
                  <div className="section-label" style={{ marginBottom: 4 }}>Revenue Breakdown</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 12 }}>Estimated split (not itemized per invoice)</div>
                  {[
                    { label: "Consultations", pct: 0.6 },
                    { label: "Lab Tests", pct: 0.25 },
                    { label: "Procedures", pct: 0.15 },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{row.label}</span>
                      <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmt(totalRevenue * row.pct)}</span>
                    </div>
                  ))}
                </div>

                <div className="card card-padded">
                  <div className="section-label" style={{ marginBottom: 4 }}>Payment Methods</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 12 }}>Estimated split (not tracked per invoice)</div>
                  {[
                    { label: "Cash", pct: 0.3 },
                    { label: "Card", pct: 0.5 },
                    { label: "UPI / Transfer", pct: 0.2 },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{row.label}</span>
                      <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmt(paidRevenue * row.pct)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card card-padded">
                <div className="section-label" style={{ marginBottom: 12 }}>
                  Invoices
                  <span style={{ marginLeft: 8, fontSize: "var(--font-xs)", color: "var(--muted)", fontWeight: 400 }}>({filteredInvoices.length} in period)</span>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Patient</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.slice(0, 20).map((inv: any) => {
                      const invStatus = inv.status || "unknown";
                      const isPaid = invStatus === "paid";
                      return (
                      <tr key={inv.id} className="tbl-row">
                        <td style={{ fontSize: "var(--font-sm)", fontWeight: 600, fontFamily: "monospace" }}>{inv.id}</td>
                        <td style={{ fontSize: "var(--font-sm)" }}>{inv.patientName || "—"}</td>
                        <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmt(Number(inv.amount) || 0)}</td>
                        <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(inv.createdAt)}</td>
                        <td>
                          <span className="badge" style={{
                            background: isPaid ? "var(--green-bg)" : "var(--amber-bg)",
                            color: isPaid ? "var(--green)" : "var(--amber)",
                            border: isPaid ? "1px solid var(--green-border)" : "1px solid var(--amber-border)"
                          }}>
                            {invStatus.charAt(0).toUpperCase() + invStatus.slice(1)}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PERFORMANCE TAB ───────────────────────────────────────────────────── */}
      {activeTab === "performance" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Doctors" value={doctorPerformance.length} color="var(--blue)" icon="ti-stethoscope" bg="var(--blue-bg)" />
            <StatCard label="Total Patients" value={patients.length} color="var(--accent)" icon="ti-users" bg="var(--accent-soft)" />
            <StatCard label="Prescriptions" value={prescriptions.length} color="var(--purple, #805ad5)" icon="ti-pill" bg="var(--purple-bg, #f3ebff)" />
            <StatCard label="Avg Patients/Dr" value={doctorPerformance.length > 0 ? Math.round(patients.length / doctorPerformance.length) : 0} color="var(--green)" icon="ti-chart-bar" bg="var(--green-bg)" />
          </div>

          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>Doctor Performance</div>
            {doctorPerformance.length === 0 ? (
              <EmptyState icon="ti-stethoscope" msg="No doctor data available yet." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Patients</th>
                    <th>Prescriptions</th>
                    <th>Share</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorPerformance.map((doc, idx) => {
                    const sharePct = patients.length > 0 ? (doc.patientsSeen / patients.length) * 100 : 0;
                    return (
                    <tr key={`${doc.name}-${idx}`} className="tbl-row">
                      <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{doc.name}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{doc.patientsSeen}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{doc.prescriptions}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                            <div style={{ height: "100%", background: "var(--accent)", borderRadius: 3, width: `${Math.max(0, Math.min(100, sharePct))}%` }} />
                          </div>
                          <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", width: 36 }}>
                            {sharePct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        {activeDoctorsInPeriod.has(doc.name) ? (
                          <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }}>Active</span>
                        ) : (
                          <span className="badge" style={{ background: "var(--surface3)", color: "var(--muted)", border: "1px solid var(--border)" }}>No activity</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── FOLLOW-UPS TAB ────────────────────────────────────────────────────── */}
      {activeTab === "followups" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Due" value={followUpMetrics.total} color="var(--blue)" icon="ti-phone" bg="var(--blue-bg)" />
            <StatCard label="Completed" value={followUpMetrics.completed} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
            <StatCard label="Pending" value={followUpMetrics.pending} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
            <StatCard label="Overdue" value={followUpMetrics.overdue} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div className="card card-padded">
              <div className="section-label" style={{ marginBottom: 12 }}>Status Breakdown</div>
              {[
                { label: "Completed", value: followUpMetrics.completed, color: "var(--green)" },
                { label: "Pending", value: followUpMetrics.pending, color: "var(--amber)" },
                { label: "Overdue", value: followUpMetrics.overdue, color: "var(--red)" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 80, fontSize: "var(--font-sm)", color: "var(--muted)", flexShrink: 0 }}>{item.label}</div>
                  <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: item.color, borderRadius: 4, width: safeWidth(item.value, followUpMetrics.total + followUpMetrics.completed), transition: "width 0.4s ease" }} />
                  </div>
                  <div style={{ width: 28, fontSize: "var(--font-sm)", fontWeight: 600, textAlign: "right", flexShrink: 0 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="card card-padded">
              <div className="section-label" style={{ marginBottom: 12 }}>Completion Rate</div>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                {(() => {
                  const total = followUpMetrics.total + followUpMetrics.completed;
                  const rate = total > 0 ? (followUpMetrics.completed / total) * 100 : 0;
                  return (
                    <>
                      <div style={{ fontSize: "var(--font-3xl)", fontWeight: 800, color: rate >= 70 ? "var(--green)" : rate >= 40 ? "var(--amber)" : "var(--red)" }}>
                        {rate.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginTop: 4 }}>
                        {followUpMetrics.completed} of {total} completed
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>Pending Follow-ups</div>
            {followUpPatients.length === 0 ? (
              <EmptyState icon="ti-circle-check" msg="All follow-ups are up to date." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Reason</th>
                    <th>Due Date</th>
                    <th>Doctor</th>
                    <th>Priority</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpPatients.slice(0, 15).map(p => {
                    const daysOverdue = p.followUpDate ? Math.floor((now.getTime() - new Date(p.followUpDate).getTime()) / MS_PER_DAY) : 0;
                    const priority = daysOverdue > 7 ? "Critical" : daysOverdue > 0 ? "High" : "Normal";
                    const { color: priorityColor, bg: priorityBg, border: priorityBorder } = severityStyle(priority);
                    return (
                      <tr key={p.id} className="tbl-row">
                        <td>
                          <PatientCell name={p.name} id={p.id} />
                        </td>
                        <td style={{ fontSize: "var(--font-sm)" }}>{p.followUpReason || "Follow-up required"}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: daysOverdue > 0 ? "var(--red)" : "var(--fg)" }}>
                          {fmtDate(p.followUpDate)}
                          {daysOverdue > 0 && <span style={{ fontSize: "var(--font-xs)", marginLeft: 4 }}>({daysOverdue}d ago)</span>}
                        </td>
                        <td style={{ fontSize: "var(--font-sm)" }}>{p.doctor}</td>
                        <td>
                          <span className="badge" style={{ background: priorityBg, color: priorityColor, border: `1px solid ${priorityBorder}` }}>
                            {priority}
                          </span>
                        </td>
                        <td>
                          {contactedIds.has(p.id) ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }}>
                                <i className="ti ti-check" style={{ fontSize: 11, marginRight: 3 }} />
                                Contacted
                              </span>
                              <button
                                aria-label={`Call ${p.name} again`}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "var(--font-xs)", textDecoration: "underline", padding: 0 }}
                                onClick={() => setCallModalPatient(p)}
                              >
                                Call again
                              </button>
                            </div>
                          ) : (
                            <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={() => setCallModalPatient(p)}>
                              <i className="ti ti-phone" style={{ fontSize: 11, marginRight: 3 }} />
                              Call
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── CALL MODAL ────────────────────────────────────────────────────────── */}
      {callModalPatient && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => { if (window.getSelection()?.toString()) return; setCallModalPatient(null); }}>
          <div className="card card-padded" role="dialog" aria-modal="true" aria-label="Call patient" style={{ maxWidth: 360, width: "100%", zIndex: 1001 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Call Patient</span>
              <button aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }} onClick={() => setCallModalPatient(null)}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{callModalPatient.name}</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{callModalPatient.id}</div>
            </div>
            <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>
              <span style={{ color: "var(--muted)" }}>Follow-up reason: </span>
              {callModalPatient.followUpReason || "Follow-up required"}
            </div>
            <div style={{ fontSize: "var(--font-sm)", marginBottom: 16 }}>
              <span style={{ color: "var(--muted)" }}>Doctor: </span>{callModalPatient.doctor}
            </div>
            {(() => {
              // `phone` isn't declared on the Patient type yet; read it defensively until the type is updated
              const phone = (callModalPatient as Patient & { phone?: string }).phone;
              return phone ? (
                <a href={`tel:${phone}`} className="btn btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: "var(--font-sm)", gap: 6 }}>
                  <i className="ti ti-phone" />
                  Call {phone}
                </a>
              ) : (
                <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", textAlign: "center", padding: 8, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <i className="ti ti-phone-off" style={{ marginRight: 4 }} />
                  No phone number on record
                </div>
              );
            })()}
            <button
              className="btn btn-primary"
              style={{ marginTop: 8, width: "100%", fontSize: "var(--font-sm)" }}
              onClick={() => {
                setContactedIds(prev => new Set(prev).add(callModalPatient.id));
                setCallModalPatient(null);
              }}
            >
              <i className="ti ti-check" style={{ fontSize: 12, marginRight: 4 }} />
              Mark as Contacted
            </button>
            <button className="btn" style={{ marginTop: 8, width: "100%", fontSize: "var(--font-sm)" }} onClick={() => setCallModalPatient(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function severityStyle(level: "Critical" | "High" | "Normal"): { color: string; bg: string; border: string } {
  if (level === "Critical") return { color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-border)" };
  if (level === "High") return { color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-border)" };
  return { color: "var(--blue)", bg: "var(--blue-bg)", border: "var(--blue-border)" };
}
function TabButton({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: string }) {
  return (
    <button
      onClick={onClick}
      className={`reports-tab-btn${active ? "" : " reports-tab-btn-inactive"}`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 14px",
        borderRadius: "var(--radius) var(--radius) 0 0",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: -1,
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--muted)",
        fontSize: "var(--font-sm)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
        whiteSpace: "nowrap",
        minHeight: 40,
        flexShrink: 0,
      }}
    >
      <style>{`.reports-tab-btn-inactive:hover { background: var(--surface2) !important; }`}</style>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 14 }} />}
      {children}
    </button>
  );
}

function StatCard({ label, value, color, icon, bg }: { label: string; value: string | number; color: string; icon: string; bg: string }) {
  return (
    <div className="card card-padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
        </div>
        <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "var(--font-xl)", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status || "";
  const cfg = s === "Active"
    ? { bg: "var(--green-bg)", color: "var(--green)", border: "var(--green-border)" }
    : s === "Completed"
    ? { bg: "var(--blue-bg)", color: "var(--blue)", border: "var(--blue-border)" }
    : s === "No Show"
    ? { bg: "var(--red-bg)", color: "var(--red)", border: "var(--red-border)" }
    : { bg: "var(--amber-bg)", color: "var(--amber)", border: "var(--amber-border)" };
  return <span className="badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{s || "Unknown"}</span>;
}

function PatientCell({ name, id }: { name: string; id: string }) {
  return (
    <>
      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{id}</div>
    </>
  );
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
      <div style={{ fontSize: "var(--font-sm)" }}>{msg}</div>
    </div>
  );
}

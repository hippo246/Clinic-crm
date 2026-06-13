import React from "react";
import type { Patient } from "./types";
import { getPatientStats, fmtDate } from "./utils";

// ─── Appointments ─────────────────────────────────────────────────────────────
export function AppointmentsPage({ patients }: { patients: Patient[] }) {
  const upcoming = patients
    .filter((p) => p.nextAppointment)
    .sort((a, b) => new Date(a.nextAppointment!).getTime() - new Date(b.nextAppointment!).getTime())
    .slice(0, 50);

  const overdue = patients.filter(
    (p) => p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date())
  );

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: 20 }}>Appointments</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 4 }} />Upcoming</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>{upcoming.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-clock-exclamation" style={{ fontSize: 11, marginRight: 4 }} />Follow-Up Overdue</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{overdue.length}</div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />
            Follow-Up Overdue ({overdue.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.slice(0, 10).map((p) => (
              <div key={p.id} className="card card-padded" style={{
                display: "flex", alignItems: "center", gap: 12,
                border: "1px solid var(--amber-border)", background: "var(--amber-bg)",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-phone" style={{ fontSize: 16, color: "var(--amber)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {p.followUpReason || "Follow-up required"} · {p.doctor}
                  </div>
                </div>
                <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)" }}>
                  Due {fmtDate(p.followUpDate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-label" style={{ marginBottom: 10 }}>
          <i className="ti ti-calendar-check" style={{ marginRight: 4 }} />
          Upcoming Appointments
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Appointment Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><i className="ti ti-calendar-off empty-state-icon" /><div className="empty-state-sub">No upcoming appointments</div></div></td></tr>
              ) : upcoming.map((p) => (
                <tr key={p.id} className="tbl-row">
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                  </td>
                  <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(p.nextAppointment)}</td>
                  <td>
                    <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" }}>
                      Scheduled
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────
export function BillingPage({ patients }: { patients: Patient[] }) {
  const expired  = patients.filter((p) => p.insuranceStatus === "Expired");
  const expiring = patients.filter((p) => p.insuranceStatus === "Expiring");
  const insured  = patients.filter((p) => p.insuranceStatus === "Active");
  const none     = patients.filter((p) => p.insuranceStatus === "None");

  const INSURERS = ["Star Health","HDFC ERGO","ICICI Lombard","Bajaj Allianz"];
  const insStats = INSURERS.map((name) => ({
    name,
    count: patients.filter((p) => p.insurer === name).length,
  }));

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: 20 }}>Billing & Insurance</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Active Insurance" value={insured.length} color="var(--green)" icon="ti-shield-check" bg="var(--green-bg)" />
        <StatCard label="Expiring Soon"    value={expiring.length} color="var(--amber)" icon="ti-shield-exclamation" bg="var(--amber-bg)" />
        <StatCard label="Expired"          value={expired.length}  color="var(--red)"   icon="ti-shield-x" bg="var(--red-bg)" />
        <StatCard label="No Insurance"     value={none.length}     color="var(--muted)" icon="ti-shield-off" bg="var(--surface3)" />
      </div>

      {expired.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ color: "var(--red)", marginBottom: 10 }}>
            <i className="ti ti-shield-x" style={{ marginRight: 4 }} />
            Expired Insurance — Action Required ({expired.length})
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr><th>Patient</th><th>Provider</th><th>Expired</th><th>Doctor</th></tr>
              </thead>
              <tbody>
                {expired.slice(0, 15).map((p) => (
                  <tr key={p.id} className="tbl-row">
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.name}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.id}</div>
                    </td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.insurer}</td>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--red)" }}>{fmtDate(p.insuranceExpiry)}</td>
                    <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{p.doctor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="section-label" style={{ marginBottom: 10 }}>Insurance Distribution</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insStats.map(({ name, count }) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "var(--font-sm)", width: 140, flexShrink: 0 }}>{name}</span>
              <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--accent)", borderRadius: 4, width: `${(count / patients.length) * 100}%`, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)", width: 40, textAlign: "right" }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export function ReportsPage({ patients }: { patients: Patient[] }) {
  const stats = getPatientStats(patients);

  const statusDistribution = [
    { label: "New",             count: patients.filter((p) => p.status === "New").length,             color: "#0ea5e9" },
    { label: "Active",          count: patients.filter((p) => p.status === "Active").length,          color: "#22c55e" },
    { label: "Follow-Up Due",   count: patients.filter((p) => p.status === "Follow-Up Due").length,   color: "#f59e0b" },
    { label: "Under Treatment", count: patients.filter((p) => p.status === "Under Treatment").length, color: "#8b5cf6" },
    { label: "Observation",     count: patients.filter((p) => p.status === "Observation").length,     color: "#ec4899" },
    { label: "Inactive",        count: patients.filter((p) => p.status === "Inactive").length,        color: "#94a3b8" },
    { label: "VIP",             count: patients.filter((p) => p.status === "VIP").length,             color: "#f97316" },
  ];

  const alertDistribution = [
    { label: "Diabetic",        count: patients.filter((p) => p.alerts.includes("Diabetic")).length,        color: "#f59e0b" },
    { label: "Hypertension",    count: patients.filter((p) => p.alerts.includes("Hypertension")).length,    color: "#ec4899" },
    { label: "Allergy",         count: patients.filter((p) => p.alerts.includes("Allergy")).length,         color: "#ef4444" },
    { label: "Heart Condition", count: patients.filter((p) => p.alerts.includes("Heart Condition")).length, color: "#dc2626" },
    { label: "Pregnancy",       count: patients.filter((p) => p.alerts.includes("Pregnancy")).length,       color: "#a855f7" },
    { label: "High Risk",       count: patients.filter((p) => p.alerts.includes("High Risk")).length,       color: "#ef4444" },
  ];

  const docDistribution = [
    { label: "Dr. Sharma", count: patients.filter((p) => p.doctor === "Dr. Sharma").length },
    { label: "Dr. Patel",  count: patients.filter((p) => p.doctor === "Dr. Patel").length  },
    { label: "Dr. Mehta",  count: patients.filter((p) => p.doctor === "Dr. Mehta").length  },
    { label: "Dr. Iyer",   count: patients.filter((p) => p.doctor === "Dr. Iyer").length   },
    { label: "Dr. Nair",   count: patients.filter((p) => p.doctor === "Dr. Nair").length   },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: 20 }}>Reports & Analytics</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Patients"       value={stats.total}          color="var(--accent)" icon="ti-users"              bg="var(--accent-soft)" />
        <StatCard label="Active Patients"      value={stats.active}         color="var(--green)"  icon="ti-activity"           bg="var(--green-bg)" />
        <StatCard label="Critical Alerts"      value={stats.criticalAlerts} color="var(--red)"    icon="ti-alert-triangle"     bg="var(--red-bg)" />
        <StatCard label="Follow-Up Due"        value={stats.followUpDue}    color="var(--amber)"  icon="ti-clock"              bg="var(--amber-bg)" />
        <StatCard label="Insurance Expiring"   value={stats.insExpiring}    color="var(--amber)"  icon="ti-shield-exclamation" bg="var(--amber-bg)" />
        <StatCard label="New Patients"         value={stats.newPatients}    color="var(--blue)"   icon="ti-user-plus"          bg="var(--blue-bg)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Patient Status Distribution</div>
          <BarChart data={statusDistribution} total={patients.length} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Medical Alert Distribution</div>
          <BarChart data={alertDistribution} total={patients.length} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Patients per Doctor</div>
          <BarChart data={docDistribution.map((d) => ({ ...d, color: "var(--accent)" }))} total={patients.length} />
        </div>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>Data Quality</div>
          <QualityReport patients={patients} />
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, total }: { data: { label: string; count: number; color?: string }[]; total: number }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(({ label, count, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "var(--font-xs)", width: 130, flexShrink: 0, color: "var(--muted)" }}>{label}</span>
          <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${(count / max) * 100}%`,
              background: color || "var(--accent)",
              transition: "width 0.5s ease",
            }} />
          </div>
          <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", width: 30, textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function QualityReport({ patients }: { patients: Patient[] }) {
  const items = [
    { label: "Phone verified",    count: patients.filter((p) => p.phoneVerified).length     },
    { label: "ID verified",       count: patients.filter((p) => p.idVerified).length        },
    { label: "Consent signed",    count: patients.filter((p) => p.consentSigned).length     },
    { label: "Insurance verified",count: patients.filter((p) => p.insuranceVerified).length },
    { label: "Docs complete",     count: patients.filter((p) => p.documentsComplete).length },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(({ label, count }) => {
        const pct = Math.round((count / patients.length) * 100);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "var(--font-xs)", width: 130, flexShrink: 0, color: "var(--muted)" }}>{label}</span>
            <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)", transition: "width 0.5s" }} />
            </div>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", width: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function SettingsPage({
  dark, setDark, role, setRole,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  role: string;
  setRole: (r: any) => void;
}) {
  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: 20 }}>Settings</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SettingRow
          icon="ti-moon"
          label="Dark Mode"
          description="Switch between light and dark theme"
        >
          <ToggleSwitch on={dark} onToggle={() => setDark(!dark)} />
        </SettingRow>

        <SettingRow
          icon="ti-user-shield"
          label="Current Role"
          description="Simulates role-based access control"
        >
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ fontSize: "var(--font-sm)" }}>
            <option value="receptionist">Receptionist</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
          </select>
        </SettingRow>

        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 10 }}>Role Permissions</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Receptionist</th>
                <th>Doctor</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["View Medical Info",    false, true,  true],
                ["View Billing",         true,  false, true],
                ["Edit Patient",         true,  true,  true],
                ["Delete Document",      false, false, true],
                ["Edit Medical Alerts",  false, true,  true],
                ["View Audit Log",       false, false, true],
                ["Delete Patient",       false, false, true],
              ].map(([perm, rec, doc, adm]) => (
                <tr key={perm as string}>
                  <td style={{ fontSize: "var(--font-sm)" }}>{perm as string}</td>
                  <td><PermDot on={rec as boolean} /></td>
                  <td><PermDot on={doc as boolean} /></td>
                  <td><PermDot on={adm as boolean} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SettingRow
          icon="ti-database"
          label="Data Persistence"
          description="Patient data is saved to localStorage and survives page refresh"
        >
          <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }}>
            <i className="ti ti-circle-check" style={{ fontSize: 10 }} /> Active
          </span>
        </SettingRow>

        <SettingRow
          icon="ti-shield-lock"
          label="Security Note"
          description="This is a frontend demo. In production, all data would be encrypted at rest (AES-256) and in transit (TLS 1.3), with full HIPAA audit logging."
        >
          <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
            Demo Mode
          </span>
        </SettingRow>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, description, children }: {
  icon: string; label: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="card card-padded" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: "var(--radius)", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 17, color: "var(--accent)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 12,
      background: on ? "var(--accent)" : "var(--border)",
      border: "none", cursor: "pointer", position: "relative",
      transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: on ? 23 : 3,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
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
  label: string; value: number; color: string; icon: string; bg: string;
}) {
  return (
    <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color }} />
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

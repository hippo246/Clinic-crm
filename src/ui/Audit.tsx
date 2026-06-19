import React, { useState } from "react";
import { fmtDate } from "./utils";

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<"login" | "edits" | "deleted" | "permissions" | "suspicious">("login");

  const loginLogs = [
    { id: 1, user: "Dr. Sarah Johnson", email: "sarah.johnson@clinic.com", ip: "192.168.1.100", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), status: "success" },
    { id: 2, user: "Emily Davis", email: "emily.davis@clinic.com", ip: "192.168.1.101", timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), status: "success" },
    { id: 3, user: "Unknown", email: "unknown@external.com", ip: "203.0.113.1", timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), status: "failed" },
    { id: 4, user: "Dr. Michael Chen", email: "michael.chen@clinic.com", ip: "192.168.1.102", timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), status: "success" },
    { id: 5, user: "Admin User", email: "admin@clinic.com", ip: "192.168.1.1", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: "success" },
  ];

  const editHistory = [
    { id: 1, user: "Dr. Sarah Johnson", action: "Updated patient medical record", patient: "John Doe (PAT001)", timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), changes: "Updated diagnosis and treatment plan" },
    { id: 2, user: "Emily Davis", action: "Modified appointment", patient: "Jane Smith (PAT002)", timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), changes: "Rescheduled appointment to tomorrow" },
    { id: 3, user: "Dr. Michael Chen", action: "Added prescription", patient: "Bob Wilson (PAT003)", timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), changes: "Prescribed Amoxicillin 500mg" },
    { id: 4, user: "James Wilson", action: "Updated vitals", patient: "Alice Brown (PAT004)", timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), changes: "Recorded blood pressure and heart rate" },
    { id: 5, user: "Admin User", action: "Modified system settings", patient: "N/A", timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), changes: "Updated notification preferences" },
  ];

  const deletedReports = [
    { id: 1, user: "Admin User", action: "Deleted patient record", patient: "Old Patient (PAT999)", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), reason: "Patient request - GDPR" },
    { id: 2, user: "Dr. Sarah Johnson", action: "Deleted document", patient: "John Doe (PAT001)", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), reason: "Incorrect upload" },
  ];

  const permissionChanges = [
    { id: 1, user: "Admin User", action: "Granted admin access", target: "Emily Davis", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), previous: "Receptionist", new: "Admin" },
    { id: 2, user: "Admin User", action: "Revoked billing access", target: "James Wilson", timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), previous: "Full access", new: "View only" },
  ];

  const suspiciousActivity = [
    { id: 1, type: "Multiple Failed Logins", description: "5 failed login attempts from IP 203.0.113.1", timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), severity: "high" },
    { id: 2, type: "Unusual Access Time", description: "Login at 3:00 AM from unexpected location", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), severity: "medium" },
    { id: 3, type: "Bulk Data Export", description: "Large data export initiated by Dr. Michael Chen", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), severity: "low" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Audit & Security
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Login logs, patient edit history, deleted reports, permission changes, suspicious activity
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Login Attempts" value={loginLogs.length} color="var(--blue)" icon="ti-login" bg="var(--blue-bg)" />
        <StatCard label="Edit History" value={editHistory.length} color="var(--green)" icon="ti-edit" bg="var(--green-bg)" />
        <StatCard label="Deleted Items" value={deletedReports.length} color="var(--red)" icon="ti-trash" bg="var(--red-bg)" />
        <StatCard label="Permission Changes" value={permissionChanges.length} color="var(--amber)" icon="ti-lock" bg="var(--amber-bg)" />
        <StatCard label="Security Alerts" value={suspiciousActivity.length} color="var(--purple)" icon="ti-shield-exclamation" bg="var(--purple-bg)" />
      </div>

      {/* Security Alerts */}
      {suspiciousActivity.length > 0 && (
        <div className="card card-padded" style={{ marginBottom: 24, border: "2px solid var(--red-border)", background: "var(--red-bg)" }}>
          <div className="section-label" style={{ color: "var(--red)", marginBottom: 12 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
            Security Alerts ({suspiciousActivity.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suspiciousActivity.map(s => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "#fff", borderRadius: "var(--radius)",
                border: "1px solid var(--red-border)"
              }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: s.severity === "high" ? "var(--red)" : s.severity === "medium" ? "var(--amber)" : "var(--blue)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{s.type}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {s.description} · {fmtDate(s.timestamp)}
                  </div>
                </div>
                <span className="badge" style={{
                  background: s.severity === "high" ? "var(--red-bg)" : s.severity === "medium" ? "var(--amber-bg)" : "var(--blue-bg)",
                  color: s.severity === "high" ? "var(--red)" : s.severity === "medium" ? "var(--amber)" : "var(--blue)",
                  border: s.severity === "high" ? "1px solid var(--red-border)" : s.severity === "medium" ? "1px solid var(--amber-border)" : "1px solid var(--blue-border)"
                }}>
                  {s.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "login"} onClick={() => setActiveTab("login")}>Login Logs</TabButton>
          <TabButton active={activeTab === "edits"} onClick={() => setActiveTab("edits")}>Edit History</TabButton>
          <TabButton active={activeTab === "deleted"} onClick={() => setActiveTab("deleted")}>Deleted Reports</TabButton>
          <TabButton active={activeTab === "permissions"} onClick={() => setActiveTab("permissions")}>Permission Changes</TabButton>
          <TabButton active={activeTab === "suspicious"} onClick={() => setActiveTab("suspicious")}>Suspicious Activity</TabButton>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "login" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>IP Address</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loginLogs.map(log => (
                <tr key={log.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{log.user}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{log.email}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{log.ip}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(log.timestamp)}</td>
                  <td>
                    <span className="badge" style={{
                      background: log.status === "success" ? "var(--green-bg)" : "var(--red-bg)",
                      color: log.status === "success" ? "var(--green)" : "var(--red)",
                      border: log.status === "success" ? "1px solid var(--green-border)" : "1px solid var(--red-border)"
                    }}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "edits" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Patient</th>
                <th>Changes</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {editHistory.map(edit => (
                <tr key={edit.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{edit.user}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{edit.action}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{edit.patient}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{edit.changes}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(edit.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "deleted" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Patient</th>
                <th>Reason</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {deletedReports.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><i className="ti ti-trash-off empty-state-icon" /><div className="empty-state-sub">No deleted records</div></div></td></tr>
              ) : (
                deletedReports.map(del => (
                  <tr key={del.id} className="tbl-row">
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{del.user}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{del.action}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{del.patient}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{del.reason}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(del.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Previous</th>
                <th>New</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {permissionChanges.map(perm => (
                <tr key={perm.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{perm.user}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{perm.action}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{perm.target}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{perm.previous}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{perm.new}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(perm.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "suspicious" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Timestamp</th>
                <th>Severity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suspiciousActivity.map(s => (
                <tr key={s.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{s.type}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{s.description}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(s.timestamp)}</td>
                  <td>
                    <span className="badge" style={{
                      background: s.severity === "high" ? "var(--red-bg)" : s.severity === "medium" ? "var(--amber-bg)" : "var(--blue-bg)",
                      color: s.severity === "high" ? "var(--red)" : s.severity === "medium" ? "var(--amber)" : "var(--blue)",
                      border: s.severity === "high" ? "1px solid var(--red-border)" : s.severity === "medium" ? "1px solid var(--amber-border)" : "1px solid var(--blue-border)"
                    }}>
                      {s.severity}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>Investigate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

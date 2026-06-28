import React, { useState } from "react";
import { fmtDate } from "./utils";

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

  const staff: StaffMember[] = [
    {
      id: "STF001",
      name: "Dr. Sarah Johnson",
      role: "doctor",
      email: "sarah.johnson@clinic.com",
      phone: "+1 555-0101",
      department: "Internal Medicine",
      status: "active",
      joinDate: "2020-03-15",
      permissions: ["view_medical", "edit_medical", "prescribe", "view_billing"]
    },
    {
      id: "STF002",
      name: "Dr. Michael Chen",
      role: "doctor",
      email: "michael.chen@clinic.com",
      phone: "+1 555-0102",
      department: "Cardiology",
      status: "active",
      joinDate: "2019-07-22",
      permissions: ["view_medical", "edit_medical", "prescribe", "view_billing"]
    },
    {
      id: "STF003",
      name: "Emily Davis",
      role: "receptionist",
      email: "emily.davis@clinic.com",
      phone: "+1 555-0103",
      department: "Front Desk",
      status: "active",
      joinDate: "2021-01-10",
      permissions: ["view_patients", "edit_patients", "schedule", "view_billing"]
    },
    {
      id: "STF004",
      name: "James Wilson",
      role: "nurse",
      email: "james.wilson@clinic.com",
      phone: "+1 555-0104",
      department: "Nursing",
      status: "active",
      joinDate: "2020-09-05",
      permissions: ["view_medical", "edit_vitals", "view_billing"]
    },
    {
      id: "STF005",
      name: "Admin User",
      role: "admin",
      email: "admin@clinic.com",
      phone: "+1 555-0100",
      department: "Administration",
      status: "active",
      joinDate: "2018-01-01",
      permissions: ["all"]
    }
  ];

  const doctors = staff.filter(s => s.role === "doctor");
  const receptionists = staff.filter(s => s.role === "receptionist");
  const nurses = staff.filter(s => s.role === "nurse");
  const admins = staff.filter(s => s.role === "admin");

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Staff & Roles
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Doctors, receptionist, permissions, schedules, activity tracking
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
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

      {activeTab === "staff" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <FilterButton active>All Staff</FilterButton>
              <FilterButton>Doctors</FilterButton>
              <FilterButton>Receptionists</FilterButton>
              <FilterButton>Nurses</FilterButton>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddStaff(true)}>
              <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />
              Add Staff Member
            </button>
          </div>

      {/* Staff List */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="tbl-row">
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
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>View</button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>Edit</button>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-calendar" style={{ marginRight: 4 }} />
              Staff Schedule
            </div>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }}>
              <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
              Add Schedule
            </button>
          </div>
          <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
            <i className="ti ti-calendar" style={{ fontSize: 32, marginBottom: 8 }} />
            <div>Schedule management coming soon</div>
            <div style={{ fontSize: "var(--font-xs)", marginTop: 4 }}>Manage staff shifts, appointments, and availability</div>
          </div>
        </div>
      )}

      {activeTab === "performance" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-chart-line" style={{ marginRight: 4 }} />
            Performance Metrics
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {doctors.map(doc => (
              <div key={doc.id} style={{
                padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)",
                border: "1px solid var(--border)"
              }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 12 }}>{doc.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <MetricCard label="Patients Seen" value="24" color="var(--blue)" />
                  <MetricCard label="Avg Time" value="15m" color="var(--green)" />
                  <MetricCard label="Satisfaction" value="4.8" color="var(--amber)" />
                  <MetricCard label="On-Time" value="95%" color="var(--purple)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-lock" style={{ marginRight: 4 }} />
            Role Permissions
          </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Permission</th>
              <th>Doctor</th>
              <th>Receptionist</th>
              <th>Nurse</th>
              <th>Admin</th>
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
      )}

      {/* Activity Tracking */}
      <div className="card card-padded" style={{ marginTop: 24 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>
          <i className="ti ti-activity" style={{ marginRight: 4 }} />
          Recent Activity
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { user: "Dr. Sarah Johnson", action: "Completed consultation for John Doe", time: "2 minutes ago" },
            { user: "Emily Davis", action: "Scheduled appointment for Jane Smith", time: "5 minutes ago" },
            { user: "Dr. Michael Chen", action: "Prescribed medication for Bob Wilson", time: "15 minutes ago" },
            { user: "James Wilson", action: "Updated vitals for Alice Brown", time: "30 minutes ago" },
            { user: "Admin User", action: "Modified system settings", time: "1 hour ago" },
          ].map((activity, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--accent-soft)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700
              }}>
                {activity.user.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{activity.user}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{activity.action}</div>
              </div>
              <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="modal-backdrop" onClick={() => setShowAddStaff(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Add Staff Member</div>
              <button className="btn-icon" onClick={() => setShowAddStaff(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Full Name</label>
                <input type="text" placeholder="Enter full name..." style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Role</label>
                <select style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="nurse">Nurse</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Email</label>
                <input type="email" placeholder="Enter email..." style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Phone</label>
                <input type="tel" placeholder="Enter phone number..." style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Department</label>
                <input type="text" placeholder="Enter department..." style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowAddStaff(false)}>Cancel</button>
                <button className="btn btn-primary">Add Staff Member</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
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

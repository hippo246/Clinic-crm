import React, { useState, useMemo } from "react";
import type { Patient } from "./types";
import { fmtDate, getPatientStats } from "./utils";

export default function Dashboard({ patients }: { patients: Patient[] }) {
  const stats = getPatientStats(patients);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const todayAppointments = patients.filter(p => {
    if (!p.nextAppointment) return false;
    const appointmentDate = new Date(p.nextAppointment).toISOString().split("T")[0];
    return appointmentDate === todayStr;
  });

  const pendingFollowUps = patients.filter(p => 
    p.status === "Follow-Up Due" || (p.followUpDate && new Date(p.followUpDate) < new Date())
  );

  const criticalAlerts = patients.filter(p => 
    p.alerts && p.alerts.some(a => a.severity === "critical")
  );

  const staffWorkload = useMemo(() => {
    const workload: Record<string, number> = {};
    patients.forEach(p => {
      if (p.doctor) {
        workload[p.doctor] = (workload[p.doctor] || 0) + 1;
      }
    });
    return Object.entries(workload).map(([doctor, count]) => ({ doctor, count }));
  }, [patients]);

  const revenue = useMemo(() => {
    const invoices = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]");
    const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
    const paidRevenue = invoices.filter((inv: any) => inv.status === "paid").reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
    const pendingRevenue = invoices.filter((inv: any) => inv.status === "pending").reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
    return { total: totalRevenue, paid: paidRevenue, pending: pendingRevenue };
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Dashboard
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Today's Appointments" value={todayAppointments.length} color="var(--blue)" icon="ti-calendar" bg="var(--blue-bg)" />
        <StatCard label="Pending Follow-Ups" value={pendingFollowUps.length} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
        <StatCard label="Critical Alerts" value={criticalAlerts.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Total Revenue" value={`$${revenue.total.toFixed(2)}`} color="var(--green)" icon="ti-currency-dollar" bg="var(--green-bg)" />
        <StatCard label="Active Patients" value={stats.active} color="var(--accent)" icon="ti-users" bg="var(--accent-soft)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Today's Appointments */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-calendar" style={{ marginRight: 4 }} />
            Today's Appointments ({todayAppointments.length})
          </div>
          {todayAppointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-calendar-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No appointments scheduled for today</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayAppointments.slice(0, 5).map(p => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--accent-soft)", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700
                  }}>
                    {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {p.doctor} · {new Date(p.nextAppointment!).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <span className="badge" style={{ background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue-border)" }}>
                    Scheduled
                  </span>
                </div>
              ))}
              {todayAppointments.length > 5 && (
                <div style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--muted)", padding: 8 }}>
                  +{todayAppointments.length - 5} more appointments
                </div>
              )}
            </div>
          )}
        </div>

        {/* Revenue Summary */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-currency-dollar" style={{ marginRight: 4 }} />
            Revenue Summary
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Total Revenue</span>
              <span style={{ fontSize: "var(--font-md)", fontWeight: 700, color: "var(--accent)" }}>${revenue.total.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Paid</span>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--green)" }}>${revenue.paid.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Pending</span>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--amber)" }}>${revenue.pending.toFixed(2)}</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "var(--green)", borderRadius: 4, width: `${(revenue.paid / revenue.total) * 100}%` }} />
            </div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", textAlign: "center" }}>
              {((revenue.paid / revenue.total) * 100).toFixed(1)}% collected
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Critical Alerts */}
        <div className="card card-padded">
          <div className="section-label" style={{ color: "var(--red)", marginBottom: 12 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
            Critical Alerts ({criticalAlerts.length})
          </div>
          {criticalAlerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-check-circle" style={{ fontSize: 32, marginBottom: 8, color: "var(--green)" }} />
              <div>No critical alerts</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {criticalAlerts.slice(0, 5).map(p => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--red-bg)", borderRadius: "var(--radius)",
                  border: "1px solid var(--red-border)"
                }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: "var(--red)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {p.alerts?.filter(a => a.severity === "critical").map(a => a.message).join(", ")}
                    </div>
                  </div>
                </div>
              ))}
              {criticalAlerts.length > 5 && (
                <div style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--muted)", padding: 8 }}>
                  +{criticalAlerts.length - 5} more alerts
                </div>
              )}
            </div>
          )}
        </div>

        {/* Staff Workload */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-user-shield" style={{ marginRight: 4 }} />
            Staff Workload
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {staffWorkload.map(({ doctor, count }) => (
              <div key={doctor} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 120, fontSize: "var(--font-sm)", fontWeight: 600 }}>{doctor}</div>
                <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--accent)", borderRadius: 4, width: `${(count / stats.total) * 100}%` }} />
                </div>
                <div style={{ width: 40, fontSize: "var(--font-sm)", color: "var(--muted)", textAlign: "right" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Follow-Ups */}
      {pendingFollowUps.length > 0 && (
        <div className="card card-padded">
          <div className="section-label" style={{ color: "var(--amber)", marginBottom: 12 }}>
            <i className="ti ti-clock-exclamation" style={{ marginRight: 4 }} />
            Pending Follow-Ups ({pendingFollowUps.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingFollowUps.slice(0, 5).map(p => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "var(--amber-bg)", borderRadius: "var(--radius)",
                border: "1px solid var(--amber-border)"
              }}>
                <i className="ti ti-phone" style={{ fontSize: 16, color: "var(--amber)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {p.followUpReason || "Follow-up required"} · {p.doctor}
                  </div>
                </div>
                <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--amber)" }}>
                  Due {fmtDate(p.followUpDate)}
                </span>
              </div>
            ))}
            {pendingFollowUps.length > 5 && (
              <div style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--muted)", padding: 8 }}>
                +{pendingFollowUps.length - 5} more follow-ups
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon, bg }: {
  label: string;
  value: string | number;
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

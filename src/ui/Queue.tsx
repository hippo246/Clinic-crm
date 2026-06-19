import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

export default function QueuePage({ patients }: { patients: Patient[] }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const today = new Date().toISOString().split("T")[0];

  const todayAppointments = patients.filter(p => {
    if (!p.nextAppointment) return false;
    const appointmentDate = new Date(p.nextAppointment).toISOString().split("T")[0];
    return appointmentDate === today;
  });

  const waitingRoom = todayAppointments.filter(p => p.status === "Checked In");
  const inProgress = todayAppointments.filter(p => p.status === "In Progress");
  const completed = todayAppointments.filter(p => p.status === "Completed");

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Queue & Front Desk
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Manage patient flow, walk-ins, check-in/check-out, and waiting room
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Waiting Room" value={waitingRoom.length} color="var(--amber)" icon="ti-users" bg="var(--amber-bg)" />
        <StatCard label="In Progress" value={inProgress.length} color="var(--blue)" icon="ti-activity" bg="var(--blue-bg)" />
        <StatCard label="Completed" value={completed.length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
        <StatCard label="Total Today" value={todayAppointments.length} color="var(--accent)" icon="ti-calendar" bg="var(--accent-soft)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Waiting Room */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-users" style={{ marginRight: 4 }} />
            Waiting Room ({waitingRoom.length})
          </div>
          {waitingRoom.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-armchair" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>Waiting room is empty</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {waitingRoom.map(p => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--amber-bg)", color: "var(--amber)",
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
                  <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }}>
                    Check In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* In Progress */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-activity" style={{ marginRight: 4 }} />
            In Progress ({inProgress.length})
          </div>
          {inProgress.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-circle-dashed" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No consultations in progress</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {inProgress.map(p => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--blue-bg)", borderRadius: "var(--radius)",
                  border: "1px solid var(--blue-border)"
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--blue)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700
                  }}>
                    {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {p.doctor} · Started {new Date(p.nextAppointment!).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card card-padded">
        <div className="section-label" style={{ marginBottom: 12 }}>
          <i className="ti ti-zoom-plus" style={{ marginRight: 4 }} />
          Quick Actions
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary">
            <i className="ti ti-user-plus" style={{ fontSize: 14, marginRight: 4 }} />
            Add Walk-in
          </button>
          <button className="btn btn-ghost">
            <i className="ti ti-calendar-plus" style={{ fontSize: 14, marginRight: 4 }} />
            Schedule Appointment
          </button>
          <button className="btn btn-ghost">
            <i className="ti ti-phone-call" style={{ fontSize: 14, marginRight: 4 }} />
            Call Next Patient
          </button>
          <button className="btn btn-ghost">
            <i className="ti ti-refresh" style={{ fontSize: 14, marginRight: 4 }} />
            Refresh Queue
          </button>
        </div>
      </div>
    </div>
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

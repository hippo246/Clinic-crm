import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

export default function ConsultationsPage({ patients }: { patients: Patient[] }) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewConsultation, setShowNewConsultation] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const todayConsultations = patients.filter(p => {
    if (!p.nextAppointment) return false;
    const appointmentDate = new Date(p.nextAppointment).toISOString().split("T")[0];
    return appointmentDate === today;
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Consultations & Encounters
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Doctor visit notes, vitals, symptoms, diagnosis, treatment plan, follow-up plan
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Today's Consultations" value={todayConsultations.length} color="var(--blue)" icon="ti-stethoscope" bg="var(--blue-bg)" />
        <StatCard label="In Progress" value={2} color="var(--amber)" icon="ti-activity" bg="var(--amber-bg)" />
        <StatCard label="Completed" value={5} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
        <StatCard label="Pending" value={3} color="var(--muted)" icon="ti-clock" bg="var(--surface3)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>
        {/* Patient List */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-users" style={{ marginRight: 4 }} />
            Today's Patients ({todayConsultations.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayConsultations.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: selectedPatient?.id === p.id ? "var(--accent-soft)" : "var(--surface2)",
                  borderRadius: "var(--radius)", cursor: "pointer",
                  border: selectedPatient?.id === p.id ? "1px solid var(--accent-border)" : "none"
                }}
              >
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
              </div>
            ))}
          </div>
        </div>

        {/* Consultation Form */}
        <div className="card card-padded">
          {selectedPatient ? (
            <>
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>{selectedPatient.name}</div>
                <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
                  ID: {selectedPatient.id} · Age: {selectedPatient.age} · {selectedPatient.gender}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Blood Pressure</label>
                  <input type="text" placeholder="120/80" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Heart Rate</label>
                  <input type="text" placeholder="72 bpm" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Temperature</label>
                  <input type="text" placeholder="98.6°F" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Weight</label>
                  <input type="text" placeholder="70 kg" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Chief Complaint</label>
                <textarea placeholder="Patient's main concern..." rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Symptoms</label>
                <textarea placeholder="List of symptoms..." rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Diagnosis</label>
                <textarea placeholder="Primary and secondary diagnoses..." rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Treatment Plan</label>
                <textarea placeholder="Treatment recommendations..." rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Follow-up Plan</label>
                <textarea placeholder="Follow-up instructions..." rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost">Cancel</button>
                <button className="btn btn-primary">Save Consultation</button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
              <i className="ti ti-stethoscope" style={{ fontSize: 48, marginBottom: 16 }} />
              <div style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Select a patient to start consultation</div>
              <div style={{ fontSize: "var(--font-sm)" }}>Choose a patient from the list to view their details and record consultation notes</div>
            </div>
          )}
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

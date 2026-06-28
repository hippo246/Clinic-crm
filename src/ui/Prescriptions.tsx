import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctor: string;
  medications: Medication[];
  createdAt: string;
  status: "active" | "completed" | "cancelled";
  notes: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  warnings?: string[];
}

interface RefillRequest {
  id: string;
  prescriptionId: string;
  patientName: string;
  medication: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

export default function PrescriptionsPage({ patients }: { patients: Patient[] }) {
  const [showNewPrescription, setShowNewPrescription] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "history" | "refills">("create");

  // Was read-only JSON.parse() on every render with no setState — nothing could ever be
  // written back, so every action button below had nowhere to send its result. Lifted into
  // real state, mirrored to localStorage on every change.
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(() =>
    JSON.parse(localStorage.getItem("clinic_crm_prescriptions") || "[]")
  );
  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>(() =>
    JSON.parse(localStorage.getItem("clinic_crm_refill_requests") || "[]")
  );

  function persistPrescriptions(next: Prescription[]) {
    setPrescriptions(next);
    localStorage.setItem("clinic_crm_prescriptions", JSON.stringify(next));
  }
  function persistRefills(next: RefillRequest[]) {
    setRefillRequests(next);
    localStorage.setItem("clinic_crm_refill_requests", JSON.stringify(next));
  }

  function handleRefillDecision(id: string, decision: "approved" | "rejected") {
    persistRefills(refillRequests.map(r => r.id === id ? { ...r, status: decision } : r));
  }

  // Create-prescription form state — these fields were plain uncontrolled <input>/<select>
  // with no state at all, so "Create Prescription" had nothing to read and could never submit.
  const [doctor, setDoctor] = useState("");
  const [medications, setMedications] = useState<Medication[]>([
    { id: "m1", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
    { id: "m2", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
  ]);
  const [notes, setNotes] = useState("");

  function updateMedication(id: string, field: keyof Medication, value: string) {
    setMedications(meds => meds.map(m => m.id === id ? { ...m, [field]: value } : m));
  }
  function addMedicationRow() {
    setMedications(meds => [...meds, { id: `m${Date.now()}`, name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  }
  function removeMedicationRow(id: string) {
    setMedications(meds => meds.length > 1 ? meds.filter(m => m.id !== id) : meds);
  }
  function clearForm() {
    setSelectedPatient(null);
    setDoctor("");
    setMedications([
      { id: "m1", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
      { id: "m2", name: "", dosage: "", frequency: "", duration: "", instructions: "" },
    ]);
    setNotes("");
  }
  function handleCreatePrescription() {
    if (!selectedPatient || !doctor) return;
    const filledMeds = medications.filter(m => m.name.trim());
    if (filledMeds.length === 0) return;
    const newRx: Prescription = {
      id: `rx_${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      doctor,
      medications: filledMeds,
      createdAt: new Date().toISOString(),
      status: "active",
      notes,
    };
    persistPrescriptions([newRx, ...prescriptions]);
    clearForm();
    setActiveTab("history");
  }

  const activePrescriptions = prescriptions.filter((p: Prescription) => p.status === "active");
  const pendingRefills = refillRequests.filter((r: RefillRequest) => r.status === "pending");

  // "View" needed somewhere to show the full prescription — there was no modal/route for it.
  const [viewingRx, setViewingRx] = useState<Prescription | null>(null);

  function handlePrint(p: Prescription) {
    const win = window.open("", "_blank");
    if (!win) return;
    const medsHtml = p.medications.map(m => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.dosage}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.frequency}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.duration}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${m.instructions || "—"}</td>
      </tr>`).join("");
    win.document.write(`
      <html><head><title>Prescription — ${p.patientName}</title></head>
      <body style="font-family:sans-serif;padding:32px;color:#111;">
        <h2 style="margin-bottom:4px;">Prescription</h2>
        <div style="color:#555;margin-bottom:20px;">${fmtDate(p.createdAt)} · Dr. ${p.doctor.replace(/^Dr\.\s*/, "")}</div>
        <div style="margin-bottom:16px;"><strong>Patient:</strong> ${p.patientName} (${p.patientId})</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead><tr style="text-align:left;background:#f3f3f3;">
            <th style="padding:6px 10px;">Medication</th><th style="padding:6px 10px;">Dosage</th>
            <th style="padding:6px 10px;">Frequency</th><th style="padding:6px 10px;">Duration</th>
            <th style="padding:6px 10px;">Instructions</th>
          </tr></thead>
          <tbody>${medsHtml}</tbody>
        </table>
        ${p.notes ? `<div><strong>Notes:</strong> ${p.notes}</div>` : ""}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  async function handleShare(p: Prescription) {
    const summary = `Prescription for ${p.patientName} — ${p.medications.map(m => `${m.name} ${m.dosage}`).join(", ")} (${p.doctor}, ${fmtDate(p.createdAt)})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Prescription", text: summary });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(summary);
      }
    } catch {
      // user cancelled the share sheet or clipboard was blocked — nothing to recover from here
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Prescriptions
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Create prescriptions, view history, manage refill requests, print/share prescriptions
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Active Prescriptions" value={activePrescriptions.length} color="var(--blue)" icon="ti-pill" bg="var(--blue-bg)" />
        <StatCard label="Today's Prescriptions" value={prescriptions.filter((p: Prescription) => new Date(p.createdAt).toDateString() === new Date().toDateString()).length} color="var(--green)" icon="ti-calendar-plus" bg="var(--green-bg)" />
        <StatCard label="Pending Refills" value={pendingRefills.length} color="var(--amber)" icon="ti-refresh" bg="var(--amber-bg)" />
        <StatCard label="Total Prescriptions" value={prescriptions.length} color="var(--accent)" icon="ti-file-text" bg="var(--accent-soft)" />
      </div>

      {/* Pending Refill Requests Alert */}
      {pendingRefills.length > 0 && (
        <div className="card card-padded" style={{ marginBottom: 24, border: "2px solid var(--amber-border)", background: "var(--amber-bg)" }}>
          <div className="section-label" style={{ color: "var(--amber)", marginBottom: 12 }}>
            <i className="ti ti-refresh-exclamation" style={{ marginRight: 4 }} />
            Pending Refill Requests ({pendingRefills.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingRefills.map((r: RefillRequest) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "#fff", borderRadius: "var(--radius)",
                border: "1px solid var(--amber-border)"
              }}>
                <i className="ti ti-refresh" style={{ fontSize: 20, color: "var(--amber)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{r.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {r.medication} · Requested {fmtDate(r.requestedAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "approved")}>Approve</button>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "rejected")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "create"} onClick={() => setActiveTab("create")}>Create Prescription</TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>Prescription History</TabButton>
          <TabButton active={activeTab === "refills"} onClick={() => setActiveTab("refills")}>Refill Requests</TabButton>
        </div>
      </div>

      {activeTab === "create" && (
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-pill" style={{ marginRight: 4 }} />
            Create New Prescription
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient</label>
            <select
              value={selectedPatient?.id || ""}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            >
              <option value="">Select patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Doctor</label>
            <select
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            >
              <option value="">Select doctor...</option>
              <option value="Dr. Sarah Johnson">Dr. Sarah Johnson</option>
              <option value="Dr. Michael Chen">Dr. Michael Chen</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Medications</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {medications.map((med) => (
                <div key={med.id} style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)", position: "relative" }}>
                  {medications.length > 1 && (
                    <button
                      className="btn-icon"
                      onClick={() => removeMedicationRow(med.id)}
                      title="Remove medication"
                      style={{ position: "absolute", top: 8, right: 8, padding: 4 }}
                    >
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </button>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text" placeholder="Medication name"
                      value={med.name}
                      onChange={(e) => updateMedication(med.id, "name", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    />
                    <input
                      type="text" placeholder="Dosage (e.g., 500mg)"
                      value={med.dosage}
                      onChange={(e) => updateMedication(med.id, "dosage", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <select
                      value={med.frequency}
                      onChange={(e) => updateMedication(med.id, "frequency", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    >
                      <option value="">Frequency...</option>
                      <option value="once-daily">Once daily</option>
                      <option value="twice-daily">Twice daily</option>
                      <option value="three-times-daily">Three times daily</option>
                      <option value="as-needed">As needed</option>
                    </select>
                    <input
                      type="text" placeholder="Duration (e.g., 7 days)"
                      value={med.duration}
                      onChange={(e) => updateMedication(med.id, "duration", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                    />
                  </div>
                  <textarea
                    placeholder="Special instructions..." rows={2}
                    value={med.instructions}
                    onChange={(e) => updateMedication(med.id, "instructions", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
                  />
                </div>
              ))}
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={addMedicationRow}>
                <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
                Add Medication
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Additional Notes</label>
            <textarea
              placeholder="Any additional notes or instructions..." rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={clearForm}>Clear</button>
            <button className="btn btn-primary" disabled={!selectedPatient || !doctor} onClick={handleCreatePrescription}>Create Prescription</button>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Medications</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-pill-off empty-state-icon" /><div className="empty-state-sub">No prescriptions found</div></div></td></tr>
              ) : prescriptions.slice(0, 10).map((p: Prescription) => (
                <tr key={p.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(p.createdAt)}</td>
                  <td>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.patientName}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{p.patientId}</div>
                  </td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{p.doctor}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>
                    {p.medications.slice(0, 2).map(m => m.name).join(", ")}
                    {p.medications.length > 2 && <span style={{ color: "var(--muted)" }}> +{p.medications.length - 2} more</span>}
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: p.status === "active" ? "var(--green-bg)" : p.status === "completed" ? "var(--blue-bg)" : "var(--red-bg)",
                      color: p.status === "active" ? "var(--green)" : p.status === "completed" ? "var(--blue)" : "var(--red)",
                      border: p.status === "active" ? "1px solid var(--green-border)" : p.status === "completed" ? "1px solid var(--blue-border)" : "1px solid var(--red-border)"
                    }}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setViewingRx(p)}>View</button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handlePrint(p)}>Print</button>
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleShare(p)}>Share</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "refills" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Patient</th>
                <th>Medication</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {refillRequests.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><i className="ti ti-refresh-off empty-state-icon" /><div className="empty-state-sub">No refill requests</div></div></td></tr>
              ) : refillRequests.map((r: RefillRequest) => (
                <tr key={r.id} className="tbl-row">
                  <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(r.requestedAt)}</td>
                  <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{r.patientName}</td>
                  <td style={{ fontSize: "var(--font-sm)" }}>{r.medication}</td>
                  <td>
                    <span className="badge" style={{
                      background: r.status === "pending" ? "var(--amber-bg)" : r.status === "approved" ? "var(--green-bg)" : "var(--red-bg)",
                      color: r.status === "pending" ? "var(--amber)" : r.status === "approved" ? "var(--green)" : "var(--red)",
                      border: r.status === "pending" ? "1px solid var(--amber-border)" : r.status === "approved" ? "1px solid var(--green-border)" : "1px solid var(--red-border)"
                    }}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {r.status === "pending" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "approved")}>Approve</button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleRefillDecision(r.id, "rejected")}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View prescription modal */}
      {viewingRx && (
        <div
          onClick={() => setViewingRx(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card card-padded"
            style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>
                  <i className="ti ti-pill" style={{ marginRight: 4 }} />
                  Prescription
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{fmtDate(viewingRx.createdAt)}</div>
              </div>
              <button className="btn-icon" onClick={() => setViewingRx(null)} title="Close">
                <i className="ti ti-x" style={{ fontSize: 14 }} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{viewingRx.patientName}</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{viewingRx.patientId} · {viewingRx.doctor}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {viewingRx.medications.map((m) => (
                <div key={m.id} style={{ padding: 10, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{m.name} {m.dosage && `· ${m.dosage}`}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {[m.frequency, m.duration].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {m.instructions && (
                    <div style={{ fontSize: "var(--font-xs)", marginTop: 4 }}>{m.instructions}</div>
                  )}
                </div>
              ))}
            </div>

            {viewingRx.notes && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>Notes</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{viewingRx.notes}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => handleShare(viewingRx)}>
                <i className="ti ti-share" style={{ fontSize: 13, marginRight: 4 }} />
                Share
              </button>
              <button className="btn btn-primary" onClick={() => handlePrint(viewingRx)}>
                <i className="ti ti-printer" style={{ fontSize: 13, marginRight: 4 }} />
                Print
              </button>
            </div>
          </div>
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

import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

export default function LabPage({ patients }: { patients: Patient[] }) {
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const labOrders = JSON.parse(localStorage.getItem("clinic_crm_lab_orders") || "[]");
  const labResults = JSON.parse(localStorage.getItem("clinic_crm_lab_results") || "[]");

  const pendingOrders = labOrders.filter((o: any) => o.status === "pending");
  const completedOrders = labOrders.filter((o: any) => o.status === "completed");
  const criticalResults = labResults.filter((r: any) => r.critical === true);

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Lab & Diagnostics
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Lab orders, lab results, imaging reports, critical result alerts
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Pending Orders" value={pendingOrders.length} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
        <StatCard label="Completed" value={completedOrders.length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
        <StatCard label="Critical Results" value={criticalResults.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Total Orders" value={labOrders.length} color="var(--blue)" icon="ti-test-tube" bg="var(--blue-bg)" />
        <StatCard label="Results" value={labResults.length} color="var(--accent)" icon="ti-file-text" bg="var(--accent-soft)" />
      </div>

      {/* Critical Results Alert */}
      {criticalResults.length > 0 && (
        <div className="card card-padded" style={{ marginBottom: 24, border: "2px solid var(--red-border)", background: "var(--red-bg)" }}>
          <div className="section-label" style={{ color: "var(--red)", marginBottom: 12 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
            Critical Results Alert ({criticalResults.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {criticalResults.map((r: any) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "#fff", borderRadius: "var(--radius)",
                border: "1px solid var(--red-border)"
              }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "var(--red)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{r.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {r.testName} · {r.result} · {fmtDate(r.date)}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }}>
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Lab Orders */}
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-test-tube" style={{ marginRight: 4 }} />
              Lab Orders ({pendingOrders.length})
            </div>
            <button className="btn btn-primary" onClick={() => setShowNewOrder(true)} style={{ fontSize: "var(--font-xs)" }}>
              <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
              New Order
            </button>
          </div>
          {pendingOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-test-tube-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No pending lab orders</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingOrders.map((o: any) => (
                <div key={o.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{o.patientName}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {o.testName} · Ordered {fmtDate(o.orderDate)} · {o.priority}
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

        {/* Lab Results */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-file-text" style={{ marginRight: 4 }} />
            Lab Results ({labResults.length})
          </div>
          {labResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-file-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No lab results available</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {labResults.slice(0, 5).map((r: any) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, background: r.critical ? "var(--red-bg)" : "var(--surface2)",
                  borderRadius: "var(--radius)",
                  border: r.critical ? "1px solid var(--red-border)" : "none"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{r.patientName}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {r.testName} · {r.result} · {fmtDate(r.date)}
                    </div>
                  </div>
                  {r.critical && (
                    <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }}>
                      Critical
                    </span>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>
                    View
                  </button>
                </div>
              ))}
              {labResults.length > 5 && (
                <div style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--muted)", padding: 8 }}>
                  +{labResults.length - 5} more results
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Imaging Reports */}
      <div className="card card-padded">
        <div className="section-label" style={{ marginBottom: 12 }}>
          <i className="ti ti-scan" style={{ marginRight: 4 }} />
          Imaging Reports
        </div>
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
          <i className="ti ti-scan" style={{ fontSize: 32, marginBottom: 8 }} />
          <div>No imaging reports available</div>
          <div style={{ fontSize: "var(--font-xs)", marginTop: 4 }}>Imaging reports will appear here when uploaded</div>
        </div>
      </div>

      {/* New Lab Order Modal */}
      {showNewOrder && (
        <div className="modal-backdrop" onClick={() => setShowNewOrder(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>New Lab Order</div>
              <button className="btn-icon" onClick={() => setShowNewOrder(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
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
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Test Type</label>
                <select style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="">Select test...</option>
                  <option value="cbc">Complete Blood Count (CBC)</option>
                  <option value="bmp">Basic Metabolic Panel (BMP)</option>
                  <option value="lipid">Lipid Panel</option>
                  <option value="thyroid">Thyroid Function</option>
                  <option value="hba1c">HbA1c</option>
                  <option value="urinalysis">Urinalysis</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Priority</label>
                <select style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Clinical Notes</label>
                <textarea placeholder="Reason for test..." rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowNewOrder(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!selectedPatient}>Submit Order</button>
              </div>
            </div>
          </div>
        </div>
      )}
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

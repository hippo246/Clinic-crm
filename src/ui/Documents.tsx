import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

export default function DocumentsPage({ patients }: { patients: Patient[] }) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "consents" | "id" | "insurance">("all");

  const documents = JSON.parse(localStorage.getItem("clinic_crm_documents") || "[]");
  const consents = documents.filter((d: any) => d.type === "consent");
  const idDocs = documents.filter((d: any) => d.type === "id");
  const insuranceDocs = documents.filter((d: any) => d.type === "insurance");

  const expiringSoon = documents.filter((d: any) => {
    if (!d.expiryDate) return false;
    const expiry = new Date(d.expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  const expired = documents.filter((d: any) => {
    if (!d.expiryDate) return false;
    return new Date(d.expiryDate) < new Date();
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Documents & Consents
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Uploaded files, consent forms, signed forms, ID/insurance docs, expiry tracking
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Documents" value={documents.length} color="var(--accent)" icon="ti-files" bg="var(--accent-soft)" />
        <StatCard label="Consents" value={consents.length} color="var(--blue)" icon="ti-writing" bg="var(--blue-bg)" />
        <StatCard label="ID Documents" value={idDocs.length} color="var(--green)" icon="ti-id" bg="var(--green-bg)" />
        <StatCard label="Insurance Docs" value={insuranceDocs.length} color="var(--amber)" icon="ti-shield" bg="var(--amber-bg)" />
        <StatCard label="Expiring Soon" value={expiringSoon.length} color="var(--red)" icon="ti-clock-exclamation" bg="var(--red-bg)" />
      </div>

      {/* Expiry Alerts */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className="card card-padded" style={{ marginBottom: 24, border: expired.length > 0 ? "2px solid var(--red-border)" : "1px solid var(--amber-border)", background: expired.length > 0 ? "var(--red-bg)" : "var(--amber-bg)" }}>
          <div className="section-label" style={{ color: expired.length > 0 ? "var(--red)" : "var(--amber)", marginBottom: 12 }}>
            <i className={`ti ${expired.length > 0 ? "ti-alert-triangle" : "ti-clock-exclamation"}`} style={{ marginRight: 4 }} />
            {expired.length > 0 ? "Expired Documents" : "Documents Expiring Soon"} ({expired.length + expiringSoon.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...expired, ...expiringSoon].map((d: any) => (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "#fff", borderRadius: "var(--radius)",
                border: expired.includes(d) ? "1px solid var(--red-border)" : "1px solid var(--amber-border)"
              }}>
                <i className={`ti ${d.type === "consent" ? "ti-writing" : d.type === "id" ? "ti-id" : "ti-shield"}`} style={{ fontSize: 20, color: expired.includes(d) ? "var(--red)" : "var(--amber)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{d.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {d.name} · Expires {fmtDate(d.expiryDate)}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }}>
                  Renew
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>All Documents</TabButton>
          <TabButton active={activeTab === "consents"} onClick={() => setActiveTab("consents")}>Consents</TabButton>
          <TabButton active={activeTab === "id"} onClick={() => setActiveTab("id")}>ID Documents</TabButton>
          <TabButton active={activeTab === "insurance"} onClick={() => setActiveTab("insurance")}>Insurance Docs</TabButton>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Showing {activeTab === "all" ? documents.length : activeTab === "consents" ? consents.length : activeTab === "id" ? idDocs.length : insuranceDocs.length} documents
        </div>
        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
          <i className="ti ti-upload" style={{ fontSize: 14, marginRight: 4 }} />
          Upload Document
        </button>
      </div>

      {/* Documents List */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Document Name</th>
              <th>Type</th>
              <th>Upload Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(activeTab === "all" ? documents : activeTab === "consents" ? consents : activeTab === "id" ? idDocs : insuranceDocs).length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-files empty-state-icon" /><div className="empty-state-sub">No documents found</div></div></td></tr>
            ) : (activeTab === "all" ? documents : activeTab === "consents" ? consents : activeTab === "id" ? idDocs : insuranceDocs).map((d: any) => (
              <tr key={d.id} className="tbl-row">
                <td>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{d.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{d.patientId}</div>
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>{d.name}</td>
                <td>
                  <span className="badge" style={{
                    background: d.type === "consent" ? "var(--blue-bg)" : d.type === "id" ? "var(--green-bg)" : "var(--amber-bg)",
                    color: d.type === "consent" ? "var(--blue)" : d.type === "id" ? "var(--green)" : "var(--amber)",
                    border: d.type === "consent" ? "1px solid var(--blue-border)" : d.type === "id" ? "1px solid var(--green-border)" : "1px solid var(--amber-border)"
                  }}>
                    {d.type}
                  </span>
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(d.uploadDate)}</td>
                <td style={{ fontSize: "var(--font-sm)" }}>{d.expiryDate ? fmtDate(d.expiryDate) : "N/A"}</td>
                <td>
                  {d.signed ? (
                    <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }}>
                      <i className="ti ti-check" style={{ fontSize: 10 }} /> Signed
                    </span>
                  ) : (
                    <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
                      Pending
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>View</button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }}>Download</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Upload Document</div>
              <button className="btn-icon" onClick={() => setShowUploadModal(false)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
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
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Document Type</label>
                <select style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <option value="consent">Consent Form</option>
                  <option value="id">ID Document</option>
                  <option value="insurance">Insurance Document</option>
                  <option value="medical">Medical Record</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Document Name</label>
                <input type="text" placeholder="Enter document name..." style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>File</label>
                <input type="file" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Expiry Date (optional)</label>
                <input type="date" style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!selectedPatient}>Upload</button>
              </div>
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

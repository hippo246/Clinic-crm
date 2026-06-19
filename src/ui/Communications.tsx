import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

export default function CommunicationsPage({ patients }: { patients: Patient[] }) {
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messageType, setMessageType] = useState<"sms" | "email" | "whatsapp">("sms");
  const [messageText, setMessageText] = useState("");

  const communications = JSON.parse(localStorage.getItem("clinic_crm_communications") || "[]");
  const smsLogs = communications.filter((c: any) => c.type === "sms");
  const emailLogs = communications.filter((c: any) => c.type === "email");
  const callLogs = communications.filter((c: any) => c.type === "call");

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Communications
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          SMS/WhatsApp/email logs/calls, appointment reminders, follow-up messages, call history
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="SMS Sent" value={smsLogs.length} color="var(--blue)" icon="ti-message" bg="var(--blue-bg)" />
        <StatCard label="Emails Sent" value={emailLogs.length} color="var(--green)" icon="ti-mail" bg="var(--green-bg)" />
        <StatCard label="Calls Logged" value={callLogs.length} color="var(--amber)" icon="ti-phone" bg="var(--amber-bg)" />
        <StatCard label="Total" value={communications.length} color="var(--accent)" icon="ti-send" bg="var(--accent-soft)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Send Message */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-send" style={{ marginRight: 4 }} />
            Send Message
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
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Message Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setMessageType("sms")}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: messageType === "sms" ? "var(--accent-soft)" : "transparent",
                  color: messageType === "sms" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-sm)", cursor: "pointer"
                }}
              >
                <i className="ti ti-message" style={{ fontSize: 14, marginRight: 4 }} />
                SMS
              </button>
              <button
                onClick={() => setMessageType("email")}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: messageType === "email" ? "var(--accent-soft)" : "transparent",
                  color: messageType === "email" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-sm)", cursor: "pointer"
                }}
              >
                <i className="ti ti-mail" style={{ fontSize: 14, marginRight: 4 }} />
                Email
              </button>
              <button
                onClick={() => setMessageType("whatsapp")}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: messageType === "whatsapp" ? "var(--accent-soft)" : "transparent",
                  color: messageType === "whatsapp" ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-sm)", cursor: "pointer"
                }}
              >
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 14, marginRight: 4 }} />
                WhatsApp
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Message</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => { setMessageText(""); setSelectedPatient(null); }}>Clear</button>
            <button className="btn btn-primary" disabled={!selectedPatient || !messageText.trim()}>Send</button>
          </div>
        </div>

        {/* Quick Templates */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-template" style={{ marginRight: 4 }} />
            Quick Templates
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TemplateButton
              icon="ti-calendar-check"
              label="Appointment Reminder"
              template="Reminder: You have an appointment scheduled for {date} at {time}. Please arrive 15 minutes early."
              onClick={setMessageText}
            />
            <TemplateButton
              icon="ti-phone"
              label="Follow-up Call"
              template="Hi {name}, this is a follow-up call regarding your recent visit. How are you feeling?"
              onClick={setMessageText}
            />
            <TemplateButton
              icon="ti-pill"
              label="Medication Reminder"
              template="Reminder: Please take your medication as prescribed. Contact us if you have any questions."
              onClick={setMessageText}
            />
            <TemplateButton
              icon="ti-file-text"
              label="Lab Results Ready"
              template="Your lab results are ready. Please log in to view them or contact us for more details."
              onClick={setMessageText}
            />
            <TemplateButton
              icon="ti-receipt"
              label="Payment Reminder"
              template="Reminder: You have an outstanding balance of ${amount}. Please complete payment at your earliest convenience."
              onClick={setMessageText}
            />
          </div>
        </div>
      </div>

      {/* Communication Logs */}
      <div className="card card-padded">
        <div className="section-label" style={{ marginBottom: 12 }}>
          <i className="ti ti-history" style={{ marginRight: 4 }} />
          Communication History
        </div>
        {communications.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
            <i className="ti ti-message-off" style={{ fontSize: 32, marginBottom: 8 }} />
            <div>No communication history</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {communications.slice(0, 10).map((c: any) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: c.type === "sms" ? "var(--blue-bg)" : c.type === "email" ? "var(--green-bg)" : "var(--amber-bg)",
                  color: c.type === "sms" ? "var(--blue)" : c.type === "email" ? "var(--green)" : "var(--amber)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${c.type === "sms" ? "ti-message" : c.type === "email" ? "ti-mail" : "ti-brand-whatsapp"}`} style={{ fontSize: 16 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{c.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {c.message} · {fmtDate(c.date)} · {c.type.toUpperCase()}
                  </div>
                </div>
                <span className="badge" style={{
                  background: c.status === "sent" ? "var(--green-bg)" : "var(--amber-bg)",
                  color: c.status === "sent" ? "var(--green)" : "var(--amber)",
                  border: c.status === "sent" ? "1px solid var(--green-border)" : "1px solid var(--amber-border)"
                }}>
                  {c.status}
                </span>
              </div>
            ))}
            {communications.length > 10 && (
              <div style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--muted)", padding: 8 }}>
                +{communications.length - 10} more communications
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateButton({ icon, label, template, onClick }: {
  icon: string;
  label: string;
  template: string;
  onClick: (t: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(template)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)",
        border: "none", cursor: "pointer", textAlign: "left",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface3)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16, color: "var(--accent)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{template}</div>
      </div>
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

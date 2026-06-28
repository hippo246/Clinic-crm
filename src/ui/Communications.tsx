import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

export default function CommunicationsPage({ patients }: { patients: Patient[] }) {
  const [activeTab, setActiveTab] = useState<"compose" | "templates" | "history" | "automation">("compose");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messageType, setMessageType] = useState<"sms" | "email" | "whatsapp">("sms");
  const [messageText, setMessageText] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [communications, setCommunications] = useState<any[]>(() =>
    JSON.parse(localStorage.getItem("clinic_crm_communications") || "[]")
  );
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const saveCommunication = (entry: any) => {
    const next = [...communications, entry];
    localStorage.setItem("clinic_crm_communications", JSON.stringify(next));
    setCommunications(next);
  };

  const smsLogs = communications.filter((c: any) => c.type === "sms");
  const emailLogs = communications.filter((c: any) => c.type === "email");
  const callLogs = communications.filter((c: any) => c.type === "call");
  const scheduledMessages = communications.filter((c: any) => c.scheduledDate && new Date(c.scheduledDate) > new Date());
  const visibleHistory = historyExpanded ? communications : communications.slice(0, 10);

  return (
    <div style={{ padding: "clamp(12px, 4vw, 24px)", maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Communications
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Send SMS, email &amp; WhatsApp · log calls · schedule reminders
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="SMS Sent" value={smsLogs.length} color="var(--blue)" icon="ti-message" bg="var(--blue-bg)" />
        <StatCard label="Emails Sent" value={emailLogs.length} color="var(--green)" icon="ti-mail" bg="var(--green-bg)" />
        <StatCard label="Calls Logged" value={callLogs.length} color="var(--amber)" icon="ti-phone" bg="var(--amber-bg)" />
        <StatCard label="Scheduled" value={scheduledMessages.length} color="var(--purple)" icon="ti-clock" bg="var(--purple-bg)" />
        <StatCard label="Total" value={communications.length} color="var(--accent)" icon="ti-send" bg="var(--accent-soft)" />
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <TabButton active={activeTab === "compose"} onClick={() => setActiveTab("compose")}>Compose</TabButton>
          <TabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")}>Templates</TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>History</TabButton>
          <TabButton active={activeTab === "automation"} onClick={() => setActiveTab("automation")}>Automation</TabButton>
        </div>
      </div>

      {activeTab === "compose" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 16, marginBottom: 24 }}>
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
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const }}
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
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Schedule (Optional)</label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => { setMessageText(""); setSelectedPatient(null); setScheduledDate(""); }}>Clear</button>
            <button
              className="btn btn-primary"
              disabled={!selectedPatient || !messageText.trim()}
              onClick={() => {
                if (!selectedPatient || !messageText.trim()) return;
                const entry = {
                  id: Date.now().toString(),
                  patientId: selectedPatient.id,
                  patientName: selectedPatient.name,
                  type: messageType,
                  message: messageText.trim(),
                  status: scheduledDate ? "scheduled" : "sent",
                  date: new Date().toISOString(),
                  scheduledDate: scheduledDate || null,
                };
                saveCommunication(entry);
                setMessageText("");
                setSelectedPatient(null);
                setScheduledDate("");
              }}
            >
              {scheduledDate ? "Schedule" : "Send"}
            </button>
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
      )}

      {activeTab === "templates" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-template" style={{ marginRight: 4 }} />
            Message Templates
          </div>
          <p style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
            Tap a template to use it — it will be loaded into the Compose tab.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TemplateButton icon="ti-calendar-check" label="Appointment Reminder"
              template="Reminder: You have an appointment scheduled for {date} at {time}. Please arrive 15 minutes early."
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
            <TemplateButton icon="ti-phone" label="Follow-up Call"
              template="Hi {name}, this is a follow-up call regarding your recent visit. How are you feeling?"
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
            <TemplateButton icon="ti-pill" label="Medication Reminder"
              template="Reminder: Please take your medication as prescribed. Contact us if you have any questions."
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
            <TemplateButton icon="ti-file-text" label="Lab Results Ready"
              template="Your lab results are ready. Please log in to view them or contact us for more details."
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
            <TemplateButton icon="ti-receipt" label="Payment Reminder"
              template="Reminder: You have an outstanding balance of ${amount}. Please complete payment at your earliest convenience."
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
            <TemplateButton icon="ti-heart" label="Post-Visit Thank You"
              template="Thank you for visiting us, {name}. We hope you're feeling well. Don't hesitate to reach out if you need anything."
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
            <TemplateButton icon="ti-alert-circle" label="Missed Appointment"
              template="Hi {name}, we noticed you missed your appointment. Please call us to reschedule at your earliest convenience."
              onClick={(t) => { setMessageText(t); setActiveTab("compose"); }} />
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
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
            {visibleHistory.map((c: any) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)"
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: c.type === "sms" ? "var(--blue-bg)" : c.type === "email" ? "var(--green-bg)" : "var(--amber-bg)",
                  color: c.type === "sms" ? "var(--blue)" : c.type === "email" ? "var(--green)" : "var(--amber)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${c.type === "sms" ? "ti-message" : c.type === "email" ? "ti-mail" : "ti-brand-whatsapp"}`} style={{ fontSize: 15 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{c.patientName}</span>
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{c.type.toUpperCase()} · {fmtDate(c.date)}</span>
                  </div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.message}
                  </div>
                </div>
                <span className="badge" style={{
                  flexShrink: 0,
                  background: c.status === "sent" ? "var(--green-bg)" : c.status === "scheduled" ? "var(--purple-bg)" : "var(--amber-bg)",
                  color: c.status === "sent" ? "var(--green)" : c.status === "scheduled" ? "var(--purple)" : "var(--amber)",
                  border: c.status === "sent" ? "1px solid var(--green-border)" : c.status === "scheduled" ? "1px solid var(--purple-border)" : "1px solid var(--amber-border)"
                }}>
                  {c.status}
                </span>
              </div>
            ))}
            {communications.length > 10 && (
              <button
                onClick={() => setHistoryExpanded(e => !e)}
                style={{ width: "100%", padding: "10px 0", background: "none", border: "1px dashed var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontSize: "var(--font-xs)", color: "var(--muted)" }}
              >
                {historyExpanded ? "Show less" : `Show ${communications.length - 10} more`}
              </button>
            )}
          </div>
        )}
        </div>
      )}

      {activeTab === "automation" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-robot" style={{ marginRight: 4 }} />
            Automated Reminders
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AutomationRule
              title="Appointment Reminders"
              description="Send SMS reminder 24 hours before appointment"
              enabled
              type="sms"
            />
            <AutomationRule
              title="Follow-up Reminders"
              description="Send follow-up message 7 days after visit"
              enabled={false}
              type="email"
            />
            <AutomationRule
              title="Lab Result Notifications"
              description="Notify patient when lab results are ready"
              enabled
              type="sms"
            />
            <AutomationRule
              title="Payment Reminders"
              description="Send payment reminder 3 days before due date"
              enabled={false}
              type="email"
            />
          </div>
        </div>
      )}
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
        border: "none", cursor: "pointer", textAlign: "left", width: "100%",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface3)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16, color: "var(--accent)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{template}</div>
      </div>
      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--muted)", flexShrink: 0 }} />
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
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function AutomationRule({ title, description, enabled: initialEnabled, type }: {
  title: string;
  description: string;
  enabled: boolean;
  type: "sms" | "email";
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)",
      border: "1px solid var(--border)"
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: type === "sms" ? "var(--blue-bg)" : "var(--green-bg)",
        color: type === "sms" ? "var(--blue)" : "var(--green)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ${type === "sms" ? "ti-message" : "ti-mail"}`} style={{ fontSize: 16 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{description}</div>
      </div>
      <div
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled(e => !e)}
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: enabled ? "var(--green)" : "var(--gray)",
          position: "relative", cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "#fff",
          position: "absolute", top: 2,
          left: enabled ? 22 : 2,
          transition: "left 0.15s",
        }} />
      </div>
    </div>
  );
}

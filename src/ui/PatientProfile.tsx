import React, { useState, useCallback } from "react";
import type { Patient, AuditEntry, UserRole, TimelineEvent, PatientNote, PatientDocument } from "./types";
import {
  fmtDate, getAvatarColor, getInitials, calcRiskScore,
  calcVisitReadiness, calcNextBestAction, buildSmartSnapshot,
  createAuditEntry,
} from "./utils";
import { QUICK_ACTIONS, ALERT_SEVERITY, CONSENT_TYPES } from "./constants";
import {
  StatusBadge, AlertChip, InsuranceBadge, BloodGroupBadge,
  RiskBadge, AvatarCircle, VerifiedDot, ConsentBadge,
} from "./Badges";
import { can } from "./constants";

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const PROFILE_TABS = [
  { id: "overview",  label: "Overview",   icon: "ti-layout-dashboard" },
  { id: "timeline",  label: "Timeline",   icon: "ti-timeline" },
  { id: "documents", label: "Documents",  icon: "ti-files" },
  { id: "notes",     label: "Notes",      icon: "ti-notes" },
  { id: "followup",  label: "Follow-Up",  icon: "ti-phone" },
  { id: "consents",  label: "Consents",   icon: "ti-writing" },
  { id: "audit",     label: "Audit Log",  icon: "ti-history" },
] as const;

type TabId = typeof PROFILE_TABS[number]["id"];

// ─── Props ────────────────────────────────────────────────────────────────────
interface PatientProfileProps {
  patient: Patient;
  auditEntries: AuditEntry[];
  onBack: () => void;
  onEditPatient: () => void;
  onUpdatePatient: (p: Patient, action?: string) => void;
  onDeletePatient: (id: string) => void;
  role: UserRole;
}

export default function PatientProfile({
  patient,
  auditEntries,
  onBack,
  onEditPatient,
  onUpdatePatient,
  onDeletePatient,
  role,
}: PatientProfileProps) {
  const [tab,          setTab]          = useState<TabId>("overview");
  const [showEmergency,setShowEmergency] = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [quickAction,  setQuickAction]  = useState<string | null>(null);

  const nba  = calcNextBestAction(patient);
  const risk = calcRiskScore(patient);
  const readiness = calcVisitReadiness(patient);
  const snapshot  = buildSmartSnapshot(patient);
  const avatarBg  = getAvatarColor(patient.name);

  function handleVerificationToggle(key: string) {
    const updated = { ...patient, [key]: !patient[key as keyof Patient] };
    onUpdatePatient(updated as Patient, "verification updated");
  }

  function handleAddTimelineEvent(event: Omit<TimelineEvent, "id">) {
    const newEvent: TimelineEvent = {
      ...event,
      id: `tl-${Date.now()}`,
    };
    onUpdatePatient(
      { ...patient, timeline: [...(patient.timeline || []), newEvent] },
      "timeline event added",
    );
  }

  function handleDeleteTimelineEvent(id: string) {
    onUpdatePatient(
      { ...patient, timeline: (patient.timeline || []).filter((e) => e.id !== id) },
      "timeline event deleted",
    );
  }

  function handleAddNote(note: Omit<PatientNote, "id">) {
    const newNote: PatientNote = { ...note, id: `note-${Date.now()}` };
    onUpdatePatient(
      { ...patient, notes: [...(patient.notes || []), newNote] },
      "note added",
    );
  }

  function handleDeleteNote(id: string) {
    onUpdatePatient(
      { ...patient, notes: (patient.notes || []).filter((n) => n.id !== id) },
      "note deleted",
    );
  }

  function handleToggleNotePin(id: string) {
    onUpdatePatient({
      ...patient,
      notes: (patient.notes || []).map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n),
    }, "note pinned");
  }

  function handleAddDocument(doc: Omit<PatientDocument, "id">) {
    const newDoc: PatientDocument = { ...doc, id: `doc-${Date.now()}` };
    onUpdatePatient(
      { ...patient, documents: [...(patient.documents || []), newDoc] },
      "document added",
    );
  }

  function handleDeleteDocument(id: string) {
    onUpdatePatient(
      { ...patient, documents: (patient.documents || []).filter((d) => d.id !== id) },
      "document deleted",
    );
  }

  function handleToggleConsent(key: string) {
    const consents = { ...(patient.consents || {}), [key]: !(patient.consents || {})[key] };
    const allSigned = CONSENT_TYPES.every((c) => consents[c.key]);
    onUpdatePatient({ ...patient, consents, consentSigned: allSigned }, "consent updated");
  }

  function handleUpdateFollowUp(updates: Partial<Patient>) {
    onUpdatePatient({ ...patient, ...updates }, "follow-up updated");
  }

  const tabCounts: Partial<Record<TabId, number>> = {
    timeline:  (patient.timeline  || []).length,
    documents: (patient.documents || []).length,
    notes:     (patient.notes     || []).length,
    audit:     auditEntries.length,
    followup:  patient.followUpDate ? 1 : 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── Header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {/* Critical alert banner */}
        {(patient.alerts || []).some((a) => ALERT_SEVERITY[a as keyof typeof ALERT_SEVERITY] === "critical") && (
          <div style={{
            background: "var(--red-bg)", borderBottom: "2px solid var(--red)",
            padding: "8px 16px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "var(--red)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 12, color: "#fff" }} />
            </div>
            <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "#991b1b", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Critical Medical Alert
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(patient.alerts || [])
                .filter((a) => ALERT_SEVERITY[a as keyof typeof ALERT_SEVERITY] === "critical")
                .map((a) => (
                  <span key={a} style={{
                    padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--red)",
                    color: "#fff", fontSize: "var(--font-xs)", fontWeight: 700,
                  }}>{a}</span>
                ))}
            </div>
            <span style={{ marginLeft: "auto", fontSize: "var(--font-xs)", color: "#991b1b" }}>
              Review before proceeding
            </span>
          </div>
        )}

        {/* Identity row */}
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button className="btn btn-ghost" onClick={onBack} style={{ padding: "6px 10px", fontSize: "var(--font-sm)", flexShrink: 0 }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
            <span className="desktop-only">Back</span>
          </button>

          {/* Avatar */}
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: avatarBg + "22", color: avatarBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800,
          }}>
            {getInitials(patient.name)}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: "var(--text)", margin: 0 }}>
                {patient.name}
              </h2>
              <StatusBadge status={patient.status} />
              <RiskBadge patient={patient} />
              {patient.status === "VIP" && (
                <span className="badge" style={{ background: "#fff7ed", color: "#92400e", border: "1px solid #f97316" }}>
                  <i className="ti ti-crown" style={{ fontSize: 10 }} /> VIP
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              {[
                { label: "ID",      value: patient.id,           icon: "ti-id" },
                { label: "Age",     value: `${patient.age}y · ${patient.gender}`, icon: "ti-user" },
                { label: "DOB",     value: fmtDate(patient.dob), icon: "ti-calendar" },
                { label: "Blood",   value: patient.bloodGroup,   icon: "ti-droplet" },
                { label: "Doctor",  value: patient.doctor,       icon: "ti-stethoscope" },
              ].map(({ label, value, icon }) => (
                <span key={label} style={{ fontSize: "var(--font-xs)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 11 }} />
                  <strong style={{ color: "var(--text)" }}>{value}</strong>
                </span>
              ))}
            </div>

            {/* Alert chips */}
            {(patient.alerts || []).length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                {(patient.alerts || []).map((a) => <AlertChip key={a} alert={a} />)}
              </div>
            )}
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setShowEmergency(true)} style={{ fontSize: "var(--font-sm)" }}>
              <i className="ti ti-emergency-bed" style={{ fontSize: 14, color: "var(--red)" }} />
              <span className="desktop-only">Emergency</span>
            </button>
            {can(role, "editPatient") && (
              <button className="btn btn-primary" onClick={onEditPatient} style={{ fontSize: "var(--font-sm)" }}>
                <i className="ti ti-edit" style={{ fontSize: 14 }} />
                <span className="desktop-only">Edit</span>
              </button>
            )}
            {can(role, "deletePatient") && (
              <button className="btn btn-danger" onClick={() => setShowDelete(true)} style={{ fontSize: "var(--font-sm)" }}>
                <i className="ti ti-trash" style={{ fontSize: 14 }} />
              </button>
            )}
          </div>
        </div>

        {/* NBA bar */}
        {nba.urgency !== "none" && (
          <div style={{
            margin: "0 16px 10px",
            padding: "8px 12px", borderRadius: "var(--radius)",
            background: nba.bg, border: `1px solid ${nba.color}30`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <i className={`ti ${nba.icon}`} style={{ fontSize: 15, color: nba.color, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: nba.color }}>
                {nba.label}
              </span>
              <span style={{ fontSize: "var(--font-xs)", color: nba.color + "cc", marginLeft: 8 }}>
                {nba.detail}
              </span>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ padding: "0 16px", display: "flex", gap: 2, overflowX: "auto" }}>
          {PROFILE_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 12px", borderRadius: "var(--radius) var(--radius) 0 0",
                border: "1px solid transparent", borderBottom: "none",
                fontSize: "var(--font-sm)", fontWeight: tab === id ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                color:      tab === id ? "var(--accent)" : "var(--muted)",
                background: tab === id ? "var(--bg)" : "transparent",
                marginBottom: tab === id ? -1 : 0,
                borderColor: tab === id ? "var(--border)" : "transparent",
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
              {label}
              {tabCounts[id] !== undefined && tabCounts[id]! > 0 && (
                <span style={{
                  fontSize: "var(--font-2xs)", fontWeight: 700, padding: "1px 5px",
                  borderRadius: "var(--radius-full)",
                  background: tab === id ? "var(--accent-soft)" : "var(--surface3)",
                  color: tab === id ? "var(--accent)" : "var(--muted)",
                }}>
                  {tabCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        <div className="fade-in" key={tab} style={{ padding: 16 }}>
          {tab === "overview"  && <OverviewTab patient={patient} role={role} onVerificationToggle={handleVerificationToggle} snapshot={snapshot} readiness={readiness} onQuickAction={setQuickAction} />}
          {tab === "timeline"  && <TimelineTab patient={patient} role={role} onAddEvent={handleAddTimelineEvent} onDeleteEvent={handleDeleteTimelineEvent} />}
          {tab === "documents" && <DocumentsTab patient={patient} role={role} onAddDoc={handleAddDocument} onDeleteDoc={handleDeleteDocument} />}
          {tab === "notes"     && <NotesTab patient={patient} role={role} onAddNote={handleAddNote} onDeleteNote={handleDeleteNote} onTogglePin={handleToggleNotePin} />}
          {tab === "followup"  && <FollowUpTab patient={patient} onUpdate={handleUpdateFollowUp} />}
          {tab === "consents"  && <ConsentsTab patient={patient} onToggle={handleToggleConsent} />}
          {tab === "audit"     && <AuditTab entries={auditEntries} />}
        </div>
      </div>

      {/* ── Modals ── */}
      {showEmergency && <EmergencyModal patient={patient} onClose={() => setShowEmergency(false)} />}
      {showDelete && (
        <ConfirmDeleteModal
          patient={patient}
          onConfirm={() => { onDeletePatient(patient.id); setShowDelete(false); }}
          onClose={() => setShowDelete(false)}
        />
      )}
      {quickAction && (
        <QuickActionModal action={quickAction} patient={patient} onClose={() => setQuickAction(null)} />
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({
  patient, role, onVerificationToggle, snapshot, readiness, onQuickAction
}: {
  patient: Patient;
  role: UserRole;
  onVerificationToggle: (key: string) => void;
  snapshot: string;
  readiness: ReturnType<typeof calcVisitReadiness>;
  onQuickAction: (a: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
      {/* Main col */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Snapshot */}
        <div className="card card-padded" style={{
          background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)",
          border: "1px solid var(--accent)30",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="ti ti-sparkles" style={{ fontSize: 16, color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                AI Snapshot
              </div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--text)", lineHeight: 1.6 }}>
                {snapshot}
              </p>
            </div>
          </div>
        </div>

        {/* Demographics */}
        <InfoCard title="Demographics" icon="ti-user" iconBg="var(--blue-bg)" iconColor="var(--blue)">
          <InfoGrid cols={2} rows={[
            ["Full Name",       patient.name],
            ["Date of Birth",   fmtDate(patient.dob)],
            ["Age",             `${patient.age} years`],
            ["Gender",          patient.gender],
            ["Blood Group",     patient.bloodGroup],
            ["Nationality",     patient.nationality],
            ["Phone",           patient.phone],
            ["Email",           patient.email],
            ["Address",         patient.address],
          ]} />
        </InfoCard>

        {/* Emergency Contact */}
        <InfoCard title="Emergency Contact" icon="ti-phone-call" iconBg="#fce7f3" iconColor="#9d174d">
          {patient.emergencyName ? (
            <InfoGrid cols={2} rows={[
              ["Name",        patient.emergencyName],
              ["Relation",    patient.emergencyRelation || "—"],
              ["Phone",       patient.emergencyPhone],
            ]} />
          ) : (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <i className="ti ti-phone-off empty-state-icon" style={{ fontSize: 24 }} />
              <div className="empty-state-sub">No emergency contact on file</div>
            </div>
          )}
        </InfoCard>

        {/* Medical (role-gated) */}
        {can(role, "viewMedical") && (
          <InfoCard title="Medical Information" icon="ti-heart-rate-monitor" iconBg="var(--red-bg)" iconColor="var(--red)">
            <InfoGrid cols={2} rows={[
              ["Allergies",    patient.allergies || "None known"],
              ["Blood Group",  patient.bloodGroup],
              ["Conditions",   (patient.conditions || []).join(", ") || "None"],
              ["Medications",  (patient.medications || []).join(", ") || "None"],
            ]} />
          </InfoCard>
        )}

        {/* Insurance */}
        {can(role, "viewBilling") && (
          <InfoCard title="Insurance" icon="ti-shield" iconBg="var(--green-bg)" iconColor="var(--green)">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <InsuranceBadge status={patient.insuranceStatus} />
            </div>
            {patient.insurer !== "None" ? (
              <InfoGrid cols={2} rows={[
                ["Provider",       patient.insurer],
                ["Policy Number",  patient.policyNumber || "—"],
                ["Expiry",         fmtDate(patient.insuranceExpiry)],
              ]} />
            ) : (
              <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>No insurance on file</p>
            )}
          </InfoCard>
        )}

        {/* Quick Actions */}
        <InfoCard title="Quick Actions" icon="ti-bolt" iconBg="var(--purple-bg)" iconColor="var(--purple)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} onClick={() => onQuickAction(a.label)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "12px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface3)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: "var(--radius)",
                  background: a.color + "15", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${a.icon}`} style={{ fontSize: 16, color: a.color }} />
                </div>
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </InfoCard>
      </div>

      {/* Side col */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0 }}>

        {/* Visit Readiness */}
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Visit Readiness</span>
            <span style={{
              fontSize: "var(--font-xs)", fontWeight: 700,
              color: readiness.ready ? "var(--green)" : "var(--amber)",
              background: readiness.ready ? "var(--green-bg)" : "var(--amber-bg)",
              padding: "2px 6px", borderRadius: "var(--radius-sm)",
            }}>
              {readiness.done}/{readiness.total}
            </span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 10 }}>
            <div className="progress-fill" style={{
              width: `${(readiness.done / readiness.total) * 100}%`,
              background: readiness.ready ? "var(--green)" : "var(--amber)",
            }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {readiness.items.map((item) => (
              <button key={item.key} onClick={() => onVerificationToggle(item.key)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                borderRadius: "var(--radius-sm)", border: `1px solid ${item.done ? "var(--green-border)" : "var(--red-border)"}`,
                background: item.done ? "var(--green-bg)" : "transparent",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <VerifiedDot done={item.done} />
                <span style={{ fontSize: "var(--font-xs)", color: item.done ? "var(--green)" : "var(--text)" }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Appointments */}
        <div className="card card-padded">
          <div className="section-label">Appointments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Last Visit</span>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{fmtDate(patient.lastVisit)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Next Appointment</span>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                {patient.nextAppointment ? fmtDate(patient.nextAppointment) : (
                  <span style={{ color: "var(--amber)", fontSize: "var(--font-xs)" }}>Not scheduled</span>
                )}
              </span>
            </div>
            {patient.followUpDate && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Follow-Up Due</span>
                <span style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--amber)" }}>
                  {fmtDate(patient.followUpDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Family */}
        {(patient.family || []).length > 0 && (
          <div className="card card-padded">
            <div className="section-label">Family Members</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(patient.family || []).map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--radius-sm)", background: "var(--surface2)" }}>
                  <AvatarCircle name={f.name} size="sm" />
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{f.relation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pinned notes */}
        {(patient.notes || []).filter((n) => n.pinned).length > 0 && (
          <div className="card card-padded">
            <div className="section-label">
              <i className="ti ti-pin" style={{ fontSize: 10, marginRight: 4 }} />
              Pinned Notes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(patient.notes || []).filter((n) => n.pinned).map((n) => (
                <div key={n.id} style={{
                  padding: "8px 10px", borderRadius: "var(--radius-sm)",
                  background: "#fffbeb", border: "1px solid var(--amber-border)",
                  fontSize: "var(--font-xs)", color: "#92400e",
                }}>
                  {n.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────
function TimelineTab({
  patient, role, onAddEvent, onDeleteEvent,
}: {
  patient: Patient;
  role: UserRole;
  onAddEvent: (e: Omit<TimelineEvent, "id">) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "note", label: "Doctor Note Added", icon: "ti-notes", color: "#7c4fff", note: "", date: new Date().toISOString().split("T")[0], doctor: "" });

  const events = [...(patient.timeline || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  function submit() {
    onAddEvent({ ...form, date: new Date(form.date) });
    setShowForm(false);
    setForm({ type: "note", label: "Doctor Note Added", icon: "ti-notes", color: "#7c4fff", note: "", date: new Date().toISOString().split("T")[0], doctor: "" });
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Clinical Timeline</span>
        {can(role, "editPatient") && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(true)}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Add Event
          </button>
        )}
      </div>

      {showForm && (
        <div className="card card-padded" style={{ marginBottom: 16, border: "1px solid var(--accent)40" }}>
          <div className="section-label">New Timeline Event</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field-group">
              <label className="field-label">Type</label>
              <select value={form.type} onChange={(e) => {
                const types: Record<string, { label: string; icon: string; color: string }> = {
                  note:         { label: "Doctor Note Added",      icon: "ti-notes",          color: "#7c4fff" },
                  appointment:  { label: "Appointment Booked",     icon: "ti-calendar",       color: "#7c4fff" },
                  consultation: { label: "Consultation Completed", icon: "ti-stethoscope",    color: "#00b4a0" },
                  prescription: { label: "Prescription Issued",    icon: "ti-pill",           color: "#ff7c4f" },
                  report:       { label: "Report Uploaded",        icon: "ti-file-analytics", color: "#4f7cff" },
                  followup:     { label: "Follow-Up Scheduled",    icon: "ti-clock",          color: "#f0a500" },
                };
                const t = types[e.target.value] || types.note;
                setForm((f) => ({ ...f, type: e.target.value, ...t }));
              }} style={{ width: "100%" }}>
                <option value="note">Doctor Note</option>
                <option value="appointment">Appointment</option>
                <option value="consultation">Consultation</option>
                <option value="prescription">Prescription</option>
                <option value="report">Report</option>
                <option value="followup">Follow-Up</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Doctor</label>
              <input type="text" value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))} placeholder="Dr. Name" style={{ width: "100%" }} />
            </div>
            <div className="field-group">
              <label className="field-label">Note</label>
              <input type="text" value={form.note || ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional note" style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={submit}>Add Event</button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-timeline empty-state-icon" />
          <div className="empty-state-text">No timeline events</div>
          <div className="empty-state-sub">Add events to track the patient's clinical history</div>
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 20 }}>
          <div className="timeline-line" />
          {events.map((ev, idx) => (
            <div key={ev.id} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
              <div className="timeline-dot" style={{ background: ev.color + "20" }}>
                <i className={`ti ${ev.icon}`} style={{ fontSize: 13, color: ev.color }} />
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{ev.label}</span>
                    {ev.doctor && (
                      <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginLeft: 6 }}>
                        · {ev.doctor}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      {fmtDate(ev.date)}
                    </span>
                    {can(role, "editPatient") && (
                      <button className="btn-icon" style={{ padding: 4 }} onClick={() => onDeleteEvent(ev.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                      </button>
                    )}
                  </div>
                </div>
                {ev.note && (
                  <p style={{
                    fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 4,
                    padding: "6px 10px", background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${ev.color}`,
                  }}>
                    {ev.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
function DocumentsTab({
  patient, role, onAddDoc, onDeleteDoc,
}: {
  patient: Patient;
  role: UserRole;
  onAddDoc: (d: Omit<PatientDocument, "id">) => void;
  onDeleteDoc: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "Medical Report", uploaded: new Date().toISOString().split("T")[0], size: "—", verified: false });

  const DOC_ICONS: Record<string, string> = {
    "Insurance Card": "ti-shield", "Passport": "ti-passport", "National ID": "ti-id",
    "Consent Form": "ti-writing", "Medical Report": "ti-file-analytics", "Referral Letter": "ti-file-text",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Documents</span>
        {can(role, "editPatient") && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(true)}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Document
          </button>
        )}
      </div>

      {showForm && (
        <div className="card card-padded" style={{ marginBottom: 16, border: "1px solid var(--accent)40" }}>
          <div className="section-label">New Document</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field-group">
              <label className="field-label">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ width: "100%" }}>
                {["Insurance Card","Passport","National ID","Consent Form","Medical Report","Referral Letter"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Upload Date</label>
              <input type="date" value={form.uploaded} onChange={(e) => setForm((f) => ({ ...f, uploaded: e.target.value }))} style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => { onAddDoc(form); setShowForm(false); }}>
              Add
            </button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {(patient.documents || []).length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-files empty-state-icon" />
          <div className="empty-state-text">No documents</div>
          <div className="empty-state-sub">Upload patient documents for this record</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {(patient.documents || []).map((doc) => (
            <div key={doc.id} className="card card-padded" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius)",
                background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <i className={`ti ${DOC_ICONS[doc.type] || "ti-file"}`} style={{ fontSize: 16, color: "var(--accent)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>{doc.type}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>
                  {fmtDate(doc.uploaded)} · {doc.size}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span className="tag" style={{ background: doc.verified ? "var(--green-bg)" : "var(--amber-bg)", color: doc.verified ? "var(--green)" : "var(--amber)" }}>
                    <i className={`ti ${doc.verified ? "ti-shield-check" : "ti-shield-exclamation"}`} style={{ fontSize: 10 }} />
                    {doc.verified ? "Verified" : "Pending"}
                  </span>
                  {can(role, "deleteDocument") && (
                    <button className="btn-icon" style={{ padding: 3, marginLeft: "auto" }} onClick={() => onDeleteDoc(doc.id)}>
                      <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({
  patient, role, onAddNote, onDeleteNote, onTogglePin,
}: {
  patient: Patient;
  role: UserRole;
  onAddNote: (n: Omit<PatientNote, "id">) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [text,     setText]     = useState("");
  const [category, setCategory] = useState("general");

  const CATEGORIES = [
    { id: "general",   label: "General",   color: "var(--muted)" },
    { id: "clinical",  label: "Clinical",  color: "var(--red)" },
    { id: "billing",   label: "Billing",   color: "var(--amber)" },
    { id: "followup",  label: "Follow-Up", color: "var(--blue)" },
  ];

  const notes = [...(patient.notes || [])].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  function submit() {
    if (!text.trim()) return;
    onAddNote({ text: text.trim(), pinned: false, date: new Date().toISOString().split("T")[0], category });
    setText("");
    setShowForm(false);
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Notes</span>
        {can(role, "editPatient") && (
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(true)}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Note
          </button>
        )}
      </div>

      {showForm && (
        <div className="card card-padded" style={{ marginBottom: 16, border: "1px solid var(--accent)40" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "var(--font-xs)", fontWeight: 600,
                border: `1px solid ${category === c.id ? c.color : "var(--border)"}`,
                background: category === c.id ? c.color + "15" : "transparent",
                color: category === c.id ? c.color : "var(--muted)", cursor: "pointer",
              }}>{c.label}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Write a note…" rows={3}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={submit}>Save Note</button>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-notes empty-state-icon" />
          <div className="empty-state-text">No notes yet</div>
          <div className="empty-state-sub">Add notes to track important information</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => {
            const cat = CATEGORIES.find((c) => c.id === n.category) || CATEGORIES[0];
            return (
              <div key={n.id} className="card card-padded" style={{
                border: n.pinned ? "1px solid var(--amber-border)" : "1px solid var(--border)",
                background: n.pinned ? "var(--amber-bg)" : "var(--surface)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--text)", lineHeight: 1.6, flex: 1 }}>{n.text}</p>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button className="btn-icon" style={{ padding: 4 }} onClick={() => onTogglePin(n.id)}>
                      <i className={`ti ${n.pinned ? "ti-pin-filled" : "ti-pin"}`} style={{ fontSize: 12, color: n.pinned ? "var(--amber)" : "var(--muted)" }} />
                    </button>
                    {can(role, "editPatient") && (
                      <button className="btn-icon" style={{ padding: 4 }} onClick={() => onDeleteNote(n.id)}>
                        <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span className="tag" style={{ background: cat.color + "15", color: cat.color }}>
                    {cat.label}
                  </span>
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {fmtDate(n.date)}
                    {n.author && ` · ${n.author}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Follow-Up Tab ─────────────────────────────────────────────────────────────
function FollowUpTab({ patient, onUpdate }: { patient: Patient; onUpdate: (u: Partial<Patient>) => void }) {
  const [notes,   setNotes]   = useState(patient.followUpNotes || "");
  const [status,  setStatus]  = useState(patient.followUpStatus || "Pending");
  const [saved,   setSaved]   = useState(false);

  function save() {
    onUpdate({
      followUpStatus:   status as any,
      followUpNotes:    notes,
      lastContacted:    new Date().toISOString().split("T")[0],
      callAttempts:     (patient.callAttempts || 0) + 1,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function logCall() {
    onUpdate({
      callAttempts:  (patient.callAttempts || 0) + 1,
      lastContacted: new Date().toISOString().split("T")[0],
      followUpStatus: "Called" as any,
    });
  }

  if (!patient.followUpDate) {
    return (
      <div className="empty-state">
        <i className="ti ti-phone empty-state-icon" />
        <div className="empty-state-text">No follow-up scheduled</div>
        <div className="empty-state-sub">Follow-up information will appear here when scheduled</div>
      </div>
    );
  }

  const STATUS_OPTIONS = [
    { id: "Pending",   label: "Pending",   color: "#d97706" },
    { id: "Called",    label: "Called",    color: "#2563eb" },
    { id: "No Answer", label: "No Answer", color: "#dc2626" },
    { id: "Completed", label: "Completed", color: "#16a34a" },
  ];
  const current = STATUS_OPTIONS.find((s) => s.id === status) || STATUS_OPTIONS[0];

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 4 }} />Follow-Up Date</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmtDate(patient.followUpDate)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="ti ti-phone" style={{ fontSize: 11, marginRight: 4 }} />Call Attempts</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{patient.callAttempts || 0}</div>
        </div>
        {patient.followUpReason && (
          <div className="stat-card" style={{ gridColumn: "1 / -1" }}>
            <div className="stat-label">Reason</div>
            <div style={{ fontSize: "var(--font-sm)", marginTop: 4 }}>{patient.followUpReason}</div>
          </div>
        )}
      </div>

      <div className="card card-padded">
        <div className="section-label">Status</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {STATUS_OPTIONS.map((s) => (
            <button key={s.id} onClick={() => setStatus(s.id)} style={{
              flex: 1, padding: "8px 12px", borderRadius: "var(--radius)",
              border: `2px solid ${status === s.id ? s.color : "var(--border)"}`,
              background: status === s.id ? s.color + "12" : "transparent",
              color: status === s.id ? s.color : "var(--muted)",
              fontWeight: status === s.id ? 700 : 500, fontSize: "var(--font-sm)", cursor: "pointer",
            }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="field-group" style={{ marginBottom: 12 }}>
          <label className="field-label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Add follow-up notes…" rows={4}
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        {patient.lastContacted && (
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 12 }}>
            Last contacted: {fmtDate(patient.lastContacted)}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={save}>
            <i className="ti ti-device-floppy" style={{ fontSize: 13 }} />
            {saved ? "Saved!" : "Save"}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={logCall}>
            <i className="ti ti-phone" style={{ fontSize: 13 }} />
            Log Call
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Consents Tab ─────────────────────────────────────────────────────────────
function ConsentsTab({ patient, onToggle }: { patient: Patient; onToggle: (key: string) => void }) {
  const consents = patient.consents || {};
  const total  = CONSENT_TYPES.length;
  const signed = CONSENT_TYPES.filter((c) => consents[c.key]).length;
  const allOK  = signed === total;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-label">Signed</div>
          <div className="stat-value" style={{ color: allOK ? "var(--green)" : "var(--amber)" }}>{signed}/{total}</div>
        </div>
        <div style={{ flex: 2 }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(signed / total) * 100}%`, background: allOK ? "var(--green)" : "var(--amber)" }} />
          </div>
          <p style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 6 }}>
            {allOK ? "All consents collected — patient ready to proceed" : `${total - signed} consent${total - signed > 1 ? "s" : ""} still required`}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CONSENT_TYPES.map((c) => {
          const done = !!consents[c.key];
          return (
            <button key={c.key} onClick={() => onToggle(c.key)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: "var(--radius)", border: `1px solid ${done ? "var(--green-border)" : "var(--border)"}`,
              background: done ? "var(--green-bg)" : "var(--surface)", cursor: "pointer",
              transition: "all 0.15s", textAlign: "left",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius)", flexShrink: 0,
                background: done ? "#16a34a" : "var(--surface3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`ti ${done ? "ti-check" : c.icon}`} style={{ fontSize: 16, color: done ? "#fff" : "var(--muted)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: done ? "#15803d" : "var(--text)" }}>
                  {c.label}
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: done ? "#16a34a" : "var(--muted)", marginTop: 2 }}>
                  {done ? "Signed & collected" : "Click to mark as signed"}
                </div>
              </div>
              <i className={`ti ${done ? "ti-circle-check-filled" : "ti-circle-dashed"}`} style={{ fontSize: 20, color: done ? "#16a34a" : "var(--border)" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────
function AuditTab({ entries }: { entries: AuditEntry[] }) {
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const AUDIT_ICONS: Record<string, string> = {
    created: "ti-user-plus", edited: "ti-edit", deleted: "ti-trash",
    merged: "ti-merge", import: "ti-file-import", archived: "ti-archive",
    verification: "ti-shield-check", "timeline event added": "ti-timeline",
    "document added": "ti-file", "note added": "ti-notes", default: "ti-history",
  };
  const AUDIT_COLORS: Record<string, string> = {
    created: "#2563eb", edited: "#7c3aed", deleted: "#dc2626",
    merged: "#d97706", import: "#16a34a", archived: "#64748b", default: "var(--muted)",
  };

  return (
    <div style={{ maxWidth: 700 }}>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-history empty-state-icon" />
          <div className="empty-state-text">No audit entries yet</div>
          <div className="empty-state-sub">All changes will be recorded here</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {sorted.map((entry, i) => {
            const icon  = AUDIT_ICONS[entry.type] || AUDIT_ICONS.default;
            const color = AUDIT_COLORS[entry.type] || AUDIT_COLORS.default;
            return (
              <div key={entry.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 14px", background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)",
                borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "var(--radius-sm)", flexShrink: 0,
                  background: color + "15", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 13, color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", color: "var(--text)" }}>{entry.message}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2, display: "flex", gap: 8 }}>
                    <span><i className="ti ti-user" style={{ fontSize: 10, marginRight: 3 }} />{entry.user}</span>
                    <span className="mono">
                      {new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Emergency Modal ──────────────────────────────────────────────────────────
function EmergencyModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div style={{
        background: "#0c0f1a", border: "2px solid #dc2626", borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 560, overflow: "hidden",
        boxShadow: "0 0 60px rgba(220,38,38,0.35)", animation: "scaleIn 0.2s ease",
      }}>
        <div style={{ background: "#dc2626", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-emergency-bed" style={{ fontSize: 20, color: "#fff" }} />
            <div>
              <div style={{ fontSize: "var(--font-md)", fontWeight: 800, color: "#fff", letterSpacing: "0.06em" }}>
                EMERGENCY VIEW
              </div>
              <div style={{ fontSize: "var(--font-xs)", color: "#fecaca" }}>
                {patient.name} · {patient.id}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "var(--radius)", padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "var(--font-sm)" }}>
            <i className="ti ti-x" style={{ fontSize: 14 }} /> Close
          </button>
        </div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Blood Group",       value: patient.bloodGroup || "Unknown", icon: "ti-droplet",          color: "#ef4444", large: true },
            { label: "Primary Doctor",    value: patient.doctor || "—",           icon: "ti-stethoscope",      color: "#60a5fa" },
            { label: "Allergies",         value: patient.allergies || "None known",icon: "ti-alert-triangle",  color: "#f59e0b", warn: !!patient.allergies },
            { label: "Medications",       value: (patient.medications||[]).join(", ") || "None", icon: "ti-pill", color: "#a78bfa" },
            { label: "Conditions",        value: (patient.conditions||[]).join(", ") || "None", icon: "ti-heart-rate-monitor", color: "#f97316", warn: (patient.conditions||[]).length > 0 },
            { label: "Emergency Contact", value: patient.emergencyName || "—",   icon: "ti-phone-call",        color: "#34d399", sub: `${patient.emergencyRelation} · ${patient.emergencyPhone}` },
          ].map(({ label, value, icon, color, large, warn, sub }) => (
            <div key={label} style={{
              background: warn ? "#1c1008" : "#131726",
              border: `1px solid ${warn ? "#f59e0b30" : "rgba(255,255,255,0.07)"}`,
              borderRadius: "var(--radius)", padding: "10px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <i className={`ti ${icon}`} style={{ fontSize: 12, color }} />
                <span style={{ fontSize: "var(--font-2xs)", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              </div>
              <div style={{ fontSize: large ? 26 : 13, fontWeight: large ? 800 : 600, color: large ? color : warn ? "#fcd34d" : "#f9fafb", lineHeight: 1.3 }}>{value}</div>
              {sub && <div style={{ fontSize: "var(--font-xs)", color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ patient, onConfirm, onClose }: { patient: Patient; onConfirm: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--red-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-trash" style={{ fontSize: 18, color: "var(--red)" }} />
          </div>
          <div>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Delete Patient Record</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>This action cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
          You are about to permanently delete <strong style={{ color: "var(--text)" }}>{patient.name}</strong> ({patient.id}). Type the patient ID to confirm.
        </p>
        <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder={patient.id} style={{ width: "100%", marginBottom: 16 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" style={{ flex: 1 }} disabled={confirm !== patient.id} onClick={onConfirm}>
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action Modal ───────────────────────────────────────────────────────
function QuickActionModal({ action, patient, onClose }: { action: string; patient: Patient; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>{action}</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--muted)", lineHeight: 1.6 }}>
          This action would be processed for <strong>{patient.name}</strong>.
          In a production system this would open the relevant workflow module.
        </p>
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>
            <i className="ti ti-check" style={{ fontSize: 13 }} /> Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function InfoCard({ title, icon, iconBg, iconColor, children }: {
  title: string; icon: string; iconBg: string; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="panel-head">
        <div className="panel-icon" style={{ background: iconBg }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: iconColor }} />
        </div>
        <div className="panel-title">{title}</div>
      </div>
      <div style={{ padding: "12px 16px" }}>{children}</div>
    </div>
  );
}

function InfoGrid({ rows, cols = 2 }: { rows: [string, string | number | undefined | null][]; cols?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "8px 16px" }}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--text)", fontWeight: 500 }}>
            {value || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

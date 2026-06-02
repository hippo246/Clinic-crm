import { useState, useEffect } from "react";
import { fmtDate, getAvatarColor, getInitials, calcRiskScore, buildSmartSnapshot, calcVisitReadiness, buildHeatmapData, calcNextBestAction } from "../utils/patientUtils";
import { StatusBadge, AlertChip, InsuranceBadge, BloodGroupBadge, RiskBadge, ConsentBadge } from "./PatientBadges";
import PatientTimeline   from "./PatientTimeline";
import PatientDocuments  from "./PatientDocuments";
import PatientNotes      from "./PatientNotes";
import FamilyLinks       from "./FamilyLinks";
import FollowUpPanel     from "./FollowUpPanel";
import ConsentManager    from "./ConsentManager";
import { QUICK_ACTIONS, MOBILE_ACTIONS, LANGUAGES, CONTACT_METHODS, BEST_CONTACT_TIMES, PATIENT_FLAGS, GUARDIAN_RELATIONS } from "../constants/patientConstants";
import AuditLog from "./AuditLog";
import { can } from "../utils/roles";
import { detectContradictions, calculateDataQualityScore, detectStaleRecord } from "../utils/dataIntegrity";
import DataIntegrityPanel from "./DataIntegrityPanel";
import CriticalAlertOverride from "./CriticalAlertOverride";
import LastActionTracker from "./LastActionTracker";
import PendingTasksWidget from "./PendingTasksWidget";
import ActionHistorySummary from "./ActionHistorySummary";

// ─── ALERT SEVERITY ───────────────────────────────────────────────────────────
export const ALERT_SEVERITY = {
  "Allergy":         "critical",
  "Heart Condition": "critical",
  "Pregnancy":       "critical",
  "High Risk":       "critical",
  "Hypertension":    "medium",
  "Diabetic":        "medium",
};

const SEVERITY_CONFIG = {
  critical: {
    bg:        "#fff0f0",
    border:    "#ef4444",
    color:     "#991b1b",
    dot:       "#ef4444",
    label:     "CRITICAL",
    labelBg:   "#ef4444",
    labelColor:"#fff",
    icon:      "ti-alert-triangle",
  },
  medium: {
    bg:        "#fffbeb",
    border:    "#f59e0b",
    color:     "#92400e",
    dot:       "#f59e0b",
    label:     "MEDIUM",
    labelBg:   "#f59e0b",
    labelColor:"#fff",
    icon:      "ti-alert-circle",
  },
  low: {
    bg:        "#f0f9ff",
    border:    "#38bdf8",
    color:     "#0369a1",
    dot:       "#38bdf8",
    label:     "LOW",
    labelBg:   "#38bdf8",
    labelColor:"#fff",
    icon:      "ti-info-circle",
  },
};

function getSeverity(alert) {
  return ALERT_SEVERITY[alert] || "low";
}

// Critical alerts sorted first
function sortAlertsBySeverity(alerts) {
  const order = { critical: 0, medium: 1, low: 2 };
  return [...alerts].sort((a, b) => order[getSeverity(a)] - order[getSeverity(b)]);
}

// ─── CRITICAL ALERT BANNER ────────────────────────────────────────────────────
function CriticalAlertBanner({ alerts }) {
  const criticals = alerts.filter((a) => getSeverity(a) === "critical");
  if (criticals.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #fff0f0 0%, #fee2e2 100%)",
      borderBottom: "2px solid #ef4444",
      padding: "8px 16px",
      display: "flex", alignItems: "center", gap: 10,
      flexShrink: 0,
      animation: "criticalPulse 3s ease-in-out infinite",
    }}>
      <style>{`
        @keyframes criticalPulse {
          0%, 100% { border-bottom-color: #ef4444; }
          50%       { border-bottom-color: #fca5a5; }
        }
      `}</style>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: "#ef4444",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 13, color: "#fff" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
        Critical Alerts
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {criticals.map((a) => (
          <span key={a} style={{
            padding: "2px 10px", borderRadius: 20,
            background: "#ef4444", color: "#fff",
            fontSize: 12, fontWeight: 600,
          }}>
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── SEVERITY CHIP (replaces plain AlertChip in alert lists) ──────────────────
function SeverityAlertChip({ alert, onAcknowledge, acknowledged }) {
  const sev = getSeverity(alert);
  const cfg = SEVERITY_CONFIG[sev];
  const [hover, setHover] = useState(false);

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 20,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: 11, fontWeight: 600,
        position: "relative",
        cursor: onAcknowledge ? "pointer" : "default",
        opacity: acknowledged ? 0.6 : 1,
        textDecoration: acknowledged ? "line-through" : "none",
      }}
      onClick={onAcknowledge && !acknowledged ? onAcknowledge : undefined}
      title={onAcknowledge && !acknowledged ? "Click to acknowledge" : alert}
    >
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
      }} />
      {alert}
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
        background: cfg.labelBg, color: cfg.labelColor,
        padding: "0px 4px", borderRadius: 3,
        textTransform: "uppercase",
      }}>
        {cfg.label}
      </span>
      {acknowledged && (
        <i className="ti ti-check" style={{ fontSize: 9, marginLeft: 2 }} />
      )}
      {onAcknowledge && !acknowledged && hover && (
        <i className="ti ti-check-double" style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }} />
      )}
    </span>
  );
}

// ─── EMERGENCY VIEW ───────────────────────────────────────────────────────────
function EmergencyView({ patient, onClose }) {
  const criticals = patient.alerts.filter((a) => getSeverity(a) === "critical");
  const others    = patient.alerts.filter((a) => getSeverity(a) !== "critical");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#0f1117",
        border: "2px solid #ef4444",
        borderRadius: 16,
        width: "100%", maxWidth: 560,
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(239,68,68,0.4)",
      }}>
        {/* Header */}
        <div style={{
          background: "#ef4444",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="ti ti-emergency-bed" style={{ fontSize: 22, color: "#fff" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Emergency View
              </div>
              <div style={{ fontSize: 11, color: "#fecaca" }}>{patient.name} · {patient.id}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
              padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 600,
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 14 }} /> Close
          </button>
        </div>

        {/* Grid of cards */}
        <div style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}>
          {/* Blood Group */}
          <EmCard
            icon="ti-droplet"
            iconColor="#ef4444"
            label="Blood Group"
            value={patient.bloodGroup || "Unknown"}
            large
            highlight={patient.bloodGroup}
          />

          {/* Primary Doctor */}
          <EmCard
            icon="ti-stethoscope"
            iconColor="#60a5fa"
            label="Primary Doctor"
            value={patient.doctor || "—"}
          />

          {/* Allergies */}
          <EmCard
            icon="ti-alert-triangle"
            iconColor="#f59e0b"
            label="Allergies"
            value={patient.allergies || "None known"}
            warn={!!patient.allergies}
          />

          {/* Medications */}
          <EmCard
            icon="ti-pill"
            iconColor="#a78bfa"
            label="Current Medications"
            value={patient.medications?.length ? patient.medications.join(", ") : "None"}
          />

          {/* Conditions */}
          <EmCard
            icon="ti-heart-rate-monitor"
            iconColor="#f97316"
            label="Major Conditions"
            value={patient.conditions?.length ? patient.conditions.join(", ") : "None"}
            warn={patient.conditions?.length > 0}
          />

          {/* Emergency Contact */}
          <EmCard
            icon="ti-phone-call"
            iconColor="#34d399"
            label="Emergency Contact"
            value={patient.emergencyName || "—"}
            sub={`${patient.emergencyRelation} · ${patient.emergencyPhone}`}
          />
        </div>

        {/* Critical alerts row at bottom if any */}
        {criticals.length > 0 && (
          <div style={{
            borderTop: "1px solid #1f2937",
            padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ⚠ Critical:
            </span>
            {criticals.map((a) => (
              <span key={a} style={{
                padding: "2px 10px", borderRadius: 20,
                background: "#ef444420", border: "1px solid #ef4444",
                color: "#fca5a5", fontSize: 12, fontWeight: 600,
              }}>
                {a}
              </span>
            ))}
            {others.map((a) => (
              <span key={a} style={{
                padding: "2px 10px", borderRadius: 20,
                background: "#f59e0b20", border: "1px solid #f59e0b",
                color: "#fcd34d", fontSize: 12, fontWeight: 600,
              }}>
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmCard({ icon, iconColor, label, value, sub, large, highlight, warn }) {
  return (
    <div style={{
      background: warn ? "#1c1008" : "#1a1d27",
      border: `1px solid ${warn ? "#f59e0b40" : "#ffffff12"}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 13, color: iconColor }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: large ? 28 : 13,
        fontWeight: large ? 800 : 600,
        color: highlight ? iconColor : warn ? "#fcd34d" : "#f9fafb",
        lineHeight: 1.3,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── SENSITIVE LOCK MODAL ─────────────────────────────────────────────────────
function SensitiveLockModal({ patient, onUnlock, onClose }) {
  const [pin, setPin]       = useState("");
  const [error, setError]   = useState(false);
  const [shake, setShake]   = useState(false);
  // In a real system this PIN would come from backend auth; here we use "1234" as demo
  const DEMO_PIN = "1234";

  function submit() {
    if (pin === DEMO_PIN) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  }

  function onKey(e) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-8px); }
          40%,80%  { transform: translateX(8px); }
        }
        .lock-shake { animation: shake 0.4s ease; }
      `}</style>
      <div className={shake ? "lock-shake" : ""} style={{
        background: "var(--surface)",
        border: "2px solid #7c4fff40",
        borderRadius: 16,
        width: "100%", maxWidth: 380,
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(124,79,255,0.25)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #7c4fff 0%, #4f7cff 100%)",
          padding: "18px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ti ti-lock" style={{ fontSize: 18, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Sensitive Record</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>Extra authorisation required</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
            padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: 13,
          }}>
            <i className="ti ti-x" style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "#7c4fff10", border: "1px solid #7c4fff30",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <i className="ti ti-shield-lock" style={{ fontSize: 15, color: "#7c4fff", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{patient.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>This record is marked as sensitive. All access is logged automatically.</div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
              Enter Access PIN
            </label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(false); }}
              onKeyDown={onKey}
              placeholder="••••"
              autoFocus
              style={{
                width: "100%", fontSize: 22, letterSpacing: "0.3em", textAlign: "center",
                padding: "10px 14px", borderRadius: 10,
                border: `2px solid ${error ? "#ef4444" : "#7c4fff40"}`,
                background: "var(--surface2)", color: "var(--text)",
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <i className="ti ti-alert-circle" style={{ fontSize: 13 }} />
                Incorrect PIN. Access denied. (Demo PIN: 1234)
              </div>
            )}
          </div>

          <button
            onClick={submit}
            style={{
              padding: "11px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: "pointer", border: "none",
              background: "linear-gradient(135deg, #7c4fff 0%, #4f7cff 100%)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <i className="ti ti-lock-open" style={{ fontSize: 15 }} />
            Unlock Record
          </button>

          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
            <i className="ti ti-history" style={{ fontSize: 11, marginRight: 4 }} />
            Your access will be recorded in the audit log
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PRINT PATIENT SUMMARY ────────────────────────────────────────────────────
function PrintSummaryModal({ patient, onClose }) {
  function doPrint() {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const p = patient;
    const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—";
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Patient Summary – ${p.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 32px; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 2px; }
    .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f7cff; padding-bottom: 16px; margin-bottom: 20px; }
    .logo { font-size: 16px; font-weight: 700; color: #4f7cff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; break-inside: avoid; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b7280; font-size: 12px; }
    .value { font-weight: 500; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #15803d; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .alert-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .med-list li { margin-left: 16px; padding: 2px 0; font-size: 12px; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #9ca3af; font-size: 11px; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 20px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">ClinicOS</div>
      <h1>${p.name}</h1>
      <div class="subtitle">${p.id} · Printed ${new Date().toLocaleString("en-IN")}</div>
    </div>
    <div style="text-align:right;">
      <div class="badge ${p.status === 'Active' ? 'badge-green' : 'badge-yellow'}">${p.status}</div>
      <div style="margin-top:6px;font-size:12px;color:#666;">Dr. ${p.doctor}</div>
    </div>
  </div>

  <div class="grid">
    <div class="section">
      <div class="section-title">Personal Information</div>
      <div class="row"><span class="label">Date of Birth</span><span class="value">${fmtD(p.dob)}</span></div>
      <div class="row"><span class="label">Age</span><span class="value">${p.age} years</span></div>
      <div class="row"><span class="label">Gender</span><span class="value">${p.gender || "—"}</span></div>
      <div class="row"><span class="label">Blood Group</span><span class="value">${p.bloodGroup || "Unknown"}</span></div>
      <div class="row"><span class="label">Nationality</span><span class="value">${p.nationality || "—"}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Contact</div>
      <div class="row"><span class="label">Phone</span><span class="value">${p.phone || "—"}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${p.email || "—"}</span></div>
      <div class="row"><span class="label">Address</span><span class="value">${p.address || "—"}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Emergency Contact</div>
      <div class="row"><span class="label">Name</span><span class="value">${p.emergencyName || "—"}</span></div>
      <div class="row"><span class="label">Relation</span><span class="value">${p.emergencyRelation || "—"}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${p.emergencyPhone || "—"}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Insurance</div>
      <div class="row"><span class="label">Provider</span><span class="value">${p.insurer || "—"}</span></div>
      <div class="row"><span class="label">Policy No.</span><span class="value">${p.policyNumber || "—"}</span></div>
      <div class="row"><span class="label">Expiry</span><span class="value">${fmtD(p.insuranceExpiry)}</span></div>
      <div class="row"><span class="label">Status</span><span class="value"><span class="badge ${p.insuranceStatus === 'Active' ? 'badge-green' : p.insuranceStatus === 'Expired' ? 'badge-red' : 'badge-yellow'}">${p.insuranceStatus || "—"}</span></span></div>
    </div>
  </div>

  <div class="section" style="margin-bottom:16px;">
    <div class="section-title">Alerts &amp; Conditions</div>
    ${(p.alerts||[]).length > 0 ? `<div class="alert-row">${(p.alerts||[]).map(a=>`<span class="badge badge-red">${a}</span>`).join("")}</div>` : "<div style='color:#9ca3af;font-size:12px;'>No active alerts</div>"}
    ${(p.conditions||[]).length > 0 ? `<div style="margin-top:8px;"><span class="label">Conditions: </span>${(p.conditions||[]).join(", ")}</div>` : ""}
    ${p.allergies ? `<div style="margin-top:6px;"><span class="label">Allergies: </span><strong>${p.allergies}</strong></div>` : ""}
  </div>

  <div class="section" style="margin-bottom:16px;">
    <div class="section-title">Current Medications</div>
    ${(p.medications||[]).length > 0
      ? `<ul class="med-list">${(p.medications||[]).map(m=>`<li>${m}</li>`).join("")}</ul>`
      : "<div style='color:#9ca3af;font-size:12px;'>None recorded</div>"
    }
  </div>

  <div class="grid">
    <div class="section">
      <div class="section-title">Visit Summary</div>
      <div class="row"><span class="label">Last Visit</span><span class="value">${fmtD(p.lastVisit)}</span></div>
      <div class="row"><span class="label">Next Appointment</span><span class="value">${p.nextAppointment ? fmtD(p.nextAppointment) : "Not scheduled"}</span></div>
      ${p.followUpDate ? `<div class="row"><span class="label">Follow-Up</span><span class="value">${fmtD(p.followUpDate)}</span></div>` : ""}
    </div>
    <div class="section">
      <div class="section-title">Assigned Doctor</div>
      <div class="row"><span class="label">Doctor</span><span class="value">Dr. ${p.doctor || "—"}</span></div>
      <div class="row"><span class="label">Patient ID</span><span class="value">${p.id}</span></div>
      <div class="row"><span class="label">Status</span><span class="value">${p.status}</span></div>
    </div>
  </div>

  <div class="footer">
    <span>ClinicOS Patient Summary · Confidential</span>
    <span>Printed by staff on ${new Date().toLocaleDateString("en-IN")}</span>
  </div>

  <script>setTimeout(() => window.print(), 300);</script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: 16,
        border: "1px solid var(--border)",
        width: "100%", maxWidth: 460,
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--accent-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ti ti-printer" style={{ fontSize: 18, color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Print Patient Summary</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{patient.name} · {patient.id}</div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: "6px 10px" }} onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: 14 }} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            A printable one-page summary will open in a new tab, including:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: "ti-user", label: "Personal info" },
              { icon: "ti-phone-call", label: "Emergency contact" },
              { icon: "ti-alert-triangle", label: "Alerts & allergies" },
              { icon: "ti-heart-rate-monitor", label: "Conditions" },
              { icon: "ti-pill", label: "Current medications" },
              { icon: "ti-calendar", label: "Visit & follow-up" },
              { icon: "ti-shield-check", label: "Insurance details" },
              { icon: "ti-stethoscope", label: "Assigned doctor" },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 8,
                background: "var(--surface2)", border: "1px solid var(--border)",
              }}>
                <i className={`ti ${icon}`} style={{ fontSize: 14, color: "var(--accent)" }} />
                <span style={{ fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={onClose}>
              Cancel
            </button>
            <button
              onClick={doPrint}
              style={{
                flex: 2, padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: "var(--accent)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <i className="ti ti-printer" style={{ fontSize: 15 }} />
              Open & Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VERIFICATION PANEL ───────────────────────────────────────────────────────
const VERIFICATION_ITEMS = [
  { key: "phoneVerified",     label: "Phone Verified",     icon: "ti-phone-check"  },
  { key: "insuranceVerified", label: "Insurance Verified", icon: "ti-shield-check" },
  { key: "idVerified",        label: "ID Verified",        icon: "ti-id"           },
  { key: "consentSigned",     label: "Consent Signed",     icon: "ti-writing"      },
  { key: "documentsComplete", label: "Documents Complete", icon: "ti-files"        },
];

function VerificationPanel({ verification: status, onToggle }) {
  const verified = Object.values(status).filter(Boolean).length;
  const total    = VERIFICATION_ITEMS.length;
  const allDone  = verified === total;

  function toggle(key) {
    onToggle(key);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel>Verification</SectionLabel>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: allDone ? "#15803d" : "#92400e",
          background: allDone ? "#dcfce7" : "#fef3c7",
          padding: "1px 6px", borderRadius: 4,
        }}>
          {verified}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, borderRadius: 4, background: "var(--border)",
        marginBottom: 10, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 4,
          width: `${(verified / total) * 100}%`,
          background: allDone ? "#22c55e" : "#f59e0b",
          transition: "width 0.3s ease",
        }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {VERIFICATION_ITEMS.map(({ key, label, icon }) => {
          const done = status[key];
          const isMissingDocs = key === "documentsComplete" && !done;
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px", borderRadius: 7, width: "100%",
                border: `1px solid ${done ? "#22c55e30" : isMissingDocs ? "#ef444430" : "#f59e0b30"}`,
                background: done ? "#dcfce708" : isMissingDocs ? "#fee2e208" : "#fef3c708",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: done ? "#dcfce7" : isMissingDocs ? "#fee2e2" : "#fef3c7",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i
                  className={`ti ${done ? "ti-check" : isMissingDocs ? "ti-alert-triangle" : icon}`}
                  style={{ fontSize: 11, color: done ? "#15803d" : isMissingDocs ? "#ef4444" : "#92400e" }}
                />
              </div>
              <span style={{
                fontSize: 12, fontWeight: done ? 500 : 400,
                color: done ? "var(--text)" : "var(--muted)", flex: 1,
              }}>
                {isMissingDocs ? "Missing Documents" : label}
              </span>
              {done && <i className="ti ti-check" style={{ fontSize: 11, color: "#22c55e" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PINNED NOTES STRIP ───────────────────────────────────────────────────────
function PinnedNotesStrip({ notes }) {
  const pinned = (notes || []).filter((n) => n.pinned);
  if (pinned.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #fffbeb 0%, #fef9ec 100%)",
      borderBottom: "1px solid #f59e0b40",
      padding: "6px 16px",
      display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      overflowX: "auto",
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: "#92400e",
        letterSpacing: "0.07em", textTransform: "uppercase",
        display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
      }}>
        <i className="ti ti-pin-filled" style={{ fontSize: 11 }} /> Pinned
      </span>
      {pinned.map((n, i) => (
        <span key={n.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: "#f59e0b60", fontSize: 12 }}>·</span>}
          <span style={{
            fontSize: 12, color: "#78350f",
            background: "#fef3c7", border: "1px solid #f59e0b30",
            padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap",
          }}>
            {n.text}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── COMPACT VERIFICATION BADGE ───────────────────────────────────────────────
function CompactVerificationBadge({ verification }) {
  const total    = 5;
  const verified = Object.values(verification).filter(Boolean).length;
  const missing  = total - verified;
  const allDone  = missing === 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: allDone ? "#dcfce7" : missing > 2 ? "#fee2e2" : "#fef3c7",
      color:      allDone ? "#15803d" : missing > 2 ? "#991b1b" : "#92400e",
      border: `1px solid ${allDone ? "#22c55e40" : missing > 2 ? "#ef444440" : "#f59e0b40"}`,
    }}>
      <i
        className={`ti ${allDone ? "ti-shield-check" : "ti-shield-exclamation"}`}
        style={{ fontSize: 10 }}
      />
      {allDone ? "Verified" : `${missing} Unverified`}
    </span>
  );
}

// ─── COMMAND CENTER STRIP ─────────────────────────────────────────────────────
function CommandCenterStrip({ patient, consents, verification }) {
  const now = new Date();

  // Profile completion %
  const completionFields = [
    patient.firstName, patient.lastName, patient.dob, patient.gender,
    patient.phone, patient.email, patient.bloodGroup,
    patient.emergencyName, patient.emergencyPhone,
    patient.insurer && patient.insurer !== "None" ? patient.policyNumber : true,
    patient.doctor,
  ];
  const filled = completionFields.filter(Boolean).length;
  const profilePct = Math.round((filled / completionFields.length) * 100);

  const consentKeys = ["generalTreatment","dataPrivacy","insuranceClaim","minorGuardian","procedureConsent"];
  const consentSigned = consentKeys.filter((k) => consents[k]).length;
  const consentTotal  = consentKeys.length;
  const consentPct    = Math.round((consentSigned / consentTotal) * 100);

  // Follow-up status
  let followUpStatus = "None";
  if (patient.followUpDate) {
    const daysLeft = Math.floor((new Date(patient.followUpDate) - now) / 86400000);
    if (daysLeft < 0) followUpStatus = "Overdue";
    else if (daysLeft <= 7) followUpStatus = "Due Soon";
    else followUpStatus = "Scheduled";
  } else if (patient.status === "Follow-Up Due") {
    followUpStatus = "Overdue";
  }

  // Insurance days left
  let insDays = null;
  if (patient.insuranceExpiry) {
    insDays = Math.floor((new Date(patient.insuranceExpiry) - now) / 86400000);
  }

  // Last visit days ago
  const lastVisitDays = patient.lastVisit
    ? Math.floor((now - new Date(patient.lastVisit)) / 86400000)
    : null;

  const { level: riskLevel, score: riskScore } = calcRiskScore(patient);

  const RISK_COLOR = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444", Critical: "#7f1d1d" };
  const RISK_BG    = { Low: "#dcfce7", Medium: "#fef3c7", High: "#fee2e2", Critical: "#fca5a5" };
  const FU_COLOR   = { None: "#94a3b8", Scheduled: "#4f7cff", "Due Soon": "#f59e0b", Overdue: "#ef4444" };
  const FU_BG      = { None: "#f1f5f9", Scheduled: "#eff6ff", "Due Soon": "#fef3c7", Overdue: "#fee2e2" };
  const INS_COLOR  = { Active: "#22c55e", Expiring: "#f59e0b", Expired: "#ef4444", None: "#94a3b8" };
  const INS_BG     = { Active: "#dcfce7", Expiring: "#fef3c7", Expired: "#fee2e2", None: "#f1f5f9" };

  const items = [
    {
      label: "Patient Status",
      value: patient.status,
      color: "#4f7cff",
      bg:    "#eff6ff",
      icon:  "ti-user-check",
    },
    {
      label: "Risk Score",
      value: `${riskLevel} (${riskScore})`,
      color: RISK_COLOR[riskLevel] || "#64748b",
      bg:    RISK_BG[riskLevel]   || "#f1f5f9",
      icon:  "ti-heart-rate-monitor",
    },
    {
      label: "Follow-Up",
      value: followUpStatus,
      color: FU_COLOR[followUpStatus] || "#64748b",
      bg:    FU_BG[followUpStatus]    || "#f1f5f9",
      icon:  "ti-clock",
    },
    {
      label: "Insurance",
      value: insDays !== null && insDays >= 0 && insDays <= 90
        ? `${patient.insuranceStatus} · ${insDays}d`
        : patient.insuranceStatus,
      color: INS_COLOR[patient.insuranceStatus] || "#64748b",
      bg:    INS_BG[patient.insuranceStatus]    || "#f1f5f9",
      icon:  "ti-shield",
    },
    {
      label: "Consent",
      value: `${consentSigned}/${consentTotal} Signed`,
      color: consentPct === 100 ? "#22c55e" : consentPct >= 60 ? "#f59e0b" : "#ef4444",
      bg:    consentPct === 100 ? "#dcfce7" : consentPct >= 60 ? "#fef3c7" : "#fee2e2",
      icon:  "ti-writing",
    },
    {
      label: "Profile",
      value: `${profilePct}% Complete`,
      color: profilePct === 100 ? "#22c55e" : profilePct >= 70 ? "#f59e0b" : "#ef4444",
      bg:    profilePct === 100 ? "#dcfce7" : profilePct >= 70 ? "#fef3c7" : "#fee2e2",
      icon:  "ti-user",
    },
    {
      label: "Primary Doctor",
      value: patient.doctor || "Unassigned",
      color: "#7c4fff",
      bg:    "#ede9fe",
      icon:  "ti-stethoscope",
    },
    {
      label: "Last Visit",
      value: lastVisitDays !== null ? `${lastVisitDays}d ago` : "—",
      color: lastVisitDays === null ? "#94a3b8" : lastVisitDays > 90 ? "#ef4444" : lastVisitDays > 30 ? "#f59e0b" : "#22c55e",
      bg:    lastVisitDays === null ? "#f1f5f9" : lastVisitDays > 90 ? "#fee2e2" : lastVisitDays > 30 ? "#fef3c7" : "#dcfce7",
      icon:  "ti-calendar-event",
    },
    {
      label: "Next Visit",
      value: patient.nextAppointment ? fmtDate(patient.nextAppointment) : "Not Scheduled",
      color: patient.nextAppointment ? "#4f7cff" : "#94a3b8",
      bg:    patient.nextAppointment ? "#eff6ff"  : "#f1f5f9",
      icon:  "ti-calendar-plus",
    },
  ];

  return (
    <div style={{
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      padding: "10px 16px", flexShrink: 0, overflowX: "auto",
    }}>
      <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
        {items.map((item) => (
          <div key={item.label} style={{
            display: "flex", flexDirection: "column", gap: 3,
            padding: "7px 12px", borderRadius: 8,
            background: item.bg,
            border: `1px solid ${item.color}30`,
            minWidth: 100, flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 11, color: item.color }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: item.color, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                {item.label}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: item.color, whiteSpace: "nowrap" }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SMART SNAPSHOT DASHBOARD ─────────────────────────────────────────────────
function SmartSnapshotBanner({ patient, consents }) {
  const now = new Date();

  const totalVisits      = (patient.timeline || []).filter((t) => t.type === "consultation").length;
  const lastVisitDays    = patient.lastVisit
    ? Math.floor((now - new Date(patient.lastVisit)) / 86400000) : null;
  const missedAppts      = (patient.timeline || []).filter((t) => t.type === "appointment" && t.status === "missed").length;
  const activeConditions = (patient.conditions || []).length;
  const activeMeds       = (patient.medications || []).length;
  const outstandingFU    = (patient.status === "Follow-Up Due" ||
    (patient.followUpDate && new Date(patient.followUpDate) < now)) ? 1 : 0;

  let insDays = null;
  if (patient.insuranceExpiry) {
    insDays = Math.floor((new Date(patient.insuranceExpiry) - now) / 86400000);
  }

  const consentKeys   = ["generalTreatment","dataPrivacy","insuranceClaim","minorGuardian","procedureConsent"];
  const consentSigned = consentKeys.filter((k) => consents[k]).length;
  const allConsents   = consentKeys.length;
  const consentDone   = consentSigned === allConsents;

  const snapStats = [
    {
      label: "Visits",
      value: totalVisits,
      sub: "total consultations",
      icon: "ti-stethoscope",
      color: "#4f7cff",
      bg: "#eff6ff",
      alert: false,
    },
    {
      label: "Last Visit",
      value: lastVisitDays !== null ? lastVisitDays : "—",
      sub: lastVisitDays !== null ? "days ago" : "no visit recorded",
      icon: "ti-calendar-event",
      color: lastVisitDays === null ? "#94a3b8" : lastVisitDays > 180 ? "#ef4444" : lastVisitDays > 90 ? "#f59e0b" : "#22c55e",
      bg:    lastVisitDays === null ? "#f8fafc"  : lastVisitDays > 180 ? "#fee2e2"  : lastVisitDays > 90 ? "#fef3c7"  : "#f0fdf4",
      alert: lastVisitDays !== null && lastVisitDays > 90,
    },
    {
      label: "Missed Appts",
      value: missedAppts,
      sub: "appointments missed",
      icon: "ti-calendar-off",
      color: missedAppts > 2 ? "#ef4444" : missedAppts > 0 ? "#f59e0b" : "#22c55e",
      bg:    missedAppts > 2 ? "#fee2e2"  : missedAppts > 0 ? "#fef3c7"  : "#f0fdf4",
      alert: missedAppts > 0,
    },
    {
      label: "Conditions",
      value: activeConditions,
      sub: "active conditions",
      icon: "ti-heart-rate-monitor",
      color: activeConditions > 2 ? "#ef4444" : activeConditions > 0 ? "#f97316" : "#22c55e",
      bg:    activeConditions > 2 ? "#fee2e2"  : activeConditions > 0 ? "#fff7ed"  : "#f0fdf4",
      alert: activeConditions > 0,
    },
    {
      label: "Medications",
      value: activeMeds,
      sub: "active medications",
      icon: "ti-pill",
      color: activeMeds > 0 ? "#a78bfa" : "#22c55e",
      bg:    activeMeds > 0 ? "#f5f3ff"  : "#f0fdf4",
      alert: false,
    },
    {
      label: "Follow-Ups",
      value: outstandingFU,
      sub: "outstanding",
      icon: "ti-clock",
      color: outstandingFU > 0 ? "#f59e0b" : "#22c55e",
      bg:    outstandingFU > 0 ? "#fef3c7"  : "#f0fdf4",
      alert: outstandingFU > 0,
    },
    {
      label: "Insurance",
      value: insDays !== null ? (insDays < 0 ? "Expired" : `${insDays}d`) : "—",
      sub: insDays !== null ? (insDays < 0 ? "policy expired" : "until expiry") : "no policy",
      icon: "ti-shield",
      color: insDays === null ? "#94a3b8" : insDays < 0 ? "#ef4444" : insDays < 30 ? "#f59e0b" : "#22c55e",
      bg:    insDays === null ? "#f8fafc"  : insDays < 0 ? "#fee2e2"  : insDays < 30 ? "#fef3c7"  : "#f0fdf4",
      alert: insDays !== null && insDays < 30,
    },
    {
      label: "Consent",
      value: consentDone ? "Complete" : `${consentSigned}/${allConsents}`,
      sub: consentDone ? "all forms signed" : "forms pending",
      icon: consentDone ? "ti-circle-check" : "ti-writing",
      color: consentDone ? "#22c55e" : consentSigned === 0 ? "#ef4444" : "#f59e0b",
      bg:    consentDone ? "#f0fdf4"  : consentSigned === 0 ? "#fee2e2"  : "#fef3c7",
      alert: !consentDone,
    },
  ];

  return (
    <div style={{ flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      {/* Section label */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "7px 16px 0",
      }}>
        <i className="ti ti-layout-dashboard" style={{ fontSize: 12, color: "var(--accent)" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.09em" }}>
          Smart Patient Snapshot
        </span>
      </div>

      {/* Stat tiles */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: 8,
        padding: "8px 16px 12px",
      }}>
        {snapStats.map((s) => (
          <div key={s.label} style={{
            borderRadius: 10,
            background: s.bg,
            border: `1.5px solid ${s.color}${s.alert ? "55" : "30"}`,
            padding: "10px 12px",
            display: "flex", flexDirection: "column", gap: 3,
            position: "relative", overflow: "hidden",
          }}>
            {/* top accent bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: s.color, opacity: s.alert ? 1 : 0.45, borderRadius: "10px 10px 0 0",
            }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 13, color: s.color }} />
              {s.alert && (
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: s.color,
                  boxShadow: `0 0 4px ${s.color}`,
                }} />
              )}
            </div>
            <span style={{
              fontSize: 22, fontWeight: 800, color: s.color,
              lineHeight: 1.1, marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}>
              {s.value}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", lineHeight: 1.3 }}>
              {s.label}
            </span>
            <span style={{ fontSize: 9, color: s.color, opacity: 0.75, fontWeight: 500 }}>
              {s.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NEXT BEST ACTION BAR ──────────────────────────────────────────────────────
function NextBestActionBar({ patient, consents }) {
  const nba = calcNextBestAction(patient);

  // Urgency color map
  const URGENCY_STYLE = {
    critical: { pill: "#ef4444", pillText: "#fff",  label: "CRITICAL" },
    high:     { pill: "#f59e0b", pillText: "#fff",  label: "HIGH"     },
    medium:   { pill: "#4f7cff", pillText: "#fff",  label: "ACTION"   },
    none:     { pill: "#22c55e", pillText: "#fff",  label: "SUGGESTED"},
  };
  const urg = URGENCY_STYLE[nba.urgency] || URGENCY_STYLE.none;

  return (
    <div style={{
      flexShrink: 0,
      background: nba.bg,
      borderBottom: `2px solid ${nba.color}40`,
      padding: "9px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* Icon bubble */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: nba.color + "22",
        border: `1.5px solid ${nba.color}50`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ${nba.icon}`} style={{ fontSize: 17, color: nba.color }} />
      </div>

      {/* Label row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
            textTransform: "uppercase", color: nba.color, opacity: 0.8,
          }}>
            Next Best Action
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
            background: urg.pill, color: urg.pillText,
            letterSpacing: "0.07em", textTransform: "uppercase",
          }}>
            {urg.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: nba.color }}>
            {nba.label}
          </span>
          {nba.detail && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>— {nba.detail}</span>
          )}
        </div>
      </div>

      {/* CTA button */}
      <button style={{
        flexShrink: 0,
        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
        cursor: "pointer", border: `1.5px solid ${nba.color}60`,
        background: nba.color + "18", color: nba.color,
        display: "flex", alignItems: "center", gap: 6,
        whiteSpace: "nowrap",
      }}>
        <i className={`ti ${nba.icon}`} style={{ fontSize: 13 }} />
        Take Action
      </button>
    </div>
  );
}

// ─── SMART WARNING BAR ─────────────────────────────────────────────────────────
function SmartWarningBar({ patient, consents }) {
  const now = new Date();

  const consentKeys   = ["generalTreatment","dataPrivacy","insuranceClaim","minorGuardian","procedureConsent"];
  const consentSigned = consentKeys.filter((k) => consents[k]).length;

  let insDays = null;
  if (patient.insuranceExpiry) {
    insDays = Math.floor((new Date(patient.insuranceExpiry) - now) / 86400000);
  }

  const lastVisitDays = patient.lastVisit
    ? Math.floor((now - new Date(patient.lastVisit)) / 86400000) : null;

  const warnings = [];

  // Critical allergy
  if (patient.allergies) {
    warnings.push({
      id: "allergy",
      icon: "ti-alert-triangle",
      label: `Critical Allergy: ${patient.allergies}`,
      color: "#ef4444", bg: "#fee2e2", tier: 0,
    });
  }

  // Critical alerts
  (patient.alerts || [])
    .filter((a) => getSeverity(a) === "critical" && a !== "Allergy")
    .forEach((a) => warnings.push({
      id: `alert-${a}`,
      icon: "ti-alert-triangle",
      label: `Medical Alert: ${a}`,
      color: "#ef4444", bg: "#fee2e2", tier: 0,
    }));

  // Missing consent
  if (consentSigned < consentKeys.length) {
    const missing = consentKeys.length - consentSigned;
    warnings.push({
      id: "consent",
      icon: "ti-writing",
      label: `${missing} Consent Form${missing > 1 ? "s" : ""} Missing`,
      color: "#f59e0b", bg: "#fef3c7", tier: 1,
    });
  }

  // Insurance expiring / expired
  if (insDays !== null && insDays < 0) {
    warnings.push({
      id: "ins-expired",
      icon: "ti-shield-off",
      label: "Insurance Expired",
      color: "#ef4444", bg: "#fee2e2", tier: 0,
    });
  } else if (insDays !== null && insDays <= 30) {
    warnings.push({
      id: "ins-expiring",
      icon: "ti-shield-exclamation",
      label: `Insurance Expiring in ${insDays}d`,
      color: "#f59e0b", bg: "#fef3c7", tier: 1,
    });
  }

  // No visit in 180 days
  if (lastVisitDays !== null && lastVisitDays > 180) {
    warnings.push({
      id: "no-visit",
      icon: "ti-calendar-off",
      label: `No Visit in ${lastVisitDays} Days`,
      color: "#f59e0b", bg: "#fef3c7", tier: 1,
    });
  }

  // Emergency contact missing
  if (!patient.emergencyName || !patient.emergencyPhone) {
    warnings.push({
      id: "no-emergency",
      icon: "ti-phone-off",
      label: "Emergency Contact Missing",
      color: "#f59e0b", bg: "#fef3c7", tier: 1,
    });
  }

  // No next appointment
  if (!patient.nextAppointment && patient.status === "Active") {
    warnings.push({
      id: "no-appt",
      icon: "ti-calendar-x",
      label: "No Appointment Scheduled",
      color: "#64748b", bg: "#f1f5f9", tier: 2,
    });
  }

  if (warnings.length === 0) return null;

  // Sort by tier (critical first)
  warnings.sort((a, b) => a.tier - b.tier);

  return (
    <div style={{
      flexShrink: 0,
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        overflowX: "auto",
        padding: "0",
      }}>
        {/* Label tab */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px",
          background: warnings[0].tier === 0 ? "#ef4444" : "#f59e0b",
          flexShrink: 0,
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 12, color: "#fff" }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.09em", whiteSpace: "nowrap" }}>
            {warnings.filter((w) => w.tier === 0).length > 0 ? "Critical" : "Warnings"}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "rgba(255,255,255,0.3)", color: "#fff",
            padding: "0px 5px", borderRadius: 8, minWidth: 16, textAlign: "center",
          }}>
            {warnings.length}
          </span>
        </div>

        {/* Warning chips */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", overflowX: "auto", flex: 1,
        }}>
          {warnings.map((w) => (
            <div key={w.id} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px 3px 7px",
              borderRadius: 20,
              background: w.bg,
              border: `1.5px solid ${w.color}50`,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                background: w.color, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`ti ${w.icon}`} style={{ fontSize: 9, color: "#fff" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: w.color }}>
                {w.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── VISIT READINESS PANEL ────────────────────────────────────────────────────
function VisitReadinessPanel({ patient, verification }) {
  const { items, done, total, ready } = calcVisitReadiness(patient, verification);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        padding: "10px 14px", borderRadius: 10,
        background: ready ? "#dcfce7" : "#fff7ed",
        border: `1px solid ${ready ? "#22c55e40" : "#f59e0b40"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className={`ti ${ready ? "ti-circle-check" : "ti-alert-circle"}`}
            style={{ fontSize: 18, color: ready ? "#22c55e" : "#f59e0b" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ready ? "#15803d" : "#92400e" }}>
              {ready ? "Patient is Ready" : "Not Ready for Appointment"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{done} of {total} checks passed</div>
          </div>
        </div>
        <div style={{ width: 80, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4, transition: "width 0.3s ease",
            width: `${(done / total) * 100}%`,
            background: ready ? "#22c55e" : "#f59e0b",
          }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <div key={item.key} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 8,
            border: `1px solid ${item.done ? "#22c55e30" : "#f59e0b30"}`,
            background: item.done ? "#dcfce708" : "#fef3c708",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
              background: item.done ? "#dcfce7" : "#fef3c7",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`ti ${item.done ? "ti-check" : "ti-x"}`}
                style={{ fontSize: 12, color: item.done ? "#15803d" : "#92400e" }} />
            </div>
            <span style={{ fontSize: 13, color: item.done ? "var(--text)" : "var(--muted)" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMMUNICATION PREFERENCES ────────────────────────────────────────────────
function CommPrefsPanel({ patient, onChange }) {
  const [prefs, setPrefs] = useState(() => ({
    preferredLanguage:  patient.preferredLanguage  || "English",
    preferredContact:   patient.preferredContact   || "Phone",
    bestTime:           patient.bestTime           || "Any time",
    doNotCall:          patient.doNotCall          ?? false,
    whatsappAllowed:    patient.whatsappAllowed     ?? true,
    smsAllowed:         patient.smsAllowed          ?? true,
    emailAllowed:       patient.emailAllowed        ?? true,
  }));
  const [saved, setSaved] = useState(false);

  function update(key, val) {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
  }

  function handleSave() {
    onChange?.(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Toggle = ({ label, icon, field, color = "var(--accent)" }) => (
    <button
      onClick={() => update(field, !prefs[field])}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 8, width: "100%", cursor: "pointer",
        border: `1px solid ${prefs[field] ? color + "40" : "var(--border)"}`,
        background: prefs[field] ? color + "10" : "var(--surface2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 15, color: prefs[field] ? color : "var(--muted)" }} />
        <span style={{ fontSize: 13 }}>{label}</span>
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: 10, position: "relative",
        background: prefs[field] ? color : "var(--border)", transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: 2, left: prefs[field] ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Preferred Language
        </label>
        <select value={prefs.preferredLanguage} onChange={(e) => update("preferredLanguage", e.target.value)}
          style={{ fontSize: 13, padding: "7px 10px" }}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Preferred Contact Method
        </label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CONTACT_METHODS.map((m) => (
            <button key={m} onClick={() => update("preferredContact", m)}
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `2px solid ${prefs.preferredContact === m ? "var(--accent)" : "var(--border)"}`,
                background: prefs.preferredContact === m ? "var(--accent-soft)" : "var(--surface2)",
                color: prefs.preferredContact === m ? "var(--accent)" : "var(--text)",
                fontWeight: prefs.preferredContact === m ? 600 : 400,
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Best Time to Contact
        </label>
        <select value={prefs.bestTime} onChange={(e) => update("bestTime", e.target.value)}
          style={{ fontSize: 13, padding: "7px 10px" }}>
          {BEST_CONTACT_TIMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Channel Permissions
        </label>
        <Toggle label="Do Not Call"      icon="ti-phone-off"  field="doNotCall"       color="#ef4444" />
        <Toggle label="WhatsApp Allowed" icon="ti-brand-whatsapp" field="whatsappAllowed" color="#22c55e" />
        <Toggle label="SMS Allowed"      icon="ti-message"    field="smsAllowed"      color="#4f7cff" />
        <Toggle label="Email Allowed"    icon="ti-mail"       field="emailAllowed"    color="#7c4fff" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
          {saved ? <i className="ti ti-check" style={{ fontSize: 14 }} /> : <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />}
          {saved ? "Saved" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}

// ─── GUARDIAN PANEL ───────────────────────────────────────────────────────────
function GuardianPanel({ patient, onChange }) {
  const [data, setData] = useState(() => ({
    isMinor:            patient.isMinor            ?? (patient.age < 18),
    guardianName:       patient.guardianName       || "",
    guardianPhone:      patient.guardianPhone      || "",
    guardianRelation:   patient.guardianRelation   || "",
    guardianConsentReq: patient.guardianConsentReq ?? false,
  }));
  const [saved, setSaved] = useState(false);

  function update(key, val) {
    const updated = { ...data, [key]: val };
    setData(updated);
  }

  function handleSave() {
    onChange?.(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: "10px 14px", borderRadius: 10,
        background: data.isMinor ? "#eff6ff" : "var(--surface2)",
        border: `1px solid ${data.isMinor ? "#bfdbfe" : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-user-shield" style={{ fontSize: 16, color: data.isMinor ? "#3b82f6" : "var(--muted)" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Minor Patient</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Guardian consent required if enabled</div>
          </div>
        </div>
        <button onClick={() => update("isMinor", !data.isMinor)}
          style={{
            width: 36, height: 20, borderRadius: 10, position: "relative", cursor: "pointer",
            background: data.isMinor ? "#3b82f6" : "var(--border)", border: "none", transition: "background 0.2s",
          }}>
          <div style={{
            position: "absolute", top: 2, left: data.isMinor ? 18 : 2,
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Guardian Name</label>
          <input type="text" value={data.guardianName} placeholder="Full name"
            onChange={(e) => update("guardianName", e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Guardian Phone</label>
          <input type="text" value={data.guardianPhone} placeholder="+91 XXXXX XXXXX"
            onChange={(e) => update("guardianPhone", e.target.value)} style={{ width: "100%" }} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Relationship</label>
        <select value={data.guardianRelation} onChange={(e) => update("guardianRelation", e.target.value)}
          style={{ width: "100%", fontSize: 13, padding: "7px 10px" }}>
          <option value="">Select relationship</option>
          {GUARDIAN_RELATIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      <button
        onClick={() => update("guardianConsentReq", !data.guardianConsentReq)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 8, width: "100%", cursor: "pointer",
          border: `1px solid ${data.guardianConsentReq ? "#f59e0b40" : "var(--border)"}`,
          background: data.guardianConsentReq ? "#fef3c7" : "var(--surface2)",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-writing" style={{ fontSize: 15, color: data.guardianConsentReq ? "#f59e0b" : "var(--muted)" }} />
          <span style={{ fontSize: 13 }}>Guardian Consent Required</span>
        </div>
        <div style={{
          width: 36, height: 20, borderRadius: 10, position: "relative",
          background: data.guardianConsentReq ? "#f59e0b" : "var(--border)", transition: "background 0.2s",
        }}>
          <div style={{
            position: "absolute", top: 2, left: data.guardianConsentReq ? 18 : 2,
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s",
          }} />
        </div>
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
          {saved ? <i className="ti ti-check" style={{ fontSize: 14 }} /> : <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />}
          {saved ? "Saved" : "Save Guardian Info"}
        </button>
      </div>
    </div>
  );
}

// ─── PATIENT FLAGS PANEL ──────────────────────────────────────────────────────
function PatientFlagsPanel({ patient, onChange }) {
  const [flags, setFlags] = useState(() => {
    const base = {};
    PATIENT_FLAGS.forEach((f) => { base[f.key] = false; });
    return { ...base, ...(patient.flags || {}) };
  });
  const [saved, setSaved] = useState(false);

  function toggle(key) {
    const updated = { ...flags, [key]: !flags[key] };
    setFlags(updated);
  }

  function handleSave() {
    onChange?.(flags);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const active = PATIENT_FLAGS.filter((f) => flags[f.key]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {active.length > 0 && (
        <div style={{
          padding: "8px 12px", borderRadius: 8,
          background: "var(--surface2)", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Active Flags
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {active.map((f) => (
              <span key={f.key} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: f.color + "18", color: f.color,
                border: `1px solid ${f.color}40`,
              }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 11 }} /> {f.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {PATIENT_FLAGS.map((f) => (
        <button key={f.key} onClick={() => toggle(f.key)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 12px", borderRadius: 8, width: "100%", cursor: "pointer",
            border: `1px solid ${flags[f.key] ? f.color + "40" : "var(--border)"}`,
            background: flags[f.key] ? f.color + "10" : "var(--surface2)",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: flags[f.key] ? f.color + "20" : "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`ti ${f.icon}`} style={{ fontSize: 14, color: flags[f.key] ? f.color : "var(--muted)" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: flags[f.key] ? 600 : 400, color: flags[f.key] ? f.color : "var(--text)" }}>
              {f.label}
            </span>
          </div>
          <div style={{
            width: 36, height: 20, borderRadius: 10, position: "relative",
            background: flags[f.key] ? f.color : "var(--border)", transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: 2, left: flags[f.key] ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s",
            }} />
          </div>
        </button>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
          {saved ? <i className="ti ti-check" style={{ fontSize: 14 }} /> : <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />}
          {saved ? "Saved" : "Save Flags"}
        </button>
      </div>
    </div>
  );
}

// ─── ACTIVITY HEATMAP ─────────────────────────────────────────────────────────
function ActivityHeatmap({ patient }) {
  const months = buildHeatmapData(patient);
  const maxVisits = Math.max(1, ...months.map((m) => m.visits));
  const totalVisits = months.reduce((s, m) => s + m.visits, 0);
  const totalMissed = months.reduce((s, m) => s + m.missed, 0);
  const activeMonths = months.filter((m) => m.visits > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "Visits (12mo)", value: totalVisits, color: "#4f7cff" },
          { label: "Missed",        value: totalMissed, color: "#ef4444" },
          { label: "Active Months", value: activeMonths, color: "#22c55e" },
        ].map((s) => (
          <div key={s.label} style={{
            padding: "10px 12px", borderRadius: 8,
            background: "var(--surface2)", border: "1px solid var(--border)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Visit Frequency — Last 12 Months
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80 }}>
          {months.map((m) => {
            const height = m.visits === 0 ? 4 : Math.max(8, (m.visits / maxVisits) * 72);
            return (
              <div key={`${m.year}-${m.month}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
                  {m.missed > 0 && (
                    <div style={{
                      position: "absolute", bottom: "100%", marginBottom: 2,
                      width: 6, height: 6, borderRadius: "50%", background: "#ef4444",
                    }} title={`${m.missed} missed`} />
                  )}
                  <div style={{
                    width: "70%", borderRadius: "3px 3px 0 0",
                    height, background: m.visits === 0 ? "var(--border)" : `hsl(${220 + (m.visits / maxVisits) * 40}, 80%, ${65 - (m.visits / maxVisits) * 20}%)`,
                    transition: "height 0.3s ease",
                  }} />
                </div>
                <span style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#4f7cff", display: "inline-block" }} /> Visit
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} /> Missed
          </span>
        </div>
      </div>

      {/* Gap analysis */}
      {totalVisits === 0 && (
        <div style={{
          padding: "12px 14px", borderRadius: 8,
          background: "#fef3c7", border: "1px solid #f59e0b40",
          fontSize: 13, color: "#92400e",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 15 }} />
          No visits recorded in the last 12 months.
        </div>
      )}
    </div>
  );
}

// ─── HEALTH SNAPSHOT ─────────────────────────────────────────────────────────
function deriveHealthSnapshot(patient) {
  const alerts      = patient.alerts || [];
  const conditions  = patient.conditions || [];
  const hasCritical = alerts.some((a) => ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a));
  const visits      = (patient.timeline || []).filter((t) => t.type === "consultation");
  const lastVisit   = patient.lastVisit ? new Date(patient.lastVisit) : null;
  const daysSince   = lastVisit ? Math.floor((Date.now() - lastVisit) / 86400000) : null;
  const missedFollowUp = patient.followUpDate && new Date(patient.followUpDate) < new Date() && patient.followUpStatus !== "Completed";

  if (hasCritical && (daysSince === null || daysSince > 60))
    return { status: "High Monitoring Required", color: "#ef4444", bg: "#fee2e2", icon: "ti-alert-triangle",  desc: "Critical alerts present with no recent visit." };
  if (conditions.length >= 3 || alerts.length >= 3)
    return { status: "High Monitoring Required", color: "#ef4444", bg: "#fee2e2", icon: "ti-alert-triangle",  desc: "Multiple active conditions or alerts." };
  if (missedFollowUp)
    return { status: "Worsening",               color: "#f97316", bg: "#fff7ed", icon: "ti-trending-down",    desc: "Missed follow-up — patient may need immediate attention." };
  if (daysSince !== null && daysSince > 90 && patient.status === "Active")
    return { status: "Worsening",               color: "#f97316", bg: "#fff7ed", icon: "ti-trending-down",    desc: "No visit in over 90 days despite active status." };
  if (visits.length >= 2 && daysSince !== null && daysSince <= 30)
    return { status: "Improving",               color: "#22c55e", bg: "#dcfce7", icon: "ti-trending-up",      desc: "Regular recent visits suggest active treatment progress." };
  if (patient.status === "Inactive" || visits.length === 0)
    return { status: "Stable",                  color: "#64748b", bg: "#f1f5f9", icon: "ti-minus",            desc: "No active treatment in progress." };
  if (visits.length > 0 && daysSince !== null && daysSince <= 60)
    return { status: "Stable",                  color: "#4f7cff", bg: "#eff6ff", icon: "ti-circle-check",     desc: "Under care with recent engagement." };
  if (patient.status === "Follow-Up Due")
    return { status: "Stable",                  color: "#f59e0b", bg: "#fef3c7", icon: "ti-clock",            desc: "Treatment stable but follow-up is pending." };
  return   { status: "Recovered",               color: "#22c55e", bg: "#dcfce7", icon: "ti-heart-check",      desc: "No active alerts, conditions stable, treatment complete." };
}

function HealthSnapshot({ patient, acknowledgedAlerts, onAcknowledgeAlert }) {
  const snap       = deriveHealthSnapshot(patient);
  const alerts     = patient.alerts || [];
  const conditions = patient.conditions || [];
  const meds       = patient.medications || [];

  const metrics = [
    { label: "Active Alerts",  value: alerts.length,     color: alerts.length > 0 ? "#ef4444" : "#22c55e" },
    { label: "Conditions",     value: conditions.length, color: conditions.length > 0 ? "#f97316" : "#22c55e" },
    { label: "Medications",    value: meds.length,       color: "#4f7cff" },
    { label: "Consultations",  value: (patient.timeline || []).filter((t) => t.type === "consultation").length, color: "#7c4fff" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Main status card */}
      <div style={{
        padding: "20px",
        background: snap.bg,
        borderRadius: 12,
        border: `2px solid ${snap.color}30`,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: snap.color + "20",
          border: `2px solid ${snap.color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <i className={`ti ${snap.icon}`} style={{ fontSize: 24, color: snap.color }} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: snap.color, lineHeight: 1.1 }}>{snap.status}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, maxWidth: 340 }}>{snap.desc}</div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 12px", borderRadius: 8,
        background: "var(--surface2)", border: "1px solid var(--border)",
        fontSize: 11, color: "var(--muted)",
      }}>
        <i className="ti ti-info-circle" style={{ fontSize: 13, flexShrink: 0 }} />
        Operational snapshot only. Does not replace clinical assessment or physician judgment.
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{
            padding: "12px 14px", borderRadius: 10,
            background: "var(--surface2)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 8 }}>
            Active Alerts
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {alerts.map((a) => (
              <SeverityAlertChip
                key={a}
                alert={a}
                acknowledged={acknowledgedAlerts?.includes(a)}
                onAcknowledge={onAcknowledgeAlert ? () => onAcknowledgeAlert(a) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Last / next visit */}
      {patient.lastVisit && (
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: "var(--surface2)", border: "1px solid var(--border)",
          fontSize: 13,
        }}>
          <span style={{ color: "var(--muted)", fontSize: 11 }}>Last visit: </span>
          <strong>{fmtDate(patient.lastVisit)}</strong>
          {patient.nextAppointment && (
            <>
              <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 12 }}>Next: </span>
              <strong>{fmtDate(patient.nextAppointment)}</strong>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PATIENT JOURNEY MAP ──────────────────────────────────────────────────────
const JOURNEY_STAGES = [
  { key: "created",   label: "Patient Created",  icon: "ti-user-plus",   color: "#4f7cff", desc: "Record created in system"              },
  { key: "firstVisit",label: "First Visit",       icon: "ti-stethoscope", color: "#7c4fff", desc: "Initial consultation completed"        },
  { key: "treatment", label: "Treatment Started", icon: "ti-pill",        color: "#f97316", desc: "Active treatment or prescription issued"},
  { key: "followup",  label: "Follow-Up",         icon: "ti-clock",       color: "#f59e0b", desc: "Follow-up appointment conducted"       },
  { key: "monitoring",label: "Monitoring",         icon: "ti-activity",    color: "#00b4a0", desc: "Ongoing observation / tests"           },
  { key: "recovery",  label: "Recovery",           icon: "ti-heart-check", color: "#22c55e", desc: "Condition stabilised / resolved"       },
];

function deriveJourneyStage(patient) {
  const timeline   = patient.timeline || [];
  const hasConsult = timeline.some((t) => t.type === "consultation");
  const hasPrescr  = timeline.some((t) => t.type === "prescription");
  const hasFollowup = timeline.some((t) => t.type === "followup") || !!patient.followUpDate;
  const hasReport  = timeline.some((t) => t.type === "report");
  const isInactive = patient.status === "Inactive";

  if (isInactive && hasConsult)          return 5;
  if (hasReport || (hasConsult && hasFollowup)) return 4;
  if (hasFollowup)                       return 3;
  if (hasPrescr)                         return 2;
  if (hasConsult)                        return 1;
  return 0;
}

function PatientJourneyMap({ patient }) {
  const currentIdx = deriveJourneyStage(patient);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Visual lifecycle map — helps staff understand where this patient is in their care journey.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {JOURNEY_STAGES.map((stage, i) => {
          const isDone    = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture  = i > currentIdx;

          return (
            <div key={stage.key} style={{ display: "flex", gap: 14, position: "relative" }}>
              {/* Spine + icon */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 36 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isFuture ? "var(--surface2)" : isCurrent ? stage.color : stage.color + "20",
                  border: `2px solid ${isFuture ? "var(--border)" : stage.color}`,
                  flexShrink: 0,
                }}>
                  {isDone
                    ? <i className="ti ti-check"       style={{ fontSize: 15, color: stage.color }} />
                    : <i className={`ti ${stage.icon}`} style={{ fontSize: 15, color: isFuture ? "var(--muted)" : isCurrent ? "#fff" : stage.color }} />
                  }
                </div>
                {i < JOURNEY_STAGES.length - 1 && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 24,
                    background: i < currentIdx ? stage.color + "80" : "var(--border)",
                    marginTop: 2, marginBottom: 2,
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ paddingTop: 6, paddingBottom: 20, flex: 1, minWidth: 0, opacity: isFuture ? 0.45 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? stage.color : "var(--text)" }}>
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 7px",
                      borderRadius: 20, background: stage.color, color: "#fff",
                    }}>
                      CURRENT
                    </span>
                  )}
                  {isDone && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: stage.color, opacity: 0.7 }}>✓ Done</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{stage.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current stage callout */}
      <div style={{
        padding: "12px 14px", borderRadius: 10,
        background: JOURNEY_STAGES[currentIdx].color + "10",
        border: `1px solid ${JOURNEY_STAGES[currentIdx].color}30`,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <i className={`ti ${JOURNEY_STAGES[currentIdx].icon}`} style={{ fontSize: 18, color: JOURNEY_STAGES[currentIdx].color, flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: JOURNEY_STAGES[currentIdx].color }}>
            Currently: {JOURNEY_STAGES[currentIdx].label}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            {JOURNEY_STAGES[currentIdx].desc}.
            {currentIdx < JOURNEY_STAGES.length - 1 && (
              <> Next expected: <strong>{JOURNEY_STAGES[currentIdx + 1].label}</strong>.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE COMPLETION ENGINE ───────────────────────────────────────────────
function buildCompletionFields(patient, consents, verification) {
  return [
    { key: "phone",            label: "Phone Number",       done: !!patient.phone,                      group: "Contact"   },
    { key: "email",            label: "Email Address",      done: !!patient.email,                      group: "Contact"   },
    { key: "address",          label: "Address",            done: !!patient.address,                    group: "Contact"   },
    { key: "emergencyName",    label: "Emergency Contact",  done: !!patient.emergencyName,              group: "Emergency" },
    { key: "emergencyPhone",   label: "Emergency Phone",    done: !!patient.emergencyPhone,             group: "Emergency" },
    { key: "bloodGroup",       label: "Blood Group",        done: !!patient.bloodGroup && patient.bloodGroup !== "—", group: "Medical" },
    { key: "allergies",        label: "Allergy Info",       done: patient.allergies !== undefined && patient.allergies !== null, group: "Medical" },
    { key: "insurer",          label: "Insurance Provider", done: !!patient.insurer && patient.insurer !== "None", group: "Insurance" },
    { key: "insuranceCard",    label: "Insurance Card",     done: (patient.documents || []).some((d) => d.type === "Insurance Card"), group: "Insurance" },
    { key: "consentGeneral",   label: "General Consent",    done: !!consents.generalTreatment,          group: "Consents"  },
    { key: "consentPrivacy",   label: "Data Privacy",       done: !!consents.dataPrivacy,               group: "Consents"  },
    { key: "idVerified",       label: "ID Verified",        done: !!verification.idVerified,            group: "Verification" },
    { key: "phoneVerified",    label: "Phone Verified",     done: !!verification.phoneVerified,         group: "Verification" },
  ];
}

function ProfileCompletion({ patient, consents, verification }) {
  const fields    = buildCompletionFields(patient, consents, verification);
  const done      = fields.filter((f) => f.done).length;
  const total     = fields.length;
  const pct       = Math.round((done / total) * 100);
  const missing   = fields.filter((f) => !f.done);
  const [expanded, setExpanded] = useState(false);

  const color = pct >= 90 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  const bg    = pct >= 90 ? "#dcfce7" : pct >= 60 ? "#fef3c7" : "#fee2e2";
  const label = pct >= 90 ? "Complete" : pct >= 60 ? "Partial" : "Incomplete";

  return (
    <div>
      <SectionLabel>Profile Completion</SectionLabel>
      <div style={{
        padding: "10px 12px",
        background: "var(--surface2)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}>
        {/* Score row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          {/* Radial-ish indicator via conic-gradient */}
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: `conic-gradient(${color} ${pct * 3.6}deg, var(--border) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--surface2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color,
            }}>
              {pct}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{done}/{total} fields</div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 7px",
              borderRadius: 20, background: bg, color,
            }}>
              {label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 4,
          background: "var(--border)", overflow: "hidden", marginBottom: 8,
        }}>
          <div style={{
            height: "100%", borderRadius: 4,
            width: `${pct}%`,
            background: color,
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Missing fields */}
        {missing.length > 0 && (
          <>
            <button
              onClick={() => setExpanded((x) => !x)}
              style={{
                fontSize: 11, fontWeight: 600, color: "#ef4444",
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, padding: 0, marginBottom: 4,
              }}
            >
              <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 11 }} />
              {missing.length} missing field{missing.length > 1 ? "s" : ""}
            </button>
            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                {missing.map((f) => (
                  <div key={f.key} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, color: "var(--muted)",
                  }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 3,
                      border: "1.5px solid #ef444460",
                      flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444" }} />
                    </span>
                    {f.label}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--border)", fontWeight: 600 }}>
                      {f.group}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {missing.length === 0 && (
          <div style={{ fontSize: 11, color: "#15803d", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-circle-check" style={{ fontSize: 13 }} />
            All fields complete
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "timeline",  label: "Timeline",  icon: "ti-timeline"      },
  { id: "snapshot",  label: "Snapshot",  icon: "ti-heart-rate-monitor" },
  { id: "journey",   label: "Journey",   icon: "ti-route"         },
  { id: "documents", label: "Documents", icon: "ti-files"          },
  { id: "notes",     label: "Notes",     icon: "ti-notes"          },
  { id: "family",    label: "Family",    icon: "ti-users"          },
  { id: "followup",  label: "Follow-Up", icon: "ti-clock"          },
  { id: "consent",   label: "Consent",   icon: "ti-writing"        },
  { id: "comms",     label: "Comms",     icon: "ti-message-circle" },
  { id: "readiness", label: "Readiness", icon: "ti-checklist"      },
  { id: "guardian",  label: "Guardian",  icon: "ti-user-shield"    },
  { id: "flags",     label: "Flags",     icon: "ti-flag"           },
  { id: "heatmap",   label: "Activity",  icon: "ti-chart-bar"      },
  { id: "audit",     label: "Audit",     icon: "ti-history"        },
];

function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "100px 1fr", gap: 8,
      padding: "5px 0", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: mono ? "'DM Mono', monospace" : undefined }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--muted)", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PatientProfile({ patient, auditEntries = [], onBack, onEdit, role = "receptionist" }) {
  const [activeSection,  setActiveSection]  = useState("timeline");
  const [emergencyOpen,  setEmergencyOpen]  = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const avatarColor = getAvatarColor(patient.name);
  const initials    = getInitials(patient.name);

  const sortedAlerts   = sortAlertsBySeverity(patient.alerts);
  const hasCritical    = sortedAlerts.some((a) => getSeverity(a) === "critical");
  const [localNotes,   setLocalNotes]   = useState(patient.notes || []);
  const [verification, setVerification] = useState({
    phoneVerified:     patient.phoneVerified     ?? false,
    insuranceVerified: patient.insuranceVerified ?? false,
    idVerified:        patient.idVerified        ?? false,
    consentSigned:     patient.consentSigned     ?? false,
    documentsComplete: patient.documentsComplete ?? false,
  });
  const [commPrefs,    setCommPrefs]    = useState(null);
  const [guardianData, setGuardianData] = useState(null);
  const [patientFlags, setPatientFlags] = useState(null);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(patient.acknowledgedAlerts || []);
  const isSensitive = !!(patient.flags?.vip || patient.flags?.sensitive || patient.flags?.staffFamily);
  const [sensitiveLocked, setSensitiveLocked] = useState(isSensitive);
  const [printOpen, setPrintOpen] = useState(false);

  const canViewMedical  = can(role, "viewMedical");
  const canViewBilling  = can(role, "viewBilling");
  const canViewAudit    = can(role, "viewAudit");

  const { level: riskLevel } = calcRiskScore(patient);
  const [consents, setConsents] = useState(patient.consents || {});

  function acknowledgeAlert(alert) {
    if (!acknowledgedAlerts.includes(alert)) {
      setAcknowledgedAlerts([...acknowledgedAlerts, alert]);
    }
  }

  function handlePatientUpdate(updatedPatient) {
    onEdit?.(updatedPatient);
  }

  function handleNavigateToPatient(patientId) {
    // In a real app, this would navigate to the patient's profile
    console.log("Navigate to patient:", patientId);
    alert(`Navigating to patient ${patientId} (navigation would happen here)`);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      // Don't fire inside inputs/selects/textareas
      if (["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "Escape") { onBack(); return; }
      if (e.key === "e" || e.key === "E") { onEdit(); return; }
      if (e.key === "f" || e.key === "F") { setActiveSection("followup"); return; }
      if (e.key === "d" || e.key === "D") { setActiveSection("documents"); return; }
      if (e.key === "t" || e.key === "T") { setActiveSection("timeline"); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onEdit]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Critical Alert Banner (only when critical alerts exist) ── */}
      <CriticalAlertBanner alerts={patient.alerts} />

      {/* ── Smart Warning Bar — persistent, non-dismissable ── */}
      <SmartWarningBar patient={patient} consents={consents} />

      {/* ── Smart Snapshot ── */}
      <SmartSnapshotBanner patient={patient} consents={consents} />

      {/* ── Data Integrity Panel ── */}
      <DataIntegrityPanel
        patient={patient}
        onFixIssue={(issue) => {
          // Navigate to edit mode to fix the issue
          onEdit();
        }}
      />

      {/* ── Critical Alert Override (for viewing mode) ── */}
      {patient.alerts.length > 0 && (
        <CriticalAlertOverride
          patient={patient}
          acknowledgedAlerts={acknowledgedAlerts.reduce((acc, alert) => ({ ...acc, [alert]: true }), {})}
          onAcknowledge={(alert) => acknowledgeAlert(alert)}
        />
      )}

      {/* ── Pinned Notes Strip ── */}
      <PinnedNotesStrip notes={localNotes} />

      {/* ── Sticky Header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 13 }} onClick={onBack}>
            <i className="ti ti-arrow-left" style={{ fontSize: 14 }} /> Patients
          </button>

          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: avatarColor + "22", color: avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700,
          }}>
            {initials}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{patient.name}</span>
              <StatusBadge status={patient.status} />
              {/* Show severity-aware chips, sorted critical first */}
              {sortedAlerts.map((a) => (
                <SeverityAlertChip
                  key={a}
                  alert={a}
                  acknowledged={acknowledgedAlerts.includes(a)}
                  onAcknowledge={() => acknowledgeAlert(a)}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--accent)" }}>{patient.id}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>·</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{patient.age}y {patient.gender}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>·</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{patient.doctor}</span>
              <InsuranceBadge status={patient.insuranceStatus} />
              <RiskBadge patient={patient} />
              <ConsentBadge consents={consents} />
              <CompactVerificationBadge verification={verification} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }} className="desktop-only">
            {/* Emergency View button — always shown, styled more urgent when critical */}
            <button
              onClick={() => setEmergencyOpen(true)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: hasCritical ? "#ef4444" : "#fee2e2",
                color: hasCritical ? "#fff" : "#991b1b",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: hasCritical ? "0 2px 8px rgba(239,68,68,0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <i className="ti ti-emergency-bed" style={{ fontSize: 15 }} />
              Emergency View
            </button>
            {isSensitive && (
              <button
                onClick={() => setSensitiveLocked(true)}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid #7c4fff40",
                  background: "#7c4fff15", color: "#7c4fff",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                title="Re-lock this sensitive record"
              >
                <i className="ti ti-shield-lock" style={{ fontSize: 15 }} />
                Sensitive
              </button>
            )}
            <button
              onClick={() => setPrintOpen(true)}
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
              title="Print patient summary"
            >
              <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
            </button>
            <button className="btn btn-primary" style={{ fontSize: 13 }}>
              <i className="ti ti-calendar" style={{ fontSize: 14 }} /> Book Appointment
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onEdit}>
              <i className="ti ti-edit" style={{ fontSize: 14 }} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Command Center Strip ── */}
      <CommandCenterStrip patient={patient} consents={consents} verification={verification} />

      {/* ── Next Best Action Bar — always visible ── */}
      <NextBestActionBar patient={patient} consents={consents} />

      {/* ── Mobile Header ── */}
      <div className="mobile-only" style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
          Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {patient.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {patient.id} · {patient.age}y · {patient.gender || "—"}
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: avatarColor + "22", color: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700,
        }}>
          {initials}
        </div>
      </div>

      {/* ── Three-Panel Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT — Patient Summary (Desktop) */}
        <div className="desktop-only" style={{

          width: 240, flexShrink: 0, borderRight: "1px solid var(--border)",
          overflow: "auto", padding: 16, background: "var(--surface)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Avatar */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: avatarColor + "22", color: avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700,
              }}>
                {initials}
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{patient.name}</span>
              <BloodGroupBadge group={patient.bloodGroup} />
            </div>

            {/* Personal */}
            <div>
              <SectionLabel>Personal</SectionLabel>
              <InfoRow label="DOB"         value={fmtDate(patient.dob)} />
              <InfoRow label="Age"         value={`${patient.age} years`} />
              <InfoRow label="Gender"      value={patient.gender} />
              <InfoRow label="Nationality" value={patient.nationality} />
            </div>

            {/* Contact */}
            <div>
              <SectionLabel>Contact</SectionLabel>
              <InfoRow label="Phone"   value={patient.phone}   mono />
              <InfoRow label="Email"   value={patient.email} />
              <InfoRow label="Address" value={patient.address} />
            </div>

            {/* Emergency */}
            <div>
              <SectionLabel>Emergency</SectionLabel>
              <InfoRow label="Name"     value={patient.emergencyName} />
              <InfoRow label="Relation" value={patient.emergencyRelation} />
              <InfoRow label="Phone"    value={patient.emergencyPhone} mono />
            </div>

            {/* Insurance */}
            <div>
              <SectionLabel>Insurance</SectionLabel>
              {canViewBilling ? (
                <>
                  <InfoRow label="Provider" value={patient.insurer} />
                  <InfoRow label="Policy"   value={patient.policyNumber} mono />
                  <InfoRow label="Expiry"   value={fmtDate(patient.insuranceExpiry)} />
                  <div style={{ padding: "5px 0" }}>
                    <InsuranceBadge status={patient.insuranceStatus} />
                  </div>
                </>
              ) : (
                <InsuranceBadge status={patient.insuranceStatus} />
              )}
            </div>

            {/* Workflow Intelligence */}
            <div>
              <SectionLabel>Activity</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <LastActionTracker auditEntries={auditEntries} />
                <ActionHistorySummary auditEntries={auditEntries} />
              </div>
            </div>

            {/* Pending Tasks */}
            <div>
              <SectionLabel>Tasks</SectionLabel>
              <PendingTasksWidget
                patient={patient}
                onTaskComplete={(updatedPatient) => {
                  // In a real app, this would update the patient state
                  console.log("Task completed:", updatedPatient);
                }}
                onEdit={onEdit}
              />
            </div>

            {/* Medical */}
            <div>
              <SectionLabel>Medical</SectionLabel>
              {canViewMedical ? (
                <>
                  {patient.allergies && <InfoRow label="Allergies" value={patient.allergies} />}
                  {patient.conditions.length > 0 && (
                    <div style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Conditions</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {patient.conditions.map((c) => <SeverityAlertChip key={c} alert={c} />)}
                      </div>
                    </div>
                  )}
                  {patient.medications.length > 0 && (
                    <InfoRow label="Medications" value={patient.medications.join(", ")} />
                  )}
                </>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 10px", borderRadius: 8,
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  fontSize: 12, color: "var(--muted)",
                }}>
                  <i className="ti ti-lock" style={{ fontSize: 13 }} />
                  Medical info restricted to doctors
                </div>
              )}
            </div>

            {/* Verification */}
            <VerificationPanel
              verification={verification}
              onToggle={(key) => setVerification((v) => ({ ...v, [key]: !v[key] }))}
            />

            {/* Profile Completion */}
            <ProfileCompletion patient={patient} consents={consents} verification={verification} />
          </div>
        </div>

        {/* LEFT — Patient Summary (Mobile Collapsible) */}
        <div className="mobile-only" style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}>
          <button
            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
            style={{
              width: "100%", padding: "12px 16px",
              background: "none", border: "none",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Patient Summary</span>
            <i className={`ti ti-chevron-${mobileSummaryOpen ? "up" : "down"}`} style={{ fontSize: 14 }} />
          </button>
          {mobileSummaryOpen && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Personal */}
              <div style={{ padding: "12px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Personal</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>DOB</div>
                    <div style={{ fontSize: 12 }}>{fmtDate(patient.dob)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Age</div>
                    <div style={{ fontSize: 12 }}>{patient.age}y</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Gender</div>
                    <div style={{ fontSize: 12 }}>{patient.gender || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Blood</div>
                    <BloodGroupBadge group={patient.bloodGroup} />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div style={{ padding: "12px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Contact</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>Phone:</span> {patient.phone || "—"}
                </div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>Email:</span> {patient.email || "—"}
                </div>
              </div>

              {/* Emergency */}
              <div style={{ padding: "12px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Emergency</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>Name:</span> {patient.emergencyName || "—"}
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--muted)" }}>Phone:</span> {patient.emergencyPhone || "—"}
                </div>
              </div>

              {/* Insurance */}
              <div style={{ padding: "12px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Insurance</div>
                <InsuranceBadge status={patient.insuranceStatus} />
              </div>

              {/* Medical */}
              {patient.allergies && (
                <div style={{ padding: "12px", borderRadius: 8, background: "#fee2e2", border: "1px solid #ef444430" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>Allergies</div>
                  <div style={{ fontSize: 12, color: "#991b1b" }}>{patient.allergies}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER — Sections */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
          {/* Section tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid var(--border)",
            background: "var(--surface)", flexShrink: 0, overflowX: "auto",
          }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  padding: "10px 14px", fontSize: 13, cursor: "pointer",
                  background: "transparent", border: "none",
                  borderBottom: activeSection === s.id ? "2px solid var(--accent)" : "2px solid transparent",
                  color: activeSection === s.id ? "var(--accent)" : "var(--muted)",
                  fontWeight: activeSection === s.id ? 600 : 400,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <i className={`ti ${s.icon}`} style={{ fontSize: 14 }} />
                {s.label}
                {s.id === "followup" && patient.followUpDate && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                )}
                {s.id === "notes" && (patient.notes || []).some((n) => n.pinned) && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                )}
                {s.id === "consent" && Object.keys(consents).filter((k) => !k.includes("_") && consents[k]).length < 5 && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                )}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {activeSection === "timeline"  && <PatientTimeline   patient={patient} />}
            {activeSection === "snapshot"  && <HealthSnapshot     patient={patient} acknowledgedAlerts={acknowledgedAlerts} onAcknowledgeAlert={acknowledgeAlert} />}
            {activeSection === "journey"   && <PatientJourneyMap  patient={patient} />}
            {activeSection === "documents" && <PatientDocuments  patient={patient} role={role} />}
            {activeSection === "notes"     && <PatientNotes notes={localNotes} onNotesChange={setLocalNotes} patient={patient} />}
            {activeSection === "family"    && <FamilyLinks       patient={patient} />}
            {activeSection === "followup"  && <FollowUpPanel     patient={patient} />}
            {activeSection === "consent"   && <ConsentManager    patient={{ ...patient, consents }} role={role} onConsentsChange={setConsents} />}
            {activeSection === "comms"     && <CommPrefsPanel    patient={{ ...patient, ...(commPrefs || {}) }} onChange={setCommPrefs} />}
            {activeSection === "readiness" && <VisitReadinessPanel patient={patient} verification={verification} />}
            {activeSection === "guardian"  && <GuardianPanel     patient={{ ...patient, ...(guardianData || {}) }} onChange={setGuardianData} />}
            {activeSection === "flags"     && <PatientFlagsPanel patient={{ ...patient, flags: patientFlags ?? patient.flags }} onChange={setPatientFlags} />}
            {activeSection === "heatmap"   && <ActivityHeatmap   patient={patient} />}
            {activeSection === "audit"     && (canViewAudit
              ? <AuditLog auditEntries={auditEntries} />
              : <div style={{ display:"flex", alignItems:"center", gap:8, padding:"24px 0", color:"var(--muted)", fontSize:13 }}>
                  <i className="ti ti-lock" style={{ fontSize:16 }} /> Audit log is restricted to admins.
                </div>
            )}
          </div>
        </div>

        {/* RIGHT — Quick Actions + Stats */}
        <div className="desktop-only" style={{
          width: 220, flexShrink: 0, borderLeft: "1px solid var(--border)",
          overflow: "auto", padding: 14, background: "var(--surface)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Quick Actions */}
            <div>
              <SectionLabel>Quick Actions</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {QUICK_ACTIONS.map((a) => (
                  <button key={a.label} className="btn btn-ghost"
                    style={{ justifyContent: "flex-start", fontSize: 12, padding: "7px 10px" }}>
                    <i className={`ti ${a.icon}`} style={{ fontSize: 15, color: a.color }} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

            {/* Visit Summary */}
            <div>
              <SectionLabel>Visit Summary</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <StatCard label="Last Visit"        value={fmtDate(patient.lastVisit)} />
                <StatCard
                  label="Next Appointment"
                  value={patient.nextAppointment ? fmtDate(patient.nextAppointment) : "Not scheduled"}
                />
                <StatCard
                  label="Total Visits"
                  value={patient.timeline.filter((t) => t.type === "consultation").length}
                  large
                />
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

            {/* Alerts — severity-aware */}
            <div>
              <SectionLabel>Alerts</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {sortedAlerts.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>No active alerts</span>
                )}
                {sortedAlerts.map((a) => (
                  <SeverityAlertChip
                    key={a}
                    alert={a}
                    acknowledged={acknowledgedAlerts.includes(a)}
                    onAcknowledge={() => acknowledgeAlert(a)}
                  />
                ))}
              </div>
            </div>

            {/* Emergency View shortcut in sidebar too */}
            <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
            <button
              onClick={() => setEmergencyOpen(true)}
              style={{
                padding: "9px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: `1px solid ${hasCritical ? "#ef4444" : "#fca5a5"}`,
                background: hasCritical ? "#ef444415" : "#fff5f5",
                color: "#991b1b",
                display: "flex", alignItems: "center", gap: 6,
                width: "100%",
              }}
            >
              <i className="ti ti-emergency-bed" style={{ fontSize: 14, color: "#ef4444" }} />
              Emergency View
            </button>
          </div>
        </div>
      </div>

      {/* Mobile action bar - enhanced with better touch targets and visual polish */}
      <div className="mobile-only" style={{
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        padding: "12px 16px", display: "flex", gap: 8, overflowX: "auto",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
      }}>
        <button
          onClick={() => setEmergencyOpen(true)}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "12px 16px",
            background: hasCritical ? "#ef4444" : "#fee2e2",
            border: hasCritical ? "2px solid #dc2626" : "1px solid #fecaca",
            borderRadius: 12, cursor: "pointer", minWidth: 64, flexShrink: 0,
            minHeight: 64, transition: "all 0.2s ease",
            boxShadow: hasCritical ? "0 4px 12px rgba(239,68,68,0.3)" : "0 2px 8px rgba(0,0,0,0.05)",
          }}
          onTouchStart={(e) => e.currentTarget.style.transform = "scale(0.95)"}
          onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <i className="ti ti-emergency-bed" style={{ fontSize: 22, color: hasCritical ? "#fff" : "#dc2626" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: hasCritical ? "#fff" : "#dc2626" }}>Emergency</span>
        </button>
        {MOBILE_ACTIONS.map((a) => (
          <button key={a.label} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "12px 16px",
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 12, cursor: "pointer", minWidth: 64, flexShrink: 0,
            minHeight: 64, transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
          onTouchStart={(e) => e.currentTarget.style.transform = "scale(0.95)"}
          onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            <i className={`ti ${a.icon}`} style={{ fontSize: 22, color: "var(--accent)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text)" }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Emergency modal */}
      {emergencyOpen && <EmergencyView patient={patient} onClose={() => setEmergencyOpen(false)} />}

      {/* Sensitive Lock overlay */}
      {sensitiveLocked && (
        <SensitiveLockModal
          patient={patient}
          onUnlock={() => setSensitiveLocked(false)}
          onClose={onBack}
        />
      )}

      {/* Print Summary modal */}
      {printOpen && (
        <PrintSummaryModal
          patient={patient}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, large }) {
  return (
    <div style={{ padding: "8px 10px", background: "var(--surface2)", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: large ? 22 : 13, fontWeight: large ? 700 : 500 }}>{value}</div>
    </div>
  );
}

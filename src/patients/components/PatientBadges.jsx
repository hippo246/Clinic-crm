import { STATUS_CONFIG, ALERT_CONFIG, INS_CONFIG, AVATAR_COLORS, RISK_CONFIG, CONSENT_TYPES } from "../constants/patientConstants";
import { getInitials, getAvatarColor, calcRiskScore } from "../utils/patientUtils";

export function StatusBadge({ status, size = "sm" }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG["Inactive"];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 20,
        fontSize: size === "sm" ? 11 : 12, fontWeight: 500,
        background: c.bg, color: c.color, whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

export function AlertChip({ alert }) {
  const c = ALERT_CONFIG[alert] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 9px", borderRadius: 20,
        fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
        background: c.bg, color: c.color,
      }}
    >
      ⚠ {alert}
    </span>
  );
}

export function InsuranceBadge({ status }) {
  const c = INS_CONFIG[status] || INS_CONFIG["None"];
  const icon = status === "Active" ? "✓" : status === "Expiring" ? "!" : status === "Expired" ? "✕" : "—";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 7px", borderRadius: 4,
        fontSize: 11, fontWeight: 500,
        background: c.bg, color: c.color,
      }}
    >
      {icon} {status}
    </span>
  );
}

export function AvatarCircle({ name, size = "sm" }) {
  const bg    = getAvatarColor(name);
  const dim   = size === "lg" ? 56 : size === "md" ? 40 : 36;
  const fsize = size === "lg" ? 18 : size === "md" ? 15 : 13;
  return (
    <div
      style={{
        width: dim, height: dim, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: fsize, fontWeight: 600,
        background: bg + "22", color: bg,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function BloodGroupBadge({ group }) {
  return (
    <span
      style={{
        background: "#fee2e2", color: "#991b1b",
        fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
      }}
    >
      {group}
    </span>
  );
}

export function PriorityTag({ priority }) {
  const config = {
    High:   { bg: "#fee2e2", color: "#991b1b" },
    Medium: { bg: "#fef3c7", color: "#92400e" },
    Low:    { bg: "#dcfce7", color: "#15803d" },
  };
  const c = config[priority] || config.Low;
  return (
    <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>
      {priority}
    </span>
  );
}

export function RiskBadge({ patient, showScore = false }) {
  const { score, level } = calcRiskScore(patient);
  const c = RISK_CONFIG[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color,
      border: `1px solid ${c.dot}40`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {level} Risk
      {showScore && <span style={{ opacity: 0.7, fontSize: 10 }}>· {score}</span>}
    </span>
  );
}

export function ConsentBadge({ consents = {} }) {
  const total   = CONSENT_TYPES.length;
  const signed  = CONSENT_TYPES.filter((c) => consents[c.key]).length;
  const missing = total - signed;
  const allDone = missing === 0;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: allDone ? "#dcfce7" : "#fee2e2",
      color:      allDone ? "#15803d" : "#991b1b",
      border: `1px solid ${allDone ? "#22c55e40" : "#ef444440"}`,
      whiteSpace: "nowrap",
    }}>
      <i className={`ti ${allDone ? "ti-writing" : "ti-alert-triangle"}`} style={{ fontSize: 10 }} />
      {allDone ? "Consents OK" : `${missing} Consent${missing > 1 ? "s" : ""} Missing`}
    </span>
  );
}

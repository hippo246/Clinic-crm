import React from "react";
import type { Patient, PatientStatus, InsuranceStatus, AlertType, RiskLevel } from "./types";
import { STATUS_CONFIG, ALERT_CONFIG, INS_CONFIG, RISK_CONFIG } from "./constants";
import { getInitials, getAvatarColor, calcRiskScore } from "./utils";

// ─── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: PatientStatus | string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG["Inactive"];
  return (
    <span className="badge" style={{ background: c.bg, color: c.color }}>
      <span className="badge-dot" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

// ─── Alert Chip ────────────────────────────────────────────────────────────────
export function AlertChip({ alert }: { alert: AlertType | string }) {
  const c = ALERT_CONFIG[alert as AlertType] || { bg: "#f1f5f9", color: "#475569" };
  const isCritical = c.severity === "critical";
  return (
    <span className="badge" style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.color}30`,
      fontWeight: isCritical ? 700 : 600,
    }}>
      {isCritical && <i className="ti ti-alert-triangle" style={{ fontSize: 10 }} />}
      {alert}
    </span>
  );
}

// ─── Insurance Badge ───────────────────────────────────────────────────────────
export function InsuranceBadge({ status }: { status: InsuranceStatus | string }) {
  const c = INS_CONFIG[status as InsuranceStatus] || INS_CONFIG["None"];
  const icons: Record<string, string> = {
    Active: "ti-shield-check", Expiring: "ti-shield-exclamation",
    Expired: "ti-shield-x", None: "ti-shield-off",
  };
  return (
    <span className="tag" style={{ background: c.bg, color: c.color }}>
      <i className={`ti ${icons[status] || "ti-shield"}`} style={{ fontSize: 10 }} />
      {status}
    </span>
  );
}

// ─── Risk Badge ────────────────────────────────────────────────────────────────
export function RiskBadge({
  patient,
  showScore = false,
}: {
  patient: Partial<Patient> | null;
  showScore?: boolean;
}) {
  const { score, level } = calcRiskScore(patient || {});
  const c = RISK_CONFIG[level] || RISK_CONFIG.Low;
  return (
    <span className="badge" style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.dot}40`,
    }}>
      <span className="badge-dot" style={{ background: c.dot }} />
      {level} Risk
      {showScore && <span style={{ opacity: 0.6, fontSize: 10 }}>· {score}</span>}
    </span>
  );
}

// ─── Blood Group Badge ─────────────────────────────────────────────────────────
export function BloodGroupBadge({ group }: { group: string }) {
  return (
    <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>
      <i className="ti ti-droplet" style={{ fontSize: 10 }} />
      {group}
    </span>
  );
}

// ─── Avatar Circle ─────────────────────────────────────────────────────────────
export function AvatarCircle({
  name = "Unknown",
  size = "sm",
}: {
  name?: string;
  size?: "sm" | "md" | "lg";
}) {
  const bg   = getAvatarColor(name);
  const cls  = size === "lg" ? "avatar-xl" : size === "md" ? "avatar-lg" : "avatar";
  return (
    <div className={cls} style={{ background: bg + "22", color: bg }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Verification Dot ──────────────────────────────────────────────────────────
export function VerifiedDot({ done }: { done: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, borderRadius: "50%",
      background: done ? "#dcfce7" : "#fee2e2",
      color:      done ? "#16a34a" : "#dc2626",
      fontSize: 10,
    }}>
      <i className={`ti ${done ? "ti-check" : "ti-x"}`} />
    </span>
  );
}

// ─── Priority Tag ──────────────────────────────────────────────────────────────
export function PriorityTag({ priority }: { priority: "High" | "Medium" | "Low" | null }) {
  const config = {
    High:   { bg: "#fee2e2", color: "#991b1b" },
    Medium: { bg: "#fef3c7", color: "#92400e" },
    Low:    { bg: "#dcfce7", color: "#15803d" },
  };
  if (!priority) return null;
  const c = config[priority] || config.Low;
  return (
    <span className="tag" style={{ background: c.bg, color: c.color }}>
      {priority}
    </span>
  );
}

// ─── Consent Badge ─────────────────────────────────────────────────────────────
export function ConsentBadge({
  consentSigned,
}: {
  consentSigned: boolean;
}) {
  return (
    <span className="badge" style={{
      background: consentSigned ? "#dcfce7" : "#fee2e2",
      color:      consentSigned ? "#15803d" : "#991b1b",
      border: `1px solid ${consentSigned ? "#22c55e40" : "#ef444440"}`,
    }}>
      <i className={`ti ${consentSigned ? "ti-writing" : "ti-alert-triangle"}`} style={{ fontSize: 10 }} />
      {consentSigned ? "Consent OK" : "Consent Missing"}
    </span>
  );
}

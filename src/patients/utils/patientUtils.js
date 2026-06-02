import { AVATAR_COLORS } from "../constants/patientConstants";

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

export function fmtDateShort(d) {
  return d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : "—";
}

export function calcAge(dob) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function getAvatarColor(name) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export function getInitials(name) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("");
}

export function filterPatients(patients, { search, filterStatus, filterDoctor, filterInsurance }) {
  let list = patients;

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.policyNumber && p.policyNumber.toLowerCase().includes(q))
    );
  }
  if (filterStatus !== "All") list = list.filter((p) => p.status === filterStatus);
  if (filterDoctor !== "All") list = list.filter((p) => p.doctor === filterDoctor);
  if (filterInsurance !== "All") list = list.filter((p) => p.insuranceStatus === filterInsurance);

  return list;
}

export function sortPatients(list, sortKey, sortDir) {
  return [...list].sort((a, b) => {
    let av = a[sortKey] ?? "";
    let bv = b[sortKey] ?? "";
    if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
}

// ─── RISK SCORE ───────────────────────────────────────────────────────────────
const CRITICAL_ALERTS = ["Allergy", "Heart Condition", "Pregnancy", "High Risk"];
const CHRONIC_ALERTS  = ["Diabetic", "Hypertension"];

export function calcRiskScore(patient) {
  let score = 0;

  // Critical medical alert: +30 each
  const criticals = (patient.alerts || []).filter((a) => CRITICAL_ALERTS.includes(a));
  score += criticals.length * 30;

  // Chronic condition: +15 each
  const chronics = (patient.alerts || []).filter((a) => CHRONIC_ALERTS.includes(a));
  score += chronics.length * 15;

  // Age risk: 65+ = +20, 75+ = +35
  const age = patient.age || 0;
  if (age >= 75) score += 35;
  else if (age >= 65) score += 20;

  // Missed follow-up (status is Follow-Up Due): +20
  if (patient.status === "Follow-Up Due") score += 20;

  // Unverified documents: +10
  const unverifiedCount = [
    patient.phoneVerified,
    patient.insuranceVerified,
    patient.idVerified,
    patient.consentSigned,
    patient.documentsComplete,
  ].filter((v) => !v).length;
  score += unverifiedCount * 2; // mild per missing

  // Insurance expired/expiring: +15 / +8
  if (patient.insuranceStatus === "Expired")  score += 15;
  if (patient.insuranceStatus === "Expiring") score += 8;

  // Recent emergency note in timeline
  const hasRecentEmergency = (patient.timeline || []).some(
    (t) => t.type === "note" && t.note && t.note.toLowerCase().includes("emergency")
  );
  if (hasRecentEmergency) score += 25;

  // Consent not signed: +10
  if (!patient.consentSigned) score += 10;

  // Derive label
  let level;
  if      (score >= 80) level = "Critical";
  else if (score >= 50) level = "High";
  else if (score >= 25) level = "Medium";
  else                  level = "Low";

  return { score, level };
}

// ─── SMART SNAPSHOT ───────────────────────────────────────────────────────────
export function buildSmartSnapshot(patient) {
  const parts = [];
  const now = new Date();

  // Last seen
  if (patient.lastVisit) {
    const days = Math.floor((now - new Date(patient.lastVisit)) / 86400000);
    parts.push(`Last seen ${days} day${days !== 1 ? "s" : ""} ago${patient.doctor ? ` by ${patient.doctor}` : ""}.`);
  }

  // Follow-up overdue
  if (patient.status === "Follow-Up Due") parts.push("Follow-up overdue.");
  if (patient.followUpDate && new Date(patient.followUpDate) < now) parts.push("Scheduled follow-up is past due.");

  // Insurance expiry
  if (patient.insuranceExpiry) {
    const daysLeft = Math.floor((new Date(patient.insuranceExpiry) - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 30) parts.push(`Insurance expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`);
    if (daysLeft < 0) parts.push("Insurance has expired.");
  }

  // Critical allergies
  if (patient.allergies) parts.push(`Critical allergy: ${patient.allergies}.`);

  // Critical alerts
  const criticals = (patient.alerts || []).filter((a) => ["Allergy","Heart Condition","Pregnancy","High Risk"].includes(a));
  if (criticals.length > 0) parts.push(`Alert: ${criticals.join(", ")}.`);

  // Consent missing
  if (!patient.consentSigned) parts.push("Consent not yet signed.");

  return parts.length > 0 ? parts.join(" ") : "No urgent flags for this patient.";
}

// ─── VISIT READINESS ──────────────────────────────────────────────────────────
export function calcVisitReadiness(patient, verification = {}) {
  const items = [
    { key: "phoneVerified",     label: "Phone Verified",        done: verification.phoneVerified     ?? patient.phoneVerified     ?? false },
    { key: "idVerified",        label: "ID Verified",           done: verification.idVerified        ?? patient.idVerified        ?? false },
    { key: "consentSigned",     label: "Consent Signed",        done: verification.consentSigned     ?? patient.consentSigned     ?? false },
    { key: "insuranceVerified", label: "Insurance Valid",       done: verification.insuranceVerified ?? patient.insuranceVerified ?? false },
    { key: "emergencyContact",  label: "Emergency Contact Added",done: !!(patient.emergencyName && patient.emergencyPhone)                 },
    { key: "documentsComplete", label: "Documents Complete",    done: verification.documentsComplete ?? patient.documentsComplete ?? false },
    { key: "alertsReviewed",    label: "Medical Alerts Reviewed",done: (patient.alerts || []).length === 0 || !!(patient.alertsReviewed)   },
  ];
  const done = items.filter((i) => i.done).length;
  const ready = done === items.length;
  return { items, done, total: items.length, ready };
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────
export function buildHeatmapData(patient) {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), visits: 0, missed: 0 });
  }
  (patient.timeline || []).forEach((t) => {
    if (!["consultation","appointment"].includes(t.type)) return;
    const d = new Date(t.date);
    const entry = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (!entry) return;
    if (t.type === "consultation") entry.visits++;
    if (t.type === "appointment" && t.status === "missed") entry.missed++;
  });
  return months;
}

export function getPatientStats(patients) {
  return {
    total:         patients.length,
    active:        patients.filter((p) => p.status === "Active").length,
    followUpDue:   patients.filter((p) => p.status === "Follow-Up Due").length,
    newPatients:   patients.filter((p) => p.status === "New").length,
    insExpiring:   patients.filter((p) => p.insuranceStatus === "Expiring").length,
  };
}

// ─── NEXT BEST ACTION ─────────────────────────────────────────────────────────
export function calcNextBestAction(patient) {
  const now = new Date();

  // 1. Critical medical alert with no documented note
  const hasCriticalAlert = (patient.alerts || []).some((a) =>
    ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(a)
  );
  if (hasCriticalAlert && !patient.alertsReviewed) {
    return {
      label:  "Review Medical Alert",
      detail: "Critical alert requires staff acknowledgement",
      icon:   "ti-alert-triangle",
      color:  "#ef4444",
      bg:     "#fee2e2",
      urgency: "critical",
    };
  }

  // 2. Expired insurance
  if (patient.insuranceStatus === "Expired") {
    return {
      label:  "Verify Insurance",
      detail: "Insurance has expired — update before next visit",
      icon:   "ti-shield-exclamation",
      color:  "#ef4444",
      bg:     "#fee2e2",
      urgency: "critical",
    };
  }

  // 3. Follow-up overdue
  if (patient.status === "Follow-Up Due" ||
      (patient.followUpDate && new Date(patient.followUpDate) < now)) {
    return {
      label:  "Call for Follow-Up",
      detail: patient.followUpReason || "Scheduled follow-up is overdue",
      icon:   "ti-phone",
      color:  "#f59e0b",
      bg:     "#fef3c7",
      urgency: "high",
    };
  }

  // 4. Consent missing
  if (!patient.consentSigned) {
    return {
      label:  "Upload Missing Consent",
      detail: "Patient consent form has not been collected",
      icon:   "ti-writing",
      color:  "#f97316",
      bg:     "#fff7ed",
      urgency: "high",
    };
  }

  // 5. Insurance expiring within 30 days
  if (patient.insuranceStatus === "Expiring") {
    return {
      label:  "Verify Insurance",
      detail: "Insurance expiring soon — confirm renewal",
      icon:   "ti-shield",
      color:  "#f59e0b",
      bg:     "#fef3c7",
      urgency: "medium",
    };
  }

  // 6. Missing emergency contact
  if (!patient.emergencyName || !patient.emergencyPhone) {
    return {
      label:  "Update Emergency Contact",
      detail: "No emergency contact on file",
      icon:   "ti-phone-call",
      color:  "#7c4fff",
      bg:     "#ede9fe",
      urgency: "medium",
    };
  }

  // 7. No visit in 90+ days
  if (patient.lastVisit) {
    const daysSince = Math.floor((now - new Date(patient.lastVisit)) / 86400000);
    if (daysSince >= 90) {
      return {
        label:  "Schedule Review Visit",
        detail: `No visit recorded in ${daysSince} days`,
        icon:   "ti-calendar-plus",
        color:  "#4f7cff",
        bg:     "#eff6ff",
        urgency: "medium",
      };
    }
  }

  // 8. Documents or ID unverified
  if (!patient.idVerified || !patient.documentsComplete) {
    return {
      label:  "Complete Verification",
      detail: "ID or documents still require verification",
      icon:   "ti-shield-check",
      color:  "#64748b",
      bg:     "#f1f5f9",
      urgency: "low",
    };
  }

  // 9. No next appointment scheduled
  if (!patient.nextAppointment) {
    return {
      label:  "Book Next Appointment",
      detail: "No upcoming appointment scheduled",
      icon:   "ti-calendar",
      color:  "#4f7cff",
      bg:     "#eff6ff",
      urgency: "low",
    };
  }

  return {
    label:  "Patient Up To Date",
    detail: "No immediate actions required",
    icon:   "ti-circle-check",
    color:  "#22c55e",
    bg:     "#dcfce7",
    urgency: "none",
  };
}

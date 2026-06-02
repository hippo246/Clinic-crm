// ─── DATA INTEGRITY & CONTRADICTION DETECTION ─────────────────────────────────────
// Hospital-grade data validation to prevent dangerous inconsistencies

/**
 * Detect data contradictions in patient records
 * Returns array of { severity, message, field } objects
 */
export function detectContradictions(patient) {
  const contradictions = [];

  // 1. Male + Pregnancy flag
  if (patient.gender === "Male" && (patient.alerts || []).includes("Pregnancy")) {
    contradictions.push({
      severity: "critical",
      message: "Male patient marked as pregnant",
      fields: ["gender", "alerts"],
      suggestion: "Remove pregnancy alert or correct gender"
    });
  }

  // 2. Age 2 + Married status (or similar logic issues)
  if (patient.age && patient.age <= 2 && patient.maritalStatus === "Married") {
    contradictions.push({
      severity: "critical",
      message: "Patient under 2 years old marked as married",
      fields: ["age", "maritalStatus"],
      suggestion: "Verify age or marital status"
    });
  }

  // 3. Expired insurance marked as Active
  if (patient.insuranceStatus === "Active" && patient.insuranceExpiry) {
    const expiry = new Date(patient.insuranceExpiry);
    if (expiry < new Date()) {
      contradictions.push({
        severity: "critical",
        message: "Insurance expired but marked as Active",
        fields: ["insuranceStatus", "insuranceExpiry"],
        suggestion: "Update insurance status to Expired"
      });
    }
  }

  // 4. Duplicate emergency contacts (same name and phone)
  if (patient.emergencyName && patient.emergencyPhone) {
    if (patient.emergencyName === patient.name && patient.emergencyPhone === patient.phone) {
      contradictions.push({
        severity: "warning",
        message: "Emergency contact is same as patient",
        fields: ["emergencyName", "emergencyPhone"],
        suggestion: "Add a different emergency contact"
      });
    }
  }

  // 5. Future date of birth
  if (patient.dob) {
    const dob = new Date(patient.dob);
    if (dob > new Date()) {
      contradictions.push({
        severity: "critical",
        message: "Date of birth is in the future",
        fields: ["dob"],
        suggestion: "Correct date of birth"
      });
    }
  }

  // 6. Age mismatch with DOB
  if (patient.dob && patient.age) {
    const calcAge = calculateAgeFromDob(patient.dob);
    if (Math.abs(calcAge - patient.age) > 1) {
      contradictions.push({
        severity: "warning",
        message: `Age (${patient.age}) doesn't match DOB (${calcAge} years old)`,
        fields: ["age", "dob"],
        suggestion: "Verify age or date of birth"
      });
    }
  }

  // 7. Invalid phone number format
  if (patient.phone) {
    const digits = patient.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      contradictions.push({
        severity: "warning",
        message: "Phone number format appears invalid",
        fields: ["phone"],
        suggestion: "Verify phone number format"
      });
    }
  }

  // 8. Missing critical data for Active status
  if (patient.status === "Active") {
    const missing = [];
    if (!patient.emergencyName || !patient.emergencyPhone) missing.push("emergency contact");
    if (!patient.consentSigned) missing.push("consent");
    if (!patient.dob) missing.push("date of birth");
    if (!patient.phone) missing.push("phone number");

    if (missing.length > 0) {
      contradictions.push({
        severity: "critical",
        message: `Patient marked Active but missing: ${missing.join(", ")}`,
        fields: ["status", ...missing.map(m => m.includes("emergency") ? "emergencyContact" : m.includes("consent") ? "consentSigned" : m.includes("date") ? "dob" : "phone")],
        suggestion: "Complete missing data before setting Active status"
      });
    }
  }

  // 9. Allergy alert without allergy details
  if ((patient.alerts || []).includes("Allergy") && !patient.allergies) {
    contradictions.push({
      severity: "warning",
      message: "Allergy alert set but no allergy details specified",
      fields: ["alerts", "allergies"],
      suggestion: "Specify allergy details or remove alert"
    });
  }

  // 10. Diabetic alert without medications
  if ((patient.alerts || []).includes("Diabetic") && (!patient.medications || patient.medications.length === 0)) {
    contradictions.push({
      severity: "info",
      message: "Diabetic alert but no medications recorded",
      fields: ["alerts", "medications"],
      suggestion: "Add current medications if applicable"
    });
  }

  return contradictions;
}

/**
 * Calculate age from date of birth
 */
function calculateAgeFromDob(dob) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Check if patient can be set to Active status
 * Returns { canActivate: boolean, missing: string[] }
 */
export function checkActivationRequirements(patient) {
  const missing = [];

  if (!patient.emergencyName || !patient.emergencyPhone) {
    missing.push("Emergency contact required");
  }
  if (!patient.consentSigned) {
    missing.push("Consent must be signed");
  }
  if (!patient.dob) {
    missing.push("Date of birth required");
  }
  if (!patient.phone) {
    missing.push("Phone number required");
  }

  // Check for critical contradictions
  const contradictions = detectContradictions(patient);
  const criticalContradictions = contradictions.filter(c => c.severity === "critical");
  if (criticalContradictions.length > 0) {
    missing.push("Resolve critical data contradictions");
  }

  return {
    canActivate: missing.length === 0,
    missing,
    contradictions: criticalContradictions
  };
}

/**
 * Get data quality score (0-100)
 */
export function calculateDataQualityScore(patient) {
  let score = 100;
  const deductions = [];

  // Missing basic info
  if (!patient.phone) { score -= 15; deductions.push("Phone"); }
  if (!patient.email) { score -= 5; deductions.push("Email"); }
  if (!patient.dob) { score -= 20; deductions.push("DOB"); }
  if (!patient.gender) { score -= 10; deductions.push("Gender"); }
  if (!patient.bloodGroup) { score -= 5; deductions.push("Blood Group"); }
  if (!patient.address) { score -= 10; deductions.push("Address"); }

  // Missing emergency contact
  if (!patient.emergencyName || !patient.emergencyPhone) {
    score -= 15;
    deductions.push("Emergency Contact");
  }

  // Missing verification
  if (!patient.phoneVerified) { score -= 5; deductions.push("Phone Verified"); }
  if (!patient.idVerified) { score -= 5; deductions.push("ID Verified"); }
  if (!patient.consentSigned) { score -= 10; deductions.push("Consent"); }

  // Missing insurance if applicable
  if (patient.insurer && patient.insurer !== "None") {
    if (!patient.insuranceVerified) { score -= 5; deductions.push("Insurance Verified"); }
  }

  // Contradictions
  const contradictions = detectContradictions(patient);
  contradictions.forEach(c => {
    if (c.severity === "critical") { score -= 15; deductions.push(c.message); }
    else if (c.severity === "warning") { score -= 5; deductions.push(c.message); }
  });

  return {
    score: Math.max(0, score),
    level: score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor",
    deductions
  };
}

/**
 * Detect stale records (no activity in X months)
 */
export function detectStaleRecord(patient, monthsThreshold = 18) {
  if (!patient.lastVisit) return { isStale: true, daysSinceLastVisit: null };

  const lastVisit = new Date(patient.lastVisit);
  const now = new Date();
  const daysSince = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));
  const monthsSince = daysSince / 30.44;

  return {
    isStale: monthsSince >= monthsThreshold,
    daysSinceLastVisit: daysSince,
    monthsSinceLastVisit: Math.floor(monthsSince),
    threshold: monthsThreshold
  };
}

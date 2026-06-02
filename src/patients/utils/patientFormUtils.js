// ─── DUPLICATE DETECTION ─────────────────────────────────────────────────────
// Returns patients that are likely the same person, with a reason label.
// Checks: exact phone, exact DOB+name similarity, fuzzy name+DOB.

export function findDuplicates(form, allPatients, excludeId = null) {
  const results = [];
  const seen    = new Set();

  const firstName = form.firstName.trim().toLowerCase();
  const lastName  = form.lastName.trim().toLowerCase();
  const phone     = normalizePhone(form.phone);
  const dob       = form.dob;

  for (const p of allPatients) {
    if (excludeId && p.id === excludeId) continue;
    if (seen.has(p.id)) continue;

    const pFirst = p.firstName.toLowerCase();
    const pLast  = p.lastName.toLowerCase();
    const pPhone = normalizePhone(p.phone);

    // 1. Exact phone match (strongest signal)
    if (phone && pPhone && phone === pPhone) {
      seen.add(p.id);
      results.push({ ...p, _matchReason: "Same phone number" });
      continue;
    }

    // 2. Same DOB + same last name (very strong)
    if (dob && p.dob === dob && lastName && pLast === lastName) {
      seen.add(p.id);
      results.push({ ...p, _matchReason: "Same DOB + last name" });
      continue;
    }

    // 3. Same full name (different phone — could be update)
    if (firstName && lastName && firstName === pFirst && lastName === pLast) {
      seen.add(p.id);
      results.push({ ...p, _matchReason: "Same full name" });
      continue;
    }

    // 4. Fuzzy: same DOB + first name sounds alike (Levenshtein ≤ 1)
    if (dob && p.dob === dob && firstName && levenshtein(firstName, pFirst) <= 1) {
      seen.add(p.id);
      results.push({ ...p, _matchReason: "Similar name + same DOB" });
    }
  }

  return results;
}

function normalizePhone(raw = "") {
  return raw.replace(/\D/g, "").slice(-10); // last 10 digits
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────
const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePatient(form) {
  const errs = {};

  // Personal
  if (!form.firstName.trim())   errs.firstName  = "First name is required";
  if (!form.lastName.trim())    errs.lastName   = "Last name is required";
  if (!form.dob)                errs.dob        = "Date of birth is required";
  else if (new Date(form.dob) >= new Date()) errs.dob = "DOB must be in the past";
  if (!form.gender)             errs.gender     = "Gender is required";
  if (!form.bloodGroup)         errs.bloodGroup = "Blood group is required";

  // Contact
  if (!form.phone.trim())       errs.phone      = "Phone is required";
  else if (!PHONE_RE.test(form.phone.trim())) errs.phone = "Enter a valid Indian mobile number";

  if (form.email && !EMAIL_RE.test(form.email.trim())) errs.email = "Enter a valid email address";

  // Emergency contact
  if (!form.emergencyName.trim())     errs.emergencyName     = "Emergency contact name is required";
  if (!form.emergencyRelation)        errs.emergencyRelation = "Relation is required";
  if (!form.emergencyPhone.trim())    errs.emergencyPhone    = "Emergency phone is required";
  else if (!PHONE_RE.test(form.emergencyPhone.trim())) errs.emergencyPhone = "Enter a valid Indian mobile number";

  // Medical — if "Allergy" alert is set, allergy text is required
  if (form.alerts.includes("Allergy") && !form.allergies.trim())
    errs.allergies = "Please specify the allergy (required when Allergy alert is selected)";

  // Admin
  if (!form.doctor)  errs.doctor = "Assign a doctor";
  if (!form.status)  errs.status = "Status is required";

  // Edit-mode: reason required when medical info changed
  // (checked in buildAuditEntries; we expose the field here but don't hard-block)

  return errs;
}

// ─── AUDIT DIFF BUILDER ───────────────────────────────────────────────────────
// Human-readable field labels for the audit log
const FIELD_LABELS = {
  firstName:         "First Name",
  lastName:          "Last Name",
  name:              "Full Name",
  dob:               "Date of Birth",
  gender:            "Gender",
  bloodGroup:        "Blood Group",
  phone:             "Phone",
  email:             "Email",
  address:           "Address",
  nationality:       "Nationality",
  emergencyName:     "Emergency Contact Name",
  emergencyRelation: "Emergency Contact Relation",
  emergencyPhone:    "Emergency Contact Phone",
  doctor:            "Assigned Doctor",
  status:            "Status",
  insurer:           "Insurance Provider",
  policyNumber:      "Policy Number",
  insuranceExpiry:   "Insurance Expiry",
  insuranceStatus:   "Insurance Status",
  allergies:         "Allergies",
  conditions:        "Conditions",
  medications:       "Medications",
  alerts:            "Medical Alerts",
};

// Fields that are "medical" and require a reason when changed
const MEDICAL_FIELDS = new Set(["allergies", "conditions", "medications", "alerts"]);

export function buildAuditEntries(oldPatient, newPatient, user, changeReason = "") {
  const entries = [];
  const now     = new Date().toISOString();

  const TRACKED = Object.keys(FIELD_LABELS);

  for (const field of TRACKED) {
    const oldVal = serialize(oldPatient[field]);
    const newVal = serialize(newPatient[field]);
    if (oldVal === newVal) continue;

    entries.push({
      id:        `audit-${Date.now()}-${field}`,
      timestamp: now,
      user,
      action:    "edited",
      field,
      label:     FIELD_LABELS[field],
      oldValue:  oldVal,
      newValue:  newVal,
      reason:    MEDICAL_FIELDS.has(field) ? (changeReason || "No reason provided") : (changeReason || null),
      isMedical: MEDICAL_FIELDS.has(field),
    });
  }

  return entries;
}

function serialize(val) {
  if (Array.isArray(val)) return val.slice().sort().join(", ") || "None";
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

export const DOCTORS = ["Dr. Sharma", "Dr. Patel", "Dr. Mehta", "Dr. Iyer", "Dr. Nair"];
export const INSURERS = ["Star Health", "HDFC ERGO", "ICICI Lombard", "Bajaj Allianz", "None"];
export const GENDERS = ["Male", "Female", "Other"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const STATUSES = ["New", "Active", "Follow-Up Due", "Under Treatment", "Observation", "Inactive", "VIP"];
export const ALERT_TYPES = ["Allergy", "Diabetic", "Hypertension", "Heart Condition", "Pregnancy", "High Risk"];
export const DOC_TYPES = ["Insurance Card", "Passport", "National ID", "Consent Form", "Medical Report", "Referral Letter"];
export const RELATIONS = ["Parent", "Child", "Spouse", "Sibling", "Guardian"];

export const LANGUAGES = ["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali", "Gujarati", "Punjabi", "Urdu", "Other"];
export const CONTACT_METHODS = ["Phone", "WhatsApp", "SMS", "Email"];
export const BEST_CONTACT_TIMES = ["Morning (8am–12pm)", "Afternoon (12pm–4pm)", "Evening (4pm–8pm)", "Any time"];
export const GUARDIAN_RELATIONS = ["Parent", "Spouse", "Child", "Sibling", "Legal Guardian", "Caretaker", "Other"];
export const PATIENT_FLAGS = [
  { key: "difficultPatient",        label: "Difficult Patient",         icon: "ti-mood-angry",       color: "#ef4444" },
  { key: "paymentIssue",            label: "Payment Issue",             icon: "ti-credit-card-off",  color: "#f59e0b" },
  { key: "vip",                     label: "VIP",                       icon: "ti-crown",            color: "#f97316" },
  { key: "needsWheelchair",         label: "Needs Wheelchair",          icon: "ti-wheelchair",       color: "#4f7cff" },
  { key: "needsTranslator",         label: "Needs Translator",          icon: "ti-language",         color: "#7c4fff" },
  { key: "insuranceApprovalNeeded", label: "Insurance Approval Needed", icon: "ti-shield-exclamation",color: "#f59e0b" },
  { key: "doNotAutoMessage",        label: "Do Not Auto-Message",       icon: "ti-message-off",      color: "#64748b" },
];

export const FIRST_NAMES_M = ["Arjun","Rohan","Vikram","Karan","Aditya","Rahul","Nikhil","Sanjay","Deepak","Mohit","Suresh","Rajesh","Amit","Ankit","Vivek"];
export const FIRST_NAMES_F = ["Priya","Sneha","Ananya","Kavya","Pooja","Divya","Meera","Sunita","Rekha","Neha","Anjali","Shreya","Nisha","Ritu","Sonal"];
export const LAST_NAMES = ["Sharma","Patel","Mehta","Iyer","Nair","Gupta","Singh","Kumar","Verma","Joshi","Shah","Rao","Reddy","Mishra","Dubey"];

export const STATUS_CONFIG = {
  "New":             { bg: "#e0f2fe", color: "#0369a1", dot: "#0ea5e9" },
  "Active":          { bg: "#dcfce7", color: "#15803d", dot: "#22c55e" },
  "Follow-Up Due":   { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  "Under Treatment": { bg: "#ede9fe", color: "#5b21b6", dot: "#8b5cf6" },
  "Observation":     { bg: "#fce7f3", color: "#9d174d", dot: "#ec4899" },
  "Inactive":        { bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" },
  "VIP":             { bg: "#fff7ed", color: "#92400e", dot: "#f97316" },
};

export const ALERT_CONFIG = {
  "Allergy":         { bg: "#fee2e2", color: "#991b1b", severity: "critical" },
  "Diabetic":        { bg: "#fef3c7", color: "#92400e", severity: "medium"   },
  "Hypertension":    { bg: "#fce7f3", color: "#9d174d", severity: "medium"   },
  "Heart Condition": { bg: "#fee2e2", color: "#7f1d1d", severity: "critical" },
  "Pregnancy":       { bg: "#fdf4ff", color: "#6b21a8", severity: "critical" },
  "High Risk":       { bg: "#fee2e2", color: "#991b1b", severity: "critical" },
};

export const INS_CONFIG = {
  "Active":   { bg: "#dcfce7", color: "#15803d" },
  "Expiring": { bg: "#fef3c7", color: "#92400e" },
  "Expired":  { bg: "#fee2e2", color: "#991b1b" },
  "None":     { bg: "#f1f5f9", color: "#64748b" },
};

export const TIMELINE_TYPES = [
  { type: "created",      label: "Patient Created",         icon: "ti-user-plus",      color: "#4f7cff" },
  { type: "appointment",  label: "Appointment Booked",       icon: "ti-calendar",       color: "#7c4fff" },
  { type: "consultation", label: "Consultation Completed",   icon: "ti-stethoscope",    color: "#00b4a0" },
  { type: "prescription", label: "Prescription Issued",      icon: "ti-pill",           color: "#ff7c4f" },
  { type: "invoice",      label: "Invoice Generated",        icon: "ti-receipt",        color: "#f0a500" },
  { type: "payment",      label: "Payment Received",         icon: "ti-cash",           color: "#22c55e" },
  { type: "report",       label: "Report Uploaded",          icon: "ti-file-analytics", color: "#4f7cff" },
  { type: "followup",     label: "Follow-Up Scheduled",      icon: "ti-clock",          color: "#f0a500" },
  { type: "note",         label: "Doctor Note Added",        icon: "ti-notes",          color: "#7c4fff" },
];

export const AVATAR_COLORS = ["#4f7cff", "#7c4fff", "#00b4a0", "#f97316", "#ec4899", "#22c55e"];

export const QUICK_ACTIONS = [
  { icon: "ti-calendar",       label: "Book Appointment",   color: "#4f7cff" },
  { icon: "ti-stethoscope",    label: "Start Consultation", color: "#7c4fff" },
  { icon: "ti-pill",           label: "New Prescription",   color: "#f97316" },
  { icon: "ti-file-analytics", label: "Upload Report",      color: "#00b4a0" },
  { icon: "ti-receipt",        label: "Create Invoice",     color: "#f59e0b" },
  { icon: "ti-phone",          label: "Call Patient",       color: "#22c55e" },
  { icon: "ti-clock",          label: "Schedule Follow-Up", color: "#ec4899" },
  { icon: "ti-message",        label: "Send SMS",           color: "#4f7cff" },
];

export const MOBILE_ACTIONS = [
  { icon: "ti-calendar",    label: "Appt" },
  { icon: "ti-stethoscope", label: "Consult" },
  { icon: "ti-pill",        label: "Rx" },
  { icon: "ti-files",       label: "Docs" },
  { icon: "ti-receipt",     label: "Bill" },
  { icon: "ti-phone",       label: "Call" },
];

export const LIST_COLUMNS = [
  { key: "id",                label: "Patient ID", w: 110 },
  { key: "name",              label: "Patient",    w: 180 },
  { key: "phone",             label: "Phone",      w: 140 },
  { key: "age",               label: "Age",        w: 60  },
  { key: "gender",            label: "Gender",     w: 75  },
  { key: "doctor",            label: "Doctor",     w: 140 },
  { key: "lastVisit",         label: "Last Visit", w: 105 },
  { key: "nextAppointment",   label: "Next Appt",  w: 105 },
  { key: "status",            label: "Status",     w: 140 },
  { key: "insuranceStatus",   label: "Insurance",  w: 95  },
  { key: "alerts",            label: "Alerts",     w: 160 },
];

export const PAGE_SIZE = 20;

export const CONSENT_TYPES = [
  { key: "generalTreatment",  label: "General Treatment",  icon: "ti-stethoscope" },
  { key: "dataPrivacy",       label: "Data Privacy",       icon: "ti-lock"        },
  { key: "insuranceClaim",    label: "Insurance Consent",  icon: "ti-shield"      },
  { key: "minorGuardian",     label: "Minor/Guardian",     icon: "ti-users"       },
  { key: "procedureConsent",  label: "Procedure Consent",  icon: "ti-writing"     },
];

export const RISK_CONFIG = {
  Low:      { bg: "#dcfce7", color: "#15803d", dot: "#22c55e", icon: "ti-circle-check"     },
  Medium:   { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b", icon: "ti-alert-circle"     },
  High:     { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444", icon: "ti-alert-triangle"   },
  Critical: { bg: "#7f1d1d", color: "#fca5a5", dot: "#ef4444", icon: "ti-urgent"           },
};

// Per-doc-type metadata: whether expiry applies and whether it needs verification
export const DOC_META = {
  "Insurance Card":   { needsExpiry: true,  needsVerify: true,  icon: "ti-shield"         },
  "Passport":         { needsExpiry: true,  needsVerify: true,  icon: "ti-passport"        },
  "National ID":      { needsExpiry: true,  needsVerify: true,  icon: "ti-id"              },
  "Consent Form":     { needsExpiry: false, needsVerify: true,  icon: "ti-writing"         },
  "Medical Report":   { needsExpiry: false, needsVerify: false, icon: "ti-file-analytics"  },
  "Referral Letter":  { needsExpiry: false, needsVerify: false, icon: "ti-file-text"       },
};

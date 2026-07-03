import React, { useState, useEffect } from "react";
import type { Patient, UserRole, AlertType } from "./types";
import { DOCTORS, INSURERS, GENDERS, BLOOD_GROUPS, STATUSES, ALERT_TYPES } from "./constants";
import { calcAge } from "./utils";

interface PatientFormProps {
  mode: "create" | "edit";
  patient?: Patient | null;
  onSave: (p: Partial<Patient>) => void;
  onClose: () => void;
  role: UserRole;
}

const EMPTY: Partial<Patient> = {
  firstName: "", lastName: "", dob: "", gender: "Male", bloodGroup: "O+",
  phone: "", email: "", address: "", nationality: "Indian",
  emergencyName: "", emergencyRelation: "Spouse", emergencyPhone: "",
  insurer: "None", policyNumber: null, insuranceExpiry: null,
  allergies: "", conditions: [], medications: [], alerts: [],
  status: "New", doctor: "Dr. Sharma",
  phoneVerified: false, insuranceVerified: false, idVerified: false,
  consentSigned: false, documentsComplete: false,
  // Additional real clinic fields
  insuranceType: "", insuranceGroupNumber: "", insuranceMemberId: "",
  emergencyContact2: "", emergencyRelation2: "", emergencyPhone2: "",
  pastIllnesses: "", pastSurgeries: "", hospitalizations: "",
  familyHistory: "", socialHistory: "", occupation: "",
  smokingStatus: "", alcoholUse: "", drugUse: "",
  allergiesSeverity: "", allergiesReaction: "",
  maritalStatus: "", languages: "", religion: "",
  // Enhanced medical fields
  ethnicity: "", race: "", preferredPharmacy: "", referralSource: "",
  advanceDirectives: "", immunizationHistory: "", vaccinationStatus: "",
  primaryCarePhysician: "", preferredLanguage: "", employmentStatus: "",
  educationLevel: "", livingArrangement: "", dietaryRestrictions: "",
  exerciseFrequency: "", sleepHours: "", stressLevel: "",
  advanceCarePlanning: "", organDonor: "", bloodDonor: "",
};

export default function PatientForm({ mode, patient, onSave, onClose, role }: PatientFormProps) {
  const initial = patient ? {
    ...patient,
  } : EMPTY;

  const draftKey = mode === "create" ? "patient_form_draft_create" : `patient_form_draft_edit_${patient?.id ?? "unknown"}`;

  // Load draft on mount
  const [form, setForm] = useState<Partial<Patient>>(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // For edit mode, only restore if same patient
        if (mode === "edit" && parsed.id && parsed.id !== patient?.id) return initial;
        return { ...initial, ...parsed };
      }
    } catch { /* ignore */ }
    return initial;
  });
  const [section, setSection] = useState<"personal" | "medical" | "insurance" | "status">("personal");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Dirty = actual diff from initial (draft load doesn't auto-dirty unless values differ)
  const [isDirty, setIsDirty] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      const WATCHED_KEYS: Array<keyof Patient> = ["firstName","lastName","phone","email","dob","gender","doctor","status","insurer","insuranceExpiry","emergencyName","allergies","bloodGroup"];
      return WATCHED_KEYS.some(k => String(parsed[k] ?? "") !== String((initial as any)[k] ?? ""));
    } catch { return false; }
  });
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [chipInput, setChipInput] = useState<{ conditions: string; medications: string }>({ conditions: "", medications: "" });
  const [confirmClear, setConfirmClear] = useState<{ section: string; label: string; action: () => void } | null>(null);
  const [dupWarnings, setDupWarnings] = useState<Array<{ id: string; name: string; reason: string }>>([]);
  const [dupDismissed, setDupDismissed] = useState(false);
  const [showReview, setShowReview] = useState(false);

  function showFeedback(message: string, type: "success" | "error" | "info" = "info") {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }

  // Check if a draft exists in storage
  const [hasDraft, setHasDraft] = useState(() => !!localStorage.getItem(draftKey));

  // Auto-save draft to localStorage (scoped key)
  useEffect(() => {
    if (isDirty) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
        setDraftSaved(true);
        setHasDraft(true);
      } catch {
        showFeedback("Draft could not be saved (storage full?).", "info");
      }
      const t = setTimeout(() => setDraftSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [form, isDirty]);

  // Escape key: close with dirty check; Ctrl+S: save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!confirmClear && !showDiscardModal && !showReview) handleSubmit();
        return;
      }
      if (e.key === "Escape") {
        if (confirmClear) { setConfirmClear(null); return; }
        if (showReview) { setShowReview(false); return; }
        if (showDiscardModal) { setShowDiscardModal(false); return; }
        if (isDirty) { setShowDiscardModal(true); } else { onClose(); }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, showDiscardModal, confirmClear, showReview]);

  function update<K extends keyof Patient>(key: K, value: Patient[K]) {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      // Auto-compute name and age
      if (key === "firstName" || key === "lastName") {
        updated.name = `${updated.firstName || ""} ${updated.lastName || ""}`.trim();
      }
      if (key === "dob" && value) {
        updated.age = calcAge(value as string);
      }
      return updated;
    });
    setIsDirty(true);
    setTouched((t) => ({ ...t, [key as string]: true }));
    
    // Real-time validation
    if (touched[key as string]) {
      validateField(key as string, value);
    }
  }

  function validateField(field: string, value: any): string | null {
    switch (field) {
      case "firstName":
        if (!value?.trim()) return "First name is required";
        if (value.trim().length < 2) return "First name must be at least 2 characters";
        return null;
      case "lastName":
        if (value && value.trim().length < 2) return "Last name must be at least 2 characters";
        return null;
      case "phone":
        if (!value?.trim()) return "Phone number is required";
        if (!/^[+]?[\d\s-]{10,}$/.test(value)) return "Invalid phone number format";
        return null;
      case "email":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email format";
        return null;
      case "dob": {
        if (!value) return "Date of birth is required";
        const dob = new Date(value);
        if (dob > new Date()) return "Date of birth cannot be in the future";
        if (dob < new Date("1900-01-01")) return "Invalid date of birth";
        const age = calcAge(value);
        if (age > 120) return "Age exceeds 120 years — please verify DOB";
        return null;
      }
      case "emergencyPhone":
        if (value && !/^[+]?[\d\s-]{10,}$/.test(value)) return "Invalid phone number format";
        return null;
      case "nextAppointment":
        // warn only, not a blocking error
        return null;
      default:
        return null;
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    const firstNameError = validateField("firstName", form.firstName);
    if (firstNameError) errs.firstName = firstNameError;

    const phoneError = validateField("phone", form.phone);
    if (phoneError) errs.phone = phoneError;

    const dobError = validateField("dob", form.dob);
    if (dobError) errs.dob = dobError;

    if (!form.gender) errs.gender = "Gender is required";
    if (!form.doctor) errs.doctor = "Assigned doctor is required";

    if (form.email) {
      const emailError = validateField("email", form.email);
      if (emailError) errs.email = emailError;
    }
    if (form.emergencyPhone) {
      const emergencyPhoneError = validateField("emergencyPhone", form.emergencyPhone);
      if (emergencyPhoneError) errs.emergencyPhone = emergencyPhoneError;
    }
    if (form.insuranceExpiry) {
      const d = new Date(form.insuranceExpiry);
      if (isNaN(d.getTime())) errs.insuranceExpiry = "Invalid expiry date";
    }

    setErrors(errs);
    setTouched(prev => ({
      ...prev,
      firstName: true, lastName: true, phone: true, email: true,
      dob: true, gender: true, doctor: true, emergencyPhone: true, insuranceExpiry: true,
    }));

    const count = Object.keys(errs).length;
    if (count > 0) {
      const personalFields = ["firstName", "lastName", "phone", "email", "dob", "gender", "emergencyPhone"];
      const insuranceFields = ["insuranceExpiry"];
      const statusFields = ["doctor"];
      let targetSection: "personal" | "medical" | "insurance" | "status" = "personal";
      if (personalFields.some(f => errs[f])) targetSection = "personal";
      else if (insuranceFields.some(f => errs[f])) targetSection = "insurance";
      else if (statusFields.some(f => errs[f])) targetSection = "status";
      setSection(targetSection);
      showFeedback(`Please fix ${count} field${count > 1 ? "s" : ""} before saving.`, "error");
      // Focus first invalid input after next render
      setTimeout(() => {
        const firstErrKey = Object.keys(errs)[0];
        const el = document.querySelector(`[name="${firstErrKey}"], input[aria-invalid], select[aria-invalid]`) as HTMLElement | null;
        el?.focus();
      }, 100);
      return false;
    }
    return true;
  }

  function handleBlur(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    const error = validateField(field, form[field as keyof Patient]);
    if (error) {
      setErrors((e) => ({ ...e, [field]: error }));
    } else {
      setErrors((e) => { const ne = { ...e }; delete ne[field]; return ne; });
    }
  }

  function handleSubmit() {
    if (isSaving) return;
    if (!validate()) return;
    // Run dup check before showing review
    try {
      const stored = localStorage.getItem("clinic_crm_patients_v1");
      if (stored) {
        const all: Patient[] = JSON.parse(stored);
        const currentId = mode === "edit" ? patient?.id : undefined;
        const warnings: Array<{ id: string; name: string; reason: string }> = [];
        for (const p of all) {
          if (p.id === currentId) continue;
          if (form.phone && p.phone === form.phone) warnings.push({ id: p.id, name: p.name || p.id, reason: "same phone" });
          else if (form.email && p.email === form.email?.toLowerCase()) warnings.push({ id: p.id, name: p.name || p.id, reason: "same email" });
          else if (form.dob && p.dob === form.dob && form.firstName && p.firstName?.toLowerCase() === form.firstName.toLowerCase()) warnings.push({ id: p.id, name: p.name || p.id, reason: "same name + DOB" });
        }
        setDupWarnings(warnings);
        setDupDismissed(false);
      }
    } catch { /* ignore */ }
    setShowReview(true);
  }

  function confirmSave() {
    if (isSaving) return;
    // Normalize fields before save
    const firstName = (form.firstName || "").trim().replace(/\s+/g, " ");
    const lastName = (form.lastName || "").trim().replace(/\s+/g, " ");
    const phone = (form.phone || "").replace(/\s{2,}/g, " ").trim();
    const email = (form.email || "").trim().toLowerCase() || "";

    const conditions = [...new Set((form.conditions || []).map(s => s.trim()).filter(Boolean))];
    const medications = [...new Set((form.medications || []).map(s => s.trim()).filter(Boolean))];

    const now = new Date().toISOString();
    const insuranceStatus = !form.insurer || form.insurer === "None" ? "None"
      : !form.insuranceExpiry ? "None"
      : new Date(form.insuranceExpiry) < new Date() ? "Expired"
      : new Date(form.insuranceExpiry) < new Date(Date.now() + 30 * 86400000) ? "Expiring"
      : "Active";

    const data: Partial<Patient> = {
      ...form,
      firstName, lastName, phone, email,
      conditions, medications,
      name: `${firstName} ${lastName}`.trim(),
      age: form.dob ? calcAge(form.dob) : 0,
      insuranceStatus,
      timeline: form.timeline || [],
      documents: form.documents || [],
      notes: form.notes || [],
      family: form.family || [],
      consents: form.consents || {},
      updatedAt: now,
    };

    if (mode === "create") {
      data.id = (form as any).id || `CLN-${Date.now()}`;
      data.createdAt = now;
    } else {
      data.id = patient?.id;
      data.createdAt = patient?.createdAt || now;
    }

    setIsSaving(true);
    setShowReview(false);
    try {
      onSave(data);
      localStorage.removeItem(draftKey);
      setHasDraft(false);
      setIsDirty(false);
      showFeedback("Patient saved successfully.", "success");
      setTimeout(() => onClose(), 800);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleAlert(alert: AlertType) {
    const current = form.alerts || [];
    if (current.includes(alert)) {
      update("alerts", current.filter((a) => a !== alert) as AlertType[]);
    } else {
      update("alerts", [...current, alert] as AlertType[]);
    }
  }

  function addChip(field: "conditions" | "medications", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current: string[] = (form[field] as string[]) || [];
    if (current.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      showFeedback(`"${trimmed}" already in ${field}.`, "info");
      return;
    }
    update(field, [...current, trimmed] as any);
    setChipInput(c => ({ ...c, [field]: "" }));
  }

  function removeChip(field: "conditions" | "medications", value: string) {
    const current: string[] = (form[field] as string[]) || [];
    update(field, current.filter(s => s !== value) as any);
  }

  function handleAllergyChange(val: string) {
    update("allergies", val);
  }

  function handleAllergySeverityChange(val: string) {
    update("allergiesSeverity", val);
    // Auto-add Allergy alert if severe
    if (val === "Severe" || val === "Life-threatening") {
      const current = form.alerts || [];
      if (!current.includes("Allergy" as AlertType)) {
        update("alerts", [...current, "Allergy" as AlertType]);
        showFeedback("Allergy alert auto-added due to severity.", "info");
      }
    }
  }

  // Computed live insurance status for summary
  const liveInsuranceStatus = !form.insurer || form.insurer === "None" ? "None"
    : !form.insuranceExpiry ? "None"
    : new Date(form.insuranceExpiry) < new Date() ? "Expired"
    : new Date(form.insuranceExpiry) < new Date(Date.now() + 30 * 86400000) ? "Expiring"
    : "Active";

  // Completion score (10 fields)
  const completionScore = [
    !!form.firstName, !!form.dob, !!form.phone, !!form.gender, !!form.doctor,
    !!form.emergencyName, liveInsuranceStatus !== "None",
    !!(form.consentSigned), !!form.bloodGroup, !!form.address,
  ].filter(Boolean).length;

  // Initials for avatar
  const initials = `${(form.firstName || "?")[0] || ""}${(form.lastName || "")[0] || ""}`.toUpperCase() || "?";
  const avatarColors = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed"];
  const avatarColor = avatarColors[(form.firstName?.charCodeAt(0) || 0) % avatarColors.length];

  // Change summary for edit mode review
  const changedFields: string[] = [];
  if (mode === "edit" && patient) {
    const watched: Array<[keyof Patient, string]> = [
      ["firstName", "First name"], ["lastName", "Last name"], ["phone", "Phone"],
      ["email", "Email"], ["dob", "DOB"], ["gender", "Gender"], ["doctor", "Doctor"],
      ["status", "Status"], ["insurer", "Insurer"], ["insuranceExpiry", "Insurance expiry"],
      ["address", "Address"], ["emergencyName", "Emergency contact"], ["allergies", "Allergies"],
      ["bloodGroup", "Blood group"],
    ];
    for (const [key, label] of watched) {
      const orig = String(patient[key] ?? "");
      const curr = String(form[key] ?? "");
      if (orig !== curr) changedFields.push(`${label} changed`);
    }
  }

  function goToNextSection() {
    const sections: Array<"personal" | "medical" | "insurance" | "status"> = ["personal", "medical", "insurance", "status"];
    const currentIndex = sections.indexOf(section);
    if (currentIndex < sections.length - 1) {
      setSection(sections[currentIndex + 1]);
    }
  }

  function goToPreviousSection() {
    const sections: Array<"personal" | "medical" | "insurance" | "status"> = ["personal", "medical", "insurance", "status"];
    const currentIndex = sections.indexOf(section);
    if (currentIndex > 0) {
      setSection(sections[currentIndex - 1]);
    }
  }

  const SECTIONS = [
    { id: "personal" as const, label: "Personal",  icon: "ti-user", required: true },
    { id: "medical" as const,   label: "Medical",   icon: "ti-heart-rate-monitor", required: false },
    { id: "insurance" as const, label: "Insurance", icon: "ti-shield", required: false },
    { id: "status" as const,    label: "Status",    icon: "ti-stethoscope", required: false },
  ];

  const currentSectionIndex = SECTIONS.findIndex(s => s.id === section);
  const progress = ((currentSectionIndex + 1) / SECTIONS.length) * 100;

  // Section completion counts: [filled required, total required]
  const sectionCompletion: Record<string, [number, number]> = {
    personal: [
      [form.firstName, form.phone, form.dob, form.gender].filter(Boolean).length,
      4,
    ],
    medical: [0, 0],
    insurance: [0, 0],
    status: [
      [form.doctor].filter(Boolean).length,
      1,
    ],
  };

  return (
    <div className="modal-backdrop">
      <div className="modal pf-modal" style={{ width: "100%", maxWidth: 800, position: "relative" }}>
        <style>{`
          @media (max-width: 640px) {
            .pf-modal { max-width: 100% !important; width: 100% !important; margin: 0 !important; border-radius: 0 !important; height: 100dvh; display: flex; flex-direction: column; }
            .pf-modal .pf-body { flex: 1; overflow-y: auto; }
            .pf-modal .pf-footer { position: sticky; bottom: 0; }
            .pf-tabs button { padding: 10px 10px !important; font-size: 11px !important; }
            .pf-tabs button span.pf-tab-label { display: none; }
            .pf-form-row { grid-template-columns: 1fr !important; }
            .pf-modal input, .pf-modal select, .pf-modal textarea { min-height: 40px; font-size: 16px !important; }
            .pf-step-label { display: none; }
            .pf-steps { gap: 6px !important; }
          }
        `}</style>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>
              {mode === "create" ? "Register New Patient" : `Edit Patient: ${patient?.name}`}
            </div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              {mode === "create" ? "Fill in patient details below" : "Update the patient's information"}
            </div>
          </div>
          {isDirty && (
            <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
              {draftSaved ? "Draft saved ✓" : "Unsaved changes"}
            </span>
          )}
          {!isDirty && mode === "edit" && (
            <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)", fontSize: 10 }}>
              No changes
            </span>
          )}
          {hasDraft && !isDirty && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => {
              localStorage.removeItem(draftKey);
              setHasDraft(false);
              showFeedback("Draft cleared.", "info");
            }}>Clear draft</button>
          )}
          {mode === "edit" && patient?.id && (
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Copy patient ID"
              onClick={() => { navigator.clipboard.writeText(patient.id); showFeedback("Patient ID copied.", "info"); }}>
              <i className="ti ti-copy" style={{ fontSize: 12 }} /> {patient.id}
            </button>
          )}
          <button className="btn-icon" onClick={() => { if (isDirty) setShowDiscardModal(true); else onClose(); }}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div style={{
            padding: "10px 20px", fontSize: "var(--font-sm)", fontWeight: 500,
            background: feedback.type === "error" ? "var(--red-bg, #fef2f2)" : feedback.type === "success" ? "var(--green-bg, #f0fdf4)" : "var(--accent-soft)",
            color: feedback.type === "error" ? "var(--red)" : feedback.type === "success" ? "var(--green, #16a34a)" : "var(--accent)",
            borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8,
          }}>
            <i className={`ti ${feedback.type === "error" ? "ti-alert-circle" : feedback.type === "success" ? "ti-circle-check" : "ti-info-circle"}`} />
            {feedback.message}
          </div>
        )}

        {/* Discard changes modal */}
        {showDiscardModal && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit",
          }}>
            <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 340, width: "90%", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Discard changes?</div>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>You have unsaved changes. They will be lost if you close now.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowDiscardModal(false)}>Continue editing</button>
                <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { localStorage.removeItem(draftKey); onClose(); }}>Discard changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Review modal */}
        {showReview && (
          <div role="dialog" aria-modal="true" aria-label="Review patient details" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
            <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 480, width: "92%", boxShadow: "var(--shadow-lg)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)", marginBottom: 4 }}>
                {mode === "create" ? "Register Patient?" : "Save Changes?"}
              </div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 16 }}>Review before confirming.</div>

              {/* Summary rows */}
              {[
                ["Name", `${form.firstName || ""} ${form.lastName || ""}`.trim() || "—"],
                ["DOB / Age", form.dob ? `${form.dob} (${calcAge(form.dob)}y)` : "—"],
                ["Gender", form.gender || "—"],
                ["Phone", form.phone || "—"],
                ["Email", form.email || "—"],
                ["Doctor", form.doctor || "—"],
                ["Status", form.status || "—"],
                ["Insurance", liveInsuranceStatus],
                ["Alerts", (form.alerts || []).join(", ") || "None"],
                ["Emergency", form.emergencyName ? `${form.emergencyName} (${form.emergencyPhone || "no phone"})` : "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
                  <span style={{ color: "var(--muted)", width: 100, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{val}</span>
                </div>
              ))}

              {/* Dup warnings in review */}
              {dupWarnings.length > 0 && !dupDismissed && (
                <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--amber-bg)", borderRadius: "var(--radius)", fontSize: "var(--font-xs)", color: "var(--amber)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Possible duplicates:</div>
                  {dupWarnings.map(w => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <i className="ti ti-alert-triangle" />
                      {w.name} — {w.reason}
                      <button style={{ fontSize: 10, padding: "1px 5px", marginLeft: 4, background: "none", border: "1px solid var(--amber)", borderRadius: 3, cursor: "pointer", color: "var(--amber)" }}
                        onClick={() => { navigator.clipboard.writeText(w.id); showFeedback(`Copied ${w.id}`, "info"); }}>
                        {w.id}
                      </button>
                    </div>
                  ))}
                  <button style={{ marginTop: 4, fontSize: 10, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", textDecoration: "underline" }}
                    onClick={() => setDupDismissed(true)}>Dismiss</button>
                </div>
              )}

              {/* Change summary (edit mode) */}
              {mode === "edit" && (
                <div style={{ marginTop: 12, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  {changedFields.length === 0
                    ? <span style={{ color: "var(--green,#16a34a)" }}>No changes detected.</span>
                    : changedFields.map(f => <div key={f}>• {f}</div>)
                  }
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                <button className="btn btn-ghost" onClick={() => setShowReview(false)}>← Back to Edit</button>
                <button className="btn btn-primary" onClick={confirmSave} disabled={isSaving}
                  style={{ opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? "Saving..." : mode === "create" ? "Confirm Register" : "Confirm Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm clear modal */}
        {confirmClear && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
            <div style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius)", maxWidth: 320, width: "90%", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Clear {confirmClear.label}?</div>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>This will reset optional fields in this section. Required fields are not affected.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setConfirmClear(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { confirmClear.action(); setConfirmClear(null); showFeedback(`${confirmClear.label} cleared.`, "info"); }}>Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Live summary strip */}
        <div style={{ padding: "8px 20px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: "var(--font-xs)" }}>
          <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 120 }}>
            {form.firstName || form.lastName ? `${form.firstName || ""} ${form.lastName || ""}`.trim() : <span style={{ color: "var(--muted)" }}>Patient Name</span>}
            {form.age ? <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 4 }}>{form.age}y</span> : null}
          </span>
          {[
            { label: "Gender", val: form.gender },
            { label: "Phone", val: form.phone },
            { label: "Doctor", val: form.doctor },
            { label: "Status", val: form.status },
            { label: "Insurance", val: liveInsuranceStatus !== "None" ? liveInsuranceStatus : null },
          ].map(({ label, val }) => val ? (
            <span key={label} style={{ color: "var(--muted)" }}><span style={{ color: "var(--text)" }}>{val}</span></span>
          ) : null)}
          <span style={{ marginLeft: "auto", color: completionScore >= 8 ? "var(--green,#16a34a)" : completionScore >= 5 ? "var(--amber)" : "var(--muted)" }}>
            {completionScore}/10 complete
          </span>
        </div>
        {/* Completion bar */}
        <div style={{ height: 3, background: "var(--border)" }}>
          <div style={{ height: "100%", background: completionScore >= 8 ? "var(--green,#16a34a)" : completionScore >= 5 ? "var(--amber)" : "var(--accent)", width: `${completionScore * 10}%`, transition: "width 0.3s ease" }} />
        </div>

        {/* Duplicate warnings */}
        {dupWarnings.length > 0 && !dupDismissed && (
          <div style={{ padding: "8px 20px", background: "var(--amber-bg)", borderBottom: "1px solid var(--border)" }}>
            {dupWarnings.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-xs)", color: "var(--amber)" }}>
                <i className="ti ti-alert-triangle" />
                Possible duplicate: <strong>{w.name}</strong> ({w.reason})
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} title="Copy duplicate patient ID"
                  onClick={() => { navigator.clipboard.writeText(w.id); showFeedback(`Copied ${w.id}`, "info"); }}>
                  <i className="ti ti-copy" style={{ fontSize: 10 }} /> {w.id}
                </button>
              </div>
            ))}
            <button style={{ marginTop: 4, fontSize: 10, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", textDecoration: "underline", padding: 0 }}
              onClick={() => setDupDismissed(true)}>Dismiss for this session</button>
          </div>
        )}

        {/* Edit mode metadata */}
        {mode === "edit" && (patient?.createdAt || patient?.updatedAt) && (
          <div style={{ padding: "4px 20px", fontSize: 10, color: "var(--muted)", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", gap: 16 }}>
            {patient.createdAt && <span>Created: {new Date(patient.createdAt).toLocaleDateString()}</span>}
            {patient.updatedAt && <span>Updated: {new Date(patient.updatedAt).toLocaleDateString()}</span>}
          </div>
        )}

        {/* Progress bar */}
        <div style={{ padding: "12px 20px", background: "var(--surface2)" }}>
          <div className="pf-steps" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {SECTIONS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: i <= currentSectionIndex ? "var(--accent)" : "var(--muted)",
                  fontSize: "var(--font-xs)", fontWeight: i <= currentSectionIndex ? 600 : 400,
                }}>
                  <i className={`ti ${i < currentSectionIndex ? "ti-circle-check-filled" : s.icon}`} style={{ fontSize: 12 }} />
                  <span className="pf-step-label">{s.label}</span>
                  {s.required && <span className="pf-step-label" style={{ color: "var(--red)" }}>*</span>}
                </div>
                {i < SECTIONS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, background: i < currentSectionIndex ? "var(--accent)" : "var(--border)",
                    borderRadius: 1,
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 8, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "var(--accent)", width: `${progress}%`, transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* Sections */}
        <div className="pf-tabs" style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "0 20px", overflowX: "auto" }}>
          {SECTIONS.map(({ id, label, icon }) => {
            const [filled, total] = sectionCompletion[id];
            const complete = total > 0 && filled === total;
            const hasError = Object.keys(errors).some(k => {
              if (id === "personal") return ["firstName","lastName","phone","email","dob","gender","emergencyPhone"].includes(k);
              if (id === "insurance") return ["insuranceExpiry"].includes(k);
              if (id === "status") return ["doctor"].includes(k);
              return false;
            });
            return (
              <button key={id} onClick={() => setSection(id)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 14px", borderBottom: `2px solid ${section === id ? "var(--accent)" : "transparent"}`,
                color: hasError ? "var(--red)" : section === id ? "var(--accent)" : "var(--muted)",
                fontWeight: section === id ? 600 : 400, fontSize: "var(--font-sm)",
                background: "none", border: "none", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
              }}>
                <i className={`ti ${complete ? "ti-circle-check-filled" : hasError ? "ti-alert-circle" : icon}`} style={{ fontSize: 13 }} />
                <span className="pf-tab-label">{label}</span>
                {total > 0 && (
                  <span style={{ fontSize: 10, color: complete ? "var(--green,#16a34a)" : "var(--muted)", marginLeft: 2 }}>
                    {filled}/{total}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Form body */}
        <div className="pf-body" style={{ padding: "20px", maxHeight: "calc(80vh - 200px)", overflowY: "auto" }}>
          {section === "personal" && (
            <FormSection>
              <FormRow>
                <Field label="First Name *" error={errors.firstName} touched={touched.firstName}>
                  <input 
                    type="text" 
                    value={form.firstName || ""} 
                    onChange={(e) => update("firstName", e.target.value)} 
                    onBlur={() => handleBlur("firstName")}
                    placeholder="First name" 
                    style={{ width: "100%", borderColor: errors.firstName && touched.firstName ? "var(--red)" : undefined }} 
                  />
                </Field>
                <Field label="Last Name" error={errors.lastName} touched={touched.lastName}>
                  <input 
                    type="text" 
                    value={form.lastName || ""} 
                    onChange={(e) => update("lastName", e.target.value)}
                    onBlur={() => handleBlur("lastName")}
                    placeholder="Last name" 
                    style={{ width: "100%", borderColor: errors.lastName && touched.lastName ? "var(--red)" : undefined }} 
                  />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Date of Birth *" error={errors.dob} touched={touched.dob}>
                  <input 
                    type="date" 
                    value={form.dob || ""} 
                    onChange={(e) => update("dob", e.target.value)}
                    onBlur={() => handleBlur("dob")}
                    style={{ width: "100%", borderColor: errors.dob && touched.dob ? "var(--red)" : undefined }} 
                  />
                  {form.dob && !errors.dob && (
                    <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, display: "block" }}>Age: {calcAge(form.dob)} years</span>
                  )}
                  {!form.dob && <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, display: "block" }}>Age auto-calculated from DOB</span>}
                </Field>
                <Field label="Gender *" error={errors.gender} touched={touched.gender}>
                  <select value={form.gender || "Male"} onChange={(e) => update("gender", e.target.value as any)} style={{ width: "100%" }}>
                    {GENDERS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Blood Group">
                  <select value={form.bloodGroup || "O+"} onChange={(e) => update("bloodGroup", e.target.value as any)} style={{ width: "100%" }}>
                    {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Phone *" error={errors.phone} touched={touched.phone}>
                  <input 
                    type="tel" 
                    name="phone"
                    value={form.phone || ""} 
                    onChange={(e) => update("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    placeholder="+91 XXXXX XXXXX" 
                    style={{ width: "100%", borderColor: errors.phone && touched.phone ? "var(--red)" : undefined }} 
                  />
                  <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, display: "block" }}>Format: +91 XXXXX XXXXX or 10-digit number</span>
                </Field>
                <Field label="Email" error={errors.email} touched={touched.email}>
                  <input 
                    type="email" 
                    name="email"
                    value={form.email || ""} 
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    placeholder="email@example.com" 
                    style={{ width: "100%", borderColor: errors.email && touched.email ? "var(--red)" : undefined }} 
                  />
                  <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, display: "block" }}>Will be saved in lowercase</span>
                </Field>
              </FormRow>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: -6 }}>
                <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
                Duplicate check runs in patient list/import tools.
              </div>
              <Field label="Address">
                <input type="text" value={form.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="Full address" style={{ width: "100%" }} />
              </Field>
              <FormRow>
                <Field label="Marital Status">
                  <select value={form.maritalStatus || ""} onChange={(e) => update("maritalStatus", e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </Field>
                <Field label="Occupation">
                  <input type="text" value={form.occupation || ""} onChange={(e) => update("occupation", e.target.value)} placeholder="Occupation" style={{ width: "100%" }} />
                </Field>
                <Field label="Employment Status">
                  <select value={form.employmentStatus || ""} onChange={(e) => update("employmentStatus", e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select...</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Self-employed">Self-employed</option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Retired">Retired</option>
                    <option value="Student">Student</option>
                  </select>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Ethnicity">
                  <input type="text" value={form.ethnicity || ""} onChange={(e) => update("ethnicity", e.target.value)} placeholder="e.g. Hispanic, Asian" style={{ width: "100%" }} />
                </Field>
                <Field label="Race">
                  <select value={form.race || ""} onChange={(e) => update("race", e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select...</option>
                    <option value="White">White</option>
                    <option value="Black/African American">Black/African American</option>
                    <option value="Asian">Asian</option>
                    <option value="Hispanic/Latino">Hispanic/Latino</option>
                    <option value="Native American">Native American</option>
                    <option value="Pacific Islander">Pacific Islander</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Religion">
                  <input type="text" value={form.religion || ""} onChange={(e) => update("religion", e.target.value)} placeholder="e.g. Christian, Hindu, Muslim" style={{ width: "100%" }} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Languages">
                  <input type="text" value={form.languages || ""} onChange={(e) => update("languages", e.target.value)} placeholder="e.g. English, Hindi" style={{ width: "100%" }} />
                </Field>
                <Field label="Preferred Language">
                  <select value={form.preferredLanguage || ""} onChange={(e) => update("preferredLanguage", e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select...</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Mandarin">Mandarin</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Education Level">
                  <select value={form.educationLevel || ""} onChange={(e) => update("educationLevel", e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select...</option>
                    <option value="Less than High School">Less than High School</option>
                    <option value="High School">High School</option>
                    <option value="Some College">Some College</option>
                    <option value="Bachelor's">Bachelor's</option>
                    <option value="Master's">Master's</option>
                    <option value="Doctorate">Doctorate</option>
                  </select>
                </Field>
              </FormRow>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
                <div className="section-label">Emergency Contact (Primary)</div>
                <FormRow>
                  <Field label="Contact Name">
                    <input type="text" value={form.emergencyName || ""} onChange={(e) => update("emergencyName", e.target.value)} placeholder="Name" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Relation">
                    <input type="text" value={form.emergencyRelation || ""} onChange={(e) => update("emergencyRelation", e.target.value)} placeholder="e.g. Spouse" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Phone" error={errors.emergencyPhone} touched={touched.emergencyPhone}>
                    <input 
                      type="tel" 
                      value={form.emergencyPhone || ""} 
                      onChange={(e) => update("emergencyPhone", e.target.value)}
                      onBlur={() => handleBlur("emergencyPhone")}
                      placeholder="+91 XXXXX XXXXX" 
                      style={{ width: "100%", borderColor: errors.emergencyPhone && touched.emergencyPhone ? "var(--red)" : undefined }} 
                    />
                  </Field>
                </FormRow>
                {form.emergencyPhone && form.phone && form.emergencyPhone === form.phone && (
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--amber)", marginTop: 4 }}>
                    <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                    Emergency phone matches patient phone number.
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
                <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Emergency Contact (Secondary)
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Clear secondary emergency contact"
                    disabled={!form.emergencyContact2 && !form.emergencyPhone2 && !form.emergencyRelation2}
                    onClick={() => setConfirmClear({ section: "personal", label: "Secondary Emergency Contact", action: () => { update("emergencyContact2", ""); update("emergencyRelation2", ""); update("emergencyPhone2", ""); } })}>
                    Clear
                  </button>
                </div>
                <FormRow>
                  <Field label="Contact Name">
                    <input type="text" value={form.emergencyContact2 || ""} onChange={(e) => update("emergencyContact2", e.target.value)} placeholder="Name" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Relation">
                    <input type="text" value={form.emergencyRelation2 || ""} onChange={(e) => update("emergencyRelation2", e.target.value)} placeholder="e.g. Parent" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Phone">
                    <input 
                      type="tel" 
                      value={form.emergencyPhone2 || ""} 
                      onChange={(e) => update("emergencyPhone2", e.target.value)}
                      placeholder="+91 XXXXX XXXXX" 
                      style={{ width: "100%" }} 
                    />
                  </Field>
                </FormRow>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
                <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Additional Information
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Clear optional demographic fields"
                    onClick={() => setConfirmClear({ section: "personal", label: "Additional Information fields", action: () => { update("livingArrangement", ""); update("preferredPharmacy", ""); update("referralSource", ""); update("occupation", ""); update("employmentStatus", ""); update("maritalStatus", ""); } })}>
                    Clear optional
                  </button>
                </div>
                <FormRow>
                  <Field label="Living Arrangement">
                    <select value={form.livingArrangement || ""} onChange={(e) => update("livingArrangement", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Lives Alone">Lives Alone</option>
                      <option value="Lives with Family">Lives with Family</option>
                      <option value="Lives with Spouse">Lives with Spouse</option>
                      <option value="Assisted Living">Assisted Living</option>
                      <option value="Nursing Home">Nursing Home</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Preferred Pharmacy">
                    <input type="text" value={form.preferredPharmacy || ""} onChange={(e) => update("preferredPharmacy", e.target.value)} placeholder="Pharmacy name" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Referral Source">
                    <select value={form.referralSource || ""} onChange={(e) => update("referralSource", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Self">Self</option>
                      <option value="Family/Friend">Family/Friend</option>
                      <option value="Physician">Physician</option>
                      <option value="Hospital">Hospital</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Online">Online</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                </FormRow>
              </div>
            </FormSection>
          )}

          {section === "medical" && (
            <FormSection>
              {role === "receptionist" && (
                <div style={{ padding: "10px 14px", background: "var(--amber-bg)", color: "var(--amber)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", marginBottom: 8 }}>
                  <i className="ti ti-lock" style={{ marginRight: 6 }} />
                  Medical fields are read-only for receptionists. Contact a doctor or admin to edit.
                </div>
              )}
              <fieldset disabled={role === "receptionist"} style={{ border: "none", padding: 0, margin: 0 }}>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginBottom: 12 }}>
                <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Allergies
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Clear allergy fields"
                    onClick={() => setConfirmClear({ section: "medical", label: "Allergy fields", action: () => { update("allergies", ""); update("allergiesSeverity", ""); update("allergiesReaction", ""); } })}>
                    Clear
                  </button>
                </div>
                <FormRow>
                  <Field label="Known Allergies">
                    <input type="text" value={form.allergies || ""} onChange={(e) => handleAllergyChange(e.target.value)} placeholder="e.g. Penicillin, Aspirin" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Severity">
                    <select value={form.allergiesSeverity || ""} onChange={(e) => handleAllergySeverityChange(e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Mild">Mild</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe</option>
                      <option value="Life-threatening">Life-threatening</option>
                    </select>
                  </Field>
                  <Field label="Reaction">
                    <input type="text" value={form.allergiesReaction || ""} onChange={(e) => update("allergiesReaction", e.target.value)} placeholder="e.g. Rash, Anaphylaxis" style={{ width: "100%" }} />
                  </Field>
                </FormRow>
              </div>
              <div>
                <label className="field-label">Medical Alerts</label>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Critical alerts affect patient risk level and are highlighted throughout the app.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {ALERT_TYPES.map((alert) => {
                    const active = (form.alerts || []).includes(alert);
                    const colors: Record<string, string> = {
                      "Allergy": "#dc2626", "Diabetic": "#d97706", "Hypertension": "#9d174d",
                      "Heart Condition": "#7f1d1d", "Pregnancy": "#6b21a8", "High Risk": "#dc2626",
                    };
                    const c = colors[alert] || "#64748b";
                    return (
                      <button key={alert} onClick={() => toggleAlert(alert)} style={{
                        padding: "6px 12px", borderRadius: "var(--radius-full)",
                        border: `2px solid ${active ? c : "var(--border)"}`,
                        background: active ? c + "12" : "transparent",
                        color: active ? c : "var(--muted)",
                        fontSize: "var(--font-sm)", fontWeight: active ? 700 : 500,
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                        {active && <i className="ti ti-check" style={{ fontSize: 11, marginRight: 4 }} />}
                        {alert}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label">Medical History</div>
                <Field label="Past Illnesses">
                  <textarea
                    value={form.pastIllnesses || ""}
                    onChange={(e) => update("pastIllnesses", e.target.value)}
                    placeholder="List any past illnesses or chronic conditions..."
                    rows={2} style={{ width: "100%", resize: "vertical" }}
                  />
                </Field>
                <Field label="Past Surgeries">
                  <textarea
                    value={form.pastSurgeries || ""}
                    onChange={(e) => update("pastSurgeries", e.target.value)}
                    placeholder="List any past surgeries with dates..."
                    rows={2} style={{ width: "100%", resize: "vertical" }}
                  />
                </Field>
                <Field label="Hospitalizations">
                  <textarea
                    value={form.hospitalizations || ""}
                    onChange={(e) => update("hospitalizations", e.target.value)}
                    placeholder="List any previous hospitalizations with reasons..."
                    rows={2} style={{ width: "100%", resize: "vertical" }}
                  />
                </Field>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Current Medications
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Clear all medications"
                    onClick={() => setConfirmClear({ section: "medical", label: "Medications", action: () => update("medications", []) })}>Clear all</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {(form.medications || []).map(m => (
                    <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--radius-full)", background: "var(--accent-soft)", color: "var(--accent)", fontSize: "var(--font-xs)", fontWeight: 500 }}>
                      {m}
                      <button aria-label={`Remove ${m}`} onClick={() => removeChip("medications", m)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", lineHeight: 1, padding: 0, fontSize: 13 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="text" value={chipInput.medications} onChange={e => setChipInput(c => ({ ...c, medications: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChip("medications", chipInput.medications); } }}
                    placeholder="Type medication and press Enter" style={{ flex: 1 }} />
                  <button className="btn btn-ghost" onClick={() => addChip("medications", chipInput.medications)} title="Add medication">Add</button>
                </div>
                <div style={{ marginTop: 16 }}>
                  <label className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    Conditions
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", fontWeight: 400 }} title="Clear all conditions"
                      onClick={() => setConfirmClear({ section: "medical", label: "Conditions", action: () => update("conditions", []) })}>Clear all</button>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {(form.conditions || []).map(c => (
                      <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--radius-full)", background: "var(--red-bg,#fef2f2)", color: "var(--red)", fontSize: "var(--font-xs)", fontWeight: 500 }}>
                        {c}
                        <button aria-label={`Remove ${c}`} onClick={() => removeChip("conditions", c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", lineHeight: 1, padding: 0, fontSize: 13 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" value={chipInput.conditions} onChange={e => setChipInput(c => ({ ...c, conditions: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChip("conditions", chipInput.conditions); } }}
                      placeholder="Type condition and press Enter" style={{ flex: 1 }} />
                    <button className="btn btn-ghost" onClick={() => addChip("conditions", chipInput.conditions)} title="Add condition">Add</button>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label">Family History</div>
                <Field label="Family Medical History">
                  <textarea
                    value={form.familyHistory || ""}
                    onChange={(e) => update("familyHistory", e.target.value)}
                    placeholder="Family history of diabetes, heart disease, cancer, etc."
                    rows={3} style={{ width: "100%", resize: "vertical" }}
                  />
                </Field>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label">Social History</div>
                <FormRow>
                  <Field label="Smoking Status">
                    <select value={form.smokingStatus || ""} onChange={(e) => update("smokingStatus", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Never">Never</option>
                      <option value="Former">Former</option>
                      <option value="Current">Current</option>
                    </select>
                  </Field>
                  <Field label="Alcohol Use">
                    <select value={form.alcoholUse || ""} onChange={(e) => update("alcoholUse", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="None">None</option>
                      <option value="Social">Social</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Heavy">Heavy</option>
                    </select>
                  </Field>
                  <Field label="Drug Use">
                    <select value={form.drugUse || ""} onChange={(e) => update("drugUse", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="None">None</option>
                      <option value="Past">Past</option>
                      <option value="Current">Current</option>
                    </select>
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Exercise Frequency">
                    <select value={form.exerciseFrequency || ""} onChange={(e) => update("exerciseFrequency", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Sedentary">Sedentary</option>
                      <option value="Light">Light (1-2x/week)</option>
                      <option value="Moderate">Moderate (3-4x/week)</option>
                      <option value="Active">Active (5+x/week)</option>
                    </select>
                  </Field>
                  <Field label="Sleep Hours">
                    <select value={form.sleepHours || ""} onChange={(e) => update("sleepHours", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="<5">&lt;5 hours</option>
                      <option value="5-6">5-6 hours</option>
                      <option value="7-8">7-8 hours</option>
                      <option value="8-9">8-9 hours</option>
                      <option value=">9">&gt;9 hours</option>
                    </select>
                  </Field>
                  <Field label="Stress Level">
                    <select value={form.stressLevel || ""} onChange={(e) => update("stressLevel", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Low">Low</option>
                      <option value="Moderate">Moderate</option>
                      <option value="High">High</option>
                      <option value="Very High">Very High</option>
                    </select>
                  </Field>
                </FormRow>
                <Field label="Social History Notes">
                  <textarea
                    value={form.socialHistory || ""}
                    onChange={(e) => update("socialHistory", e.target.value)}
                    placeholder="Additional social history information..."
                    rows={2} style={{ width: "100%", resize: "vertical" }}
                  />
                </Field>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label">Immunizations & Preventive Care</div>
                <Field label="Immunization History">
                  <textarea
                    value={form.immunizationHistory || ""}
                    onChange={(e) => update("immunizationHistory", e.target.value)}
                    placeholder="List of vaccinations received..."
                    rows={2} style={{ width: "100%", resize: "vertical" }}
                  />
                </Field>
                <FormRow>
                  <Field label="Vaccination Status">
                    <select value={form.vaccinationStatus || ""} onChange={(e) => update("vaccinationStatus", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Up to Date">Up to Date</option>
                      <option value="Partial">Partial</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </Field>
                  <Field label="Dietary Restrictions">
                    <input type="text" value={form.dietaryRestrictions || ""} onChange={(e) => update("dietaryRestrictions", e.target.value)} placeholder="e.g. Vegetarian, Gluten-free" style={{ width: "100%" }} />
                  </Field>
                </FormRow>
              </div>
              </fieldset>
            </FormSection>
          )}

          {section === "insurance" && (
            <FormSection>
              {/* Quick action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Set patient as uninsured"
                  onClick={() => { update("insurer", "None"); update("policyNumber", null); update("insuranceMemberId", ""); update("insuranceGroupNumber", ""); update("insuranceExpiry", null); update("insuranceType", ""); showFeedback("Insurance cleared — set to None.", "info"); }}>
                  <i className="ti ti-x" style={{ fontSize: 11 }} /> No Insurance
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Mark insurance as verified"
                  disabled={!form.insurer || form.insurer === "None"}
                  onClick={() => { update("insuranceVerified", true); showFeedback("Insurance marked as verified.", "success"); }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 11 }} /> Mark Verified
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} title="Clear all insurance fields"
                  disabled={!form.insurer || form.insurer === "None"}
                  onClick={() => setConfirmClear({ section: "insurance", label: "Insurance fields", action: () => { update("insurer", "None"); update("policyNumber", null); update("insuranceMemberId", ""); update("insuranceGroupNumber", ""); update("insuranceExpiry", null); update("insuranceType", ""); update("insuranceVerified", false); } })}>
                  <i className="ti ti-trash" style={{ fontSize: 11 }} /> Clear Insurance
                </button>
                {form.insuranceVerified && <span style={{ fontSize: "var(--font-xs)", color: "var(--green,#16a34a)", alignSelf: "center" }}><i className="ti ti-circle-check-filled" /> Verified</span>}
              </div>
              <FormRow>
                <Field label="Insurance Provider">
                  <select value={form.insurer || "None"} onChange={(e) => update("insurer", e.target.value)} style={{ width: "100%" }}>
                    {INSURERS.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Insurance Type">
                  <select value={form.insuranceType || ""} onChange={(e) => update("insuranceType", e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select...</option>
                    <option value="Private">Private</option>
                    <option value="Government">Government</option>
                    <option value="Employer">Employer-sponsored</option>
                    <option value="Self-pay">Self-pay</option>
                  </select>
                </Field>
              </FormRow>
              {form.insurer !== "None" && (
                <>
                  <FormRow>
                    <Field label="Policy Number">
                      <input type="text" value={form.policyNumber || ""} onChange={(e) => update("policyNumber", e.target.value || null)} placeholder="POL-XXXXXX" style={{ width: "100%" }} />
                    </Field>
                    <Field label="Group Number">
                      <input type="text" value={form.insuranceGroupNumber || ""} onChange={(e) => update("insuranceGroupNumber", e.target.value)} placeholder="GRP-XXXXXX" style={{ width: "100%" }} />
                    </Field>
                    <Field label="Member ID">
                      <input type="text" value={form.insuranceMemberId || ""} onChange={(e) => update("insuranceMemberId", e.target.value)} placeholder="MEM-XXXXXX" style={{ width: "100%" }} />
                    </Field>
                  </FormRow>
                  <FormRow>
                    <Field label="Expiry Date">
                      <input type="date" value={form.insuranceExpiry || ""} onChange={(e) => update("insuranceExpiry", e.target.value || null)} style={{ width: "100%" }} />
                      {form.insuranceExpiry && (
                        <span style={{ fontSize: 10, color: liveInsuranceStatus === "Expired" ? "var(--red)" : liveInsuranceStatus === "Expiring" ? "var(--amber)" : "var(--green,#16a34a)", marginTop: 2, display: "block" }}>
                          Status will be: {liveInsuranceStatus}
                        </span>
                      )}
                    </Field>
                  </FormRow>
                </>
              )}
            </FormSection>
          )}

          {section === "status" && (
            <FormSection>
              <FormRow>
                <Field label="Status">
                  <select value={form.status || "New"} onChange={(e) => update("status", e.target.value as any)} style={{ width: "100%" }}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Assigned Doctor *" error={errors.doctor} touched={touched.doctor}>
                  <select value={form.doctor || "Dr. Sharma"} onChange={(e) => update("doctor", e.target.value)} style={{ width: "100%" }}>
                    {DOCTORS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Primary Care Physician">
                  <input type="text" value={form.primaryCarePhysician || ""} onChange={(e) => update("primaryCarePhysician", e.target.value)} placeholder="External PCP if applicable" style={{ width: "100%" }} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Last Visit">
                  <input type="date" value={form.lastVisit || ""} onChange={(e) => update("lastVisit", e.target.value || null)} style={{ width: "100%" }} />
                </Field>
                <Field label="Next Appointment">
                  <input type="date" value={form.nextAppointment || ""} onChange={(e) => update("nextAppointment", e.target.value || null)} style={{ width: "100%" }} />
                  {form.nextAppointment && new Date(form.nextAppointment) < new Date() && (
                    <span style={{ fontSize: 10, color: "var(--amber)", marginTop: 2, display: "block" }}>
                      <i className="ti ti-alert-triangle" style={{ marginRight: 3 }} />Appointment date is in the past.
                    </span>
                  )}
                </Field>
              </FormRow>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Follow-Up
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Clear follow-up fields"
                    disabled={!form.followUpDate && !form.followUpReason}
                    onClick={() => setConfirmClear({ section: "status", label: "Follow-up fields", action: () => { update("followUpDate", null); update("followUpReason", ""); update("followUpPriority", ""); update("followUpStatus", ""); } })}>
                    Clear
                  </button>
                </div>
                <FormRow>
                  <Field label="Follow-Up Date">
                    <input type="date" value={form.followUpDate || ""} onChange={(e) => update("followUpDate", e.target.value || null)} style={{ width: "100%" }} />
                  </Field>
                  <Field label="Priority">
                    <select value={form.followUpPriority || ""} onChange={(e) => update("followUpPriority", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.followUpStatus || ""} onChange={(e) => update("followUpStatus", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Pending">Pending</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Missed">Missed</option>
                    </select>
                  </Field>
                </FormRow>
                <Field label="Follow-Up Reason">
                  <input type="text" value={form.followUpReason || ""} onChange={(e) => update("followUpReason", e.target.value)} placeholder="Reason for follow-up" style={{ width: "100%" }} />
                </Field>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 12 }}>
                <div className="section-label">Advance Directives & Donor Status</div>
                <FormRow>
                  <Field label="Advance Directives">
                    <textarea
                      value={form.advanceDirectives || ""}
                      onChange={(e) => update("advanceDirectives", e.target.value)}
                      placeholder="DNR, living will, power of attorney..."
                      rows={2} style={{ width: "100%", resize: "vertical" }}
                    />
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Advance Care Planning">
                    <select value={form.advanceCarePlanning || ""} onChange={(e) => update("advanceCarePlanning", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Complete">Complete</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Not Started">Not Started</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </Field>
                  <Field label="Organ Donor">
                    <select value={form.organDonor || ""} onChange={(e) => update("organDonor", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </Field>
                  <Field label="Blood Donor">
                    <select value={form.bloodDonor || ""} onChange={(e) => update("bloodDonor", e.target.value)} style={{ width: "100%" }}>
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </Field>
                </FormRow>
              </div>
            </FormSection>
          )}
        </div>

        {/* Footer */}
        <div className="pf-footer" style={{
          padding: "14px 20px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface2)", flexWrap: "wrap", gap: 8,
          paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              className="btn btn-ghost" 
              onClick={goToPreviousSection}
              disabled={currentSectionIndex === 0}
              style={{ opacity: currentSectionIndex === 0 ? 0.5 : 1 }}
            >
              <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
              Previous
            </button>
            <button 
              className="btn btn-ghost" 
              onClick={goToNextSection}
              disabled={currentSectionIndex === SECTIONS.length - 1}
              style={{ opacity: currentSectionIndex === SECTIONS.length - 1 ? 0.5 : 1 }}
            >
              Next
              <i className="ti ti-arrow-right" style={{ fontSize: 14 }} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {form.phone && (
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} title="Copy phone"
                onClick={() => { navigator.clipboard.writeText(form.phone || ""); showFeedback("Phone copied.", "info"); }}>
                <i className="ti ti-phone" style={{ fontSize: 12 }} /> Copy phone
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => { if (isDirty) setShowDiscardModal(true); else onClose(); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSaving} title={isSaving ? "Saving..." : mode === "create" ? "Register patient (Ctrl+S)" : "Save changes (Ctrl+S)"} style={{ opacity: isSaving ? 0.7 : 1 }}>
              <i className={`ti ${isSaving ? "ti-loader-2" : mode === "create" ? "ti-user-plus" : "ti-device-floppy"}`} style={{ fontSize: 14 }} />
              {isSaving ? "Saving..." : mode === "create" ? "Register Patient" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>;
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="pf-form-row" style={{ display: "grid", gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)`, gap: 12 }}>{children}</div>;
}

function Field({ label, error, touched, children }: { label: string; error?: string; touched?: boolean; children: React.ReactNode }) {
  const showErr = !!(error && touched);
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && showErr) {
          return React.cloneElement(child as React.ReactElement<any>, { "aria-invalid": true });
        }
        return child;
      })}
      {showErr && <span role="alert" style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 3, display: "block" }}>{error}</span>}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import {
  DOCTORS, GENDERS, BLOOD_GROUPS, STATUSES,
  ALERT_TYPES, INSURERS, RELATIONS,
} from "../constants/patientConstants";
import { calcAge } from "../utils/patientUtils";
import { findDuplicates, validatePatient, buildAuditEntries } from "../utils/patientFormUtils";
import { detectContradictions, checkActivationRequirements } from "../utils/dataIntegrity";
import DataIntegrityPanel from "./DataIntegrityPanel";
import CriticalAlertOverride from "./CriticalAlertOverride";

// ─── FIELD PRIMITIVES ─────────────────────────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono, disabled }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ fontFamily: mono ? "'DM Mono', monospace" : undefined, width: "100%" }}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "var(--accent)",
      padding: "14px 0 6px",
      borderBottom: "1px solid var(--border)",
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function Grid({ children, cols = 2 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "12px 16px",
    }}>
      {children}
    </div>
  );
}

// ─── DUPLICATE WARNING BANNER ─────────────────────────────────────────────────
function DuplicateWarning({ duplicates, onViewPatient, onDismiss }) {
  if (!duplicates.length) return null;
  return (
    <div style={{
      background: "#fef3c7", border: "1px solid #f59e0b",
      borderRadius: 8, padding: "12px 14px", marginBottom: 16,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e", marginBottom: 8 }}>
        ⚠ Possible duplicate patient{duplicates.length > 1 ? "s" : ""} found
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {duplicates.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#78350f" }}>{d.name}</span>
              <span style={{ fontSize: 11, color: "#92400e", marginLeft: 8 }}>{d.id}</span>
              <span style={{ fontSize: 11, color: "#92400e", marginLeft: 8 }}>· {d.phone}</span>
              <span style={{ fontSize: 11, color: "#92400e", marginLeft: 8 }}>· DOB {d.dob}</span>
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 600,
                background: "#fde68a", color: "#92400e",
                padding: "1px 6px", borderRadius: 4,
              }}>
                {d._matchReason}
              </span>
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "3px 8px", flexShrink: 0 }}
              onClick={() => onViewPatient(d)}
            >
              View
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onDismiss}>
          Dismiss — proceed anyway
        </button>
      </div>
    </div>
  );
}

// ─── EMPTY FORM STATE ─────────────────────────────────────────────────────────
function emptyForm() {
  return {
    firstName: "", lastName: "",
    dob: "", gender: "", bloodGroup: "",
    phone: "", email: "", address: "", nationality: "Indian",
    emergencyName: "", emergencyRelation: "", emergencyPhone: "",
    doctor: "", status: "New",
    insurer: "None", policyNumber: "", insuranceExpiry: "",
    allergies: "", conditions: [], medications: "",
    alerts: [],
    changeReason: "",
  };
}

function patientToForm(p) {
  return {
    firstName:         p.firstName,
    lastName:          p.lastName,
    dob:               p.dob,
    gender:            p.gender,
    bloodGroup:        p.bloodGroup,
    phone:             p.phone,
    email:             p.email,
    address:           p.address,
    nationality:       p.nationality,
    emergencyName:     p.emergencyName,
    emergencyRelation: p.emergencyRelation,
    emergencyPhone:    p.emergencyPhone,
    doctor:            p.doctor,
    status:            p.status,
    insurer:           p.insurer,
    policyNumber:      p.policyNumber  || "",
    insuranceExpiry:   p.insuranceExpiry || "",
    allergies:         p.allergies     || "",
    conditions:        p.conditions    || [],
    medications:       (p.medications  || []).join(", "),
    alerts:            p.alerts        || [],
    changeReason:      "",
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PatientForm({
  mode,            // "create" | "edit"
  patient,         // existing patient when mode === "edit"
  allPatients,     // full list for duplicate checking
  currentUser,     // { name, role } — who's logged in
  onSave,          // (patientData, auditEntries) => void
  onClose,
  onViewDuplicate, // (patient) => void
}) {
  const isEdit = mode === "edit";

  const [form,            setForm]            = useState(isEdit ? patientToForm(patient) : emptyForm());
  const [errors,          setErrors]          = useState({});
  const [touched,         setTouched]         = useState({});
  const [duplicates,      setDuplicates]      = useState([]);
  const [dupDismissed,    setDupDismissed]    = useState(false);
  const [step,            setStep]            = useState(0); // 0=personal 1=contact 2=medical 3=admin
  const [saving,          setSaving]          = useState(false);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  const STEPS = ["Personal", "Contact", "Medical", "Admin"];

  // Live duplicate check (create mode only) — runs after name+phone+dob filled
  useEffect(() => {
    if (isEdit || dupDismissed) return;
    const candidates = findDuplicates(form, allPatients);
    setDuplicates(candidates);
  }, [form.firstName, form.lastName, form.phone, form.dob, isEdit, dupDismissed, allPatients]);

  // Live validation of touched fields
  useEffect(() => {
    if (Object.keys(touched).length === 0) return;
    const errs = validatePatient(form);
    const visibleErrs = {};
    Object.keys(errs).forEach((k) => { if (touched[k]) visibleErrs[k] = errs[k]; });
    setErrors(visibleErrs);
  }, [form, touched]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function toggleAlert(alert) {
    set("alerts", form.alerts.includes(alert)
      ? form.alerts.filter((a) => a !== alert)
      : [...form.alerts, alert]);
  }

  function toggleCondition(c) {
    set("conditions", form.conditions.includes(c)
      ? form.conditions.filter((x) => x !== c)
      : [...form.conditions, c]);
  }

  function handleSave() {
    // Touch all fields to show all errors
    const allFields = Object.keys(emptyForm());
    setTouched(Object.fromEntries(allFields.map((k) => [k, true])));

    const errs = validatePatient(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Jump to first step that has an error
      const stepFields = [
        ["firstName","lastName","dob","gender","bloodGroup"],
        ["phone","email","address","emergencyName","emergencyRelation","emergencyPhone"],
        ["allergies"],
        ["doctor","status"],
      ];
      const firstErrStep = stepFields.findIndex((fields) => fields.some((f) => errs[f]));
      if (firstErrStep >= 0) setStep(firstErrStep);
      return;
    }

    if (duplicates.length > 0 && !dupDismissed) {
      setDupDismissed(false); // force them to see the warning
      setStep(0);
      return;
    }

    // Check critical alert acknowledgment
    const criticalAlerts = form.alerts.filter(alert =>
      ["Allergy", "Heart Condition", "Pregnancy", "High Risk"].includes(alert)
    );
    const unacknowledgedCriticals = criticalAlerts.filter(alert => !acknowledgedAlerts[alert]);
    if (unacknowledgedCriticals.length > 0) {
      setStep(2); // Jump to medical step where alerts are
      alert("Please acknowledge all critical alerts before saving.");
      return;
    }

    // Check activation requirements for Active status
    if (form.status === "Active") {
      const patientForCheck = {
        ...form,
        name: `${form.firstName} ${form.lastName}`,
        age: form.dob ? calcAge(form.dob) : null,
        insuranceStatus: deriveInsuranceStatus(form),
      };
      const activationCheck = checkActivationRequirements(patientForCheck);
      if (!activationCheck.canActivate) {
        setStep(3); // Jump to admin step where status is
        alert(`Cannot activate patient. Missing requirements:\n${activationCheck.missing.join("\n")}`);
        return;
      }
    }

    setSaving(true);

    const now    = new Date().toISOString();
    const userId = currentUser?.name ?? "Staff";

    const patientData = {
      ...(isEdit ? patient : {}),
      firstName:         form.firstName.trim(),
      lastName:          form.lastName.trim(),
      name:              `${form.firstName.trim()} ${form.lastName.trim()}`,
      dob:               form.dob,
      age:               calcAge(form.dob),
      gender:            form.gender,
      bloodGroup:        form.bloodGroup,
      phone:             form.phone.trim(),
      email:             form.email.trim(),
      address:           form.address.trim(),
      nationality:       form.nationality.trim(),
      emergencyName:     form.emergencyName.trim(),
      emergencyRelation: form.emergencyRelation,
      emergencyPhone:    form.emergencyPhone.trim(),
      doctor:            form.doctor,
      status:            form.status,
      insurer:           form.insurer,
      policyNumber:      form.insurer !== "None" ? form.policyNumber.trim() : null,
      insuranceExpiry:   form.insurer !== "None" ? form.insuranceExpiry : null,
      insuranceStatus:   deriveInsuranceStatus(form),
      allergies:         form.allergies.trim(),
      conditions:        form.conditions,
      medications:       form.medications ? form.medications.split(",").map((m) => m.trim()).filter(Boolean) : [],
      alerts:            form.alerts,
      // preserve existing sub-collections on edit
      timeline:          isEdit ? patient.timeline   : [],
      documents:         isEdit ? patient.documents  : [],
      notes:             isEdit ? patient.notes      : [],
      family:            isEdit ? patient.family     : [],
      lastVisit:         isEdit ? patient.lastVisit  : new Date().toISOString().split("T")[0],
      nextAppointment:   isEdit ? patient.nextAppointment : null,
      followUpDate:      isEdit ? patient.followUpDate    : null,
      followUpReason:    isEdit ? patient.followUpReason  : null,
      followUpStaff:     isEdit ? patient.followUpStaff   : null,
      followUpPriority:  isEdit ? patient.followUpPriority : null,
    };

    // Build audit entries
    const auditEntries = isEdit
      ? buildAuditEntries(patient, patientData, userId, form.changeReason)
      : [{
          id:        `audit-${Date.now()}`,
          timestamp: now,
          user:      userId,
          action:    "created",
          field:     null,
          label:     "Patient Record Created",
          oldValue:  null,
          newValue:  null,
          reason:    null,
        }];

    setSaving(false);
    onSave(patientData, auditEntries);
  }

  const allErrors = validatePatient(form);
  const hasErrors = Object.keys(allErrors).length > 0;

  // Count errors per step for step indicator dots
  const stepFields = [
    ["firstName","lastName","dob","gender","bloodGroup"],
    ["phone","email","address","emergencyName","emergencyRelation","emergencyPhone"],
    ["allergies"],
    ["doctor","status"],
  ];
  const stepErrorCounts = stepFields.map((fields) =>
    fields.filter((f) => touched[f] && allErrors[f]).length
  );

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)", zIndex: 100,
        }}
      />

      {/* ── Modal ── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 101,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, pointerEvents: "none",
      }}>
        <div style={{
          background: "var(--surface)", borderRadius: 14,
          width: "100%", maxWidth: 680,
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          pointerEvents: "all",
          animation: "fadeIn 0.15s ease",
        }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {isEdit ? `Edit — ${patient.name}` : "New Patient Registration"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {isEdit ? patient.id : "Fill in all required fields. Duplicates are checked automatically."}
              </div>
            </div>
            <button className="btn btn-ghost" style={{ padding: "6px 10px" }} onClick={onClose}>
              <i className="ti ti-x" style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Step tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid var(--border)",
            background: "var(--surface2)", flexShrink: 0,
          }}>
            {STEPS.map((label, i) => (
              <button
                key={label}
                onClick={() => setStep(i)}
                style={{
                  flex: 1, padding: "10px 8px", fontSize: 12, cursor: "pointer",
                  background: "transparent", border: "none",
                  borderBottom: step === i ? "2px solid var(--accent)" : "2px solid transparent",
                  color: step === i ? "var(--accent)" : "var(--muted)",
                  fontWeight: step === i ? 600 : 400,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {label}
                {stepErrorCounts[i] > 0 && (
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#ef4444", color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {stepErrorCounts[i]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>

            {/* Duplicate warning always visible at top */}
            {!dupDismissed && (
              <DuplicateWarning
                duplicates={duplicates}
                onViewPatient={onViewDuplicate}
                onDismiss={() => setDupDismissed(true)}
              />
            )}

            {/* Data Integrity Panel - shows contradictions and warnings */}
            <DataIntegrityPanel
              patient={{
                ...form,
                name: `${form.firstName} ${form.lastName}`,
                age: form.dob ? calcAge(form.dob) : null,
                insuranceStatus: deriveInsuranceStatus(form),
              }}
              onFixIssue={(issue) => {
                // Auto-fix simple issues by jumping to relevant step and field
                if (issue.fields.includes("gender")) setStep(0);
                else if (issue.fields.includes("dob")) setStep(0);
                else if (issue.fields.includes("phone")) setStep(1);
                else if (issue.fields.includes("emergencyContact")) setStep(1);
                else if (issue.fields.includes("insuranceStatus")) setStep(3);
              }}
            />

            {/* Critical Alert Override - forces acknowledgment for critical alerts */}
            {form.alerts.length > 0 && (
              <CriticalAlertOverride
                patient={{
                  ...form,
                  name: `${form.firstName} ${form.lastName}`,
                }}
                acknowledgedAlerts={acknowledgedAlerts}
                onAcknowledge={(alert) => {
                  setAcknowledgedAlerts(prev => ({ ...prev, [alert]: true }));
                }}
              />
            )}

            {/* ── STEP 0: Personal ── */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SectionHeading>Personal Information</SectionHeading>
                <Grid>
                  <Field label="First Name" required error={errors.firstName}>
                    <TextInput value={form.firstName} onChange={(v) => set("firstName", v)} placeholder="e.g. Arjun" />
                  </Field>
                  <Field label="Last Name" required error={errors.lastName}>
                    <TextInput value={form.lastName} onChange={(v) => set("lastName", v)} placeholder="e.g. Sharma" />
                  </Field>
                  <Field label="Date of Birth" required error={errors.dob}>
                    <input
                      type="date"
                      value={form.dob}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => set("dob", e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
                    />
                  </Field>
                  <Field label="Gender" required error={errors.gender}>
                    <SelectInput value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} placeholder="Select gender" />
                  </Field>
                  <Field label="Blood Group" required error={errors.bloodGroup}>
                    <SelectInput value={form.bloodGroup} onChange={(v) => set("bloodGroup", v)} options={BLOOD_GROUPS} placeholder="Select" />
                  </Field>
                  <Field label="Nationality">
                    <TextInput value={form.nationality} onChange={(v) => set("nationality", v)} />
                  </Field>
                </Grid>
              </div>
            )}

            {/* ── STEP 1: Contact ── */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SectionHeading>Contact Details</SectionHeading>
                <Grid>
                  <Field label="Phone" required error={errors.phone}>
                    <TextInput value={form.phone} onChange={(v) => set("phone", v)} placeholder="+91 9XXXXXXXXX" mono />
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <TextInput value={form.email} onChange={(v) => set("email", v)} placeholder="patient@email.com" />
                  </Field>
                </Grid>
                <Field label="Address" error={errors.address}>
                  <TextInput value={form.address} onChange={(v) => set("address", v)} placeholder="Street, Area, City" />
                </Field>

                <SectionHeading>Emergency Contact</SectionHeading>
                <Grid>
                  <Field label="Name" required error={errors.emergencyName}>
                    <TextInput value={form.emergencyName} onChange={(v) => set("emergencyName", v)} placeholder="Full name" />
                  </Field>
                  <Field label="Relation" required error={errors.emergencyRelation}>
                    <SelectInput value={form.emergencyRelation} onChange={(v) => set("emergencyRelation", v)} options={RELATIONS} placeholder="Select relation" />
                  </Field>
                  <Field label="Phone" required error={errors.emergencyPhone}>
                    <TextInput value={form.emergencyPhone} onChange={(v) => set("emergencyPhone", v)} placeholder="+91 9XXXXXXXXX" mono />
                  </Field>
                </Grid>
              </div>
            )}

            {/* ── STEP 2: Medical ── */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SectionHeading>Medical Alerts</SectionHeading>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ALERT_TYPES.map((a) => {
                    const active = form.alerts.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() => toggleAlert(a)}
                        style={{
                          padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "var(--accent-soft)" : "transparent",
                          color: active ? "var(--accent)" : "var(--muted)",
                          cursor: "pointer",
                        }}
                      >
                        {active ? "✓ " : ""}{a}
                      </button>
                    );
                  })}
                </div>
                {errors.alerts && <span style={{ fontSize: 11, color: "#ef4444" }}>{errors.alerts}</span>}

                <SectionHeading>Medical Details</SectionHeading>
                <Grid>
                  <Field label="Allergies" error={errors.allergies}>
                    <TextInput value={form.allergies} onChange={(v) => set("allergies", v)} placeholder="e.g. Penicillin, Aspirin" />
                  </Field>
                  <Field label="Medications" error={errors.medications}>
                    <TextInput value={form.medications} onChange={(v) => set("medications", v)} placeholder="e.g. Metformin 500mg (comma separated)" />
                  </Field>
                </Grid>

                <SectionHeading>Insurance</SectionHeading>
                <Grid>
                  <Field label="Insurance Provider">
                    <SelectInput value={form.insurer} onChange={(v) => set("insurer", v)} options={INSURERS} />
                  </Field>
                  {form.insurer !== "None" && (
                    <>
                      <Field label="Policy Number">
                        <TextInput value={form.policyNumber} onChange={(v) => set("policyNumber", v)} placeholder="POL-XXXXXX" mono />
                      </Field>
                      <Field label="Expiry Date">
                        <input
                          type="date"
                          value={form.insuranceExpiry}
                          onChange={(e) => set("insuranceExpiry", e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
                        />
                      </Field>
                    </>
                  )}
                </Grid>
              </div>
            )}

            {/* ── STEP 3: Admin ── */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SectionHeading>Clinical Assignment</SectionHeading>
                <Grid>
                  <Field label="Assigned Doctor" required error={errors.doctor}>
                    <SelectInput value={form.doctor} onChange={(v) => set("doctor", v)} options={DOCTORS} placeholder="Select doctor" />
                  </Field>
                  <Field label="Status" required error={errors.status}>
                    <SelectInput value={form.status} onChange={(v) => set("status", v)} options={STATUSES} />
                  </Field>
                </Grid>

                {isEdit && (
                  <>
                    <SectionHeading>Reason for Changes</SectionHeading>
                    <Field
                      label="Change reason"
                      error={errors.changeReason}
                    >
                      <input
                        type="text"
                        value={form.changeReason}
                        onChange={(e) => set("changeReason", e.target.value)}
                        placeholder="e.g. Patient called to update contact details"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
                      />
                    </Field>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      Required when medical information (alerts, allergies, medications) is changed.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderTop: "1px solid var(--border)", flexShrink: 0,
            background: "var(--surface2)",
          }}>
            <div style={{ display: "flex", gap: 8 }}>
              {step > 0 && (
                <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setStep((s) => s - 1)}>
                  <i className="ti ti-arrow-left" style={{ fontSize: 13 }} /> Back
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {hasErrors && Object.keys(touched).length > 0 && (
                <span style={{ fontSize: 12, color: "#ef4444" }}>
                  {Object.keys(allErrors).length} field{Object.keys(allErrors).length > 1 ? "s" : ""} need attention
                </span>
              )}
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onClose}>
                Cancel
              </button>
              {step < STEPS.length - 1 ? (
                <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setStep((s) => s + 1)}>
                  Next <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 13, opacity: saving ? 0.7 : 1 }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  <i className="ti ti-check" style={{ fontSize: 13 }} />
                  {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Patient"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function deriveInsuranceStatus(form) {
  if (form.insurer === "None" || !form.insuranceExpiry) return "None";
  const exp = new Date(form.insuranceExpiry);
  if (exp < new Date()) return "Expired";
  if (exp < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return "Expiring";
  return "Active";
}

import React, { useState } from "react";
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
};

export default function PatientForm({ mode, patient, onSave, onClose, role }: PatientFormProps) {
  const initial = patient ? {
    ...patient,
  } : EMPTY;

  const [form, setForm] = useState<Partial<Patient>>(initial);
  const [section, setSection] = useState<"personal" | "medical" | "insurance" | "status">("personal");
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setErrors((e) => { const ne = { ...e }; delete ne[key as string]; return ne; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.firstName?.trim()) errs.firstName = "Required";
    if (!form.phone?.trim())     errs.phone     = "Required";
    if (!form.dob)               errs.dob       = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const data: Partial<Patient> = {
      ...form,
      name: `${form.firstName || ""} ${form.lastName || ""}`.trim(),
      age:  form.dob ? calcAge(form.dob) : 0,
      insuranceStatus: !form.insurer || form.insurer === "None" ? "None"
        : !form.insuranceExpiry ? "None"
        : new Date(form.insuranceExpiry) < new Date() ? "Expired"
        : new Date(form.insuranceExpiry) < new Date(Date.now() + 30 * 86400000) ? "Expiring"
        : "Active",
      timeline:  form.timeline || [],
      documents: form.documents || [],
      notes:     form.notes || [],
      family:    form.family || [],
      consents:  form.consents || {},
    };
    onSave(data);
  }

  function toggleAlert(alert: AlertType) {
    const current = form.alerts || [];
    if (current.includes(alert)) {
      update("alerts", current.filter((a) => a !== alert) as AlertType[]);
    } else {
      update("alerts", [...current, alert] as AlertType[]);
    }
  }

  const SECTIONS = [
    { id: "personal",  label: "Personal",  icon: "ti-user" },
    { id: "medical",   label: "Medical",   icon: "ti-heart-rate-monitor" },
    { id: "insurance", label: "Insurance", icon: "ti-shield" },
    { id: "status",    label: "Status",    icon: "ti-stethoscope" },
  ] as const;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 760 }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius)",
            background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ti ${mode === "create" ? "ti-user-plus" : "ti-edit"}`}
               style={{ fontSize: 18, color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>
              {mode === "create" ? "Register New Patient" : `Edit Patient: ${patient?.name}`}
            </div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              {mode === "create" ? "Fill in patient details below" : "Update the patient's information"}
            </div>
          </div>
          <button className="btn-icon" style={{ marginLeft: "auto" }} onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "0 20px" }}>
          {SECTIONS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setSection(id as any)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 14px", borderBottom: `2px solid ${section === id ? "var(--accent)" : "transparent"}`,
              color: section === id ? "var(--accent)" : "var(--muted)",
              fontWeight: section === id ? 600 : 400, fontSize: "var(--font-sm)",
              background: "none", border: "none", borderBottom: `2px solid ${section === id ? "var(--accent)" : "transparent"}`,
              cursor: "pointer", transition: "all 0.15s",
            }}>
              <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
              {label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div style={{ padding: "20px", maxHeight: "calc(80vh - 160px)", overflowY: "auto" }}>
          {section === "personal" && (
            <FormSection>
              <FormRow>
                <Field label="First Name *" error={errors.firstName}>
                  <input type="text" value={form.firstName || ""} onChange={(e) => update("firstName", e.target.value)} placeholder="First name" style={{ width: "100%", borderColor: errors.firstName ? "var(--red)" : undefined }} />
                </Field>
                <Field label="Last Name">
                  <input type="text" value={form.lastName || ""} onChange={(e) => update("lastName", e.target.value)} placeholder="Last name" style={{ width: "100%" }} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Date of Birth *" error={errors.dob}>
                  <input type="date" value={form.dob || ""} onChange={(e) => update("dob", e.target.value)} style={{ width: "100%", borderColor: errors.dob ? "var(--red)" : undefined }} />
                </Field>
                <Field label="Gender">
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
                <Field label="Phone *" error={errors.phone}>
                  <input type="tel" value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ width: "100%", borderColor: errors.phone ? "var(--red)" : undefined }} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="email@example.com" style={{ width: "100%" }} />
                </Field>
              </FormRow>
              <Field label="Address">
                <input type="text" value={form.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="Full address" style={{ width: "100%" }} />
              </Field>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
                <div className="section-label">Emergency Contact</div>
                <FormRow>
                  <Field label="Contact Name">
                    <input type="text" value={form.emergencyName || ""} onChange={(e) => update("emergencyName", e.target.value)} placeholder="Name" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Relation">
                    <input type="text" value={form.emergencyRelation || ""} onChange={(e) => update("emergencyRelation", e.target.value)} placeholder="e.g. Spouse" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" value={form.emergencyPhone || ""} onChange={(e) => update("emergencyPhone", e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ width: "100%" }} />
                  </Field>
                </FormRow>
              </div>
            </FormSection>
          )}

          {section === "medical" && (
            <FormSection>
              <Field label="Known Allergies">
                <input type="text" value={form.allergies || ""} onChange={(e) => update("allergies", e.target.value)} placeholder="e.g. Penicillin, Aspirin" style={{ width: "100%" }} />
              </Field>
              <div>
                <label className="field-label">Medical Alerts</label>
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
              <Field label="Current Medications">
                <textarea
                  value={(form.medications || []).join(", ")}
                  onChange={(e) => update("medications", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : [])}
                  placeholder="Metformin 500mg, Amlodipine 5mg…"
                  rows={2} style={{ width: "100%", resize: "vertical" }}
                />
              </Field>
              <Field label="Conditions">
                <textarea
                  value={(form.conditions || []).join(", ")}
                  onChange={(e) => update("conditions", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : [])}
                  placeholder="Type 2 Diabetes, Hypertension…"
                  rows={2} style={{ width: "100%", resize: "vertical" }}
                />
              </Field>
            </FormSection>
          )}

          {section === "insurance" && (
            <FormSection>
              <FormRow>
                <Field label="Insurance Provider">
                  <select value={form.insurer || "None"} onChange={(e) => update("insurer", e.target.value)} style={{ width: "100%" }}>
                    {INSURERS.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
                {form.insurer !== "None" && (
                  <>
                    <Field label="Policy Number">
                      <input type="text" value={form.policyNumber || ""} onChange={(e) => update("policyNumber", e.target.value || null)} placeholder="POL-XXXXXX" style={{ width: "100%" }} />
                    </Field>
                    <Field label="Expiry Date">
                      <input type="date" value={form.insuranceExpiry || ""} onChange={(e) => update("insuranceExpiry", e.target.value || null)} style={{ width: "100%" }} />
                    </Field>
                  </>
                )}
              </FormRow>
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
                <Field label="Assigned Doctor">
                  <select value={form.doctor || "Dr. Sharma"} onChange={(e) => update("doctor", e.target.value)} style={{ width: "100%" }}>
                    {DOCTORS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Last Visit">
                  <input type="date" value={form.lastVisit || ""} onChange={(e) => update("lastVisit", e.target.value || null)} style={{ width: "100%" }} />
                </Field>
                <Field label="Next Appointment">
                  <input type="date" value={form.nextAppointment || ""} onChange={(e) => update("nextAppointment", e.target.value || null)} style={{ width: "100%" }} />
                </Field>
              </FormRow>
            </FormSection>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface2)",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {SECTIONS.map(({ id, label }) => (
              <button key={id} onClick={() => setSection(id as any)} style={{
                padding: "4px 10px", borderRadius: "var(--radius-full)",
                fontSize: "var(--font-xs)", cursor: "pointer",
                background: section === id ? "var(--accent)" : "transparent",
                color: section === id ? "#fff" : "var(--muted)",
                border: `1px solid ${section === id ? "var(--accent)" : "var(--border)"}`,
                fontWeight: section === id ? 600 : 400,
              }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              <i className={`ti ${mode === "create" ? "ti-user-plus" : "ti-device-floppy"}`} style={{ fontSize: 14 }} />
              {mode === "create" ? "Register Patient" : "Save Changes"}
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
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)`, gap: 12 }}>{children}</div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
      {error && <span style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 3 }}>{error}</span>}
    </div>
  );
}

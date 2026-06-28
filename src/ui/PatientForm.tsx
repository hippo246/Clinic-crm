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

  const [form, setForm] = useState<Partial<Patient>>(initial);
  const [section, setSection] = useState<"personal" | "medical" | "insurance" | "status">("personal");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (isDirty) {
      localStorage.setItem('patient_form_draft', JSON.stringify(form));
    }
  }, [form, isDirty]);

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
      case "dob":
        if (!value) return "Date of birth is required";
        const dob = new Date(value);
        if (dob > new Date()) return "Date of birth cannot be in the future";
        if (dob < new Date("1900-01-01")) return "Invalid date of birth";
        return null;
      case "emergencyPhone":
        if (value && !/^[+]?[\d\s-]{10,}$/.test(value)) return "Invalid phone number format";
        return null;
      default:
        return null;
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    
    // Validate required fields
    const firstNameError = validateField("firstName", form.firstName);
    if (firstNameError) errs.firstName = firstNameError;
    
    const phoneError = validateField("phone", form.phone);
    if (phoneError) errs.phone = phoneError;
    
    const dobError = validateField("dob", form.dob);
    if (dobError) errs.dob = dobError;
    
    // Validate optional fields if filled
    if (form.email) {
      const emailError = validateField("email", form.email);
      if (emailError) errs.email = emailError;
    }
    
    if (form.emergencyPhone) {
      const emergencyPhoneError = validateField("emergencyPhone", form.emergencyPhone);
      if (emergencyPhoneError) errs.emergencyPhone = emergencyPhoneError;
    }

    setErrors(errs);
    setTouched({
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      dob: true,
      emergencyPhone: true,
    });
    
    return Object.keys(errs).length === 0;
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
    // Clear draft
    localStorage.removeItem('patient_form_draft');
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

  return (
    <div className="modal-backdrop">
      <div className="modal pf-modal" style={{ width: "100%", maxWidth: 800 }}>
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
            width: 40, height: 40, borderRadius: "var(--radius)",
            background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ti ${mode === "create" ? "ti-user-plus" : "ti-edit"}`}
               style={{ fontSize: 18, color: "var(--accent)" }} />
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
              Draft saved
            </span>
          )}
          <button className="btn-icon" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

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
        <div className="pf-tabs" style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "0 20px" }}>
          {SECTIONS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setSection(id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 14px", borderBottom: `2px solid ${section === id ? "var(--accent)" : "transparent"}`,
              color: section === id ? "var(--accent)" : "var(--muted)",
              fontWeight: section === id ? 600 : 400, fontSize: "var(--font-sm)",
              background: "none", border: "none", cursor: "pointer", transition: "all 0.15s",
            }}>
              <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
              <span className="pf-tab-label">{label}</span>
            </button>
          ))}
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
                <Field label="Phone *" error={errors.phone} touched={touched.phone}>
                  <input 
                    type="tel" 
                    value={form.phone || ""} 
                    onChange={(e) => update("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    placeholder="+91 XXXXX XXXXX" 
                    style={{ width: "100%", borderColor: errors.phone && touched.phone ? "var(--red)" : undefined }} 
                  />
                </Field>
                <Field label="Email" error={errors.email} touched={touched.email}>
                  <input 
                    type="email" 
                    value={form.email || ""} 
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    placeholder="email@example.com" 
                    style={{ width: "100%", borderColor: errors.email && touched.email ? "var(--red)" : undefined }} 
                  />
                </Field>
              </FormRow>
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
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
                <div className="section-label">Emergency Contact (Secondary)</div>
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
                <div className="section-label">Additional Information</div>
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
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginBottom: 12 }}>
                <div className="section-label">Allergies</div>
                <FormRow>
                  <Field label="Known Allergies">
                    <input type="text" value={form.allergies || ""} onChange={(e) => update("allergies", e.target.value)} placeholder="e.g. Penicillin, Aspirin" style={{ width: "100%" }} />
                  </Field>
                  <Field label="Severity">
                    <select value={form.allergiesSeverity || ""} onChange={(e) => update("allergiesSeverity", e.target.value)} style={{ width: "100%" }}>
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
                <div className="section-label">Current Medications</div>
                <Field label="Medications">
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
                <Field label="Assigned Doctor">
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
                </Field>
              </FormRow>
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
  return <div className="pf-form-row" style={{ display: "grid", gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)`, gap: 12 }}>{children}</div>;
}

function Field({ label, error, touched, children }: { label: string; error?: string; touched?: boolean; children: React.ReactNode }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
      {error && touched && <span style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 3 }}>{error}</span>}
    </div>
  );
}

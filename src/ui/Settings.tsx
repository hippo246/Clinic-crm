import React, { useState, useEffect } from "react";

// ─── Shared field styling ──────────────────────────────────────────────────────
// Centralizes input/select/textarea appearance so every field in this page gets
// a consistent border, sizing, and focus ring instead of each one redeclaring it.
const fieldBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  fontSize: "var(--font-sm)",
  fontFamily: "inherit",
  color: "var(--fg)",
  background: "var(--surface)",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function useFieldFocus() {
  const onFocus = (e: React.FocusEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px var(--accent-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
    (e.currentTarget as HTMLElement).style.boxShadow = "none";
  };
  return { onFocus, onBlur };
}

// ─── Storage key constants ─────────────────────────────────────────────────────
const PATIENTS_KEY        = "clinic_crm_patients_v1";
const LEGACY_PATIENTS_KEY = "clinic_crm_patients";
const AUDIT_KEY           = "clinic_crm_audit_v1";
const INVOICES_KEY        = "clinic_crm_invoices";
const PRESCRIPTIONS_KEY   = "clinic_crm_prescriptions";
const DOCUMENTS_KEY       = "clinic_crm_documents";
const COMMUNICATIONS_KEY  = "clinic_crm_communications";
const SETTINGS_KEY        = "clinic_crm_settings";
const LAST_BACKUP_KEY     = "clinic_crm_last_backup";

// ─── Safe JSON read helper ─────────────────────────────────────────────────────
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Read patients with v1 → legacy fallback ───────────────────────────────────
function readPatientsForExport(): any[] {
  const v1 = readJSON<any[]>(PATIENTS_KEY, []);
  if (v1.length > 0) return v1;
  return readJSON<any[]>(LEGACY_PATIENTS_KEY, []);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 6, display: "block", color: "var(--fg)" }}>
      {children}
    </label>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const focus = useFieldFocus();
  return <input {...focus} {...props} style={{ ...fieldBaseStyle, ...props.style }} />;
}

function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const focus = useFieldFocus();
  return <select {...focus} {...props} style={{ ...fieldBaseStyle, cursor: "pointer", ...props.style }} />;
}

function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const focus = useFieldFocus();
  return <textarea {...focus} {...props} style={{ ...fieldBaseStyle, resize: "vertical", lineHeight: 1.5, ...props.style }} />;
}

export default function SettingsPage({
  dark, setDark, role, setRole,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  role: string;
  setRole: (r: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"clinic" | "templates" | "invoice" | "prescription" | "notifications" | "backup">("clinic");
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const base = {
      clinicName: "City Medical Center",
      clinicAddress: "123 Healthcare Ave, Medical District",
      clinicPhone: "+1 (555) 123-4567",
      clinicEmail: "info@citymedical.com",
      clinicHours: "Mon-Fri: 8AM-8PM, Sat: 9AM-5PM",
      currency: "USD",
      timezone: "Asia/Kolkata",
      invoicePrefix: "INV",
      invoiceStartingNumber: "1001",
      invoiceTerms: "",
      paymentMethods: ["Cash", "Card", "UPI"] as string[],
      prescriptionPrefix: "RX",
      prescriptionStartingNumber: "5001",
      prescriptionHeader: "",
      prescriptionFooter: "",
      drugInteractionWarnings: true,
      appointmentReminder: true,
      followUpReminder: true,
      paymentReminder: true,
      labResultAlert: true,
      reminderLeadHours: "24",
      emailNotifications: true,
      smsNotifications: false,
      autoBackup: true,
      backupFrequency: "daily",
      templates: [
        { name: "Appointment Reminder", body: "Hi {patient_name}, this is a reminder for your appointment on {appointment_date} at {appointment_time}. Please arrive 15 minutes early." },
        { name: "Follow-up Reminder", body: "Hi {patient_name}, it's time for your follow-up appointment. Please call us to schedule at your convenience." },
        { name: "Payment Reminder", body: "Hi {patient_name}, this is a reminder that your payment of {amount} is due by {due_date}. Please make the payment at your earliest convenience." },
        { name: "Lab Result Ready", body: "Hi {patient_name}, your lab results are ready. Please visit the clinic or log in to view them." },
      ],
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure array fields survive old saves
      if (!Array.isArray(parsed.paymentMethods)) parsed.paymentMethods = base.paymentMethods;
      if (!Array.isArray(parsed.templates)) parsed.templates = base.templates;
      return { ...base, ...parsed };
    }
    return base;
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "unsaved">("idle");
  const [lastBackup, setLastBackup] = useState<string>(localStorage.getItem(LAST_BACKUP_KEY) || "Never");
  const [storageUsage, setStorageUsage] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [healthTick, setHealthTick] = useState(0); // increment to re-render health counts
  const isMounted = React.useRef(false);

  const showToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const calcStorage = () => {
    try {
      let total = 0;
      for (const key of Object.keys(localStorage)) {
        total += (localStorage.getItem(key) || "").length * 2;
      }
      setStorageUsage(total < 1024 ? `${total} B` : total < 1048576 ? `${(total / 1024).toFixed(1)} KB` : `${(total / 1048576).toFixed(2)} MB`);
    } catch { setStorageUsage("Unknown"); }
    setHealthTick(t => t + 1);
  };

  // Track unsaved changes — skip first mount
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    setSaveStatus("unsaved");
  }, [settings]);

  // Recalculate storage when backup tab opens
  useEffect(() => {
    if (activeTab === "backup") calcStorage();
  }, [activeTab]);

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaveStatus("saved");
    calcStorage();
    showToast("Settings saved successfully", "success");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const downloadCSV = (filename: string, rows: any[]) => {
    if (!rows.length) { showToast("No data to export.", "info"); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename; a.click();
  };

  const handleExportPatients = () => {
    const patients = readPatientsForExport();
    downloadCSV(`patients-${new Date().toISOString().slice(0,10)}.csv`, patients);
  };

  const handleExportAppointments = () => {
    const patients = readPatientsForExport();
    const appts = patients.filter((p: any) => p.nextAppointment).map((p: any) => ({ id: p.id, name: p.name, doctor: p.doctor, nextAppointment: p.nextAppointment, status: p.status }));
    downloadCSV(`appointments-${new Date().toISOString().slice(0,10)}.csv`, appts);
  };

  const handleExportInvoices = () => {
    const invoices = JSON.parse(localStorage.getItem(INVOICES_KEY) || "[]");
    downloadCSV(`invoices-${new Date().toISOString().slice(0,10)}.csv`, invoices);
  };

  const handleExportAllJSON = () => {
    const allData = {
      patients:       readPatientsForExport(),
      audit:          readJSON<any[]>(AUDIT_KEY, []),
      invoices:       readJSON<any[]>(INVOICES_KEY, []),
      prescriptions:  readJSON<any[]>(PRESCRIPTIONS_KEY, []),
      documents:      readJSON<any[]>(DOCUMENTS_KEY, []),
      communications: readJSON<any[]>(COMMUNICATIONS_KEY, []),
      settings,
      exportedAt:     new Date().toISOString(),
      appVersion:     "frontend-local-v1",
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" }));
    a.download = `clinic-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    const ts = new Date().toLocaleString();
    setLastBackup(ts);
    localStorage.setItem(LAST_BACKUP_KEY, ts);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const summaryParts: string[] = [];

          // Helper: merge two arrays by id, appending items without id
          const mergeById = (existing: any[], incoming: any[]): any[] => {
            const map = new Map<string, any>();
            for (const item of existing) { if (item.id != null) map.set(String(item.id), item); }
            const noId: any[] = [];
            for (const item of incoming) {
              if (item.id != null) map.set(String(item.id), item);
              else noId.push(item);
            }
            return [...map.values(), ...noId];
          };

          // Helper: save one array section
          const saveSection = (key: string, incoming: any[], label: string) => {
            if (!Array.isArray(incoming)) return;
            let final: any[];
            if (importMode === "merge") {
              const existing = readJSON<any[]>(key, []);
              final = mergeById(existing, incoming);
            } else {
              final = incoming;
            }
            localStorage.setItem(key, JSON.stringify(final));
            summaryParts.push(`${final.length} ${label}`);
          };

          if (data.patients && Array.isArray(data.patients)) {
            saveSection(PATIENTS_KEY, data.patients, "patients");
            localStorage.removeItem(LEGACY_PATIENTS_KEY);
          }
          if (data.audit && Array.isArray(data.audit))          saveSection(AUDIT_KEY,           data.audit,          "audit entries");
          if (data.invoices && Array.isArray(data.invoices))    saveSection(INVOICES_KEY,        data.invoices,       "invoices");
          if (data.prescriptions && Array.isArray(data.prescriptions)) saveSection(PRESCRIPTIONS_KEY, data.prescriptions, "prescriptions");
          if (data.documents && Array.isArray(data.documents))  saveSection(DOCUMENTS_KEY,       data.documents,      "documents");
          if (data.communications && Array.isArray(data.communications)) saveSection(COMMUNICATIONS_KEY, data.communications, "communications");
          if (data.settings && typeof data.settings === "object") {
            const merged = importMode === "merge" ? { ...settings, ...data.settings } : data.settings;
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
            setSettings((s: typeof settings) => ({ ...s, ...merged }));
          }

          calcStorage();
          const summary = summaryParts.length > 0 ? summaryParts.join(", ") : "no sections";
          showToast(`Import complete (${importMode}): ${summary} restored.`, "success");
        } catch { showToast("Invalid backup file. Please select a valid JSON backup.", "error"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleMigrateLegacy = () => {
    const v1 = readJSON<any[]>(PATIENTS_KEY, []);
    if (v1.length > 0) { showToast("v1 already has patients — migration skipped.", "info"); return; }
    const legacy = readJSON<any[]>(LEGACY_PATIENTS_KEY, []);
    if (legacy.length === 0) { showToast("No legacy patient data found.", "info"); return; }
    localStorage.setItem(PATIENTS_KEY, JSON.stringify(legacy));
    calcStorage();
    showToast(`Migrated ${legacy.length} patients to clinic_crm_patients_v1.`, "success");
  };

  const handleExportSummary = () => {
    const counts = [
      { label: "Patients",       count: readJSON<any[]>(PATIENTS_KEY,       []).length },
      { label: "Audit entries",  count: readJSON<any[]>(AUDIT_KEY,          []).length },
      { label: "Invoices",       count: readJSON<any[]>(INVOICES_KEY,       []).length },
      { label: "Prescriptions",  count: readJSON<any[]>(PRESCRIPTIONS_KEY,  []).length },
      { label: "Documents",      count: readJSON<any[]>(DOCUMENTS_KEY,      []).length },
      { label: "Communications", count: readJSON<any[]>(COMMUNICATIONS_KEY, []).length },
    ];
    const legacyCount = readJSON<any[]>(LEGACY_PATIENTS_KEY, []).length;
    const lines = [
      "Clinic CRM — Backup Summary",
      "=".repeat(40),
      `Exported at: ${new Date().toLocaleString()}`,
      `Storage used: ${storageUsage || "unknown"}`,
      "",
      "Data Counts:",
      ...counts.map(c => `  ${c.label.padEnd(20)} ${c.count}`),
      ...(legacyCount > 0 ? [`  Legacy patients     ${legacyCount} (clinic_crm_patients — unmigrated)`] : []),
      "",
      "Keys included in full JSON backup:",
      `  ${PATIENTS_KEY}`,
      `  ${AUDIT_KEY}`,
      `  ${INVOICES_KEY}`,
      `  ${PRESCRIPTIONS_KEY}`,
      `  ${DOCUMENTS_KEY}`,
      `  ${COMMUNICATIONS_KEY}`,
      `  ${SETTINGS_KEY}`,
    ];
    const txt = lines.join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = `clinic-backup-summary-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    showToast("Backup summary downloaded.", "success");
  };

  const handleClearData = (key: string, label: string) => {
    if (!window.confirm(`Are you sure you want to delete all ${label}? This cannot be undone.`)) return;
    localStorage.removeItem(key);
    calcStorage();
    showToast(`${label} cleared.`, "info");
  };

  const defaultTemplates = [
    { name: "Appointment Reminder", body: "Hi {patient_name}, this is a reminder for your appointment on {appointment_date} at {appointment_time}. Please arrive 15 minutes early." },
    { name: "Follow-up Reminder", body: "Hi {patient_name}, it's time for your follow-up appointment. Please call us to schedule at your convenience." },
    { name: "Payment Reminder", body: "Hi {patient_name}, this is a reminder that your payment of {amount} is due by {due_date}. Please make the payment at your earliest convenience." },
    { name: "Lab Result Ready", body: "Hi {patient_name}, your lab results are ready. Please visit the clinic or log in to view them." },
  ];

  return (
    <div style={{ padding: "20px 24px 32px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 6, letterSpacing: "-0.01em" }}>
          Settings
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Configure clinic information, templates, and system preferences
        </div>
      </div>

      <div style={{ marginBottom: 20, position: "sticky", top: 0, zIndex: 5, background: "var(--surface)", paddingTop: 2 }}>
        <div className="settings-tabbar" style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <style>{`.settings-tabbar::-webkit-scrollbar { display: none; }`}</style>
          <TabButton active={activeTab === "clinic"} onClick={() => setActiveTab("clinic")} icon="ti-building-hospital">Clinic Info</TabButton>
          <TabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")} icon="ti-file-text">Templates</TabButton>
          <TabButton active={activeTab === "invoice"} onClick={() => setActiveTab("invoice")} icon="ti-receipt">Invoices</TabButton>
          <TabButton active={activeTab === "prescription"} onClick={() => setActiveTab("prescription")} icon="ti-pill">Prescriptions</TabButton>
          <TabButton active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} icon="ti-bell">Notifications</TabButton>
          <TabButton active={activeTab === "backup"} onClick={() => setActiveTab("backup")} icon="ti-database">Backup</TabButton>
        </div>
      </div>

      {activeTab === "clinic" && (
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 16 }}>
            <i className="ti ti-building-hospital" style={{ marginRight: 4 }} />
            Clinic Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>Clinic Name</FieldLabel>
              <FieldInput
                type="text"
                value={settings.clinicName}
                onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <FieldInput
                type="text"
                value={settings.clinicPhone}
                onChange={(e) => setSettings({ ...settings, clinicPhone: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Email Address</FieldLabel>
              <FieldInput
                type="email"
                value={settings.clinicEmail}
                onChange={(e) => setSettings({ ...settings, clinicEmail: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Operating Hours</FieldLabel>
              <FieldInput
                type="text"
                value={settings.clinicHours}
                onChange={(e) => setSettings({ ...settings, clinicHours: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Currency</FieldLabel>
              <FieldSelect
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              >
                <option value="USD">USD — US Dollar ($)</option>
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="AED">AED — UAE Dirham (د.إ)</option>
                <option value="SGD">SGD — Singapore Dollar (S$)</option>
              </FieldSelect>
            </div>
            <div>
              <FieldLabel>Timezone</FieldLabel>
              <FieldSelect
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT +8)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              </FieldSelect>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Clinic Address</FieldLabel>
            <FieldTextarea
              value={settings.clinicAddress}
              onChange={(e) => setSettings({ ...settings, clinicAddress: e.target.value })}
              rows={3}
            />
          </div>

          <div className="section-label" style={{ marginBottom: 12, marginTop: 8 }}>Appearance</div>
          <SettingRow
            icon="ti-moon"
            label="Dark Mode"
            description="Switch between light and dark theme"
          >
            <ToggleSwitch on={dark} onToggle={() => setDark(!dark)} />
          </SettingRow>

          <div className="section-label" style={{ marginBottom: 12, marginTop: 8 }}>Role Simulation</div>
          <SettingRow
            icon="ti-user-shield"
            label="Current Role"
            description="Simulates role-based access control"
          >
            <FieldSelect value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "auto", minWidth: 150 }}>
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </FieldSelect>
          </SettingRow>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-file-text" style={{ marginRight: 4 }} />
              Message Templates
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: "var(--font-xs)" }}
              onClick={() => { if (window.confirm("Reset all templates to defaults?")) setSettings({ ...settings, templates: defaultTemplates }); }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 12, marginRight: 4 }} />
              Reset All
            </button>
            <div style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-xs)", color: "var(--muted)", maxWidth: 420, width: "100%", boxSizing: "border-box" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--fg)" }}>Available variables</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px" }}>
                {["{patient_name}", "{appointment_date}", "{appointment_time}", "{doctor_name}", "{clinic_name}", "{amount}", "{due_date}", "{clinic_phone}"].map(v => (
                  <span key={v} style={{ fontFamily: "monospace", background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 6px", borderRadius: 4, fontSize: "var(--font-xs)" }}>{v}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {settings.templates.map((tmpl, i) => (
              <div key={i} style={{ padding: 14, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                  <FieldInput
                    type="text"
                    value={tmpl.name}
                    onChange={(e) => {
                      const updated = settings.templates.map((t, idx) => idx === i ? { ...t, name: e.target.value } : t);
                      setSettings({ ...settings, templates: updated });
                    }}
                    style={{ fontWeight: 600, background: "var(--surface)", flex: 1 }}
                    placeholder="Template name"
                  />
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {i < defaultTemplates.length && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "var(--font-xs)", padding: "4px 8px" }}
                        title="Reset to default"
                        onClick={() => {
                          const updated = settings.templates.map((t, idx) => idx === i ? { ...defaultTemplates[i] } : t);
                          setSettings({ ...settings, templates: updated });
                        }}
                      >
                        <i className="ti ti-refresh" style={{ fontSize: 12 }} />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }}
                      title="Delete template"
                      onClick={() => {
                        if (settings.templates.length <= 1) { showToast("Must keep at least one template.", "info"); return; }
                        setSettings({ ...settings, templates: settings.templates.filter((_, idx) => idx !== i) });
                      }}
                    >
                      <i className="ti ti-trash" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </div>
                <FieldTextarea
                  value={tmpl.body}
                  onChange={(e) => {
                    const updated = settings.templates.map((t, idx) => idx === i ? { ...t, body: e.target.value } : t);
                    setSettings({ ...settings, templates: updated });
                  }}
                  rows={3}
                  style={{ background: "var(--surface)" }}
                  placeholder="Template body..."
                />
              </div>
            ))}
            <button
              className="btn btn-ghost"
              style={{ alignSelf: "flex-start", fontSize: "var(--font-sm)" }}
              onClick={() => setSettings({ ...settings, templates: [...settings.templates, { name: "New Template", body: "" }] })}
            >
              <i className="ti ti-plus" style={{ fontSize: 13, marginRight: 4 }} />
              Add Template
            </button>
          </div>
        </div>
      )}

      {activeTab === "invoice" && (
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 16 }}>
            <i className="ti ti-receipt" style={{ marginRight: 4 }} />
            Invoice Settings
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>Invoice Prefix</FieldLabel>
              <FieldInput
                type="text"
                value={settings.invoicePrefix}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Starting Number</FieldLabel>
              <FieldInput
                type="text"
                value={settings.invoiceStartingNumber}
                onChange={(e) => { if (/^\d*$/.test(e.target.value)) setSettings({ ...settings, invoiceStartingNumber: e.target.value }); }}
                inputMode="numeric"
                placeholder="1001"
              />
            </div>
          </div>
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
            <span style={{ color: "var(--muted)" }}>Next invoice number preview: </span>
            <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>
              {settings.invoicePrefix}-{String(parseInt(settings.invoiceStartingNumber, 10) || 1).padStart(4, "0")}
            </span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Invoice Terms</FieldLabel>
            <FieldTextarea
              value={settings.invoiceTerms}
              onChange={(e) => setSettings({ ...settings, invoiceTerms: e.target.value })}
              placeholder="Enter invoice terms and conditions..."
              rows={4}
            />
          </div>
          <div>
            <FieldLabel>Payment Methods Accepted</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Cash", "Card", "UPI", "Bank Transfer", "Insurance"].map(method => {
                const checked = settings.paymentMethods.includes(method);
                return (
                  <label key={method} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: "var(--font-sm)", cursor: "pointer", minHeight: 36,
                    padding: "6px 12px", borderRadius: "var(--radius-full)",
                    border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                    background: checked ? "var(--accent-soft)" : "transparent",
                    color: checked ? "var(--accent)" : "var(--fg)",
                    fontWeight: checked ? 600 : 400,
                    transition: "background 0.12s, border-color 0.12s, color 0.12s",
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...settings.paymentMethods, method]
                          : settings.paymentMethods.filter(m => m !== method);
                        setSettings({ ...settings, paymentMethods: updated });
                      }}
                      style={{ accentColor: "var(--accent)", width: 14, height: 14, cursor: "pointer" }}
                    />
                    {method}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "prescription" && (
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 16 }}>
            <i className="ti ti-pill" style={{ marginRight: 4 }} />
            Prescription Settings
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>Prescription Prefix</FieldLabel>
              <FieldInput
                type="text"
                value={settings.prescriptionPrefix}
                onChange={(e) => setSettings({ ...settings, prescriptionPrefix: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Starting Number</FieldLabel>
              <FieldInput
                type="text"
                value={settings.prescriptionStartingNumber}
                onChange={(e) => { if (/^[0-9]*$/.test(e.target.value)) setSettings({ ...settings, prescriptionStartingNumber: e.target.value }); }}
                inputMode="numeric"
                placeholder="5001"
              />
            </div>
          </div>
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}>
            <span style={{ color: "var(--muted)" }}>Next prescription number preview: </span>
            <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>
              {settings.prescriptionPrefix}-{String(parseInt(settings.prescriptionStartingNumber, 10) || 1).padStart(4, "0")}
            </span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Default Prescription Header</FieldLabel>
            <FieldTextarea
              value={settings.prescriptionHeader}
              onChange={(e) => setSettings({ ...settings, prescriptionHeader: e.target.value })}
              placeholder="Enter default header text for prescriptions..."
              rows={3}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Default Prescription Footer</FieldLabel>
            <FieldTextarea
              value={settings.prescriptionFooter}
              onChange={(e) => setSettings({ ...settings, prescriptionFooter: e.target.value })}
              placeholder="Enter default footer text for prescriptions..."
              rows={2}
            />
          </div>
          <div>
            <SettingRow
              icon="ti-alert-triangle"
              label="Drug Interaction Warnings"
              description="Automatic warnings when prescribing potentially interacting medications"
            >
              <ToggleSwitch on={settings.drugInteractionWarnings} onToggle={() => setSettings({ ...settings, drugInteractionWarnings: !settings.drugInteractionWarnings })} />
            </SettingRow>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 16 }}>
            <i className="ti ti-bell" style={{ marginRight: 4 }} />
            Notification Settings
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SettingRow
              icon="ti-calendar-check"
              label="Appointment Reminders"
              description="Send reminders to patients before their appointments"
            >
              <ToggleSwitch on={settings.appointmentReminder} onToggle={() => setSettings({ ...settings, appointmentReminder: !settings.appointmentReminder })} />
            </SettingRow>
            <SettingRow
              icon="ti-phone"
              label="Follow-up Reminders"
              description="Send reminders for follow-up appointments"
            >
              <ToggleSwitch on={settings.followUpReminder} onToggle={() => setSettings({ ...settings, followUpReminder: !settings.followUpReminder })} />
            </SettingRow>
            <SettingRow
              icon="ti-currency-dollar"
              label="Payment Reminders"
              description="Send reminders for pending payments"
            >
              <ToggleSwitch on={settings.paymentReminder} onToggle={() => setSettings({ ...settings, paymentReminder: !settings.paymentReminder })} />
            </SettingRow>
            <SettingRow
              icon="ti-test-tube"
              label="Lab Result Alerts"
              description="Notify patients when lab results are ready"
            >
              <ToggleSwitch on={settings.labResultAlert} onToggle={() => setSettings({ ...settings, labResultAlert: !settings.labResultAlert })} />
            </SettingRow>
            <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)", marginTop: 4 }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>Reminder Lead Time</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>How far in advance to send appointment and follow-up reminders</div>
              <FieldSelect
                value={settings.reminderLeadHours}
                onChange={(e) => setSettings({ ...settings, reminderLeadHours: e.target.value })}
                style={{ width: "auto", minWidth: 200 }}
              >
                <option value="1">1 hour before</option>
                <option value="2">2 hours before</option>
                <option value="6">6 hours before</option>
                <option value="12">12 hours before</option>
                <option value="24">24 hours before (1 day)</option>
                <option value="48">48 hours before (2 days)</option>
                <option value="72">72 hours before (3 days)</option>
              </FieldSelect>
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
            <SettingRow
              icon="ti-mail"
              label="Email Notifications"
              description="Receive notifications via email"
            >
              <ToggleSwitch on={settings.emailNotifications} onToggle={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })} />
            </SettingRow>
            <SettingRow
              icon="ti-message"
              label="SMS Notifications"
              description="Receive notifications via SMS"
            >
              <ToggleSwitch on={settings.smsNotifications} onToggle={() => setSettings({ ...settings, smsNotifications: !settings.smsNotifications })} />
            </SettingRow>
          </div>
        </div>
      )}

      {activeTab === "backup" && (
        <div className="card card-padded">
          <style>{`
            @media (max-width: 640px) {
              .settings-export-row { flex-direction: column; align-items: stretch; }
              .settings-export-row .btn { width: 100%; justify-content: center; }
            }
          `}</style>
          <div className="section-label" style={{ marginBottom: 16 }}>
            <i className="ti ti-database" style={{ marginRight: 4 }} />
            Backup & Export
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SettingRow
              icon="ti-refresh"
              label="Auto Backup"
              description="Automatically backup data at regular intervals"
            >
              <ToggleSwitch on={settings.autoBackup} onToggle={() => setSettings({ ...settings, autoBackup: !settings.autoBackup })} />
            </SettingRow>
            {settings.autoBackup && (
              <div style={{ marginLeft: 48 }}>
                <FieldLabel>Backup Frequency</FieldLabel>
                <FieldSelect
                  value={settings.backupFrequency}
                  onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                  style={{ width: "auto", minWidth: 160 }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </FieldSelect>
              </div>
            )}
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />

            {/* ── Data Health ── */}
            <div>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 10 }}>
                <i className="ti ti-heart-rate-monitor" style={{ fontSize: 13, marginRight: 4 }} />
                Data Health
              </div>
              {(() => {
                void healthTick; // reference so re-renders on tick
                const legacyPatients = readJSON<any[]>(LEGACY_PATIENTS_KEY, []);
                const v1Patients     = readJSON<any[]>(PATIENTS_KEY, []);
                const showLegacyWarning = legacyPatients.length > 0 && v1Patients.length === 0;
                const healthRows = [
                  { label: "Patients",       count: v1Patients.length },
                  { label: "Audit entries",  count: readJSON<any[]>(AUDIT_KEY, []).length },
                  { label: "Invoices",       count: readJSON<any[]>(INVOICES_KEY, []).length },
                  { label: "Prescriptions",  count: readJSON<any[]>(PRESCRIPTIONS_KEY, []).length },
                  { label: "Documents",      count: readJSON<any[]>(DOCUMENTS_KEY, []).length },
                  { label: "Communications", count: readJSON<any[]>(COMMUNICATIONS_KEY, []).length },
                ];
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
                      {healthRows.map(({ label, count }) => (
                        <div key={label} style={{ textAlign: "center", padding: "10px 4px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: "var(--font-xl)", fontWeight: 800 }}>{count}</div>
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: showLegacyWarning ? 10 : 0 }}>
                      Storage used: <strong>{storageUsage || "—"}</strong>
                    </div>
                    {showLegacyWarning && (
                      <div style={{ padding: "10px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--radius)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <i className="ti ti-alert-triangle" style={{ fontSize: 14, color: "var(--amber)", marginTop: 1, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--amber)", marginBottom: 6 }}>
                            Legacy patient data detected ({legacyPatients.length} patients in <code>clinic_crm_patients</code>)
                          </div>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={handleMigrateLegacy}>
                            <i className="ti ti-database-import" style={{ fontSize: 12, marginRight: 4 }} />
                            Migrate Legacy Patients
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />

            {/* ── Export ── */}
            <div>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Export Data</div>
              <div className="settings-export-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" style={{ fontSize: "var(--font-sm)" }} onClick={handleExportPatients}>
                  <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
                  Export Patients (CSV)
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={handleExportAppointments}>
                  <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
                  Export Appointments (CSV)
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={handleExportInvoices}>
                  <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
                  Export Invoices (CSV)
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={handleExportAllJSON}>
                  <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
                  Export All Data (JSON)
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={handleExportSummary}>
                  <i className="ti ti-file-description" style={{ fontSize: 12, marginRight: 4 }} />
                  Export Backup Summary
                </button>
              </div>
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />

            {/* ── Import ── */}
            <div>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>Import Data</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", whiteSpace: "nowrap" }}>Import mode:</span>
                {(["replace", "merge"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setImportMode(mode)}
                    style={{
                      fontSize: "var(--font-xs)", padding: "4px 12px", borderRadius: "var(--radius)",
                      border: `1px solid ${importMode === mode ? "var(--accent)" : "var(--border)"}`,
                      background: importMode === mode ? "var(--accent-soft)" : "var(--surface2)",
                      color: importMode === mode ? "var(--accent)" : "var(--muted)",
                      cursor: "pointer", fontWeight: importMode === mode ? 600 : 400,
                    }}
                  >
                    {mode === "replace" ? "Replace existing data" : "Merge with existing data"}
                  </button>
                ))}
                <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                  {importMode === "replace" ? "Each imported section overwrites existing data." : "Items are merged by id; missing sections are untouched."}
                </span>
              </div>
              <div className="settings-export-row" style={{ display: "flex" }}>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)" }} onClick={handleImport}>
                  <i className="ti ti-upload" style={{ fontSize: 12, marginRight: 4 }} />
                  Import from Backup
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
            <div>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, color: "var(--red, #e53e3e)" }}>Danger Zone</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>Permanently delete stored data. Make sure to export a backup first.</div>
              <div className="settings-export-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", color: "var(--red, #e53e3e)", borderColor: "var(--red, #e53e3e)" }} onClick={() => { handleClearData(PATIENTS_KEY, "Patients"); localStorage.removeItem(LEGACY_PATIENTS_KEY); }}>
                  <i className="ti ti-trash" style={{ fontSize: 12, marginRight: 4 }} />
                  Clear Patients
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", color: "var(--red, #e53e3e)", borderColor: "var(--red, #e53e3e)" }} onClick={() => handleClearData(INVOICES_KEY, "Invoices")}>
                  <i className="ti ti-trash" style={{ fontSize: 12, marginRight: 4 }} />
                  Clear Invoices
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-sm)", color: "var(--red, #e53e3e)", borderColor: "var(--red, #e53e3e)" }} onClick={() => handleClearData(PRESCRIPTIONS_KEY, "Prescriptions")}>
                  <i className="ti ti-trash" style={{ fontSize: 12, marginRight: 4 }} />
                  Clear Prescriptions
                </button>
              </div>
            </div>
            <div style={{ padding: 12, background: "var(--amber-bg)", borderRadius: "var(--radius)", border: "1px solid var(--amber-border)" }}>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--amber)", display: "flex", alignItems: "flex-start", gap: 6 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                <span>Last backup: {lastBackup}. Data is stored in localStorage — use Export All Data (JSON) regularly to avoid data loss.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, right: 24, zIndex: 9999,
          padding: "10px 16px", borderRadius: "var(--radius)",
          background: toast.type === "success" ? "var(--green, #38a169)" : toast.type === "error" ? "var(--red, #e53e3e)" : "var(--accent)",
          color: "#fff", fontSize: "var(--font-sm)", fontWeight: 500,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: 8,
          animation: "fadeInUp 0.2s ease",
          maxWidth: 320,
        }}>
          <i className={toast.type === "success" ? "ti ti-check" : toast.type === "error" ? "ti ti-x" : "ti ti-info-circle"} style={{ fontSize: 15, flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }`}</style>

      {/* Save Button */}
      <style>{`
        .settings-save-bar { bottom: 0; }
        @media (max-width: 767px) {
          .settings-save-bar { bottom: calc(76px + env(safe-area-inset-bottom)); }
          .settings-save-bar .settings-save-status { order: 1; flex: 1; }
          .settings-save-bar .settings-save-btn { order: 2; }
        }
      `}</style>
      <div className="settings-save-bar" style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, position: "sticky", padding: "12px 0", background: "var(--surface)", borderTop: saveStatus === "unsaved" ? "1px solid var(--border)" : "1px solid transparent", zIndex: 10, transition: "border-color 0.2s" }}>
        {saveStatus === "unsaved" && (
          <span className="settings-save-status" style={{ fontSize: "var(--font-sm)", color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-edit" style={{ fontSize: 14 }} />
            Unsaved changes
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="settings-save-status" style={{ fontSize: "var(--font-sm)", color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-check" style={{ fontSize: 14 }} />
            Settings saved
          </span>
        )}
        <button className="btn btn-primary settings-save-btn" onClick={handleSave} disabled={saveStatus !== "unsaved"} style={{ opacity: saveStatus !== "unsaved" ? 0.5 : 1 }}>
          <i className="ti ti-device-floppy" style={{ fontSize: 14, marginRight: 4 }} />
          Save Settings
        </button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 14px",
        borderRadius: "var(--radius) var(--radius) 0 0",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: -1,
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--muted)",
        fontSize: "var(--font-sm)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
        minHeight: 40,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 14 }} />}
      {children}
    </button>
  );
}

function SettingRow({ icon, label, description, children }: {
  icon: string;
  label: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: "var(--muted)" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 1 }}>{description}</div>
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? "var(--accent)" : "var(--border)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
      onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px var(--accent-soft)"; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

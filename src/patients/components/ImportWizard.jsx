import { useState, useRef, useCallback } from "react";

// ─── FIELD MAPPING CONFIG ─────────────────────────────────────────────────────
const EXPECTED_FIELDS = [
  { key: "name",            label: "Full Name",          required: true  },
  { key: "phone",           label: "Phone",              required: true  },
  { key: "dob",             label: "Date of Birth",      required: true  },
  { key: "gender",          label: "Gender",             required: true  },
  { key: "email",           label: "Email",              required: false },
  { key: "address",         label: "Address",            required: false },
  { key: "doctor",          label: "Assigned Doctor",    required: false },
  { key: "insurer",         label: "Insurance Provider", required: false },
  { key: "insuranceExpiry", label: "Insurance Expiry",   required: false },
  { key: "emergencyName",   label: "Emergency Contact",  required: false },
  { key: "emergencyPhone",  label: "Emergency Phone",    required: false },
  { key: "bloodGroup",      label: "Blood Group",        required: false },
];

const VALID_GENDERS  = ["Male", "Female", "Other", "male", "female", "other", "M", "F"];
const VALID_BLOOD    = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const PHONE_RE       = /^\+?[\d\s\-().]{7,15}$/;
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    // Basic CSV parse (handles quoted fields with commas)
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || "").replace(/^"|"$/g, "").trim(); });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v));
  return { headers, rows };
}

// ─── AUTO-MAP COLUMNS ─────────────────────────────────────────────────────────
function autoMap(csvHeaders) {
  const mapping = {};
  const ALIASES = {
    name:            ["name","full name","patient name","fullname","patient"],
    phone:           ["phone","mobile","contact","tel","telephone","phone number","mobile number"],
    dob:             ["dob","date of birth","birth date","birthday","birthdate","born"],
    gender:          ["gender","sex"],
    email:           ["email","email address","e-mail"],
    address:         ["address","location","city","addr"],
    doctor:          ["doctor","physician","dr","assigned doctor","primary doctor"],
    insurer:         ["insurer","insurance","insurance provider","insurance company","provider"],
    insuranceExpiry: ["insurance expiry","expiry","expiry date","insurance exp","ins expiry"],
    emergencyName:   ["emergency name","emergency contact","emergency","kin name","next of kin"],
    emergencyPhone:  ["emergency phone","emergency contact phone","kin phone","emergency number"],
    bloodGroup:      ["blood group","blood type","bloodgroup","blood"],
  };
  EXPECTED_FIELDS.forEach(({ key }) => {
    const aliases = ALIASES[key] || [];
    const found = csvHeaders.find((h) =>
      aliases.some((a) => a.toLowerCase() === h.toLowerCase())
    );
    mapping[key] = found || "";
  });
  return mapping;
}

// ─── VALIDATE ROW ─────────────────────────────────────────────────────────────
function validateRow(row, mapping, existingPatients, rowIndex) {
  const issues = [];
  const get = (key) => (mapping[key] ? row[mapping[key]] || "" : "");

  // Required fields
  if (!get("name").trim())  issues.push({ field: "name",   type: "missing",  msg: "Missing name"         });
  if (!get("phone").trim()) issues.push({ field: "phone",  type: "missing",  msg: "Missing phone"        });
  if (!get("dob").trim())   issues.push({ field: "dob",    type: "missing",  msg: "Missing date of birth" });
  if (!get("gender").trim())issues.push({ field: "gender", type: "missing",  msg: "Missing gender"       });

  // Phone format
  const phone = get("phone");
  if (phone && !PHONE_RE.test(phone)) issues.push({ field: "phone", type: "invalid", msg: "Invalid phone format" });

  // DOB / age
  const dob = get("dob");
  if (dob) {
    const d = new Date(dob);
    if (isNaN(d.getTime())) {
      issues.push({ field: "dob", type: "invalid", msg: "Invalid date of birth" });
    } else {
      const age = Math.floor((Date.now() - d) / (365.25 * 24 * 3600 * 1000));
      if (age < 0 || age > 130) issues.push({ field: "dob", type: "invalid", msg: "Unrealistic date of birth" });
    }
  }

  // Gender
  const gender = get("gender");
  if (gender && !VALID_GENDERS.includes(gender)) {
    issues.push({ field: "gender", type: "invalid", msg: `Unknown gender "${gender}"` });
  }

  // Email
  const email = get("email");
  if (email && !EMAIL_RE.test(email)) issues.push({ field: "email", type: "invalid", msg: "Invalid email" });

  // Insurance expiry
  const insExp = get("insuranceExpiry");
  if (insExp) {
    const d = new Date(insExp);
    if (isNaN(d.getTime())) issues.push({ field: "insuranceExpiry", type: "invalid", msg: "Invalid insurance expiry date" });
  }

  // Duplicate name check
  const name = get("name").trim().toLowerCase();
  if (name) {
    const dup = existingPatients.find((p) => p.name.toLowerCase() === name);
    if (dup) issues.push({ field: "name", type: "duplicate", msg: `Duplicate: matches ${dup.name} (${dup.id})`, dupId: dup.id });
  }

  // Duplicate phone check
  if (phone && PHONE_RE.test(phone)) {
    const dupPhone = existingPatients.find((p) => p.phone?.replace(/\s/g,"") === phone.replace(/\s/g,""));
    if (dupPhone) issues.push({ field: "phone", type: "duplicate", msg: `Duplicate phone: matches ${dupPhone.name}` });
  }

  return issues;
}

// ─── TRANSFORM ROW → PATIENT ──────────────────────────────────────────────────
function rowToPatient(row, mapping, index) {
  const get = (key) => (mapping[key] ? row[mapping[key]] || "" : "");
  const dob = get("dob");
  const age  = dob ? Math.floor((Date.now() - new Date(dob)) / (365.25*24*3600*1000)) : 0;
  const genderRaw = get("gender");
  const gender = genderRaw === "M" ? "Male" : genderRaw === "F" ? "Female"
    : genderRaw ? genderRaw.charAt(0).toUpperCase() + genderRaw.slice(1).toLowerCase()
    : "";

  return {
    id:               `IMP-${String(index + 1).padStart(4,"0")}`,  // will be replaced in App
    name:             get("name"),
    phone:            get("phone"),
    dob:              dob || null,
    age,
    gender,
    email:            get("email"),
    address:          get("address"),
    doctor:           get("doctor") || "Unassigned",
    insurer:          get("insurer") || "",
    insuranceExpiry:  get("insuranceExpiry") || null,
    insuranceStatus:  (() => {
      const exp = get("insuranceExpiry");
      if (!exp) return "None";
      const d = new Date(exp); const now = new Date();
      const diff = (d - now) / (1000*3600*24);
      if (diff < 0) return "Expired";
      if (diff < 30) return "Expiring";
      return "Active";
    })(),
    emergencyName:    get("emergencyName"),
    emergencyRelation:"",
    emergencyPhone:   get("emergencyPhone"),
    bloodGroup:       VALID_BLOOD.includes(get("bloodGroup")) ? get("bloodGroup") : "",
    status:           "Active",
    alerts:           [],
    conditions:       [],
    medications:      [],
    timeline:         [],
    notes:            [],
    lastVisit:        null,
    nextAppointment:  null,
    followUpDate:     null,
    nationality:      "",
    policyNumber:     "",
    consents:         {},
    flags:            {},
  };
}

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ["Upload", "Map Columns", "Review", "Import"];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:24 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display:"flex", alignItems:"center", flex: i < steps.length-1 ? 1 : "none" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:12, fontWeight:700,
              background: i < current ? "#22c55e" : i === current ? "var(--accent)" : "var(--border)",
              color: i <= current ? "#fff" : "var(--muted)",
              transition:"background 0.25s",
            }}>
              {i < current ? <i className="ti ti-check" style={{fontSize:13}}/> : i+1}
            </div>
            <span style={{fontSize:10, fontWeight: i===current ? 700:400, color: i===current ? "var(--accent)" : "var(--muted)", whiteSpace:"nowrap"}}>
              {s}
            </span>
          </div>
          {i < steps.length-1 && (
            <div style={{flex:1, height:2, background: i < current ? "#22c55e" : "var(--border)", margin:"0 4px", marginBottom:18, transition:"background 0.25s"}}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ISSUE CHIP ───────────────────────────────────────────────────────────────
function IssueChip({ issue }) {
  const colors = {
    missing:   { bg:"#fee2e2", color:"#991b1b", icon:"ti-alert-circle"    },
    invalid:   { bg:"#fff7ed", color:"#9a3412", icon:"ti-alert-triangle"  },
    duplicate: { bg:"#fef3c7", color:"#92400e", icon:"ti-copy"            },
  };
  const c = colors[issue.type] || colors.invalid;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"2px 7px", borderRadius:20, fontSize:11, fontWeight:600,
      background:c.bg, color:c.color,
    }}>
      <i className={`ti ${c.icon}`} style={{fontSize:11}}/> {issue.msg}
    </span>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ImportWizard({ existingPatients, onClose, onImport }) {
  const [step,       setStep]       = useState(0);
  const [csvData,    setCsvData]    = useState(null);   // { headers, rows }
  const [mapping,    setMapping]    = useState({});
  const [validated,  setValidated]  = useState([]);     // [{ row, issues, include }]
  const [importing,  setImporting]  = useState(false);
  const [done,       setDone]       = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const fileRef = useRef();

  // ── Step 0: Upload ──
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) return;
      setCsvData({ headers, rows, filename: file.name });
      setMapping(autoMap(headers));
      setStep(1);
    };
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Step 1 → 2: Validate ──
  function runValidation() {
    const results = csvData.rows.map((row, i) => ({
      row,
      issues: validateRow(row, mapping, existingPatients, i),
      include: true,
    }));
    setValidated(results);
    setStep(2);
  }

  // ── Step 2 → 3: Import ──
  function doImport() {
    setImporting(true);
    const toImport = validated
      .filter((v) => v.include && !v.issues.some((i) => i.type === "missing"))
      .map((v, i) => rowToPatient(v.row, mapping, i));
    setTimeout(() => {
      setImporting(false);
      setDone(true);
      setStep(3);
      onImport(toImport);
    }, 900);
  }

  const includedCount = validated.filter((v) => v.include && !v.issues.some((i) => i.type === "missing")).length;
  const errorCount    = validated.filter((v) => v.issues.some((i) => i.type === "missing" || i.type === "invalid")).length;
  const warnCount     = validated.filter((v) => v.issues.some((i) => i.type === "duplicate")).length;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1500,
      background:"rgba(0,0,0,0.55)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }}>
      <div style={{
        background:"var(--surface)", borderRadius:16,
        border:"1px solid var(--border)",
        width:"100%", maxWidth:720, maxHeight:"90vh",
        display:"flex", flexDirection:"column",
        boxShadow:"0 24px 80px rgba(0,0,0,0.3)",
        overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{
          padding:"16px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0,
        }}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:"var(--accent-soft)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <i className="ti ti-upload" style={{fontSize:18, color:"var(--accent)"}}/>
            </div>
            <div>
              <div style={{fontSize:15, fontWeight:700}}>Import Patients</div>
              <div style={{fontSize:11, color:"var(--muted)"}}>CSV or Excel file upload with validation</div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{padding:"6px 10px"}} onClick={onClose}>
            <i className="ti ti-x" style={{fontSize:15}}/>
          </button>
        </div>

        {/* Body */}
        <div style={{flex:1, overflow:"auto", padding:24}}>
          <Steps current={step}/>

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div style={{display:"flex", flexDirection:"column", gap:16}}>
              <div
                onDragOver={(e)=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={onDrop}
                onClick={()=>fileRef.current?.click()}
                style={{
                  border:`2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  borderRadius:12, padding:"40px 24px",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:12,
                  cursor:"pointer", transition:"all 0.2s",
                  background: dragOver ? "var(--accent-soft)" : "var(--surface2)",
                }}
              >
                <div style={{
                  width:56, height:56, borderRadius:16,
                  background:"var(--accent-soft)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <i className="ti ti-file-spreadsheet" style={{fontSize:28, color:"var(--accent)"}}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:14, fontWeight:600, marginBottom:4}}>Drop your file here or click to browse</div>
                  <div style={{fontSize:12, color:"var(--muted)"}}>Supports CSV files · Excel support coming soon</div>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}}
                  onChange={(e)=>handleFile(e.target.files[0])}/>
              </div>

              {/* Template hint */}
              <div style={{
                padding:"12px 16px", borderRadius:10,
                background:"var(--surface2)", border:"1px solid var(--border)",
              }}>
                <div style={{fontSize:12, fontWeight:600, marginBottom:8, display:"flex", alignItems:"center", gap:6}}>
                  <i className="ti ti-info-circle" style={{fontSize:14, color:"var(--accent)"}}/>
                  Expected columns (auto-detected)
                </div>
                <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                  {EXPECTED_FIELDS.map((f)=>(
                    <span key={f.key} style={{
                      padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600,
                      background: f.required ? "var(--accent-soft)" : "var(--border)",
                      color: f.required ? "var(--accent)" : "var(--muted)",
                    }}>
                      {f.label}{f.required ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1: Map Columns ── */}
          {step === 1 && csvData && (
            <div style={{display:"flex", flexDirection:"column", gap:16}}>
              <div style={{
                padding:"10px 14px", borderRadius:10,
                background:"#dcfce7", border:"1px solid #22c55e40",
                display:"flex", alignItems:"center", gap:8,
              }}>
                <i className="ti ti-file-check" style={{fontSize:15, color:"#15803d"}}/>
                <span style={{fontSize:13, color:"#15803d", fontWeight:500}}>
                  <strong>{csvData.rows.length}</strong> rows detected in <strong>{csvData.filename}</strong>
                </span>
              </div>

              <div style={{fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.07em"}}>
                Map your columns to patient fields
              </div>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
                {EXPECTED_FIELDS.map((f)=>(
                  <div key={f.key} style={{
                    display:"flex", flexDirection:"column", gap:4,
                    padding:"10px 12px", borderRadius:8,
                    background:"var(--surface2)", border:"1px solid var(--border)",
                  }}>
                    <label style={{
                      fontSize:11, fontWeight:700, color: f.required ? "var(--accent)" : "var(--muted)",
                      textTransform:"uppercase", letterSpacing:"0.06em",
                    }}>
                      {f.label}{f.required ? " *" : ""}
                    </label>
                    <select
                      value={mapping[f.key] || ""}
                      onChange={(e)=>setMapping((m)=>({...m,[f.key]:e.target.value}))}
                      style={{fontSize:12, padding:"5px 8px"}}
                    >
                      <option value="">— skip —</option>
                      {csvData.headers.map((h)=>(
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {mapping[f.key] && (
                      <div style={{fontSize:11, color:"var(--muted)", fontFamily:"monospace"}}>
                        Sample: {csvData.rows[0]?.[mapping[f.key]] || "—"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Review ── */}
          {step === 2 && (
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              {/* Summary bar */}
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
                {[
                  { label:"Ready to import", value:includedCount, color:"#22c55e", bg:"#dcfce7" },
                  { label:"Errors",          value:errorCount,    color:"#ef4444", bg:"#fee2e2" },
                  { label:"Warnings",        value:warnCount,     color:"#f59e0b", bg:"#fef3c7" },
                ].map((s)=>(
                  <div key={s.label} style={{
                    padding:"10px 14px", borderRadius:10,
                    background:s.bg, border:`1px solid ${s.color}40`,
                    textAlign:"center",
                  }}>
                    <div style={{fontSize:22, fontWeight:800, color:s.color}}>{s.value}</div>
                    <div style={{fontSize:11, color:s.color, fontWeight:600}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Row list */}
              <div style={{display:"flex", flexDirection:"column", gap:6, maxHeight:340, overflowY:"auto"}}>
                {validated.map((v, i)=>{
                  const name = mapping.name ? v.row[mapping.name] || `Row ${i+1}` : `Row ${i+1}`;
                  const hasError = v.issues.some((x)=>x.type==="missing"||x.type==="invalid");
                  return (
                    <div key={i} style={{
                      display:"flex", alignItems:"flex-start", gap:10,
                      padding:"10px 12px", borderRadius:8,
                      border:`1px solid ${hasError ? "#ef444430" : v.issues.length ? "#f59e0b30" : "#22c55e20"}`,
                      background: hasError ? "#fff5f5" : v.issues.length ? "#fffbeb" : "var(--surface2)",
                      opacity: v.include ? 1 : 0.5,
                    }}>
                      <input type="checkbox" checked={v.include}
                        disabled={hasError}
                        onChange={()=>setValidated((vv)=>vv.map((x,j)=>j===i?{...x,include:!x.include}:x))}
                        style={{marginTop:2,flexShrink:0}}
                      />
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom: v.issues.length ? 6:0}}>
                          <span style={{fontSize:13, fontWeight:600}}>{name}</span>
                          {mapping.phone && v.row[mapping.phone] && (
                            <span style={{fontSize:11, color:"var(--muted)", fontFamily:"monospace"}}>{v.row[mapping.phone]}</span>
                          )}
                          {v.issues.length === 0 && (
                            <span style={{fontSize:11, fontWeight:600, color:"#15803d", display:"flex", alignItems:"center", gap:3}}>
                              <i className="ti ti-check" style={{fontSize:11}}/> OK
                            </span>
                          )}
                        </div>
                        {v.issues.length > 0 && (
                          <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                            {v.issues.map((iss, k)=><IssueChip key={k} issue={iss}/>)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"32px 0"}}>
              <div style={{
                width:64, height:64, borderRadius:"50%",
                background:"#dcfce7",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <i className="ti ti-check" style={{fontSize:30, color:"#15803d"}}/>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:18, fontWeight:700, marginBottom:4}}>Import Complete!</div>
                <div style={{fontSize:13, color:"var(--muted)"}}>
                  <strong>{includedCount}</strong> patients have been added to your records.
                </div>
              </div>
              <button className="btn btn-primary" style={{fontSize:14}} onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div style={{
            padding:"14px 24px", borderTop:"1px solid var(--border)",
            display:"flex", gap:10, justifyContent:"flex-end", flexShrink:0,
            background:"var(--surface)",
          }}>
            {step > 0 && (
              <button className="btn btn-ghost" style={{fontSize:13}}
                onClick={()=>setStep((s)=>s-1)}>
                <i className="ti ti-arrow-left" style={{fontSize:13}}/> Back
              </button>
            )}
            <button className="btn btn-ghost" style={{fontSize:13}} onClick={onClose}>Cancel</button>

            {step === 0 && (
              <button className="btn btn-primary" style={{fontSize:13}} disabled>
                <i className="ti ti-upload" style={{fontSize:13}}/> Upload a file to continue
              </button>
            )}
            {step === 1 && (
              <button className="btn btn-primary" style={{fontSize:13}} onClick={runValidation}>
                Validate <i className="ti ti-arrow-right" style={{fontSize:13}}/>
              </button>
            )}
            {step === 2 && (
              <button
                className="btn btn-primary"
                style={{fontSize:13}}
                disabled={includedCount === 0 || importing}
                onClick={doImport}
              >
                {importing ? (
                  <><i className="ti ti-loader-2" style={{fontSize:13, animation:"spin 1s linear infinite"}}/> Importing…</>
                ) : (
                  <><i className="ti ti-check" style={{fontSize:13}}/> Import {includedCount} Patients</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

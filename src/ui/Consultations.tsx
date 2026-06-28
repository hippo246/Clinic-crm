import React, { useState, useRef, useEffect } from "react";
import type { Patient, TimelineEvent, PatientNote, Prescription } from "./types";
import { fmtDate } from "./utils";

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  .cs-input, .cs-textarea, .cs-select {
    width: 100%; padding: 9px 12px; box-sizing: border-box;
    border: 1px solid var(--border); border-radius: var(--radius);
    font-size: var(--font-sm); background: var(--surface1);
    color: var(--text); font-family: inherit;
  }
  .cs-input:focus, .cs-textarea:focus, .cs-select:focus {
    outline: none; border-color: var(--accent);
  }
  .cs-input:disabled, .cs-textarea:disabled {
    opacity: 0.55; background: var(--surface2); cursor: not-allowed;
  }
  .cs-textarea { resize: vertical; }
  .cs-label {
    display: block; font-size: var(--font-xs); font-weight: 700;
    color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;
    margin-bottom: 5px;
  }
  .cs-dropdown-menu {
    background: var(--surface1); border: 1px solid var(--border);
    border-radius: var(--radius); max-height: 260px; overflow-y: auto;
    margin-top: 6px;
  }
  .cs-dropdown-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer;
  }
  .cs-dropdown-item:hover, .cs-dropdown-item.active { background: var(--surface2); }
  .cs-section-title {
    font-size: var(--font-xs); font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
  }
  .cs-divider { border: none; border-top: 1px solid var(--border); margin: 18px 0; }
  .cs-history-item {
    padding: 14px 16px; border-radius: var(--radius);
    border: 1px solid var(--border); background: var(--surface2);
    cursor: pointer; transition: border-color 0.15s;
  }
  .cs-history-item:hover { border-color: var(--accent-border); }
  @media (max-width: 768px) {
    .cs-stats { grid-template-columns: repeat(2, 1fr) !important; }
    .cs-vitals { grid-template-columns: 1fr 1fr !important; }
    .cs-main-grid { grid-template-columns: 1fr !important; }
    .cs-actions { flex-direction: column !important; }
    .cs-actions button { width: 100%; }
    .cs-rx-grid { grid-template-columns: 1fr !important; }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────
type ConsultStatus = "pending" | "in-progress" | "completed";

interface ConsultRecord {
  id: string;
  patientId: string;
  date: string;
  doctor: string;
  bp: string; hr: string; temp: string; weight: string;
  complaint: string; symptoms: string; diagnosis: string;
  treatment: string; followup: string;
  prescriptions: Prescription[];
  status: ConsultStatus;
}

const emptyConsult = (patientId: string, doctor: string): ConsultRecord => ({
  id: `consult-${Date.now()}`,
  patientId, doctor,
  date: new Date().toISOString(),
  bp: "", hr: "", temp: "", weight: "",
  complaint: "", symptoms: "", diagnosis: "", treatment: "", followup: "",
  prescriptions: [],
  status: "pending",
});

// ─── localStorage helpers ──────────────────────────────────────────────────────
const LS_KEY = "clinic_consultations";

function loadConsults(): ConsultRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveConsults(records: ConsultRecord[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(records));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ConsultationsPageProps {
  patients: Patient[];
  onUpdatePatient: (p: Patient, action?: string) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConsultationsPage({ patients, onUpdatePatient }: ConsultationsPageProps) {
  const [allConsults, setAllConsults] = useState<ConsultRecord[]>(loadConsults);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeConsult, setActiveConsult] = useState<ConsultRecord | null>(null);
  const [viewingHistory, setViewingHistory] = useState<ConsultRecord | null>(null);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [newRx, setNewRx] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  // Holds the pre-edit snapshot of a *completed* consult while it's unlocked for editing,
  // so "Discard" can restore it instead of leaving a half-edited record persisted.
  const originalRef = useRef<ConsultRecord | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const persist = (updated: ConsultRecord[]) => {
    setAllConsults(updated);
    saveConsults(updated);
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    (p.doctor || "").toLowerCase().includes(search.toLowerCase())
  );

  const patientConsults = (pid: string) =>
    allConsults.filter(c => c.patientId === pid).sort((a, b) => b.date.localeCompare(a.date));

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearch(p.name);
    setDropdownOpen(false);
    setViewingHistory(null);
    // Open the in-progress consult for this patient if one exists, else start fresh
    const inProg = allConsults.find(c => c.patientId === p.id && c.status === "in-progress");
    setActiveConsult(inProg ?? emptyConsult(p.id, p.doctor || ""));
    originalRef.current = null;
  };

  const handleFieldChange = (key: keyof ConsultRecord, value: string) => {
    if (!activeConsult) return;
    const updated = { ...activeConsult, [key]: value, status: "in-progress" as ConsultStatus };
    setActiveConsult(updated);
    // Auto-upsert into allConsults
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);
  };

  const handleSave = () => {
    if (!activeConsult || !selectedPatient) return;
    const saved: ConsultRecord = { ...activeConsult, status: "completed" };
    const others = allConsults.filter(c => c.id !== saved.id);
    persist([...others, saved]);
    setActiveConsult(saved);

    // ── Write back to Patient record ──────────────────────────────────────────
    const now = new Date().toISOString();

    // 1. Update lastVisit
    // 2. Add/replace timeline event for this consult (tied to consult id so re-saving an
    //    edited visit updates the existing entry instead of duplicating it)
    const tlEvent: TimelineEvent = {
      id: `tl-${saved.id}`,
      type: "consultation",
      label: "Consultation Completed",
      icon: "ti-stethoscope",
      color: "var(--blue)",
      date: now,
      note: saved.diagnosis || saved.complaint || "Visit recorded",
      doctor: saved.doctor,
    };
    const timeline = [
      ...(selectedPatient.timeline || []).filter(t => t.id !== tlEvent.id),
      tlEvent,
    ];

    // 3. Add/replace clinical note for this consult if diagnosis/complaint filled
    const noteId = `note-${saved.id}`;
    let notes = (selectedPatient.notes || []).filter(n => n.id !== noteId);
    if (saved.diagnosis || saved.complaint) {
      const note: PatientNote = {
        id: noteId,
        text: [
          saved.complaint && `Chief Complaint: ${saved.complaint}`,
          saved.diagnosis && `Diagnosis: ${saved.diagnosis}`,
          saved.treatment && `Treatment: ${saved.treatment}`,
          saved.followup && `Follow-up: ${saved.followup}`,
        ].filter(Boolean).join("\n"),
        pinned: false,
        date: now,
        category: "Consultation",
        author: saved.doctor,
      };
      notes = [...notes, note];
    }

    // 4. Add any new prescriptions
    const existingRx = selectedPatient.prescriptions || [];
    const newRxItems = saved.prescriptions.filter(
      rx => !existingRx.find(e => e.id === rx.id)
    );

    onUpdatePatient({
      ...selectedPatient,
      lastVisit: now,
      timeline,
      notes,
      prescriptions: [...existingRx, ...newRxItems],
    }, "consultation saved");

    originalRef.current = null;
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const handleAddRx = (rx: Prescription) => {
    if (!activeConsult) return;
    const updated = { ...activeConsult, prescriptions: [...activeConsult.prescriptions, rx] };
    setActiveConsult(updated);
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);
    setNewRx(false);
  };

  const handleRemoveRx = (id: string) => {
    if (!activeConsult) return;
    const updated = { ...activeConsult, prescriptions: activeConsult.prescriptions.filter(r => r.id !== id) };
    setActiveConsult(updated);
    const others = allConsults.filter(c => c.id !== updated.id);
    persist([...others, updated]);
  };

  const handleNewConsult = () => {
    if (!selectedPatient) return;
    const fresh = emptyConsult(selectedPatient.id, selectedPatient.doctor || "");
    setActiveConsult(fresh);
    setViewingHistory(null);
    originalRef.current = null;
  };

  const handleViewHistory = (c: ConsultRecord) => {
    setViewingHistory(c);
    setActiveConsult(null);
    originalRef.current = null;
  };

  const handleDiscard = () => {
    if (!activeConsult) return;
    if (originalRef.current) {
      // Was a completed visit unlocked for editing — restore it instead of leaving
      // half-finished edits sitting in storage.
      const restored = originalRef.current;
      const others = allConsults.filter(c => c.id !== restored.id);
      persist([...others, restored]);
    } else {
      // Brand-new/never-completed draft — actually remove it, since it was
      // auto-persisted on every keystroke and would otherwise resurface later.
      persist(allConsults.filter(c => c.id !== activeConsult.id));
    }
    originalRef.current = null;
    setActiveConsult(null);
    setViewingHistory(null);
  };

  // Stats
  const totalToday = (() => {
    const today = new Date().toDateString();
    return allConsults.filter(c => new Date(c.date).toDateString() === today).length;
  })();
  const totalCompleted = allConsults.filter(c => c.status === "completed").length;
  const totalInProgress = allConsults.filter(c => c.status === "in-progress").length;

  const isCompleted = activeConsult?.status === "completed";
  const history = selectedPatient ? patientConsults(selectedPatient.id) : [];
  const hasContent = activeConsult ? (
    Object.entries(activeConsult)
      .filter(([k]) => ["bp","hr","temp","weight","complaint","symptoms","diagnosis","treatment","followup"].includes(k))
      .some(([,v]) => typeof v === "string" && v.trim())
    || activeConsult.prescriptions.length > 0
  ) : false;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 4 }}>
          Consultations & Encounters
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Record and manage patient visit notes — saves to patient timeline, notes, and prescriptions
        </div>
      </div>

      {/* Stats */}
      <div className="cs-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Today's Visits"  value={totalToday}      color="var(--blue)"  icon="ti-stethoscope" bg="var(--blue-bg)"  />
        <StatCard label="In Progress"     value={totalInProgress} color="var(--amber)" icon="ti-activity"    bg="var(--amber-bg)" />
        <StatCard label="Completed"       value={totalCompleted}  color="var(--green)" icon="ti-check"       bg="var(--green-bg)" />
        <StatCard label="All Patients"    value={patients.length} color="var(--muted)" icon="ti-users"       bg="var(--surface3)" />
      </div>

      {/* Patient Picker */}
      <div className="card card-padded" style={{ marginBottom: 14 }}>
        <div className="cs-section-title">Select Patient</div>
        <div style={{ position: "relative" }} ref={dropRef}>
          <div style={{ position: "relative" }}>
            <i className="ti ti-search" style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:13, pointerEvents:"none" }} />
            <input
              className="cs-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search by name, ID, or doctor…"
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true); if (!e.target.value) { setSelectedPatient(null); setActiveConsult(null); setViewingHistory(null); originalRef.current = null; } }}
              onFocus={() => setDropdownOpen(true)}
            />
            {search && (
              <button onClick={() => { setSearch(""); setSelectedPatient(null); setActiveConsult(null); setViewingHistory(null); originalRef.current = null; }}
                style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--muted)", padding:2 }}>
                <i className="ti ti-x" style={{ fontSize:13 }} />
              </button>
            )}
          </div>

          {dropdownOpen && (
            <div className="cs-dropdown-menu">
              {filtered.length === 0
                ? <div style={{ padding:"14px 16px", fontSize:"var(--font-sm)", color:"var(--muted)" }}>No patients found</div>
                : filtered.map(p => {
                  const pConsults = patientConsults(p.id);
                  const lastC = pConsults[0];
                  const hasDraft = pConsults.some(c => c.status === "in-progress");
                  return (
                    <div key={p.id} className={`cs-dropdown-item${selectedPatient?.id === p.id ? " active" : ""}`} onClick={() => handleSelectPatient(p)}>
                      <Avatar name={p.name} size={36} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"var(--font-sm)", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                          {p.name}
                          {hasDraft && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--amber)", display:"inline-block" }} title="Draft in progress" />}
                        </div>
                        <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {p.doctor}{p.age ? ` · Age ${p.age}` : ""}{lastC ? ` · Last: ${fmtDate(lastC.date)}` : " · No visits"}
                        </div>
                      </div>
                      <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", flexShrink:0 }}>
                        {pConsults.length} visit{pConsults.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>

        {/* Patient info strip */}
        {selectedPatient && (
          <div style={{ marginTop:12, padding:"10px 14px", background:"var(--accent-soft)", border:"1px solid var(--accent-border)", borderRadius:"var(--radius)", display:"flex", flexWrap:"wrap", gap:16, alignItems:"center" }}>
            <Chip icon="ti-id" label="ID" value={selectedPatient.id} />
            {selectedPatient.age    && <Chip icon="ti-calendar"        label="Age"       value={selectedPatient.age} />}
            {selectedPatient.gender && <Chip icon="ti-gender-bigender" label="Gender"    value={selectedPatient.gender} />}
            {selectedPatient.bloodGroup && <Chip icon="ti-droplet"     label="Blood"     value={selectedPatient.bloodGroup} />}
            {selectedPatient.doctor && <Chip icon="ti-user-md"         label="Doctor"    value={selectedPatient.doctor} />}
            {selectedPatient.phone  && <Chip icon="ti-phone"           label="Phone"     value={selectedPatient.phone} />}
            {(selectedPatient.allergies && selectedPatient.allergies !== "None") &&
              <Chip icon="ti-alert-triangle" label="Allergies" value={selectedPatient.allergies} color="var(--red)" />}
            {(selectedPatient.conditions?.length ?? 0) > 0 &&
              <Chip icon="ti-heartbeat" label="Conditions" value={(selectedPatient.conditions ?? []).join(", ")} />}
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="cs-main-grid" style={{ display:"grid", gridTemplateColumns: history.length > 0 ? "1fr 2fr" : "1fr", gap:14 }}>

          {/* Visit History sidebar */}
          {history.length > 0 && (
            <div className="card card-padded" style={{ alignSelf:"start" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div className="cs-section-title" style={{ margin:0 }}>Visit History ({history.length})</div>
                <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={handleNewConsult}>
                  <i className="ti ti-plus" style={{ fontSize:11, marginRight:4 }} />New
                </button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {history.map(c => {
                  const isActive = activeConsult?.id === c.id;
                  const isViewing = viewingHistory?.id === c.id;
                  return (
                    <div key={c.id} className="cs-history-item"
                      style={{ borderColor: (isActive || isViewing) ? "var(--accent-border)" : "var(--border)", background: (isActive||isViewing) ? "var(--accent-soft)" : "var(--surface2)" }}
                      onClick={() => c.status === "in-progress" ? (setActiveConsult(c), setViewingHistory(null)) : handleViewHistory(c)}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontSize:"var(--font-xs)", fontWeight:700 }}>{new Date(c.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                        <StatusPill status={c.status} />
                      </div>
                      <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {c.diagnosis || c.complaint || "No notes yet"}
                      </div>
                      {c.doctor && <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>{c.doctor}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Consult form / history viewer */}
          <div className="card card-padded">
            {viewingHistory ? (
              <HistoryView record={viewingHistory} onClose={() => setViewingHistory(null)} onEdit={() => {
                // Snapshot the completed record before unlocking so Discard can restore it
                originalRef.current = viewingHistory;
                const unlocked = { ...viewingHistory, status: "in-progress" as ConsultStatus };
                const others = allConsults.filter(c => c.id !== unlocked.id);
                persist([...others, unlocked]);
                setActiveConsult(unlocked);
                setViewingHistory(null);
              }} />
            ) : activeConsult ? (
              <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:14, borderBottom:"1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize:"var(--font-md)", fontWeight:700 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>
                      {new Date(activeConsult.date).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                      {activeConsult.doctor && ` · ${activeConsult.doctor}`}
                    </div>
                  </div>
                  <StatusPill status={activeConsult.status} />
                </div>

                {/* Vitals */}
                <div className="cs-section-title">Vitals</div>
                <div className="cs-vitals" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
                  {([
                    { key:"bp",     label:"Blood Pressure", placeholder:"120/80"  },
                    { key:"hr",     label:"Heart Rate",     placeholder:"72 bpm"  },
                    { key:"temp",   label:"Temperature",    placeholder:"98.6°F"  },
                    { key:"weight", label:"Weight",         placeholder:"70 kg"   },
                  ] as { key: keyof ConsultRecord; label: string; placeholder: string }[]).map(f => (
                    <div key={f.key}>
                      <label className="cs-label">{f.label}</label>
                      <input className="cs-input" placeholder={f.placeholder}
                        value={activeConsult[f.key] as string}
                        onChange={e => handleFieldChange(f.key, e.target.value)}
                        disabled={isCompleted} />
                    </div>
                  ))}
                </div>

                <hr className="cs-divider" />

                {/* Notes */}
                {([
                  { key:"complaint",  label:"Chief Complaint",  placeholder:"Patient's main concern…",        rows:2 },
                  { key:"symptoms",   label:"Symptoms",         placeholder:"Describe symptoms presented…",   rows:3 },
                  { key:"diagnosis",  label:"Diagnosis",        placeholder:"Primary and secondary diagnoses…",rows:2 },
                  { key:"treatment",  label:"Treatment Plan",   placeholder:"Medications, procedures, referrals…", rows:3 },
                  { key:"followup",   label:"Follow-up Plan",   placeholder:"Return in X weeks for…",        rows:2 },
                ] as { key: keyof ConsultRecord; label: string; placeholder: string; rows: number }[]).map(f => (
                  <div key={f.key} style={{ marginBottom:14 }}>
                    <label className="cs-label">{f.label}</label>
                    <textarea className="cs-textarea" placeholder={f.placeholder} rows={f.rows}
                      value={activeConsult[f.key] as string}
                      onChange={e => handleFieldChange(f.key, e.target.value)}
                      disabled={isCompleted} />
                  </div>
                ))}

                <hr className="cs-divider" />

                {/* Prescriptions */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div className="cs-section-title" style={{ margin:0 }}>Prescriptions ({activeConsult.prescriptions.length})</div>
                  {!isCompleted && (
                    <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={() => setNewRx(true)}>
                      <i className="ti ti-plus" style={{ fontSize:11, marginRight:4 }} />Add
                    </button>
                  )}
                </div>

                {activeConsult.prescriptions.length === 0 && !newRx && (
                  <div style={{ fontSize:"var(--font-sm)", color:"var(--muted)", padding:"10px 0", marginBottom:8 }}>
                    No prescriptions for this visit
                  </div>
                )}
                {activeConsult.prescriptions.map(rx => (
                  <RxCard key={rx.id} rx={rx} onRemove={isCompleted ? undefined : () => handleRemoveRx(rx.id)} />
                ))}
                {newRx && <RxForm onSave={handleAddRx} onCancel={() => setNewRx(false)} doctor={selectedPatient.doctor || ""} />}

                <hr className="cs-divider" />

                {/* Actions */}
                <div className="cs-actions" style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  {isCompleted ? (
                    <button className="btn btn-ghost" onClick={() => {
                      originalRef.current = activeConsult;
                      const unlocked = { ...activeConsult, status: "in-progress" as ConsultStatus };
                      setActiveConsult(unlocked);
                      const others = allConsults.filter(c => c.id !== unlocked.id);
                      persist([...others, unlocked]);
                    }}>
                      <i className="ti ti-pencil" style={{ marginRight:5, fontSize:12 }} />Edit
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-ghost" onClick={handleDiscard}>Discard</button>
                      <button className="btn btn-primary" onClick={handleSave} disabled={!hasContent}>
                        {saveFlash
                          ? <><i className="ti ti-check" style={{ marginRight:5, fontSize:12 }} />Saved to Patient Record</>
                          : <><i className="ti ti-device-floppy" style={{ marginRight:5, fontSize:12 }} />Save &amp; Update Patient</>
                        }
                      </button>
                    </>
                  )}
                </div>

                {isCompleted && (
                  <div style={{ marginTop:10, fontSize:"var(--font-xs)", color:"var(--green)", display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                    <i className="ti ti-circle-check" style={{ fontSize:13 }} />
                    Saved — added to patient timeline, notes &amp; prescriptions
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
                <i className="ti ti-stethoscope" style={{ fontSize:40, display:"block", marginBottom:12 }} />
                <div style={{ fontSize:"var(--font-md)", fontWeight:600, marginBottom:6 }}>No active consultation</div>
                <div style={{ fontSize:"var(--font-sm)", marginBottom:16 }}>Select a visit from history or start a new one</div>
                <button className="btn btn-primary" onClick={handleNewConsult}>
                  <i className="ti ti-plus" style={{ fontSize:12, marginRight:6 }} />New Consultation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedPatient && (
        <div className="card card-padded" style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
          <i className="ti ti-stethoscope" style={{ fontSize:40, display:"block", marginBottom:12 }} />
          <div style={{ fontSize:"var(--font-md)", fontWeight:600, marginBottom:6 }}>Search for a patient above</div>
          <div style={{ fontSize:"var(--font-sm)" }}>Select a patient to view their consultation history or start a new visit</div>
        </div>
      )}
    </div>
  );
}

// ─── History Viewer ───────────────────────────────────────────────────────────
function HistoryView({ record, onClose, onEdit }: { record: ConsultRecord; onClose: () => void; onEdit: () => void }) {
  const fields = [
    { label: "Chief Complaint", value: record.complaint },
    { label: "Symptoms",        value: record.symptoms  },
    { label: "Diagnosis",       value: record.diagnosis },
    { label: "Treatment Plan",  value: record.treatment },
    { label: "Follow-up Plan",  value: record.followup  },
  ];
  const vitals = [
    { label: "Blood Pressure", value: record.bp },
    { label: "Heart Rate",     value: record.hr },
    { label: "Temperature",    value: record.temp },
    { label: "Weight",         value: record.weight },
  ].filter(v => v.value);

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:14, borderBottom:"1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize:"var(--font-md)", fontWeight:700 }}>
            Visit — {new Date(record.date).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </div>
          {record.doctor && <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>{record.doctor}</div>}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <StatusPill status={record.status} />
          <button className="btn btn-ghost" style={{ fontSize:"var(--font-xs)", padding:"4px 10px" }} onClick={onEdit}>
            <i className="ti ti-pencil" style={{ fontSize:11, marginRight:4 }} />Edit
          </button>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize:14 }} /></button>
        </div>
      </div>

      {vitals.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:18, padding:"10px 14px", background:"var(--surface2)", borderRadius:"var(--radius)" }}>
          {vitals.map(v => (
            <div key={v.label}>
              <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>{v.label}</div>
              <div style={{ fontSize:"var(--font-md)", fontWeight:700 }}>{v.value}</div>
            </div>
          ))}
        </div>
      )}

      {fields.map(f => f.value ? (
        <div key={f.label} style={{ marginBottom:14 }}>
          <label className="cs-label">{f.label}</label>
          <div style={{ fontSize:"var(--font-sm)", lineHeight:1.6, padding:"9px 12px", background:"var(--surface2)", borderRadius:"var(--radius)", whiteSpace:"pre-wrap" }}>{f.value}</div>
        </div>
      ) : null)}

      {record.prescriptions.length > 0 && (
        <>
          <hr className="cs-divider" />
          <div className="cs-section-title">Prescriptions ({record.prescriptions.length})</div>
          {record.prescriptions.map(rx => <RxCard key={rx.id} rx={rx} />)}
        </>
      )}
    </>
  );
}

// ─── Rx Card ─────────────────────────────────────────────────────────────────
function RxCard({ rx, onRemove }: { rx: Prescription; onRemove?: () => void }) {
  return (
    <div style={{ padding:"10px 14px", background:"var(--surface2)", borderRadius:"var(--radius)", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <div style={{ fontSize:"var(--font-sm)", fontWeight:700 }}>{rx.medicationName}</div>
        <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>
          {rx.dosage} · {rx.frequency} · {rx.duration}
          {rx.route && ` · ${rx.route}`}
        </div>
        {rx.instructions && <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>{rx.instructions}</div>}
        <div style={{ fontSize:"var(--font-xs)", color:"var(--muted)", marginTop:2 }}>By: {rx.prescribedBy} · {fmtDate(rx.prescribedDate)}</div>
      </div>
      {onRemove && (
        <button className="btn-icon" onClick={onRemove} title="Remove"><i className="ti ti-trash" style={{ fontSize:13, color:"var(--red)" }} /></button>
      )}
    </div>
  );
}

// ─── Rx Form ──────────────────────────────────────────────────────────────────
function RxForm({ onSave, onCancel, doctor }: { onSave: (rx: Prescription) => void; onCancel: () => void; doctor: string }) {
  const [form, setForm] = useState({ medicationName:"", dosage:"", frequency:"", route:"oral", duration:"", instructions:"" });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.medicationName || !form.dosage) return;
    onSave({
      id: `rx-${Date.now()}`,
      ...form,
      prescribedDate: new Date().toISOString().split("T")[0],
      prescribedBy: doctor,
      refillsTotal: 0, refillsUsed: 0, refillsRemaining: 0,
      status: "active",
    });
  };

  return (
    <div style={{ padding:"14px 16px", border:"1px solid var(--accent-border)", borderRadius:"var(--radius)", background:"var(--accent-soft)", marginBottom:8 }}>
      <div style={{ fontSize:"var(--font-xs)", fontWeight:700, color:"var(--accent)", marginBottom:10, textTransform:"uppercase" }}>New Prescription</div>
      <div className="cs-rx-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <div><label className="cs-label">Medication *</label><input className="cs-input" placeholder="e.g. Amoxicillin" value={form.medicationName} onChange={f("medicationName")} /></div>
        <div><label className="cs-label">Dosage *</label><input className="cs-input" placeholder="e.g. 500mg" value={form.dosage} onChange={f("dosage")} /></div>
        <div><label className="cs-label">Frequency</label><input className="cs-input" placeholder="e.g. 3x daily" value={form.frequency} onChange={f("frequency")} /></div>
        <div><label className="cs-label">Duration</label><input className="cs-input" placeholder="e.g. 7 days" value={form.duration} onChange={f("duration")} /></div>
        <div>
          <label className="cs-label">Route</label>
          <select className="cs-select" value={form.route} onChange={f("route")}>
            {["oral","topical","intravenous","intramuscular","subcutaneous","inhaled","sublingual","rectal","nasal"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div><label className="cs-label">Instructions</label><input className="cs-input" placeholder="e.g. with food" value={form.instructions} onChange={f("instructions")} /></div>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!form.medicationName || !form.dosage}>Add Prescription</button>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"var(--accent-soft)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.3, fontWeight:700, flexShrink:0 }}>
      {name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
    </div>
  );
}

function Chip({ icon, label, value, color }: { icon: string; label: string; value: any; color?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <i className={`ti ${icon}`} style={{ fontSize:11, color: color || "var(--accent)" }} />
      <span style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>{label}:</span>
      <span style={{ fontSize:"var(--font-xs)", fontWeight:600, color: color || "var(--text)" }}>{value}</span>
    </div>
  );
}

const STATUS_META: Record<ConsultStatus, { label: string; color: string; bg: string }> = {
  pending:       { label:"Pending",     color:"var(--muted)",  bg:"var(--surface3)"  },
  "in-progress": { label:"In Progress", color:"var(--amber)",  bg:"var(--amber-bg)"  },
  completed:     { label:"Completed",   color:"var(--green)",  bg:"var(--green-bg)"  },
};

function StatusPill({ status }: { status: ConsultStatus }) {
  const m = STATUS_META[status];
  return <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, background:m.bg, color:m.color, flexShrink:0 }}>{m.label}</span>;
}

function StatCard({ label, value, color, icon, bg }: { label:string; value:number; color:string; icon:string; bg:string }) {
  return (
    <div className="card card-padded" style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:30, height:30, borderRadius:"var(--radius)", background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <i className={`ti ${icon}`} style={{ fontSize:14, color }} />
        </div>
        <span style={{ fontSize:"var(--font-xs)", color:"var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize:"var(--font-xl)", fontWeight:800, color }}>{value}</div>
    </div>
  );
}

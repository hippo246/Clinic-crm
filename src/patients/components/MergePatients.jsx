import { useState } from "react";
import { fmtDate } from "../utils/patientUtils";

// ─── FIELDS TO COMPARE & MERGE ─────────────────────────────────────────────────
const MERGE_FIELDS = [
  { key:"name",            label:"Full Name"          },
  { key:"phone",           label:"Phone"              },
  { key:"email",           label:"Email"              },
  { key:"dob",             label:"Date of Birth",  fmt: fmtDate },
  { key:"gender",          label:"Gender"             },
  { key:"address",         label:"Address"            },
  { key:"doctor",          label:"Assigned Doctor"    },
  { key:"bloodGroup",      label:"Blood Group"        },
  { key:"insurer",         label:"Insurance Provider" },
  { key:"policyNumber",    label:"Policy Number"      },
  { key:"insuranceExpiry", label:"Insurance Expiry", fmt: fmtDate },
  { key:"emergencyName",   label:"Emergency Contact"  },
  { key:"emergencyPhone",  label:"Emergency Phone"    },
  { key:"allergies",       label:"Allergies"          },
  { key:"nationality",     label:"Nationality"        },
];

// ─── FIELD ROW ─────────────────────────────────────────────────────────────────
function FieldRow({ field, primary, secondary, chosen, onChoose }) {
  const pVal = field.fmt ? field.fmt(primary[field.key]) : (primary[field.key] || "—");
  const sVal = field.fmt ? field.fmt(secondary[field.key]) : (secondary[field.key] || "—");
  const differ = pVal !== sVal && pVal !== "—" && sVal !== "—";

  return (
    <tr style={{ borderBottom:"1px solid var(--border)" }}>
      <td style={{ padding:"8px 12px", fontSize:12, color:"var(--muted)", fontWeight:600, width:140, whiteSpace:"nowrap", verticalAlign:"top" }}>
        {field.label}
      </td>
      <td
        onClick={()=>onChoose(field.key,"primary")}
        style={{
          padding:"8px 12px", fontSize:13, cursor:"pointer",
          background: chosen[field.key]==="primary" ? "var(--accent-soft)" : "transparent",
          border: chosen[field.key]==="primary" ? "1px solid var(--accent)" : "1px solid transparent",
          borderRadius:6,
          color: chosen[field.key]==="primary" ? "var(--accent)" : differ ? "var(--text)" : "var(--muted)",
          fontWeight: chosen[field.key]==="primary" ? 600 : 400,
          transition:"all 0.15s",
          verticalAlign:"top",
        }}
      >
        {pVal}
        {chosen[field.key]==="primary" && (
          <i className="ti ti-check" style={{fontSize:11, marginLeft:6, color:"var(--accent)"}}/>
        )}
      </td>
      <td
        onClick={()=>onChoose(field.key,"secondary")}
        style={{
          padding:"8px 12px", fontSize:13, cursor:"pointer",
          background: chosen[field.key]==="secondary" ? "var(--accent-soft)" : "transparent",
          border: chosen[field.key]==="secondary" ? "1px solid var(--accent)" : "1px solid transparent",
          borderRadius:6,
          color: chosen[field.key]==="secondary" ? "var(--accent)" : differ ? "var(--text)" : "var(--muted)",
          fontWeight: chosen[field.key]==="secondary" ? 600 : 400,
          transition:"all 0.15s",
          verticalAlign:"top",
        }}
      >
        {sVal}
        {chosen[field.key]==="secondary" && (
          <i className="ti ti-check" style={{fontSize:11, marginLeft:6, color:"var(--accent)"}}/>
        )}
      </td>
    </tr>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function MergePatients({ primary, secondary, currentUser, onClose, onMerge }) {
  // Default: prefer primary's values; auto-pick non-empty values
  const defaultChosen = {};
  MERGE_FIELDS.forEach(({ key }) => {
    const pVal = primary[key];
    const sVal = secondary[key];
    defaultChosen[key] = pVal ? "primary" : sVal ? "secondary" : "primary";
  });

  const [chosen,   setChosen]   = useState(defaultChosen);
  const [step,     setStep]     = useState("review");   // "review" | "confirm"
  const [merging,  setMerging]  = useState(false);

  function choose(field, side) {
    setChosen((c) => ({ ...c, [field]: side }));
  }

  function pickAll(side) {
    const next = {};
    MERGE_FIELDS.forEach(({ key }) => { next[key] = side; });
    setChosen(next);
  }

  function buildMerged() {
    const merged = { ...primary };
    MERGE_FIELDS.forEach(({ key }) => {
      const src = chosen[key] === "secondary" ? secondary : primary;
      merged[key] = src[key];
    });
    // Always keep primary's ID; merge arrays (alerts, conditions, medications, timeline, notes)
    merged.id        = primary.id;
    merged.alerts    = [...new Set([...(primary.alerts||[]), ...(secondary.alerts||[])])];
    merged.conditions= [...new Set([...(primary.conditions||[]), ...(secondary.conditions||[])])];
    merged.medications=[...new Set([...(primary.medications||[]), ...(secondary.medications||[])])];
    merged.timeline  = [...(primary.timeline||[]), ...(secondary.timeline||[])]
      .sort((a,b)=>new Date(b.date)-new Date(a.date));
    merged.notes     = [...(primary.notes||[]), ...(secondary.notes||[])];
    merged.consents  = { ...(secondary.consents||{}), ...(primary.consents||{}) };
    merged.flags     = { ...(secondary.flags||{}), ...(primary.flags||{}) };
    // Keep the most recent visit date
    if (secondary.lastVisit && (!primary.lastVisit || new Date(secondary.lastVisit) > new Date(primary.lastVisit))) {
      merged.lastVisit = secondary.lastVisit;
    }
    return merged;
  }

  function doMerge() {
    setMerging(true);
    const merged = buildMerged();
    const auditEntry = {
      id:        Date.now(),
      timestamp: new Date().toISOString(),
      user:      currentUser?.name || "Staff",
      action:    "Merge",
      detail:    `Merged with ${secondary.name} (${secondary.id}). Secondary record retired.`,
    };
    setTimeout(() => {
      setMerging(false);
      onMerge(merged, auditEntry, secondary.id);
    }, 700);
  }

  const diffCount = MERGE_FIELDS.filter(({ key }) => {
    const pVal = primary[key] || "—";
    const sVal = secondary[key] || "—";
    return pVal !== sVal;
  }).length;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1500,
      background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }}>
      <div style={{
        background:"var(--surface)", borderRadius:16,
        border:"1px solid var(--border)",
        width:"100%", maxWidth:780, maxHeight:"92vh",
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
              background:"#7c4fff15",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <i className="ti ti-git-merge" style={{fontSize:18, color:"#7c4fff"}}/>
            </div>
            <div>
              <div style={{fontSize:15, fontWeight:700}}>Merge Patients</div>
              <div style={{fontSize:11, color:"var(--muted)"}}>
                {diffCount} field{diffCount!==1?"s":""} differ · Click a cell to choose which value to keep
              </div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{padding:"6px 10px"}} onClick={onClose}>
            <i className="ti ti-x" style={{fontSize:15}}/>
          </button>
        </div>

        {step === "review" && (
          <>
            {/* Column headers */}
            <div style={{
              display:"grid", gridTemplateColumns:"140px 1fr 1fr",
              padding:"10px 12px", borderBottom:"1px solid var(--border)",
              background:"var(--surface)", flexShrink:0, gap:0,
            }}>
              <div/>
              {[
                { patient:primary,   label:"Primary (kept)", side:"primary"   },
                { patient:secondary, label:"Secondary (retired)", side:"secondary" },
              ].map(({ patient, label, side })=>(
                <div key={side} style={{
                  display:"flex", flexDirection:"column", gap:4,
                  padding:"0 12px",
                }}>
                  <div style={{
                    display:"flex", alignItems:"center", gap:8, justifyContent:"space-between",
                  }}>
                    <div>
                      <div style={{fontSize:13, fontWeight:700}}>{patient.name}</div>
                      <div style={{fontSize:11, color:"var(--muted)", fontFamily:"monospace"}}>{patient.id}</div>
                    </div>
                    <button
                      onClick={()=>pickAll(side)}
                      style={{
                        padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:600,
                        cursor:"pointer",
                        border:"1px solid var(--accent)",
                        background:"var(--accent-soft)", color:"var(--accent)",
                      }}
                    >
                      Use all
                    </button>
                  </div>
                  {side === "secondary" && (
                    <div style={{
                      fontSize:10, fontWeight:700, color:"#ef4444",
                      background:"#fee2e2", padding:"2px 6px", borderRadius:4,
                      display:"inline-block", alignSelf:"flex-start",
                    }}>
                      WILL BE RETIRED
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Field rows */}
            <div style={{flex:1, overflowY:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <tbody>
                  {MERGE_FIELDS.map((field)=>(
                    <FieldRow
                      key={field.key}
                      field={field}
                      primary={primary}
                      secondary={secondary}
                      chosen={chosen}
                      onChoose={choose}
                    />
                  ))}
                </tbody>
              </table>

              {/* Arrays preview */}
              <div style={{padding:"12px 16px", borderTop:"1px solid var(--border)"}}>
                <div style={{fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8}}>
                  Auto-merged (combined from both)
                </div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
                  {[
                    { label:"Alerts", items:[...(primary.alerts||[]),...(secondary.alerts||[])].filter((v,i,a)=>a.indexOf(v)===i) },
                    { label:"Conditions", items:[...(primary.conditions||[]),...(secondary.conditions||[])].filter((v,i,a)=>a.indexOf(v)===i) },
                    { label:"Medications", items:[...(primary.medications||[]),...(secondary.medications||[])].filter((v,i,a)=>a.indexOf(v)===i) },
                  ].map(({ label, items })=>(
                    <div key={label} style={{
                      padding:"8px 10px", borderRadius:8,
                      background:"var(--surface2)", border:"1px solid var(--border)",
                    }}>
                      <div style={{fontSize:11, fontWeight:600, color:"var(--muted)", marginBottom:4}}>{label}</div>
                      {items.length
                        ? items.map((it)=>(
                          <span key={it} style={{
                            display:"inline-block", margin:"2px 3px 2px 0",
                            padding:"1px 6px", borderRadius:20,
                            background:"var(--accent-soft)", color:"var(--accent)",
                            fontSize:11, fontWeight:600,
                          }}>{it}</span>
                        ))
                        : <span style={{fontSize:12, color:"var(--muted)"}}>None</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding:"14px 20px", borderTop:"1px solid var(--border)",
              display:"flex", gap:10, justifyContent:"flex-end", flexShrink:0,
              background:"var(--surface)",
            }}>
              <button className="btn btn-ghost" style={{fontSize:13}} onClick={onClose}>Cancel</button>
              <button
                style={{
                  padding:"9px 18px", borderRadius:10, fontSize:13, fontWeight:600,
                  cursor:"pointer", border:"none",
                  background:"#7c4fff", color:"#fff",
                  display:"flex", alignItems:"center", gap:7,
                }}
                onClick={()=>setStep("confirm")}
              >
                <i className="ti ti-git-merge" style={{fontSize:14}}/> Preview Merge
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div style={{flex:1, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:16}}>
              <div style={{
                padding:"12px 16px", borderRadius:10,
                background:"#fef3c7", border:"1px solid #f59e0b40",
                display:"flex", gap:10, alignItems:"flex-start",
              }}>
                <i className="ti ti-alert-triangle" style={{fontSize:16, color:"#f59e0b", flexShrink:0, marginTop:1}}/>
                <div>
                  <div style={{fontSize:13, fontWeight:700, color:"#92400e", marginBottom:3}}>This action cannot be undone</div>
                  <div style={{fontSize:12, color:"#92400e"}}>
                    <strong>{secondary.name} ({secondary.id})</strong> will be retired and archived.
                    All data will be merged into <strong>{primary.name} ({primary.id})</strong>.
                    The merge is logged in the audit trail.
                  </div>
                </div>
              </div>

              {/* Merged preview */}
              <div style={{fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.07em"}}>
                Merged record preview
              </div>
              {(() => {
                const merged = buildMerged();
                return (
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                    {MERGE_FIELDS.map(({ key, label, fmt })=>(
                      <div key={key} style={{
                        display:"flex", flexDirection:"column", gap:2,
                        padding:"8px 10px", borderRadius:8,
                        background:"var(--surface2)", border:"1px solid var(--border)",
                      }}>
                        <div style={{fontSize:10, color:"var(--muted)", fontWeight:600}}>{label}</div>
                        <div style={{fontSize:13, fontWeight:500}}>
                          {fmt ? fmt(merged[key]) : (merged[key] || "—")}
                          {chosen[key]==="secondary" && (
                            <span style={{
                              fontSize:9, fontWeight:700, marginLeft:5,
                              padding:"1px 5px", borderRadius:3,
                              background:"#7c4fff20", color:"#7c4fff",
                            }}>from secondary</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{
              padding:"14px 20px", borderTop:"1px solid var(--border)",
              display:"flex", gap:10, justifyContent:"flex-end", flexShrink:0,
              background:"var(--surface)",
            }}>
              <button className="btn btn-ghost" style={{fontSize:13}} onClick={()=>setStep("review")}>
                <i className="ti ti-arrow-left" style={{fontSize:13}}/> Back
              </button>
              <button
                disabled={merging}
                onClick={doMerge}
                style={{
                  padding:"9px 18px", borderRadius:10, fontSize:13, fontWeight:600,
                  cursor: merging ? "not-allowed" : "pointer", border:"none",
                  background: merging ? "var(--border)" : "#ef4444",
                  color: merging ? "var(--muted)" : "#fff",
                  display:"flex", alignItems:"center", gap:7,
                  transition:"all 0.15s",
                }}
              >
                {merging
                  ? <><i className="ti ti-loader-2" style={{fontSize:14, animation:"spin 1s linear infinite"}}/> Merging…</>
                  : <><i className="ti ti-git-merge" style={{fontSize:14}}/> Confirm & Merge</>
                }
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

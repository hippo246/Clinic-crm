import { useState } from "react";
import { CONSENT_TYPES } from "../constants/patientConstants";
import { fmtDate } from "../utils/patientUtils";

export default function ConsentManager({ patient, role = "receptionist", onConsentsChange }) {
  const [consents, setConsents] = useState(() => {
    // Init from patient.consents or all false
    const base = {};
    CONSENT_TYPES.forEach((c) => { base[c.key] = false; });
    return { ...base, ...(patient.consents || {}) };
  });
  const [signingKey, setSigningKey] = useState(null); // which consent is being signed
  const [signedBy,   setSignedBy]   = useState("");
  const [notes,      setNotes]      = useState({});   // { [key]: string }

  const signed  = CONSENT_TYPES.filter((c) => consents[c.key]).length;
  const total   = CONSENT_TYPES.length;
  const allDone = signed === total;

  function handleSign(key) {
    if (!signedBy.trim()) return;
    const updated = {
      ...consents,
      [key]: true,
      [`${key}_signedBy`]:   signedBy.trim(),
      [`${key}_signedAt`]:   new Date().toISOString(),
      [`${key}_note`]:       notes[key] || "",
    };
    setConsents(updated);
    setSigningKey(null);
    setSignedBy("");
    onConsentsChange?.(updated);
  }

  function handleRevoke(key) {
    const updated = { ...consents, [key]: false };
    delete updated[`${key}_signedBy`];
    delete updated[`${key}_signedAt`];
    setConsents(updated);
    onConsentsChange?.(updated);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Summary bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10,
        background: allDone ? "#dcfce7" : "#fff7ed",
        border: `1px solid ${allDone ? "#22c55e40" : "#f59e0b40"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i
            className={`ti ${allDone ? "ti-circle-check" : "ti-alert-circle"}`}
            style={{ fontSize: 18, color: allDone ? "#22c55e" : "#f59e0b" }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: allDone ? "#15803d" : "#92400e" }}>
              {allDone ? "All consents collected" : `${total - signed} consent${total - signed > 1 ? "s" : ""} missing`}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{signed} of {total} signed</div>
          </div>
        </div>
        {/* Progress */}
        <div style={{ width: 80, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4,
            width: `${(signed / total) * 100}%`,
            background: allDone ? "#22c55e" : "#f59e0b",
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      {/* Consent rows */}
      {CONSENT_TYPES.map(({ key, label, icon }) => {
        const isSigned   = !!consents[key];
        const signedByWho = consents[`${key}_signedBy`];
        const signedAt   = consents[`${key}_signedAt`];
        const isThisSigning = signingKey === key;

        return (
          <div key={key} style={{
            borderRadius: 10, border: `1px solid ${isSigned ? "#22c55e40" : "var(--border)"}`,
            background: isSigned ? "#dcfce708" : "var(--surface2)",
            overflow: "hidden",
          }}>
            {/* Row header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: isSigned ? "#dcfce7" : "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`ti ${icon}`} style={{ fontSize: 15, color: isSigned ? "#15803d" : "var(--muted)" }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                {isSigned ? (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    Signed by {signedByWho} · {fmtDate(signedAt)}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>Not yet collected</div>
                )}
              </div>

              {isSigned ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                    background: "#dcfce7", color: "#15803d",
                  }}>
                    <i className="ti ti-check" style={{ fontSize: 10 }} /> Signed
                  </span>
                  {role === "admin" && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "3px 8px", color: "#ef4444" }}
                      onClick={() => handleRevoke(key)}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => setSigningKey(isThisSigning ? null : key)}
                >
                  <i className="ti ti-writing" style={{ fontSize: 12 }} />
                  {isThisSigning ? "Cancel" : "Collect"}
                </button>
              )}
            </div>

            {/* Inline sign form */}
            {isThisSigning && (
              <div style={{
                padding: "12px 14px", borderTop: "1px solid var(--border)",
                background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                      Signed by (name / ID) *
                    </label>
                    <input
                      type="text"
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                      placeholder="Patient name or staff ID"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={notes[key] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                      placeholder="e.g. Signed in person"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, opacity: signedBy.trim() ? 1 : 0.5 }}
                    disabled={!signedBy.trim()}
                    onClick={() => handleSign(key)}
                  >
                    <i className="ti ti-check" style={{ fontSize: 12 }} /> Confirm Consent
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import { fmtDate } from "../utils/patientUtils";
import { DOC_TYPES, DOC_META } from "../constants/patientConstants";
import { can } from "../utils/roles";

const DOC_FOLDERS = [
  { key: "all",        label: "All Documents",  icon: "ti-folder",      color: "#4f7cff" },
  { key: "insurance",  label: "Insurance",      icon: "ti-shield",     color: "#22c55e" },
  { key: "consent",    label: "Consent Forms",  icon: "ti-writing",    color: "#f59e0b" },
  { key: "reports",    label: "Medical Reports", icon: "ti-file-analytics", color: "#7c4fff" },
  { key: "id",         label: "ID Documents",   icon: "ti-id",         color: "#ec4899" },
  { key: "prescriptions", label: "Prescriptions", icon: "ti-pill",      color: "#f97316" },
];

const DOC_TYPE_TO_FOLDER = {
  "Insurance Card": "insurance",
  "Consent Form": "consent",
  "Medical Report": "reports",
  "Referral Letter": "reports",
  "Passport": "id",
  "National ID": "id",
};

function VerifiedBadge({ verified }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: verified ? "#dcfce7" : "#fef3c7",
      color:      verified ? "#15803d" : "#92400e",
    }}>
      <i className={`ti ${verified ? "ti-shield-check" : "ti-shield-exclamation"}`} style={{ fontSize: 10 }} />
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

function DocIcon({ type }) {
  const meta = DOC_META[type];
  const icon = meta?.icon || "ti-file";
  return <i className={`ti ${icon}`} style={{ fontSize: 18, color: "var(--accent)", flexShrink: 0 }} />;
}

function RenameModal({ doc, onSave, onClose }) {
  const [name, setName] = useState(doc.type);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: 12, padding: 20,
        width: "100%", maxWidth: 360, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Rename Document</span>
        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%" }}
        >
          {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(name)}>Save</button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ doc, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: 12, padding: 20,
        width: "100%", maxWidth: 360, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#991b1b" }}>
            <i className="ti ti-trash" style={{ fontSize: 14 }} /> Delete Document?
          </span>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{doc.type}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Reason (required)</label>
          <input
            type="text"
            placeholder="e.g. Uploaded in error, duplicate..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => reason.trim() && onConfirm(reason)}
            style={{ opacity: reason.trim() ? 1 : 0.5 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MissingRequiredDocs({ docs }) {
  const required = [
    { type: "Insurance Card", folder: "insurance" },
    { type: "Consent Form", folder: "consent" },
    { type: "National ID", folder: "id" },
  ];

  const missing = required.filter((r) => !docs.some((d) => d.type === r.type));

  if (missing.length === 0) return null;

  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: "#fef3c7", border: "1px solid #f59e0b40",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <i className="ti ti-alert-triangle" style={{ fontSize: 15, color: "#92400e" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>
          Missing Required Documents
        </div>
        <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
          {missing.map((m) => m.type).join(", ")}
        </div>
      </div>
    </div>
  );
}

export default function PatientDocuments({ patient, role = "receptionist" }) {
  const [docs,        setDocs]        = useState(patient.documents || []);
  const [renaming,    setRenaming]    = useState(null); // doc object
  const [deleting,    setDeleting]    = useState(null); // doc object
  const [uploading,   setUploading]   = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("all");

  const canDelete = can(role, "deleteDocument");

  // Filter docs by folder
  const filteredDocs = selectedFolder === "all" 
    ? docs 
    : docs.filter((doc) => DOC_TYPE_TO_FOLDER[doc.type] === selectedFolder);

  // Count docs per folder
  const folderCounts = DOC_FOLDERS.reduce((acc, folder) => {
    if (folder.key === "all") {
      acc[folder.key] = docs.length;
    } else {
      acc[folder.key] = docs.filter((doc) => DOC_TYPE_TO_FOLDER[doc.type] === folder.key).length;
    }
    return acc;
  }, {});

  function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    // Simulate async upload
    setTimeout(() => {
      const newDocs = files.map((f, i) => ({
        id:       `doc-new-${Date.now()}-${i}`,
        type:     DOC_TYPES[0],
        uploaded: new Date().toISOString().split("T")[0],
        size:     `${Math.round(f.size / 1024)} KB`,
        verified: false,
        expiry:   null,
        fileName: f.name,
      }));
      setDocs((prev) => [...newDocs, ...prev]);
      setUploading(false);
    }, 800);
  }

  function handleRename(doc, newType) {
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, type: newType } : d));
    setRenaming(null);
  }

  function handleDelete(doc) {
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleting(null);
  }

  function toggleVerified(id) {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, verified: !d.verified } : d));
  }

  function handleExpiryChange(id, val) {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, expiry: val } : d));
  }

  // Empty state
  if (docs.length === 0 && !uploading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "32px 16px" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-files" style={{ fontSize: 26, color: "var(--accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>No documents uploaded</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Upload insurance cards, IDs, consent forms, and reports.</div>
        </div>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: "pointer", border: "1px solid var(--border)",
          background: "var(--accent)", color: "#fff",
        }}>
          <i className="ti ti-upload" style={{ fontSize: 14 }} /> Upload Document
          <input type="file" multiple style={{ display: "none" }} onChange={handleUpload} />
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Folder Selector */}
      <div style={{
        display: "flex", gap: 4, flexWrap: "wrap",
        padding: "0 0 8px 0",
        borderBottom: "1px solid var(--border)",
      }}>
        {DOC_FOLDERS.map((folder) => {
          const count = folderCounts[folder.key] || 0;
          const isActive = selectedFolder === folder.key;
          return (
            <button
              key={folder.key}
              onClick={() => setSelectedFolder(folder.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: "pointer",
                border: `1px solid ${isActive ? folder.color : "var(--border)"}`,
                background: isActive ? folder.color + "15" : "var(--surface2)",
                color: isActive ? folder.color : "var(--muted)",
                transition: "all 0.12s",
              }}
            >
              <i className={`ti ${folder.icon}`} style={{ fontSize: 11 }} />
              {folder.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: isActive ? folder.color : "var(--border)",
                  color: isActive ? "#fff" : "var(--muted)",
                  padding: "0 5px", borderRadius: 10, minWidth: 16, textAlign: "center",
                  lineHeight: "16px",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {selectedFolder === "all" ? `All Documents (${docs.length})` : `${DOC_FOLDERS.find(f => f.key === selectedFolder)?.label} (${filteredDocs.length})`}
        </span>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          cursor: "pointer", border: "1px solid var(--border)",
          background: "transparent", color: "var(--muted)",
        }}>
          {uploading
            ? <><i className="ti ti-loader-2 ti-spin" style={{ fontSize: 13 }} /> Uploading…</>
            : <><i className="ti ti-upload" style={{ fontSize: 13 }} /> Upload</>
          }
          <input type="file" multiple style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Missing required documents indicator */}
      {selectedFolder === "all" && (
        <MissingRequiredDocs docs={docs} />
      )}

      {filteredDocs.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
          No documents in this folder.
        </div>
      ) : (
        filteredDocs.map((doc) => {
          const meta       = DOC_META[doc.type] || {};
          const isExpiring = doc.expiry && new Date(doc.expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const isExpired  = doc.expiry && new Date(doc.expiry) < new Date();

          return (
            <div
              key={doc.id}
              style={{
                display: "flex", flexDirection: "column", gap: 8,
                padding: "10px 12px",
                background: "var(--surface2)",
                borderRadius: 8,
                border: `1px solid ${isExpired ? "#ef444440" : isExpiring ? "#f59e0b40" : "var(--border)"}`,
              }}
            >
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <DocIcon type={doc.type} />

                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.type}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {fmtDate(doc.uploaded)} · {doc.size}
                    </span>
                    {meta.needsVerify && <VerifiedBadge verified={!!doc.verified} />}
                    {isExpired  && <span style={{ fontSize: 10, fontWeight: 600, color: "#991b1b", background: "#fee2e2", padding: "1px 5px", borderRadius: 4 }}>EXPIRED</span>}
                    {!isExpired && isExpiring && <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", background: "#fef3c7", padding: "1px 5px", borderRadius: 4 }}>EXPIRING SOON</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} title="Preview">
                    <i className="ti ti-eye" style={{ fontSize: 13 }} />
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} title="Download">
                    <i className="ti ti-download" style={{ fontSize: 13 }} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 8px", fontSize: 12 }}
                    title="Rename"
                    onClick={() => setRenaming(doc)}
                  >
                    <i className="ti ti-pencil" style={{ fontSize: 13 }} />
                  </button>
                  {canDelete && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 8px", fontSize: 12, color: "#ef4444" }}
                      title="Delete"
                      onClick={() => setDeleting(doc)}
                    >
                      <i className="ti ti-trash" style={{ fontSize: 13 }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom row — expiry + verify toggles */}
              {(meta.needsExpiry || meta.needsVerify) && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                  {meta.needsExpiry && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Expiry:</span>
                      <input
                        type="date"
                        value={doc.expiry || ""}
                        onChange={(e) => handleExpiryChange(doc.id, e.target.value)}
                        style={{
                          fontSize: 11, padding: "2px 6px", borderRadius: 5,
                          border: "1px solid var(--border)", background: "var(--surface)",
                          color: "var(--text)",
                        }}
                      />
                    </div>
                  )}
                  {meta.needsVerify && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "3px 8px", color: doc.verified ? "#15803d" : "var(--muted)" }}
                      onClick={() => toggleVerified(doc.id)}
                    >
                      <i className={`ti ${doc.verified ? "ti-shield-check" : "ti-shield"}`} style={{ fontSize: 12 }} />
                      {doc.verified ? "Mark Unverified" : "Mark Verified"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {renaming && (
        <RenameModal
          doc={renaming}
          onSave={(newType) => handleRename(renaming, newType)}
          onClose={() => setRenaming(null)}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          doc={deleting}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

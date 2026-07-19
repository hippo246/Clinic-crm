import React, { useState, useEffect, useCallback } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";
import {
  validateRequired,
  validateDate,
  validateMaxLength,
  safeString,
} from "../shared/validation/validators";
import { validateDocumentData } from "../shared/validation/entityValidation";
import { MAX_FILE_SIZE_BYTES, ALLOWED_DOCUMENT_MIME_TYPES } from "../shared/constants/validationConstants";
import { hasRole, normalizeRole } from "../shared/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";

export default function DocumentsPage({ patients, onUpdatePatient, userRole = "admin" }: { patients: Patient[]; onUpdatePatient?: (updated: Patient, action?: string) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  const normalizedRole = normalizeRole(userRole);

  // Local permission guards
  const canViewDocuments = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist", "readonly"]);
  const canUploadDocument = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canEditDocument = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canDeleteDocument = hasRole(normalizedRole, ["admin"]);
  const canDownloadDocument = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist", "readonly"]);
  const canPrintDocument = hasRole(normalizedRole, ["admin", "doctor", "nurse", "receptionist", "readonly"]);
  const canExportDocuments = hasRole(normalizedRole, ["admin", "doctor", "nurse"]);
  const canExportDocumentActivity = hasRole(normalizedRole, ["admin"]);
  const canClearDocumentActivity = hasRole(normalizedRole, ["admin"]);

  const handleDeniedAccess = (action: string, resource: string) => {
    setFeedback({ type: "error", message: `You don't have permission to ${action} ${resource}.` });
    logDeniedAction({
      action,
      resource,
      role: normalizedRole,
      reason: "Insufficient permissions",
      severity: "medium",
    });
  };

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "consents" | "id" | "insurance">("all");
  const [uploadDocType, setUploadDocType] = useState("consent");
  const [uploadDocName, setUploadDocName] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [viewDoc, setViewDoc] = useState<any | null>(null);
  const [renewDoc, setRenewDoc] = useState<any | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [signConfirmDoc, setSignConfirmDoc] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  const showFeedback = useCallback((message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const loadDocuments = useCallback(() => {
    return JSON.parse(localStorage.getItem("clinic_crm_documents") || "[]");
  }, []);

  const [documents, setDocuments] = useState<any[]>(loadDocuments);

  useEffect(() => {
    setDocuments(loadDocuments());
  }, [loadDocuments]);

  const saveDocuments = (updated: any[]) => {
    localStorage.setItem("clinic_crm_documents", JSON.stringify(updated));
    setDocuments(updated);
  };

  const consents = documents.filter((d: any) => d.type === "consent");
  const idDocs = documents.filter((d: any) => d.type === "id");
  const insuranceDocs = documents.filter((d: any) => d.type === "insurance");

  const expiringSoon = documents.filter((d: any) => {
    if (!d.expiryDate) return false;
    const expiry = new Date(d.expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  const expired = documents.filter((d: any) => {
    if (!d.expiryDate) return false;
    return new Date(d.expiryDate) < new Date();
  });

  const tabDocs = activeTab === "all" ? documents : activeTab === "consents" ? consents : activeTab === "id" ? idDocs : insuranceDocs;
  const filteredDocs = searchQuery.trim()
    ? tabDocs.filter((d: any) =>
        d.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.type?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabDocs;

  function validateDocumentUpload(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate patient
    if (!selectedPatient) {
      errors.push("Please select a patient.");
    }

    // Validate document name
    const docName = uploadDocName || uploadFile?.name || "";
    const nameError = validateRequired(docName, "Document name");
    if (nameError) errors.push(nameError);

    // Validate document type
    const typeError = validateRequired(uploadDocType, "Document type");
    if (typeError) errors.push(typeError);

    // Validate file if provided
    if (uploadFile) {
      // Check file size
      if (uploadFile.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
      }

      // Check file type (more permissive check)
      const fileType = uploadFile.type.toLowerCase();
      const allowedTypes = ALLOWED_DOCUMENT_MIME_TYPES.map(t => t.toLowerCase());
      if (!allowedTypes.includes(fileType as any)) {
        errors.push(`File type "${uploadFile.type}" is not allowed. Allowed types: ${ALLOWED_DOCUMENT_MIME_TYPES.join(", ")}`);
      }
    }

    // Validate expiry date if provided
    if (uploadExpiryDate) {
      if (!validateDate(uploadExpiryDate)) {
        errors.push("Invalid expiry date format.");
      }
    }

    // Validate notes max length
    if (uploadNotes) {
      const notesError = validateMaxLength(uploadNotes, 1000, "Clinical notes");
      if (notesError) errors.push(notesError);
    }

    // Use shared entity validation as final check
    if (selectedPatient && docName && uploadDocType) {
      const documentData = {
        patient_id: selectedPatient.id,
        patientId: selectedPatient.id,
        title: docName,
        type: uploadDocType,
        expiryDate: uploadExpiryDate || undefined,
      };
      const entityValidation = validateDocumentData(documentData);
      if (!entityValidation.valid && entityValidation.errors.length > 0) {
        entityValidation.errors.forEach((err) => {
          if (!errors.includes(err)) errors.push(err);
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  const handleUpload = () => {
    if (!canUploadDocument) {
      handleDeniedAccess("upload", "document");
      return;
    }
    const validation = validateDocumentUpload();
    
    // Show errors and block upload
    if (validation.errors.length > 0) {
      validation.errors.forEach(error => showFeedback(error, "error"));
      return;
    }

    // Show warnings but don't block
    validation.warnings.forEach(warning => showFeedback(warning, "warning"));

    const docName = uploadDocName || uploadFile?.name || "Untitled";
    
    const newDoc = {
      id: `doc_${Date.now()}`,
      patientId: selectedPatient!.id,
      patientName: selectedPatient!.name,
      type: uploadDocType,
      name: safeString(docName).trim(),
      uploadDate: new Date().toISOString(),
      uploadedBy: "Current User",
      expiryDate: uploadExpiryDate || null,
      notes: uploadNotes ? safeString(uploadNotes).trim() : null,
      signed: false,
      fileName: uploadFile?.name || null,
    };
    saveDocuments([...documents, newDoc]);
    setShowUploadModal(false);
    setSelectedPatient(null);
    setUploadDocName("");
    setUploadNotes("");
    setUploadExpiryDate("");
    setUploadFile(null);
    setUploadDocType("consent");
    showFeedback("Document uploaded successfully.", "success");
  };

  const handleDownload = (d: any) => {
    if (!canDownloadDocument) {
      handleDeniedAccess("download", "document");
      return;
    }
    // Phase 8H: Remove patientName and other PHI from downloaded JSON (PHI-safe)
    const sanitizedMetadata = {
      id: d.id,
      patientId: d.patientId,
      type: d.type,
      name: d.name,
      uploadDate: d.uploadDate,
      expiryDate: d.expiryDate,
      signed: d.signed,
      signedDate: d.signedDate,
      signedBy: d.signedBy,
      renewedDate: d.renewedDate,
      renewedBy: d.renewedBy,
      // Explicitly exclude: patientName, phone, email, dob, address, document content
    };
    const blob = new Blob([JSON.stringify(sanitizedMetadata, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${d.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback("Document metadata downloaded.", "success");
  };

  const handleRenewConfirm = () => {
    if (!canEditDocument) {
      handleDeniedAccess("renew", "document");
      return;
    }
    if (!renewDoc || !renewDate) return;
    const updated = documents.map((doc: any) =>
      doc.id === renewDoc.id
        ? { ...doc, expiryDate: renewDate, renewedDate: new Date().toISOString(), renewedBy: "Current User" }
        : doc
    );
    saveDocuments(updated);
    setRenewDoc(null);
    setRenewDate("");
    showFeedback("Document renewed successfully.", "success");
  };

  const handleMarkSigned = (d: any) => {
    if (!canEditDocument) {
      handleDeniedAccess("mark as signed", "document");
      return;
    }
    const updated = documents.map((doc: any) =>
      doc.id === d.id
        ? { ...doc, signed: true, signedDate: new Date().toISOString(), signedBy: "Current User" }
        : doc
    );
    saveDocuments(updated);
    setSignConfirmDoc(null);
    showFeedback("Document marked as signed.", "success");
  };

  const daysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div style={{ padding: "16px clamp(12px, 4vw, 24px)", maxWidth: 1400 }}>
      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: "var(--radius)",
          background: feedback.type === "error" ? "var(--red-bg)" : 
                     feedback.type === "success" ? "var(--green-bg)" : 
                     feedback.type === "warning" ? "var(--amber-bg)" : "var(--blue-bg)",
          border: `1px solid ${feedback.type === "error" ? "var(--red-border)" : 
                              feedback.type === "success" ? "var(--green-border)" : 
                              feedback.type === "warning" ? "var(--amber-border)" : "var(--blue-border)"}`,
          color: feedback.type === "error" ? "var(--red)" : 
                 feedback.type === "success" ? "var(--green)" : 
                 feedback.type === "warning" ? "var(--amber)" : "var(--blue)",
          fontSize: "var(--font-sm)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <i className={`ti ${feedback.type === "error" ? "ti-alert-circle" : 
                              feedback.type === "success" ? "ti-check" : 
                              feedback.type === "warning" ? "ti-alert-triangle" : "ti-info-circle"}`} />
          {feedback.message}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Documents & Consents
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Consents, ID, insurance, and medical records — with expiry tracking and audit trail
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Documents" value={documents.length} color="var(--accent)" icon="ti-files" bg="var(--accent-soft)" />
        <StatCard label="Consents" value={consents.length} color="var(--blue)" icon="ti-writing" bg="var(--blue-bg)" />
        <StatCard label="ID Documents" value={idDocs.length} color="var(--green)" icon="ti-id" bg="var(--green-bg)" />
        <StatCard label="Insurance Docs" value={insuranceDocs.length} color="var(--amber)" icon="ti-shield" bg="var(--amber-bg)" />
        <StatCard label="Expiring Soon" value={expiringSoon.length} color="var(--red)" icon="ti-clock-exclamation" bg="var(--red-bg)" />
      </div>

      {/* Expiry Alerts */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className="card card-padded" style={{ marginBottom: 24, border: expired.length > 0 ? "2px solid var(--red-border)" : "1px solid var(--amber-border)", background: expired.length > 0 ? "var(--red-bg)" : "var(--amber-bg)" }}>
          <div className="section-label" style={{ color: expired.length > 0 ? "var(--red)" : "var(--amber)", marginBottom: 12 }}>
            <i className={`ti ${expired.length > 0 ? "ti-alert-triangle" : "ti-clock-exclamation"}`} style={{ marginRight: 4 }} />
            {expired.length > 0 ? "Expired Documents" : "Documents Expiring Soon"} ({expired.length + expiringSoon.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...expired, ...expiringSoon].map((d: any) => (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "#fff", borderRadius: "var(--radius)",
                border: expired.includes(d) ? "1px solid var(--red-border)" : "1px solid var(--amber-border)"
              }}>
                <i className={`ti ${d.type === "consent" ? "ti-writing" : d.type === "id" ? "ti-id" : "ti-shield"}`} style={{ fontSize: 20, color: expired.includes(d) ? "var(--red)" : "var(--amber)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{d.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                    {d.name} · Expires {fmtDate(d.expiryDate)}
                  </div>
                </div>
                {canEditDocument && (
                  <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)" }} onClick={() => { setRenewDoc(d); setRenewDate(d.expiryDate || ""); }}>
                    Renew
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Card */}
      <div className="card" style={{ overflow: "visible" }}>
        {/* Card header toolbar */}
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          {/* Row 1: tabs */}
          <div style={{
            padding: "0 16px",
            display: "flex",
            gap: 4,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch" as any,
          }}>
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} count={documents.length}>All</TabButton>
            <TabButton active={activeTab === "consents"} onClick={() => setActiveTab("consents")} count={consents.length}>Consents</TabButton>
            <TabButton active={activeTab === "id"} onClick={() => setActiveTab("id")} count={idDocs.length}>ID Docs</TabButton>
            <TabButton active={activeTab === "insurance"} onClick={() => setActiveTab("insurance")} count={insuranceDocs.length}>Insurance</TabButton>
          </div>
          {/* Row 2: search + count + upload */}
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
              <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13, pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search patient, document, type…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "7px 12px 7px 30px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {filteredDocs.length} record{filteredDocs.length !== 1 ? "s" : ""}
            </div>
            <div style={{ flex: 1 }} />
            {canUploadDocument && (
              <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setShowUploadModal(true)}>
                <i className="ti ti-upload" style={{ fontSize: 13, marginRight: 5 }} />
                Upload
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
          <table className="tbl" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Document Name</th>
              <th>Type</th>
              <th>Upload Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-files empty-state-icon" /><div className="empty-state-sub">{searchQuery ? `No documents match "${searchQuery}"` : "No documents yet"}</div>{!searchQuery && canUploadDocument && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowUploadModal(true)}>Upload first document</button>}</div></td></tr>
            ) : filteredDocs.map((d: any) => {
              const days = d.expiryDate ? daysUntilExpiry(d.expiryDate) : null;
              const isExpired = days !== null && days < 0;
              const isExpiringSoon = days !== null && days >= 0 && days <= 30;
              return (
              <tr key={d.id} className="tbl-row">
                <td>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{d.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{d.patientId}</div>
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>
                  <div>{d.name}</div>
                  {d.notes && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.notes}>{d.notes}</div>}
                </td>
                <td>
                  <span className="badge" style={{
                    background: d.type === "consent" ? "var(--blue-bg)" : d.type === "id" ? "var(--green-bg)" : "var(--amber-bg)",
                    color: d.type === "consent" ? "var(--blue)" : d.type === "id" ? "var(--green)" : "var(--amber)",
                    border: d.type === "consent" ? "1px solid var(--blue-border)" : d.type === "id" ? "1px solid var(--green-border)" : "1px solid var(--amber-border)",
                    textTransform: "capitalize",
                  }}>
                    {d.type}
                  </span>
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>
                  <div>{fmtDate(d.uploadDate)}</div>
                  {d.uploadedBy && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{d.uploadedBy}</div>}
                </td>
                <td style={{ fontSize: "var(--font-sm)" }}>
                  {d.expiryDate ? (
                    <>
                      <div style={{ color: isExpired ? "var(--red)" : isExpiringSoon ? "var(--amber)" : undefined }}>{fmtDate(d.expiryDate)}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: isExpired ? "var(--red)" : isExpiringSoon ? "var(--amber)" : "var(--muted)" }}>
                        {isExpired ? `Expired ${Math.abs(days!)}d ago` : `${days}d remaining`}
                      </div>
                    </>
                  ) : <span style={{ color: "var(--muted)" }}>N/A</span>}
                </td>
                <td>
                  {d.signed ? (
                    <div>
                      <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }}>
                        <i className="ti ti-check" style={{ fontSize: 10 }} /> Signed
                      </span>
                      {d.signedDate && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>{fmtDate(d.signedDate)}</div>}
                    </div>
                  ) : (
                    <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
                      Pending
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setViewDoc(d)}>View</button>
                    {canDownloadDocument && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleDownload(d)}>Download</button>
                    )}
                    {canEditDocument && !d.signed && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--green)" }} onClick={() => setSignConfirmDoc(d)}>Sign</button>
                    )}
                    {canEditDocument && (isExpired || isExpiringSoon) && (
                      <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => { setRenewDoc(d); setRenewDate(d.expiryDate || ""); }}>Renew</button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowUploadModal(false)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            className="modal"
            style={{ maxWidth: 520, width: "calc(100% - 32px)", margin: "auto", borderRadius: "calc(var(--radius) * 2)", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--radius)", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="ti ti-upload" style={{ fontSize: 18, color: "var(--accent)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Upload Document</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Attach a file to a patient record</div>
              </div>
              <button className="btn-icon" onClick={() => setShowUploadModal(false)}>
                <i className="ti ti-x" style={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", maxHeight: "calc(85vh - 130px)", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Patient + Type row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                    Patient <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <select
                    value={selectedPatient?.id || ""}
                    onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", background: "var(--surface, #fff)" }}
                  >
                    <option value="">Select patient…</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Type</label>
                  <select value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", background: "var(--surface, #fff)" }}>
                    <option value="consent">Consent Form</option>
                    <option value="id">ID Document</option>
                    <option value="insurance">Insurance Document</option>
                    <option value="medical">Medical Record</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Document name */}
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Document Name</label>
                <input
                  type="text"
                  placeholder="e.g. General Anaesthesia Consent 2025"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }}
                />
              </div>

              {/* File drop zone */}
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>File</label>
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, padding: "24px 16px", borderRadius: "var(--radius)",
                  border: `2px dashed ${uploadFile ? "var(--accent)" : "var(--border)"}`,
                  background: uploadFile ? "var(--accent-soft)" : "var(--surface, #fafafa)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <i className={`ti ${uploadFile ? "ti-file-check" : "ti-cloud-upload"}`} style={{ fontSize: 28, color: uploadFile ? "var(--accent)" : "var(--muted)" }} />
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, color: uploadFile ? "var(--accent)" : "var(--muted)" }}>
                    {uploadFile ? uploadFile.name : "Click to browse or drag & drop"}
                  </div>
                  {!uploadFile && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>PDF, JPG, PNG, DOCX up to 20MB</div>}
                  <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
                </label>
                {uploadFile && (
                  <button
                    onClick={() => setUploadFile(null)}
                    style={{ marginTop: 4, fontSize: "var(--font-xs)", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    × Remove file
                  </button>
                )}
              </div>

              {/* Expiry + Notes row */}
              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Expiry Date <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                <input
                  type="date"
                  value={uploadExpiryDate}
                  onChange={(e) => setUploadExpiryDate(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Clinical Notes <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Add any relevant clinical notes…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", background: "var(--surface, #fafafa)" }}>
              <button className="btn btn-ghost" onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!selectedPatient} onClick={handleUpload}>
                <i className="ti ti-upload" style={{ fontSize: 13, marginRight: 5 }} />
                Upload Document
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View Document Modal */}
      {viewDoc && (
        <div className="modal-backdrop" onClick={() => setViewDoc(null)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal" style={{ maxWidth: 500, width: "calc(100% - 32px)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>{viewDoc.name}</div>
              <button className="btn-icon" onClick={() => setViewDoc(null)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Patient", viewDoc.patientName],
                ["Patient ID", viewDoc.patientId],
                ["Type", viewDoc.type],
                ["Uploaded", fmtDate(viewDoc.uploadDate)],
                ["Uploaded By", viewDoc.uploadedBy || "—"],
                ["Expiry", viewDoc.expiryDate ? fmtDate(viewDoc.expiryDate) : "N/A"],
                ["Status", viewDoc.signed ? `Signed${viewDoc.signedDate ? " · " + fmtDate(viewDoc.signedDate) : ""}` : "Pending"],
                ...(viewDoc.signedBy ? [["Signed By", viewDoc.signedBy]] : []),
                ...(viewDoc.renewedDate ? [["Last Renewed", `${fmtDate(viewDoc.renewedDate)} by ${viewDoc.renewedBy || "—"}`]] : []),
                ...(viewDoc.fileName ? [["File", viewDoc.fileName]] : []),
                ...(viewDoc.notes ? [["Clinical Notes", viewDoc.notes]] : []),
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-sm)", gap: 12 }}>
                  <span style={{ color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>{label}</span>
                  <span style={{ textAlign: "right" }}>{val}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setViewDoc(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => { handleDownload(viewDoc); setViewDoc(null); }}>Download</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Renew Modal */}
      {renewDoc && (
        <div className="modal-backdrop" onClick={() => setRenewDoc(null)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal" style={{ maxWidth: 400, width: "calc(100% - 32px)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Renew Document</div>
              <button className="btn-icon" onClick={() => setRenewDoc(null)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: "var(--font-sm)", marginBottom: 16 }}>
                <span style={{ fontWeight: 600 }}>{renewDoc.name}</span>
                <span style={{ color: "var(--muted)" }}> · {renewDoc.patientName}</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>New Expiry Date</label>
                <input
                  type="date"
                  value={renewDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setRenewDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setRenewDoc(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!renewDate} onClick={handleRenewConfirm}>Confirm Renewal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Confirmation Modal */}
      {signConfirmDoc && (
        <div className="modal-backdrop" onClick={() => setSignConfirmDoc(null)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal" style={{ maxWidth: 400, width: "calc(100% - 32px)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Confirm Signature</div>
              <button className="btn-icon" onClick={() => setSignConfirmDoc(null)}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: "var(--font-sm)", marginBottom: 8, color: "var(--muted)" }}>
                Confirm you are signing the following document. This is permanent and timestamped.
              </p>
              <div style={{ background: "var(--accent-soft)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--font-sm)" }}>{signConfirmDoc.name}</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{signConfirmDoc.patientName} · {signConfirmDoc.patientId}</div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setSignConfirmDoc(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => handleMarkSigned(signConfirmDoc)}>
                  <i className="ti ti-check" style={{ fontSize: 13, marginRight: 4 }} />
                  Mark as Signed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px 10px",
        borderRadius: 0,
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        background: "transparent",
        color: active ? "var(--accent)" : "var(--muted)",
        fontSize: "var(--font-sm)",
        fontWeight: active ? 600 : 400,
        flexShrink: 0,
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: -1,
      }}
    >
      {children}
      {count !== undefined && (
        <span style={{
          fontSize: "var(--font-xs)",
          fontWeight: 600,
          background: active ? "var(--accent)" : "var(--border)",
          color: active ? "#fff" : "var(--muted)",
          borderRadius: 99,
          padding: "1px 6px",
          lineHeight: "1.4",
          transition: "all 0.15s",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, color, icon, bg }: {
  label: string;
  value: number;
  color: string;
  icon: string;
  bg: string;
}) {
  return (
    <div className="card card-padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
        </div>
        <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "var(--font-xl)", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { fmtDate } from "./utils";
import { useAudit } from "../modules/audit/hooks/useAudit";
import { useSecurity } from "../modules/security/hooks/useSecurity";
import { AuditLogList } from "../modules/audit/components/AuditLogList";
import { SecurityEvents } from "../modules/security/components/SecurityEvents";
import { ConfirmDialog } from "../shared/components/feedback/ConfirmDialog";
import { Feedback } from "../shared/components/feedback/Feedback";
import { hasRole, normalizeRole } from "../shared/permissions/permissions";
import { logDeniedAction } from "../shared/services/deniedActionLogger";
// Phase 8F: Import workflow integrity scanner and audit logging
import { scanWorkflowIntegrity, type IntegrityScanResult, type WorkflowData } from "../shared/workflow/workflowIntegrity";
import { logWorkflowAction } from "../shared/workflow/workflowAudit";
// Phase 9E: Import admin operation audit helper and retention service
import { logAdminOperation } from "../shared/services/adminAudit";
import { createArchiveMetadata, storeArchiveMetadata } from "../shared/services/auditRetention";
// Phase 10B: Import legacy log sanitizer
import { scanLogsForSensitiveFields, scanAllLogSources, scanAllKnownLogSources, previewSanitization, sanitizeLogEntry } from "../shared/services/logSanitizer";

export default function AuditPage({ userRole = "admin" }: { userRole?: "receptionist" | "doctor" | "admin" | "nurse" | "billing" | "auditor" | "readonly" }) {
  const [activeTab, setActiveTab] = useState<"audit" | "security" | "integrity" | "privacy">("audit");
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showClearAuditConfirm, setShowClearAuditConfirm] = useState(false);
  const [showClearSecurityConfirm, setShowClearSecurityConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  // Phase 8F: Integrity scan state
  const [integrityResult, setIntegrityResult] = useState<IntegrityScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  // Phase 9E: Add typed confirmation state for dangerous actions
  const [typedConfirm, setTypedConfirm] = useState<{ requiredText: string; onConfirm: () => void } | null>(null);
  const [typedValue, setTypedValue] = useState("");
  // Phase 10B: Legacy log scan state
  const [legacyScanResult, setLegacyScanResult] = useState<any>(null);
  const [isLegacyScanning, setIsLegacyScanning] = useState(false);
  const [redactionPreview, setRedactionPreview] = useState<any>(null);

  // Normalized role for consistent permission checks
  const normalizedRole = normalizeRole(userRole) as "admin" | "doctor" | "nurse" | "receptionist" | "billing" | "auditor" | "readonly";

  // Local permission guards for Audit actions
  const canViewAuditLogs = hasRole(normalizedRole, ["admin", "auditor"]);
  const canViewSecurityEvents = hasRole(normalizedRole, ["admin", "auditor"]);
  const canExportAuditLogs = hasRole(normalizedRole, ["admin", "auditor"]);
  const canExportSecurityEvents = hasRole(normalizedRole, ["admin"]);
  const canClearAuditLogs = hasRole(normalizedRole, ["admin"]);
  const canClearSecurityEvents = hasRole(normalizedRole, ["admin"]);
  const canDeleteAuditEvent = hasRole(normalizedRole, ["admin"]);
  const canDeleteSecurityEvent = hasRole(normalizedRole, ["admin"]);
  // Phase 8F: Integrity scan permission (admin only)
  const canRunIntegrityScan = hasRole(normalizedRole, ["admin"]);
  // Phase 10B: Legacy log scan permission (admin only)
  const canRunLegacyScan = hasRole(normalizedRole, ["admin"]);

  // Local denied access helper
  const handleDeniedAccess = (action: string, resource: string) => {
    setFeedback({ message: `You don't have permission to ${action} ${resource}.`, type: "error" });
    logDeniedAction({
      action,
      resource,
      role: normalizedRole,
      reason: "insufficient_permissions",
    });
  };

  const { logs, refreshLogs, clearLogs, seedDemoLogs, exportLogs: exportAuditLogs, deleteLog } = useAudit();
  const { events, refreshEvents, clearEvents, seedDemoEvents, exportEvents: exportSecurityEvents, resolveEvent, reopenEvent, deleteEvent } = useSecurity();

  useEffect(() => {
    refreshLogs();
    refreshEvents();
  }, [refreshLogs, refreshEvents]);

  const handleSeedDemo = () => {
    if (!hasRole(normalizedRole, ["admin"])) {
      handleDeniedAccess("seed", "demo logs");
      return;
    }
    seedDemoLogs();
    seedDemoEvents();
    setFeedback({ message: "Demo audit and security logs seeded successfully", type: "success" });
    setShowSeedConfirm(false);
    // Phase 9E: Log seed demo action (PHI-safe)
    logAdminOperation({
      action: "seed_demo",
      module: "audit",
      resourceType: "logs",
      actor: normalizedRole,
      role: normalizedRole,
    });
  };

  const handleClearAudit = () => {
    if (!canClearAuditLogs) {
      handleDeniedAccess("clear", "audit logs");
      return;
    }
    // Phase 9E: Require typed confirmation for clearing audit logs
    setTypedConfirm({
      requiredText: "CLEAR AUDIT LOGS",
      onConfirm: () => {
        const count = logs.length;
        // Phase 9E: Create archive metadata before clearing
        const archiveMetadata = createArchiveMetadata("audit_logs_clear", count, "audit", normalizedRole);
        storeArchiveMetadata(archiveMetadata);
        
        clearLogs();
        setFeedback({ message: "Audit logs cleared successfully", type: "success" });
        setShowClearAuditConfirm(false);
        // Phase 9E: Log clear audit action (PHI-safe)
        logAdminOperation({
          action: "clear",
          module: "audit",
          resourceType: "audit_logs",
          count,
          metadata: { archived: true },
          actor: normalizedRole,
          role: normalizedRole,
        });
        setTypedConfirm(null);
        setTypedValue("");
      },
    });
  };

  const handleClearSecurity = () => {
    if (!canClearSecurityEvents) {
      handleDeniedAccess("clear", "security events");
      return;
    }
    // Phase 9E: Require typed confirmation for clearing security events
    setTypedConfirm({
      requiredText: "CLEAR SECURITY EVENTS",
      onConfirm: () => {
        const count = events.length;
        // Phase 9E: Create archive metadata before clearing
        const archiveMetadata = createArchiveMetadata("security_events_clear", count, "audit", normalizedRole);
        storeArchiveMetadata(archiveMetadata);
        
        clearEvents();
        setFeedback({ message: "Security events cleared successfully", type: "success" });
        setShowClearSecurityConfirm(false);
        // Phase 9E: Log clear security action (PHI-safe)
        logAdminOperation({
          action: "clear",
          module: "audit",
          resourceType: "security_events",
          count,
          metadata: { archived: true },
          actor: normalizedRole,
          role: normalizedRole,
        });
        setTypedConfirm(null);
        setTypedValue("");
      },
    });
  };

  const handleRefresh = () => {
    refreshLogs();
    refreshEvents();
    setFeedback({ message: "Logs refreshed successfully", type: "success" });
  };

  const handleExportAudit = () => {
    if (!canExportAuditLogs) {
      handleDeniedAccess("export", "audit logs");
      return;
    }
    exportAuditLogs();
    setFeedback({ message: "Audit logs exported successfully", type: "success" });
    // Phase 9E: Log export audit action (PHI-safe)
    logAdminOperation({
      action: "export",
      module: "audit",
      resourceType: "audit_logs",
      exportType: "csv",
      count: logs.length,
      actor: normalizedRole,
      role: normalizedRole,
    });
  };

  const handleExportSecurity = () => {
    if (!canExportSecurityEvents) {
      handleDeniedAccess("export", "security events");
      return;
    }
    exportSecurityEvents();
    setFeedback({ message: "Security events exported successfully", type: "success" });
    // Phase 9E: Log export security action (PHI-safe)
    logAdminOperation({
      action: "export",
      module: "audit",
      resourceType: "security_events",
      exportType: "csv",
      count: events.length,
      actor: normalizedRole,
      role: normalizedRole,
    });
  };

  // Phase 8F: Handle workflow integrity scan
  const handleIntegrityScan = () => {
    if (!canRunIntegrityScan) {
      handleDeniedAccess("run", "integrity scan");
      return;
    }

    setIsScanning(true);
    setFeedback(null);

    // Collect workflow data from localStorage
    const workflowData: WorkflowData = {
      patients: [],
      consultations: [],
      prescriptions: [],
      labOrders: [],
      labResults: [],
      invoices: [],
      communications: [],
      queue: [],
      waitlist: [],
      queueActivity: [],
      consultationActivity: [],
      prescriptionActivity: [],
      labActivity: [],
      billingActivity: [],
    };

    // Read data from localStorage
    try {
      const patientsData = localStorage.getItem("clinic_crm_patients");
      if (patientsData) workflowData.patients = JSON.parse(patientsData);

      const consultationsData = localStorage.getItem("clinic_crm_consultations");
      if (consultationsData) workflowData.consultations = JSON.parse(consultationsData);

      const prescriptionsData = localStorage.getItem("clinic_crm_prescriptions");
      if (prescriptionsData) workflowData.prescriptions = JSON.parse(prescriptionsData);

      const labOrdersData = localStorage.getItem("clinic_crm_lab_orders");
      if (labOrdersData) workflowData.labOrders = JSON.parse(labOrdersData);

      const labResultsData = localStorage.getItem("clinic_crm_lab_results");
      if (labResultsData) workflowData.labResults = JSON.parse(labResultsData);

      const invoicesData = localStorage.getItem("clinic_crm_invoices");
      if (invoicesData) workflowData.invoices = JSON.parse(invoicesData);

      const communicationsData = localStorage.getItem("clinic_crm_communications");
      if (communicationsData) workflowData.communications = JSON.parse(communicationsData);

      const queueData = localStorage.getItem("clinic_crm_queue_priority"); // Queue is derived from patients, but check for any queue-specific data
      if (queueData) workflowData.queue = JSON.parse(queueData);

      const waitlistData = localStorage.getItem("clinic_crm_waitlist");
      if (waitlistData) workflowData.waitlist = JSON.parse(waitlistData);

      const queueActivityData = localStorage.getItem("clinic_crm_queue_activity");
      if (queueActivityData) workflowData.queueActivity = JSON.parse(queueActivityData);

      const consultationActivityData = localStorage.getItem("clinic_crm_consultation_activity");
      if (consultationActivityData) workflowData.consultationActivity = JSON.parse(consultationActivityData);

      const prescriptionActivityData = localStorage.getItem("clinic_crm_prescription_activity");
      if (prescriptionActivityData) workflowData.prescriptionActivity = JSON.parse(prescriptionActivityData);

      const labActivityData = localStorage.getItem("clinic_crm_lab_activity");
      if (labActivityData) workflowData.labActivity = JSON.parse(labActivityData);

      const billingActivityData = localStorage.getItem("clinic_crm_billing_activity");
      if (billingActivityData) workflowData.billingActivity = JSON.parse(billingActivityData);
    } catch (error) {
      console.error("Error reading workflow data for integrity scan:", error);
      setFeedback({ message: "Error reading workflow data for integrity scan", type: "error" });
      setIsScanning(false);
      return;
    }

    // Run integrity scan
    try {
      const result = scanWorkflowIntegrity(workflowData);
      setIntegrityResult(result);

      // Phase 8F: Log scan execution safely
      logWorkflowAction({
        action: "workflow_integrity_scan",
        module: "system",
        resourceType: "system",
        resourceId: "integrity-scan",
        success: true,
        metadata: {
          totalIssues: result.summary.totalIssues,
          critical: result.summary.critical,
          high: result.summary.high,
          medium: result.summary.medium,
          low: result.summary.low,
          scannedModules: result.summary.scannedModules,
          scanDuration: result.summary.scanDuration,
          performedBy: normalizedRole,
        },
      });

      setFeedback({
        message: `Integrity scan complete: ${result.summary.totalIssues} issues found (${result.summary.critical} critical, ${result.summary.high} high)`,
        type: result.summary.critical > 0 ? "error" : "success",
      });
    } catch (error) {
      console.error("Error running integrity scan:", error);
      setFeedback({ message: "Error running integrity scan", type: "error" });
    } finally {
      setIsScanning(false);
    }
  };

  // Phase 10B: Handle legacy PHI/PII log scan
  const handleLegacyScan = () => {
    if (!canRunLegacyScan) {
      handleDeniedAccess("run", "legacy PHI scan");
      return;
    }

    setIsLegacyScanning(true);
    setFeedback(null);
    setLegacyScanResult(null);

    try {
      // Scan all log sources for sensitive fields
      const scanResult = scanAllKnownLogSources();
      setLegacyScanResult(scanResult);
      
      // Phase 10B: Log scan execution (PHI-safe)
      logAdminOperation({
        action: "scan",
        module: "privacy",
        resourceType: "legacy_logs",
        count: scanResult.totalEntries,
        metadata: { riskyRecords: scanResult.riskyRecords, sources: scanResult.scannedModules },
        actor: normalizedRole,
        role: normalizedRole,
      });
      
      setFeedback({ message: `Legacy scan completed: ${scanResult.riskyRecords} risky records found`, type: "success" });
    } catch (error) {
      console.error("Error running legacy scan:", error);
      setFeedback({ message: "Error running legacy scan", type: "error" });
    } finally {
      setIsLegacyScanning(false);
    }
  };

  // Phase 10B: Handle redaction preview
  const handleRedactionPreview = () => {
    if (!legacyScanResult) {
      setFeedback({ message: "Run legacy scan first", type: "error" });
      return;
    }

    try {
      const preview = previewSanitization(legacyScanResult.rawLogs || []);
      setRedactionPreview(preview);
      setFeedback({ message: "Redaction preview generated", type: "success" });
    } catch (error) {
      console.error("Error generating redaction preview:", error);
      setFeedback({ message: "Error generating redaction preview", type: "error" });
    }
  };

  // Phase 10B: Handle legacy log redaction execution
  const handleRedactionExecute = () => {
    if (!canRunLegacyScan) {
      handleDeniedAccess("execute", "legacy log redaction");
      return;
    }

    // Require typed confirmation
    setTypedConfirm({
      requiredText: "REDACT LEGACY LOGS",
      onConfirm: () => {
        if (!legacyScanResult) {
          setFeedback({ message: "Run legacy scan first", type: "error" });
          setTypedConfirm(null);
          setTypedValue("");
          return;
        }

        try {
          let totalRedacted = 0;
          const sourcesAffected: string[] = [];

          // Redact each log source
          if (legacyScanResult.auditLogs && legacyScanResult.auditLogs.length > 0) {
            const sanitized = legacyScanResult.auditLogs.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("clinic_crm_audit", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("audit_logs");
          }

          if (legacyScanResult.adminAuditLogs && legacyScanResult.adminAuditLogs.length > 0) {
            const sanitized = legacyScanResult.adminAuditLogs.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("admin_audit", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("admin_audit");
          }

          if (legacyScanResult.securityEvents && legacyScanResult.securityEvents.length > 0) {
            const sanitized = legacyScanResult.securityEvents.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("clinic_crm_security_events", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("security_events");
          }

          if (legacyScanResult.deniedActions && legacyScanResult.deniedActions.length > 0) {
            const sanitized = legacyScanResult.deniedActions.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("clinic_crm_denied_actions", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("denied_actions");
          }

          if (legacyScanResult.staffActivity && legacyScanResult.staffActivity.length > 0) {
            const sanitized = legacyScanResult.staffActivity.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("clinic_crm_staff_activity", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("staff_activity");
          }

          if (legacyScanResult.communicationActivity && legacyScanResult.communicationActivity.length > 0) {
            const sanitized = legacyScanResult.communicationActivity.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("clinic_crm_communication_activity", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("communication_activity");
          }

          if (legacyScanResult.queueActivity && legacyScanResult.queueActivity.length > 0) {
            const sanitized = legacyScanResult.queueActivity.map((log: any) => sanitizeLogEntry(log));
            localStorage.setItem("clinic_crm_queue_activity", JSON.stringify(sanitized));
            totalRedacted += sanitized.filter((l: any) => l._redacted).length;
            sourcesAffected.push("queue_activity");
          }

          // Phase 10B: Log redaction action (PHI-safe)
          logAdminOperation({
            action: "redact",
            module: "privacy",
            resourceType: "legacy_logs",
            count: totalRedacted,
            metadata: { sources: sourcesAffected },
            actor: normalizedRole,
            role: normalizedRole,
          });

          setFeedback({ message: `Redacted ${totalRedacted} entries across ${sourcesAffected.length} sources`, type: "success" });
          setLegacyScanResult(null);
          setRedactionPreview(null);
        } catch (error) {
          console.error("Error executing redaction:", error);
          setFeedback({ message: "Error executing redaction", type: "error" });
        } finally {
          setTypedConfirm(null);
          setTypedValue("");
        }
      },
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      {feedback && (
        <Feedback
          message={feedback.message}
          type={feedback.type}
          onClose={() => setFeedback(null)}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Audit & Security
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Real-time audit logs and security event tracking (localStorage-backed)
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Audit Logs" value={logs.length} color="var(--blue)" icon="ti-file-text" bg="var(--blue-bg)" />
        <StatCard label="Security Events" value={events.length} color="var(--purple)" icon="ti-shield-exclamation" bg="var(--purple-bg)" />
        <StatCard label="Unresolved Events" value={events.filter(e => !e.resolved).length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="High Severity" value={events.filter(e => e.severity === "high" || e.severity === "critical").length} color="var(--amber)" icon="ti-alert-circle" bg="var(--amber-bg)" />
        <StatCard label="Resolved Events" value={events.filter(e => e.resolved).length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={handleRefresh}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--fg)",
            cursor: "pointer",
            fontSize: "var(--font-sm)",
          }}
        >
          <i className="ti ti-refresh" style={{ marginRight: 4 }} /> Refresh
        </button>
        {hasRole(normalizedRole, ["admin"]) && (
          <button
            onClick={() => setShowSeedConfirm(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--fg)",
              cursor: "pointer",
              fontSize: "var(--font-sm)",
            }}
          >
            <i className="ti ti-database" style={{ marginRight: 4 }} /> Seed Demo Logs
          </button>
        )}
        {activeTab === "audit" && (
          <>
            {canExportAuditLogs && (
              <button
                onClick={handleExportAudit}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: "var(--accent)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "var(--font-sm)",
                }}
              >
                <i className="ti ti-download" style={{ marginRight: 4 }} /> Export Audit Logs
              </button>
            )}
            {canClearAuditLogs && (
              <button
                onClick={() => setShowClearAuditConfirm(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  border: "1px solid #ef4444",
                  backgroundColor: "transparent",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "var(--font-sm)",
                }}
              >
                <i className="ti ti-trash" style={{ marginRight: 4 }} /> Clear Audit Logs
              </button>
            )}
          </>
        )}
        {activeTab === "security" && (
          <>
            {canExportSecurityEvents && (
              <button
                onClick={handleExportSecurity}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: "var(--accent)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "var(--font-sm)",
                }}
              >
                <i className="ti ti-download" style={{ marginRight: 4 }} /> Export Security Events
              </button>
            )}
            {canClearSecurityEvents && (
              <button
                onClick={() => setShowClearSecurityConfirm(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  border: "1px solid #ef4444",
                  backgroundColor: "transparent",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "var(--font-sm)",
                }}
              >
                <i className="ti ti-trash" style={{ marginRight: 4 }} /> Clear Security Events
              </button>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "audit"} onClick={() => setActiveTab("audit")}>Audit Logs</TabButton>
          <TabButton active={activeTab === "security"} onClick={() => setActiveTab("security")}>Security Events</TabButton>
          {canRunIntegrityScan && (
            <TabButton active={activeTab === "integrity"} onClick={() => setActiveTab("integrity")}>Workflow Integrity</TabButton>
          )}
          {canRunLegacyScan && (
            <TabButton active={activeTab === "privacy"} onClick={() => setActiveTab("privacy")}>Legacy PHI Scan</TabButton>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "audit" && (
        <AuditLogList
          logs={logs}
          onDelete={canDeleteAuditEvent ? deleteLog : undefined}
          onExport={canExportAuditLogs ? handleExportAudit : undefined}
          onClear={canClearAuditLogs ? () => setShowClearAuditConfirm(true) : undefined}
        />
      )}

      {activeTab === "security" && (
        <SecurityEvents
          events={events}
          onResolve={resolveEvent}
          onReopen={reopenEvent}
          onDelete={canDeleteSecurityEvent ? deleteEvent : undefined}
          onExport={canExportSecurityEvents ? handleExportSecurity : undefined}
          onClear={canClearSecurityEvents ? () => setShowClearSecurityConfirm(true) : undefined}
        />
      )}

      {/* Phase 8F: Workflow Integrity Tab */}
      {activeTab === "integrity" && (
        <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: 16 }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Workflow Integrity Scan</h2>
            <button
              onClick={handleIntegrityScan}
              disabled={isScanning}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius)",
                border: "none",
                backgroundColor: isScanning ? "var(--muted)" : "var(--accent)",
                color: "white",
                cursor: isScanning ? "not-allowed" : "pointer",
                fontSize: "var(--font-sm)",
              }}
            >
              <i className="ti ti-scan" style={{ marginRight: 4 }} /> {isScanning ? "Scanning..." : "Run Scan"}
            </button>
          </div>

          {integrityResult ? (
            <>
              {/* Summary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
                <StatCard label="Total Issues" value={integrityResult.summary.totalIssues} color="var(--blue)" icon="ti-alert-circle" bg="var(--blue-bg)" />
                <StatCard label="Critical" value={integrityResult.summary.critical} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
                <StatCard label="High" value={integrityResult.summary.high} color="var(--orange)" icon="ti-alert-circle" bg="var(--orange-bg)" />
                <StatCard label="Medium" value={integrityResult.summary.medium} color="var(--amber)" icon="ti-info-circle" bg="var(--amber-bg)" />
                <StatCard label="Low" value={integrityResult.summary.low} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
              </div>

              {/* Module Breakdown */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Module Breakdown</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {Object.entries(integrityResult.byModule).map(([module, stats]) => (
                    <div key={module} style={{ background: "var(--surface2)", padding: 12, borderRadius: "var(--radius)" }}>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>{module}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        Total: {stats.total} | Critical: {stats.critical} | High: {stats.high}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {integrityResult.recommendations.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Recommendations</h3>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: "var(--font-sm)" }}>
                    {integrityResult.recommendations.map((rec, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top Issues Table */}
              <div>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Top Issues</h3>
                {integrityResult.issues.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: "var(--font-sm)" }}>No issues detected.</div>
                ) : (
                  <div style={{ maxHeight: 400, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-xs)" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th style={{ textAlign: "left", padding: 8 }}>Severity</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Module</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Resource ID</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Patient ID</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Category</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {integrityResult.issues.slice(0, 50).map((issue, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: 8 }}>
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: "var(--radius)",
                                fontSize: "var(--font-xs)",
                                background: issue.severity === "critical" ? "var(--red-bg)" : issue.severity === "high" ? "var(--orange-bg)" : issue.severity === "medium" ? "var(--amber-bg)" : "var(--green-bg)",
                                color: issue.severity === "critical" ? "var(--red)" : issue.severity === "high" ? "var(--orange)" : issue.severity === "medium" ? "var(--amber)" : "var(--green)",
                              }}>
                                {issue.severity}
                              </span>
                            </td>
                            <td style={{ padding: 8 }}>{issue.module}</td>
                            <td style={{ padding: 8, fontFamily: "monospace" }}>{issue.resourceId}</td>
                            <td style={{ padding: 8, fontFamily: "monospace" }}>{issue.patientId || "-"}</td>
                            <td style={{ padding: 8 }}>{issue.category}</td>
                            <td style={{ padding: 8 }}>{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {integrityResult.issues.length > 50 && (
                      <div style={{ marginTop: 8, fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        Showing first 50 of {integrityResult.issues.length} issues
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: "var(--font-sm)" }}>
              Click "Run Scan" to check workflow data integrity. This scan detects orphaned records, timestamp issues, invalid statuses, and PHI risks without mutating data.
            </div>
          )}
        </div>
      )}

      {/* Phase 10B: Legacy PHI Scan Tab */}
      {activeTab === "privacy" && (
        <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: 16 }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>Legacy PHI/PII Log Scan</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleLegacyScan}
                disabled={isLegacyScanning}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: isLegacyScanning ? "var(--muted)" : "var(--accent)",
                  color: "white",
                  cursor: isLegacyScanning ? "not-allowed" : "pointer",
                  fontSize: "var(--font-sm)",
                }}
              >
                <i className="ti ti-scan" style={{ marginRight: 4 }} /> {isLegacyScanning ? "Scanning..." : "Run Scan"}
              </button>
              {legacyScanResult && (
                <>
                  <button
                    onClick={handleRedactionPreview}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface)",
                      color: "var(--fg)",
                      cursor: "pointer",
                      fontSize: "var(--font-sm)",
                    }}
                  >
                    <i className="ti ti-eye" style={{ marginRight: 4 }} /> Preview Redaction
                  </button>
                  <button
                    onClick={handleRedactionExecute}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--radius)",
                      border: "1px solid #ef4444",
                      backgroundColor: "transparent",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "var(--font-sm)",
                    }}
                  >
                    <i className="ti ti-shield-lock" style={{ marginRight: 4 }} /> Redact Logs
                  </button>
                </>
              )}
            </div>
          </div>

          {legacyScanResult ? (
            <>
              {/* Summary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                <StatCard label="Total Entries" value={legacyScanResult.totalEntries} color="var(--blue)" icon="ti-file-text" bg="var(--blue-bg)" />
                <StatCard label="Risky Records" value={legacyScanResult.riskyRecords} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
                <StatCard label="Safe Entries" value={legacyScanResult.safeEntries} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
                <StatCard label="Sources Scanned" value={legacyScanResult.scannedModules.length} color="var(--purple)" icon="ti-database" bg="var(--purple-bg)" />
              </div>

              {/* Risky Fields */}
              {legacyScanResult.riskyFields.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Risky Fields Found</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                    {legacyScanResult.riskyFields.map((field: any, idx: number) => (
                      <div key={idx} style={{ background: "var(--surface2)", padding: 12, borderRadius: "var(--radius)" }}>
                        <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>{field.fieldName}</div>
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                          Count: {field.count} | Module: {field.module}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources Scanned */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Sources Scanned</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {legacyScanResult.scannedModules.map((module: string, idx: number) => (
                    <span key={idx} style={{
                      padding: "4px 8px",
                      borderRadius: "var(--radius)",
                      fontSize: "var(--font-xs)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}>
                      {module}
                    </span>
                  ))}
                </div>
              </div>

              {/* Redaction Preview */}
              {redactionPreview && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600, marginBottom: 8 }}>Redaction Preview</h3>
                  <div style={{ background: "var(--surface2)", padding: 12, borderRadius: "var(--radius)" }}>
                    <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>
                      <strong>Entries to Redact:</strong> {redactionPreview.totalToRedact}
                    </div>
                    <div style={{ fontSize: "var(--font-sm)", marginBottom: 8 }}>
                      <strong>Fields to Redact:</strong> {redactionPreview.fieldsToRedact.join(", ")}
                    </div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      Note: This preview shows counts only. No sensitive values are displayed.
                    </div>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div style={{ background: "var(--amber-bg)", padding: 12, borderRadius: "var(--radius)", marginBottom: 16 }}>
                <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, color: "var(--amber)" }}>
                  ⚠️ Important Notes
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: "var(--font-sm)", color: "var(--fg)" }}>
                  <li>Frontend localStorage audit cannot be truly immutable</li>
                  <li>Redaction replaces sensitive values with "[REDACTED]"</li>
                  <li>IDs, timestamps, and non-sensitive metadata are preserved</li>
                  <li>This action cannot be undone</li>
                  <li>Backend implementation required for true audit immutability</li>
                </ul>
              </div>
            </>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: "var(--font-sm)" }}>Click "Run Scan" to check legacy logs for PHI/PII fields.</div>
          )}
        </div>
      )}

      {/* Seed Demo Confirmation */}
      <ConfirmDialog
        isOpen={showSeedConfirm}
        onClose={() => setShowSeedConfirm(false)}
        onConfirm={handleSeedDemo}
        title="Seed Demo Logs"
        message="This will add demo audit logs and security events to localStorage. These are clearly labeled as local/demo data. Continue?"
        confirmText="Seed Demo"
        cancelText="Cancel"
      />

      {/* Clear Audit Logs Confirmation */}
      <ConfirmDialog
        isOpen={showClearAuditConfirm}
        onClose={() => setShowClearAuditConfirm(false)}
        onConfirm={() => { setShowClearAuditConfirm(false); setTypedConfirm({ requiredText: "CLEAR AUDIT LOGS", onConfirm: handleClearAudit }); }}
        title="Clear All Audit Logs"
        message="This will permanently delete all audit logs. Type confirmation required."
        confirmText="Continue to Typed Confirmation"
        cancelText="Cancel"
        danger
      />

      {/* Clear Security Events Confirmation */}
      <ConfirmDialog
        isOpen={showClearSecurityConfirm}
        onClose={() => setShowClearSecurityConfirm(false)}
        onConfirm={() => { setShowClearSecurityConfirm(false); setTypedConfirm({ requiredText: "CLEAR SECURITY EVENTS", onConfirm: handleClearSecurity }); }}
        title="Clear All Security Events"
        message="This will permanently delete all security events. Type confirmation required."
        confirmText="Continue to Typed Confirmation"
        cancelText="Cancel"
        danger
      />

      {/* Phase 9E: Typed confirmation modal for dangerous actions */}
      {typedConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setTypedConfirm(null); setTypedValue(""); } }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 12 }}>
              Confirm Dangerous Action
            </div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>
              This action is irreversible. Type <strong>"{typedConfirm.requiredText}"</strong> to confirm.
            </div>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={`Type "${typedConfirm.requiredText}"`}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                fontSize: "var(--font-sm)",
                fontFamily: "monospace",
                marginBottom: 16,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setTypedConfirm(null); setTypedValue(""); }}
                style={{ fontSize: "var(--font-sm)" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (typedValue === typedConfirm.requiredText) {
                    typedConfirm.onConfirm();
                  } else {
                    setFeedback({ message: "Confirmation text does not match.", type: "error" });
                  }
                }}
                disabled={typedValue !== typedConfirm.requiredText}
                style={{ fontSize: "var(--font-sm)", opacity: typedValue === typedConfirm.requiredText ? 1 : 0.5 }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "var(--radius)",
        border: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--muted)",
        fontSize: "var(--font-sm)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
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

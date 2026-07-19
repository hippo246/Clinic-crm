/**
 * Audit Log List Component
 * Reusable real audit log viewer
 */

import React, { useState } from "react";
import { ConfirmDialog } from "../../../shared/components/feedback/ConfirmDialog";
import { Feedback } from "../../../shared/components/feedback/Feedback";
import type { AuditLogEntry } from "../services/auditService";

interface AuditLogListProps {
  logs: AuditLogEntry[];
  onDelete?: (id: string) => void;
  onExport?: () => void;
  onClear?: () => void;
}

export function AuditLogList({ logs, onDelete, onExport, onClear }: AuditLogListProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [successFilter, setSuccessFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const searchable = `${log.action} ${log.resourceType} ${log.resourceLabel} ${log.userName} ${log.details}`.toLowerCase();
      if (!searchable.includes(searchLower)) return false;
    }
    if (actionFilter && log.action !== actionFilter) return false;
    if (severityFilter && log.severity !== severityFilter) return false;
    if (successFilter === "true" && !log.success) return false;
    if (successFilter === "false" && log.success) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId && onDelete) {
      onDelete(deleteTargetId);
      setFeedback({ message: "Audit log deleted successfully", type: "success" });
    }
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    if (onClear) {
      onClear();
      setFeedback({ message: "All audit logs cleared successfully", type: "success" });
    }
    setShowClearConfirm(false);
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
      setFeedback({ message: "Audit logs exported successfully", type: "success" });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "#ef4444";
      case "high": return "#f97316";
      case "medium": return "#f59e0b";
      case "low": return "#22c55e";
      default: return "#64748b";
    }
  };

  const getSuccessBadge = (success: boolean) => {
    return success
      ? { bg: "#dcfce7", color: "#166534", text: "Success" }
      : { bg: "#fee2e2", color: "#991b1b", text: "Failed" };
  };

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));
  const uniqueSeverities = Array.from(new Set(logs.map((l) => l.severity)));

  if (logs.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
        <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#334155" }}>No Audit Logs</h3>
        <p style={{ margin: 0, fontSize: "14px" }}>
          Real audit logging is now available locally. App-wide wiring comes in the next phase.
        </p>
      </div>
    );
  }

  return (
    <div>
      {feedback && (
        <Feedback
          message={feedback.message}
          type={feedback.type}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "16px",
        flexWrap: "wrap",
        padding: "16px",
        backgroundColor: "var(--surface2)",
        borderRadius: "var(--radius)",
      }}>
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            minWidth: "200px",
            flex: 1,
          }}
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">All Actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">All Severities</option>
          {uniqueSeverities.map((severity) => (
            <option key={severity} value={severity}>{severity}</option>
          ))}
        </select>
        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">All Status</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
        <button
          onClick={handleExport}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            border: "none",
            backgroundColor: "var(--accent)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Export
        </button>
        {onClear && (
          <button
            onClick={handleClear}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--fg)",
              cursor: "pointer",
            }}
          >
            Clear Logs
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--surface2)" }}>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Timestamp</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>User</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Action</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Resource</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Severity</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Details</th>
              {onDelete && <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.map((log) => {
              const successBadge = getSuccessBadge(log.success);
              return (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {log.userName || "System"}
                    {log.userRole && <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "4px" }}>({log.userRole})</span>}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {log.action}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {log.resourceType}
                    {log.resourceLabel && <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "4px" }}>({log.resourceLabel})</span>}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 500,
                      backgroundColor: `${getSeverityColor(log.severity)}20`,
                      color: getSeverityColor(log.severity),
                    }}>
                      {log.severity}
                    </span>
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 500,
                      backgroundColor: successBadge.bg,
                      color: successBadge.color,
                    }}>
                      {successBadge.text}
                    </span>
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)", maxWidth: "300px" }}>
                    {log.details || "-"}
                    {log.errorMessage && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{log.errorMessage}</div>}
                  </td>
                  {onDelete && (
                    <td style={{ padding: "12px" }}>
                      <button
                        onClick={() => handleDelete(log.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #ef4444",
                          backgroundColor: "transparent",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          padding: "12px",
          backgroundColor: "var(--surface2)",
          borderRadius: "var(--radius)",
        }}>
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                backgroundColor: page === 1 ? "var(--surface)" : "var(--accent)",
                color: page === 1 ? "var(--muted)" : "white",
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              Previous
            </button>
            <span style={{ padding: "6px 12px", fontSize: "13px", color: "var(--fg)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                backgroundColor: page === totalPages ? "var(--surface)" : "var(--accent)",
                color: page === totalPages ? "var(--muted)" : "white",
                cursor: page === totalPages ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Audit Log"
        message="Are you sure you want to delete this audit log? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger
      />

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClear}
        title="Clear All Audit Logs"
        message="Are you sure you want to clear all audit logs? This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
        danger
      />
    </div>
  );
}

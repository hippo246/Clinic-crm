/**
 * Security Events Component
 * Reusable real security events viewer
 */

import React, { useState } from "react";
import { ConfirmDialog } from "../../../shared/components/feedback/ConfirmDialog";
import { Feedback } from "../../../shared/components/feedback/Feedback";
import { Modal } from "../../../shared/components/ui/Modal";
import type { SecurityEvent } from "../services/securityService";

interface SecurityEventsProps {
  events: SecurityEvent[];
  onResolve?: (id: string, notes?: string) => void;
  onReopen?: (id: string) => void;
  onDelete?: (id: string) => void;
  onExport?: () => void;
  onClear?: () => void;
}

export function SecurityEvents({ events, onResolve, onReopen, onDelete, onExport, onClear }: SecurityEventsProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [targetEventId, setTargetEventId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const filteredEvents = events.filter((event) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const searchable = `${event.type} ${event.title} ${event.description} ${event.userName} ${event.ipAddress}`.toLowerCase();
      if (!searchable.includes(searchLower)) return false;
    }
    if (typeFilter && event.type !== typeFilter) return false;
    if (severityFilter && event.severity !== severityFilter) return false;
    if (resolvedFilter === "true" && !event.resolved) return false;
    if (resolvedFilter === "false" && event.resolved) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = (id: string) => {
    setTargetEventId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (targetEventId && onDelete) {
      onDelete(targetEventId);
      setFeedback({ message: "Security event deleted successfully", type: "success" });
    }
    setShowDeleteConfirm(false);
    setTargetEventId(null);
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    if (onClear) {
      onClear();
      setFeedback({ message: "All security events cleared successfully", type: "success" });
    }
    setShowClearConfirm(false);
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
      setFeedback({ message: "Security events exported successfully", type: "success" });
    }
  };

  const handleResolve = (id: string) => {
    setTargetEventId(id);
    setResolutionNotes("");
    setShowResolveModal(true);
  };

  const confirmResolve = () => {
    if (targetEventId && onResolve) {
      onResolve(targetEventId, resolutionNotes);
      setFeedback({ message: "Security event resolved successfully", type: "success" });
    }
    setShowResolveModal(false);
    setTargetEventId(null);
    setResolutionNotes("");
  };

  const handleReopen = (id: string) => {
    if (onReopen) {
      onReopen(id);
      setFeedback({ message: "Security event reopened successfully", type: "success" });
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

  const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));
  const uniqueSeverities = Array.from(new Set(events.map((e) => e.severity)));

  if (events.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
        <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#334155" }}>No Security Events</h3>
        <p style={{ margin: 0, fontSize: "14px" }}>
          Real security event logging is now available locally. App-wide wiring comes in the next phase.
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
          placeholder="Search events..."
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
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">All Types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
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
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">All Status</option>
          <option value="true">Resolved</option>
          <option value="false">Unresolved</option>
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
            Clear Events
          </button>
        )}
      </div>

      {/* Events Table */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--surface2)" }}>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Timestamp</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Severity</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Type</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Title</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Description</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>User</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((event) => {
              const isHighCritical = event.severity === "high" || event.severity === "critical";
              return (
                <tr
                  key={event.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: isHighCritical && !event.resolved ? "#fef2f2" : "transparent",
                  }}
                >
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 500,
                      backgroundColor: `${getSeverityColor(event.severity)}20`,
                      color: getSeverityColor(event.severity),
                    }}>
                      {event.severity}
                    </span>
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {event.type}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)", fontWeight: isHighCritical ? 600 : 400 }}>
                    {event.title}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)", maxWidth: "300px" }}>
                    {event.description}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px", color: "var(--fg)" }}>
                    {event.userName || "System"}
                    {event.userRole && <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "4px" }}>({event.userRole})</span>}
                  </td>
                  <td style={{ padding: "12px", fontSize: "13px" }}>
                    {event.resolved ? (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                      }}>
                        Resolved
                      </span>
                    ) : (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: "#fee2e2",
                        color: "#991b1b",
                      }}>
                        Unresolved
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {!event.resolved && onResolve && (
                        <button
                          onClick={() => handleResolve(event.id)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #22c55e",
                            backgroundColor: "transparent",
                            color: "#22c55e",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Resolve
                        </button>
                      )}
                      {event.resolved && onReopen && (
                        <button
                          onClick={() => handleReopen(event.id)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #f59e0b",
                            backgroundColor: "transparent",
                            color: "#f59e0b",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Reopen
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => handleDelete(event.id)}
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
                      )}
                    </div>
                  </td>
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
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredEvents.length)} of {filteredEvents.length}
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
        title="Delete Security Event"
        message="Are you sure you want to delete this security event? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger
      />

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClear}
        title="Clear All Security Events"
        message="Are you sure you want to clear all security events? This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
        danger
      />

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title="Resolve Security Event"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowResolveModal(false)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--fg)",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmResolve}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius)",
                border: "none",
                backgroundColor: "#22c55e",
                color: "white",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Resolve
            </button>
          </>
        }
      >
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--fg)" }}>
            Resolution Notes (optional)
          </label>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Add notes about how this event was resolved..."
            rows={4}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              fontSize: "13px",
              resize: "vertical",
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

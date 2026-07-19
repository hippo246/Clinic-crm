import React, { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import type { Patient, AuditEntry, UserRole } from "./types";
import GlobalStyles from "./GlobalStyles";
import { ToastProvider, useToast } from "./Toast";
import { getInitialPatients } from "./mockData";
import { apiClient } from "./api";
import { listPatients as listPatientsService, getPatient, createPatient as createPatientService, updatePatient as updatePatientService } from "../services/patientService";
import { isApiMode } from "../utils/apiModeHelper";
import {
  getPatientStats,
  createAuditEntry,
  addAuditEntry,
  savePatients,
  loadPatients,
  saveAuditMap,
  loadAuditMap,
  fmtDate,
} from "./utils";
import { Notifications } from "./components/Notifications";
import { logAccess } from "../shared/services/auditLogger";
import { logDeniedAction } from "../shared/services/deniedActionLogger";
import { logAdminOperation } from "../shared/services/adminAudit";
import { ROLES, ROLE_LABELS, normalizeRole, getDeniedMessage } from "../shared/permissions/permissions";

// ─── Tab Permission Map (Phase 6B) ─────────────────────────────────────────────
// Maps tabs to allowed roles based on intended access model
const TAB_PERMISSIONS: Record<NavTab, UserRole[]> = {
  dashboard:     ["admin", "doctor"],
  queue:         ["admin", "doctor", "nurse", "receptionist"],
  appointments:  ["admin", "doctor", "nurse", "receptionist"],
  consultations: ["admin", "doctor", "nurse"],
  prescriptions: ["admin", "doctor"],
  lab:           ["admin", "doctor", "nurse"],
  billing:       ["admin", "billing", "receptionist"],
  documents:     ["admin", "doctor", "nurse", "receptionist", "readonly"],
  communications:["admin", "doctor", "nurse", "receptionist"],
  reports:       ["admin", "auditor", "doctor"],
  staff:         ["admin"],
  settings:      ["admin"],
  audit:         ["admin", "auditor"],
  patients:      ["admin", "doctor", "nurse", "receptionist", "billing", "auditor", "readonly"],
};

// Helper to check if a role can access a tab
function canAccessTab(tab: NavTab, role: UserRole): boolean {
  return TAB_PERMISSIONS[tab]?.includes(role) || false;
}

// Helper to get first allowed tab for a role
function getFirstAllowedTab(role: UserRole): NavTab {
  // Prefer dashboard if allowed
  if (canAccessTab("dashboard", role)) return "dashboard";
  // Otherwise patients if allowed
  if (canAccessTab("patients", role)) return "patients";
  // Otherwise first allowed tab
  for (const tab of NAV_TABS) {
    if (canAccessTab(tab.id, role)) return tab.id;
  }
  // Fallback to dashboard (will show denied access)
  return "dashboard";
}

// ─── Denied Access Helper (Phase 6B → 6D) ─────────────────────────────────────────────
// Now uses shared denied-action logger for consistent security logging
interface DenyAccessOptions {
  reason: string;
  target?: string;
  role?: UserRole;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

function denyAccess(options: DenyAccessOptions): void {
  const { reason, target, role, showToast } = options;
  
  // Show feedback if toast function provided
  if (showToast) {
    showToast(`Access denied: ${reason}`, "error");
  }
  
  // Log denied access attempt using shared denied-action logger
  logDeniedAction({
    role: role?.toString(),
    action: "tab_access",
    resource: target || "system",
    reason,
    severity: "medium",
  });
}

// ─── Lazy page imports — only loaded when the tab is first visited ─────────────
const PatientList      = lazy(() => import("./PatientList"));
const PatientProfile   = lazy(() => import("./PatientProfile"));
const PatientForm      = lazy(() => import("./PatientForm"));
const Dashboard        = lazy(() => import("./Dashboard"));
const QueuePage        = lazy(() => import("./Queue"));
const AppointmentsPage = lazy(() => import("./StubPages").then((m) => ({ default: m.AppointmentsPage })));
const ConsultationsPage = lazy(() => import("./Consultations"));
const PrescriptionsPage = lazy(() => import("./Prescriptions"));
const BillingPage      = lazy(() => import("./Billing"));
const LabPage          = lazy(() => import("./Lab"));
const DocumentsPage    = lazy(() => import("./Documents"));
const CommunicationsPage = lazy(() => import("./Communications"));
const ReportsPage      = lazy(() => import("./Reports"));
const StaffPage        = lazy(() => import("./Staff"));
const SettingsPage     = lazy(() => import("./Settings"));
const AuditPage        = lazy(() => import("./Audit"));

// ─── Nav Tabs ─────────────────────────────────────────────────────────────────
const NAV_TABS = [
  { id: "dashboard",     label: "Dashboard",     icon: "ti-layout-dashboard" },
  { id: "queue",         label: "Queue",         icon: "ti-users-group" },
  { id: "appointments",  label: "Appointments",  icon: "ti-calendar" },
  { id: "consultations", label: "Consultations", icon: "ti-stethoscope" },
  { id: "prescriptions", label: "Prescriptions", icon: "ti-pill" },
  { id: "lab",           label: "Lab",           icon: "ti-test-tube" },
  { id: "billing",       label: "Billing",       icon: "ti-receipt" },
  { id: "documents",     label: "Documents",     icon: "ti-files" },
  { id: "communications",label: "Communications",icon: "ti-message" },
  { id: "reports",       label: "Reports",       icon: "ti-chart-bar" },
  { id: "staff",         label: "Staff",         icon: "ti-user-shield" },
  { id: "settings",      label: "Settings",      icon: "ti-settings" },
  { id: "audit",         label: "Audit",         icon: "ti-shield-lock" },
  { id: "patients",      label: "Patients",      icon: "ti-users" },
] as const;
type NavTab = typeof NAV_TABS[number]["id"];

const CURRENT_USER = { name: "Dr. Admin", role: "admin" as UserRole };

// ─── App connection/status types ──────────────────────────────────────────────
// Backend wiring is still in progress, so getMode/getAuthStatus/healthCheck are
// typed here as optional on top of apiClient — this lets App.tsx feature-detect
// them at runtime without requiring any changes to api.ts. If they're missing
// or throw, the app simply reports "local" and keeps working off localStorage.
type ApiMode = "local" | "backend" | string;
interface AuthStatusResult {
  hasFirebaseToken?: boolean;
  firebaseToken?: string | null;
  token?: string | null;
}
type ApiClientWithStatus = typeof apiClient & {
  getMode?: () => ApiMode | Promise<ApiMode>;
  getAuthStatus?: () => AuthStatusResult | Promise<AuthStatusResult> | null | Promise<AuthStatusResult | null>;
  healthCheck?: () => unknown | Promise<unknown>;
};

// ─── Load initial data ────────────────────────────────────────────────────────
async function getPatients(): Promise<Patient[]> {
  if (isApiMode()) {
    try {
      const response = await listPatientsService();
      return response.data;
    } catch (error) {
      console.error('Failed to load patients from API:', error);
      throw error; // Do not silently fall back to localStorage in API mode
    }
  } else {
    const saved = await loadPatients();
    if (saved && saved.length > 0) return saved;
    return getInitialPatients();
  }
}

// ─── Lazy-load fallback ───────────────────────────────────────────────────────
function AppPageFallback() {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, color: "var(--muted)", fontSize: "var(--font-sm)",
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "10px 18px",
      }}>
        <i className="ti ti-loader-2" style={{ fontSize: 16, animation: "spin 1s linear infinite" }} />
        Loading…
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Denied Access Panel (Phase 6B) ─────────────────────────────────────────────
function DeniedAccessPanel({ tab, onReturn }: { tab: string; onReturn: () => void }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, flexDirection: "column", gap: 16,
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--red-bg)", border: "1px solid var(--red-border)",
      }}>
        <i className="ti ti-lock" style={{ fontSize: 32, color: "var(--red)" }} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Access Denied
        </div>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
          You do not have permission to access <strong>{tab}</strong>. Please contact your administrator if you believe this is an error.
        </div>
        <button
          onClick={onReturn}
          style={{
            padding: "8px 16px", borderRadius: "var(--radius)",
            background: "var(--accent)", color: "#fff", border: "none",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Clinic",
    tabs: ["dashboard", "queue", "appointments", "consultations", "prescriptions", "lab"] as NavTab[],
  },
  {
    label: "Admin",
    tabs: ["billing", "documents", "communications", "reports", "patients"] as NavTab[],
  },
  {
    label: "System",
    tabs: ["staff", "settings", "audit"] as NavTab[],
  },
];

function Sidebar({
  dark, activeTab, setActiveTab, stats, userRole, setUserRole, patients, onLogout, setDark, requestConfirm,
}: {
  dark: boolean;
  activeTab: NavTab;
  setActiveTab: (t: NavTab) => void;
  stats: ReturnType<typeof getPatientStats>;
  userRole: UserRole;
  setUserRole: (r: UserRole) => void;
  patients: Patient[];
  onLogout: () => void;
  setDark: (d: boolean) => void;
  requestConfirm: (config: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; isDanger?: boolean; onConfirm: () => void }) => void;
}) {
  // Tablet viewports (between mobile's bottom-nav and desktop's full sidebar) get a
  // collapsed icon-only rail instead of either a 224px sidebar or nothing at all.
  const [railWidth, setRailWidth] = useState<number>(() =>
    typeof window === "undefined" ? 224 : window.innerWidth <= 1024 ? 68 : 224
  );
  useEffect(() => {
    function onResize() { setRailWidth(window.innerWidth <= 1024 ? 68 : 224); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const collapsed = railWidth === 68;
  const urgentCount = stats.followUpDue + stats.insExpiring;

  // Phase 6B: Filter navigation sections based on role permissions
  const filteredNavSections = NAV_SECTIONS.map(section => ({
    ...section,
    tabs: section.tabs.filter(tab => canAccessTab(tab, userRole))
  })).filter(section => section.tabs.length > 0);

  // Phase 6B: Guard tab navigation in sidebar
  const handleNavTabClick = useCallback((tab: NavTab) => {
    if (!canAccessTab(tab, userRole)) {
      // Use a simple alert since we don't have toast access here
      // The main guard in handleSetActiveTab will catch this too
      return;
    }
    setActiveTab(tab);
  }, [userRole, setActiveTab]);

  return (
    <div className="desktop-only qpsb-root" style={{
      width: railWidth, flexShrink: 0,
      background: dark ? "#0d1117" : "#fafbfc",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
      position: "sticky", top: 0, zIndex: 100,
      transition: "width 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      <style>{`
        .qpsb-root .qpsb-link { position: relative; }
        .qpsb-root .qpsb-link:focus-visible {
          outline: 2px solid var(--accent); outline-offset: -2px;
        }
        .qpsb-root .qpsb-link .qpsb-active-bar {
          position: absolute; left: -8px; top: 50%; transform: translateY(-50%);
          width: 3px; height: 0; border-radius: 0 3px 3px 0;
          background: linear-gradient(180deg, #2563eb, #7c3aed);
          transition: height 0.15s ease;
        }
        .qpsb-root .qpsb-link.active .qpsb-active-bar { height: 16px; }
        .qpsb-root .qpsb-link .qpsb-tooltip {
          position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%) scale(0.92);
          background: ${dark ? "#1c2136" : "#111827"}; color: #fff;
          font-size: 11.5px; font-weight: 600; white-space: nowrap;
          padding: 5px 9px; border-radius: 6px;
          opacity: 0; pointer-events: none; transition: opacity 0.12s, transform 0.12s;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25); z-index: 200;
        }
        .qpsb-root .qpsb-link:hover .qpsb-tooltip { opacity: 1; transform: translateY(-50%) scale(1); }
      `}</style>

      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "16px 0 14px" : "16px 16px 14px",
        justifyContent: collapsed ? "center" : "flex-start",
        flexShrink: 0,
        transition: "padding 0.18s ease",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
        }}>
          <i className="ti ti-heart-rate-monitor" style={{ color: "#fff", fontSize: 17 }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.03em", lineHeight: 1.15 }}>ClinicOS</div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.01em", marginTop: 1 }}>Medical Suite</div>
          </div>
        )}
      </div>

      {/* Urgent badge */}
      {urgentCount > 0 && (
        collapsed ? (
          <div className="qpsb-link" style={{ margin: "0 0 6px", display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => setActiveTab("patients")}
              title={`${urgentCount} need attention`}
              style={{
                position: "relative", width: 40, height: 32, border: "none", cursor: "pointer",
                borderRadius: "var(--radius)",
                background: dark ? "rgba(217,119,6,0.14)" : "var(--amber-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <i className="ti ti-alert-triangle" style={{ fontSize: 15, color: "var(--amber)" }} />
              <span style={{
                position: "absolute", top: -3, right: -3,
                minWidth: 15, height: 15, borderRadius: "50%",
                background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${dark ? "#0d1117" : "#fafbfc"}`,
              }}>{urgentCount > 9 ? "9+" : urgentCount}</span>
              <span className="qpsb-tooltip">{urgentCount} need attention</span>
            </button>
          </div>
        ) : (
          <button onClick={() => setActiveTab("patients")} style={{
            display: "flex", alignItems: "center", gap: 7,
            margin: "0 10px 6px", width: "calc(100% - 20px)",
            padding: "7px 10px", borderRadius: "var(--radius)",
            background: dark ? "rgba(217,119,6,0.12)" : "var(--amber-bg)",
            border: "1px solid var(--amber-border)",
            fontSize: 11, fontWeight: 600, color: "var(--amber)",
            cursor: "pointer", textAlign: "left",
            transition: "filter 0.12s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.97)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
          >
            <i className="ti ti-alert-triangle" style={{ fontSize: 13, flexShrink: 0 }} />
            <span>{urgentCount} need attention</span>
          </button>
        )
      )}

      {/* Sectioned nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "4px 10px 8px" : "4px 8px 8px", display: "flex", flexDirection: "column" }}>
        {filteredNavSections.map((section) => (
          <div key={section.label} style={{ marginBottom: 2 }}>
            {!collapsed && (
              <div style={{
                fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.35)",
                padding: "12px 8px 4px",
              }}>
                {section.label}
              </div>
            )}
            {collapsed && <div style={{ height: 1, background: "var(--border)", margin: "10px 0 8px", opacity: 0.6 }} />}
            {section.tabs.map((id) => {
              const tab = NAV_TABS.find((t) => t.id === id)!;
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  className={`qpsb-link${active ? " active" : ""}`}
                  onClick={() => handleNavTabClick(id)}
                  title={collapsed ? tab.label : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "9px 0" : "8px 10px",
                    marginBottom: 1,
                    borderRadius: "var(--radius)",
                    fontSize: 12.5, fontWeight: active ? 600 : 400,
                    cursor: "pointer", border: "none",
                    transition: "background 0.12s, color 0.12s",
                    color: active
                      ? (dark ? "#93b4ff" : "var(--accent)")
                      : "var(--muted)",
                    background: active
                      ? (dark ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.09)")
                      : "transparent",
                    width: "100%", textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)";
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {!collapsed && <span className="qpsb-active-bar" />}
                  <i className={`ti ${tab.icon}`} style={{
                    fontSize: 15, flexShrink: 0,
                    color: active ? (dark ? "#93b4ff" : "var(--accent)") : "var(--muted)",
                    opacity: active ? 1 : 0.7,
                  }} />
                  {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.label}</span>}
                  {collapsed && <span className="qpsb-tooltip">{tab.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: collapsed ? "10px 8px 12px" : "10px 12px 12px",
        borderTop: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 8,
        alignItems: collapsed ? "center" : "stretch",
      }}>
        {/* Role pill */}
        {collapsed ? (
          <div className="qpsb-link" style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 34, height: 28, borderRadius: "var(--radius)",
              background: dark ? "#1c2136" : "var(--surface2)",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
            }}>
              {userRole === "doctor" ? "🩺" : userRole === "admin" ? "🛡" : "👤"}
            </div>
            <span className="qpsb-tooltip" style={{ left: "calc(100% + 6px)" }}>
              {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </span>
          </div>
        ) : (
          <select
            value={userRole}
            onChange={(e) => {
              const next = normalizeRole(e.target.value);
              if (next === userRole) return;
              const selectEl = e.target;
              requestConfirm({
                title: "Switch role?",
                message: `Switch active role to ${ROLE_LABELS[next]}? This changes what you can view and edit. (Demo-only - no real authentication)`,
                confirmLabel: "Switch Role",
                onConfirm: () => {
                  // Phase 10F: Log role switch safely (PHI-safe)
                  try {
                    logAdminOperation({
                      action: "role_switch",
                      module: "app",
                      resourceType: "user_role",
                      metadata: {
                        fromRole: userRole,
                        toRole: next,
                      },
                      actor: userRole,
                      role: userRole,
                    });
                  } catch {
                    // Fail silently
                  }
                  setUserRole(next);
                },
              });
              // Reset the select visually until the user confirms
              selectEl.value = userRole;
            }}
            style={{
              width: "100%", fontSize: 11, padding: "5px 8px",
              borderRadius: "var(--radius)", border: "1px solid var(--border)",
              background: dark ? "#1c2136" : "var(--surface2)",
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role === "receptionist" ? "� " : role === "doctor" ? "🩺 " : role === "nurse" ? "💉 " : role === "billing" ? "💰 " : role === "auditor" ? "📋 " : role === "readonly" ? "👁 " : role === "admin" ? "� " : ""}
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        )}

        {/* Avatar row */}
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
            }} title={CURRENT_USER.name}>
              {CURRENT_USER.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <button className="btn-icon" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}
              style={{ padding: 5, flexShrink: 0 }}>
              <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 13 }} />
            </button>
            <button className="btn-icon" onClick={onLogout} title="Logout"
              style={{ padding: 5, flexShrink: 0, color: "var(--red)", borderColor: "transparent", background: "transparent" }}>
              <i className="ti ti-logout" style={{ fontSize: 13 }} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
            }}>
              {CURRENT_USER.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {CURRENT_USER.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{userRole}</div>
            </div>
            <button className="btn-icon" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}
              style={{ padding: 5, flexShrink: 0 }}>
              <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 13 }} />
            </button>
            <button className="btn-icon" onClick={onLogout} title="Logout"
              style={{ padding: 5, flexShrink: 0, color: "var(--red)", borderColor: "transparent", background: "transparent" }}>
              <i className="ti ti-logout" style={{ fontSize: 13 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Connection / Mode Status Pill ────────────────────────────────────────────
// Small, non-intrusive indicator of whether the app is running purely off
// localStorage ("Local Mode") or talking to a real backend, plus whether a
// Firebase auth token is present. Always degrades to "Local Mode" if the
// underlying apiClient methods are missing or fail — see ApiClientWithStatus.
function ConnectionStatusPill({
  dark, apiMode, backendConnected, hasFirebaseToken, statusLoading,
}: {
  dark: boolean;
  apiMode: ApiMode;
  backendConnected: boolean;
  hasFirebaseToken: boolean;
  statusLoading: boolean;
}) {
  let label = "Local Mode";
  let color = "var(--muted)";

  if (statusLoading) {
    label = "Checking…";
  } else if (apiMode === "backend" || apiMode === "remote") {
    label = backendConnected ? "Backend Connected" : "Backend Offline";
    color = backendConnected ? "var(--green)" : "var(--red)";
  } else if (hasFirebaseToken) {
    label = "Firebase Token";
    color = "var(--accent)";
  }

  return (
    <span
      title={`API mode: ${apiMode}${hasFirebaseToken ? " • Firebase token present" : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10.5, fontWeight: 600, lineHeight: 1,
        padding: "4px 9px", borderRadius: "var(--radius-full)",
        color, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
        border: "1px solid var(--border)", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ─── Content Top Bar ─────────────────────────────────────────────────────────
function ContentTopBar({
  dark, setDark, activeTab, setActiveTab, userRole, setUserRole, patients, onLogout,
  apiMode, backendConnected, hasFirebaseToken, statusLoading, onRefresh, refreshing,
  lastSavedAt, onSearchEnter, searchInputRef,
}: {
  dark: boolean;
  setDark: (d: boolean) => void;
  activeTab: NavTab;
  setActiveTab: (t: NavTab) => void;
  userRole: UserRole;
  setUserRole: (r: UserRole) => void;
  patients: Patient[];
  onLogout: () => void;
  apiMode: ApiMode;
  backendConnected: boolean;
  hasFirebaseToken: boolean;
  statusLoading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  lastSavedAt: Date | null;
  onSearchEnter: (q: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const currentTab = NAV_TABS.find((t) => t.id === activeTab);
  const [searchVal, setSearchVal] = useState("");

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchVal.trim()) {
      onSearchEnter(searchVal.trim());
      setSearchVal("");
    }
  }

  return (
    <div className="desktop-only qptb-root" style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center",
      padding: "0 20px", gap: 10,
      background: dark ? "#0d1117" : "#fafbfc",
      borderBottom: "1px solid var(--border)",
    }}>
      <style>{`
        .qptb-root .qptb-search input::placeholder { color: var(--muted); opacity: 0.85; }
        .qptb-root .qptb-search input:focus {
          background: ${dark ? "rgba(255,255,255,0.07)" : "#ffffff"} !important;
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px ${dark ? "rgba(37,99,235,0.25)" : "rgba(37,99,235,0.13)"} !important;
        }
        .qptb-root .qptb-icon-btn {
          width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius); transition: background 0.12s, color 0.12s;
        }
        .qptb-root .qptb-icon-btn:hover { background: ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}; }
        .qptb-root .qptb-icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .qptb-root .qptb-icon-btn.qptb-spinning i { animation: qptb-spin 0.8s linear infinite; }
        @keyframes qptb-spin { to { transform: rotate(360deg); } }
        .qptb-root .qptb-role-select:hover { background: ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"} !important; }
        .qptb-root .qptb-user-name { transition: opacity 0.15s; }
        /* Tablet compression: keep every control, just tighten and drop secondary text */
        @media (max-width: 1100px) {
          .qptb-root { padding: 0 14px !important; gap: 7px !important; }
          .qptb-root .qptb-search { max-width: 220px !important; }
          .qptb-root .qptb-kbd-hint { display: none !important; }
          .qptb-root .qptb-user-name { display: none !important; }
          .qptb-root .qptb-breadcrumb-label { display: none !important; }
        }
      `}</style>

      {/* Page breadcrumb */}
      <div className="qptb-breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: dark ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.09)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`ti ${currentTab?.icon}`} style={{ fontSize: 13.5, color: "var(--accent)" }} />
        </div>
        <span className="qptb-breadcrumb-label" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
          {currentTab?.label}
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px", flexShrink: 0 }} />

      {/* Search */}
      <div className="qptb-search" style={{ position: "relative", flex: 1, maxWidth: 380, transition: "max-width 0.15s ease" }}>
        <i className="ti ti-search" style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          fontSize: 12, color: "var(--muted)", pointerEvents: "none",
        }} />
        <input
          ref={searchInputRef}
          data-topbar="1"
          type="search"
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search… or press Ctrl+K"
          style={{
            width: "100%", paddingLeft: 30, paddingRight: 36,
            height: 34, fontSize: 12.5,
            background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            boxShadow: "none", color: "var(--text)",
            transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
            boxSizing: "border-box",
          }}
        />
        <kbd className="qptb-kbd-hint" style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          fontSize: 9, padding: "1px 5px", borderRadius: 4,
          background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
          color: "var(--muted)", fontFamily: "monospace", letterSpacing: "0.02em",
          pointerEvents: "none",
        }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Last saved indicator — tiny, non-intrusive */}
      {lastSavedAt && (
        <span style={{
          fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0,
          opacity: 0.75,
        }}>
          Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

      {/* Connection/mode status — small and non-intrusive, never blocks local-mode use */}
      <ConnectionStatusPill
        dark={dark}
        apiMode={apiMode}
        backendConnected={backendConnected}
        hasFirebaseToken={hasFirebaseToken}
        statusLoading={statusLoading}
      />

      {/* Refresh patients */}
      <button
        className={`btn-icon qptb-icon-btn${refreshing ? " qptb-spinning" : ""}`}
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh data"
        style={{ border: "none", background: "transparent" }}
      >
        <i className="ti ti-refresh" style={{ fontSize: 15, color: "var(--muted)" }} />
      </button>

      {/* Notifications */}
      <Notifications patients={patients} />

      {/* Dark toggle */}
      <button className="btn-icon qptb-icon-btn" onClick={() => setDark(!dark)}
        title={dark ? "Light mode" : "Dark mode"}
        style={{ border: "none", background: "transparent" }}>
        <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 16, color: "var(--muted)" }} />
      </button>

      {/* Role badge */}
      <select
        className="qptb-role-select"
        value={userRole}
        onChange={(e) => {
          const next = normalizeRole(e.target.value);
          if (next === userRole) return;
          const selectEl = e.target;
          requestConfirm({
            title: "Switch role?",
            message: `Switch active role to ${ROLE_LABELS[next]}? This changes what you can view and edit. (Demo-only - no real authentication)`,
            confirmLabel: "Switch Role",
            onConfirm: () => {
              // Phase 10F: Log role switch safely (PHI-safe)
              try {
                logAdminOperation({
                  action: "role_switch",
                  module: "app",
                  resourceType: "user_role",
                  metadata: {
                    fromRole: userRole,
                    toRole: next,
                  },
                  actor: userRole,
                  role: userRole,
                });
              } catch {
                // Fail silently
              }
              setUserRole(next);
            },
          });
          // Reset the select visually until the user confirms
          selectEl.value = userRole;
        }}
        style={{
          fontSize: 11, padding: "4px 8px",
          borderRadius: "var(--radius-full)",
          background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
          border: "1px solid var(--border)",
          color: "var(--muted)", cursor: "pointer", height: 28,
          transition: "background 0.12s",
        }}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>

      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, cursor: "default", flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg, #2563eb, #7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff",
          flexShrink: 0,
        }}>
          {CURRENT_USER.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <span className="qptb-user-name" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{CURRENT_USER.name}</span>
      </div>

      {/* Logout */}
      <button className="btn-icon qptb-icon-btn" onClick={onLogout} title="Logout"
        style={{ border: "1px solid transparent", background: "transparent", color: "var(--muted)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--red)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--muted)"; }}>
        <i className="ti ti-logout" style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}

// ─── Mobile Top Bar ───────────────────────────────────────────────────────────
// ContentTopBar above is desktop-only, which silently dropped search and
// notifications from the phone UI entirely (dark mode + logout were relocated
// into the BottomNav "More" sheet separately). This gives phone users a slim
// equivalent: page title, a search trigger, and the notifications bell.
function MobileTopBar({
  dark, activeTab, setActiveTab, patients,
}: {
  dark: boolean;
  activeTab: NavTab;
  setActiveTab: (t: NavTab) => void;
  patients: Patient[];
}) {
  const currentTab = NAV_TABS.find((t) => t.id === activeTab);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchVal.trim()) {
      setActiveTab("patients");
      setTimeout(() => {
        const real = document.querySelector<HTMLInputElement>('input[type="search"]:not([data-mobiletopbar])');
        if (real) { real.value = searchVal; real.focus(); real.dispatchEvent(new Event("input", { bubbles: true })); }
      }, 60);
      setSearchOpen(false);
    }
  }

  return (
    <div className="mobile-only" style={{
      height: 52, flexShrink: 0,
      display: "flex", alignItems: "center",
      padding: "0 14px", gap: 8,
      background: dark ? "#0d1117" : "#fafbfc",
      borderBottom: "1px solid var(--border)",
    }}>
      {searchOpen ? (
        <>
          <div style={{ position: "relative", flex: 1 }}>
            <i className="ti ti-search" style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              fontSize: 12, color: "var(--muted)", pointerEvents: "none",
            }} />
            <input
              data-mobiletopbar="1"
              type="search"
              autoFocus
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search patients…"
              style={{
                width: "100%", paddingLeft: 30, paddingRight: 10,
                height: 36, fontSize: 13,
                background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-full)",
                color: "var(--text)", boxSizing: "border-box",
              }}
            />
          </div>
          <button className="btn-icon" onClick={() => { setSearchOpen(false); setSearchVal(""); }} style={{ flexShrink: 0 }}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: dark ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.09)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <i className={`ti ${currentTab?.icon}`} style={{ fontSize: 13, color: "var(--accent)" }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentTab?.label}
            </span>
          </div>
          <button className="btn-icon" onClick={() => setSearchOpen(true)} title="Search" style={{ flexShrink: 0 }}>
            <i className="ti ti-search" style={{ fontSize: 16, color: "var(--muted)" }} />
          </button>
          <Notifications patients={patients} />
        </>
      )}
    </div>
  );
}

// ─── Bottom Nav (mobile) ──────────────────────────────────────────────────────
const BOTTOM_NAV_TABS: NavTab[] = ["dashboard", "queue", "patients", "billing", "consultations"];

function BottomNav({
  dark, activeTab, setActiveTab, setDark, onLogout, userRole,
}: {
  dark: boolean;
  activeTab: NavTab;
  setActiveTab: (t: NavTab) => void;
  setDark: (d: boolean) => void;
  onLogout: () => void;
  userRole: UserRole;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const isMoreActive = !BOTTOM_NAV_TABS.includes(activeTab as any);

  // Phase 6B: Filter bottom nav tabs based on role permissions
  const filteredBottomNavTabs = BOTTOM_NAV_TABS.filter(tab => canAccessTab(tab, userRole));

  function NavBtn({ id, icon, label, onClick }: { id: string; icon: string; label: string; onClick: () => void }) {
    const active = id === "more" ? (isMoreActive || sheetOpen) : activeTab === id;
    const isPressed = pressed === id;
    return (
      <button
        onPointerDown={() => setPressed(id)}
        onPointerUp={() => setPressed(null)}
        onPointerLeave={() => setPressed(null)}
        onClick={onClick}
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3,
          border: "none", background: "transparent", cursor: "pointer",
          padding: "6px 2px 4px", WebkitTapHighlightColor: "transparent",
          transition: "transform 0.08s ease",
          transform: isPressed ? "scale(0.85)" : "scale(1)",
        }}>
        <div style={{
          width: 48, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 16,
          background: active
            ? (dark ? "rgba(37,99,235,0.22)" : "rgba(37,99,235,0.12)")
            : "transparent",
          transform: active ? "scale(1)" : "scale(0.92)",
          transition: "background 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          <i className={`ti ${icon}`} style={{
            fontSize: 22,
            color: active ? "var(--accent)" : "var(--muted)",
            transition: "color 0.15s",
          }} />
        </div>
        <span style={{
          fontSize: 10, lineHeight: 1, letterSpacing: "0.01em",
          fontWeight: active ? 700 : 500,
          color: active ? "var(--accent)" : "var(--muted)",
          transition: "color 0.15s",
        }}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes qpbn-sheet-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes qpbn-backdrop-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        .qpbn-sheet-item:hover { filter: brightness(${dark ? 1.12 : 0.97}); }
        .qpbn-sheet-item:active { transform: scale(0.95); }
      `}</style>

      {/* Blurred backdrop */}
      {sheetOpen && (
        <div className="mobile-only" onClick={() => setSheetOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 197,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          animation: "qpbn-backdrop-in 0.18s ease",
        }} />
      )}

      {/* More sheet — floating card above nav */}
      {sheetOpen && (
        <div className="mobile-only" style={{
          position: "fixed",
          bottom: "calc(76px + env(safe-area-inset-bottom))",
          left: 12, right: 12,
          background: dark ? "#16192a" : "#ffffff",
          borderRadius: 22,
          border: `1px solid ${dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)"}`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.1)",
          zIndex: 198, overflow: "hidden",
          animation: "qpbn-sheet-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)" }} />
          </div>
          <div style={{ padding: "8px 14px 16px" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
              paddingBottom: 10, paddingLeft: 2,
            }}>Pages</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {NAV_TABS.filter((t) => !BOTTOM_NAV_TABS.includes(t.id as any) && t.id !== "settings" && t.id !== "audit" && canAccessTab(t.id, userRole)).map(({ id, label, icon }) => {
                const active = activeTab === id;
                return (
                  <button key={id} className="qpbn-sheet-item" onClick={() => { setActiveTab(id); setSheetOpen(false); }}
                    style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 6,
                      padding: "14px 4px 12px",
                      borderRadius: 16, border: "none",
                      fontSize: 10.5, fontWeight: active ? 700 : 500,
                      color: active ? "var(--accent)" : "var(--muted)",
                      background: active
                        ? (dark ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.09)")
                        : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                      cursor: "pointer", minHeight: 74,
                      transition: "background 0.12s, transform 0.1s, filter 0.12s",
                      WebkitTapHighlightColor: "transparent",
                    }}>
                    <i className={`ti ${icon}`} style={{ fontSize: 24, color: active ? "var(--accent)" : "var(--muted)" }} />
                    <span style={{ textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>{label}</span>
                  </button>
                );
              })}
            </div>
            {/* System row — smaller, separated, desktop-intent pages accessible but de-emphasised */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["settings", "audit"] as NavTab[]).filter(id => canAccessTab(id, userRole)).map((id) => {
                const tab = NAV_TABS.find((t) => t.id === id)!;
                const active = activeTab === id;
                return (
                  <button key={id} className="qpbn-sheet-item" onClick={() => { setActiveTab(id); setSheetOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 14px", borderRadius: 12, border: "none",
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      color: active ? "var(--accent)" : "var(--muted)",
                      background: active
                        ? (dark ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.09)")
                        : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                      cursor: "pointer",
                      transition: "background 0.12s, filter 0.12s",
                      WebkitTapHighlightColor: "transparent",
                    }}>
                    <i className={`ti ${tab.icon}`} style={{ fontSize: 16, color: active ? "var(--accent)" : "var(--muted)" }} />
                    {tab.label}
                  </button>
                );
              })}
              {/* Dark mode toggle — mirrors the desktop sidebar/topbar control, just relocated here on phone */}
              <button className="qpbn-sheet-item" onClick={() => setDark(!dark)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 12, border: "none",
                  fontSize: 12, fontWeight: 500,
                  color: "var(--muted)",
                  background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  transition: "background 0.12s, filter 0.12s",
                  WebkitTapHighlightColor: "transparent",
                }}>
                <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 16, color: "var(--muted)" }} />
                {dark ? "Light mode" : "Dark mode"}
              </button>
              {/* Logout — only destructive control in the sheet, kept visually distinct in red */}
              <button className="qpbn-sheet-item" onClick={() => { setSheetOpen(false); onLogout(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 12, border: "none",
                  fontSize: 12, fontWeight: 500,
                  color: "var(--red)",
                  background: dark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.07)",
                  cursor: "pointer",
                  transition: "background 0.12s, filter 0.12s",
                  WebkitTapHighlightColor: "transparent",
                }}>
                <i className="ti ti-logout" style={{ fontSize: 16, color: "var(--red)" }} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The bar itself */}
      <div className="mobile-only" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: dark ? "rgba(13,17,23,0.97)" : "rgba(255,255,255,0.97)",
        backdropFilter: "saturate(180%) blur(16px)",
        WebkitBackdropFilter: "saturate(180%) blur(16px)",
        borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
        boxShadow: dark ? "0 -4px 20px rgba(0,0,0,0.35)" : "0 -4px 20px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "stretch",
        height: "calc(76px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 200,
      }}>
        {BOTTOM_NAV_TABS.map((id) => {
          const tab = NAV_TABS.find((t) => t.id === id)!;
          return <NavBtn key={id} id={id} icon={tab.icon} label={tab.label} onClick={() => { setActiveTab(id); setSheetOpen(false); }} />;
        })}
        <NavBtn
          id="more"
          icon={sheetOpen ? "ti-x" : "ti-grid-dots"}
          label={sheetOpen ? "Close" : "More"}
          onClick={() => setSheetOpen((o) => !o)}
        />
      </div>
    </>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({
  stats,
  onFilter,
}: {
  stats: ReturnType<typeof getPatientStats>;
  onFilter: (q: string) => void;
}) {
  const items = [
    { label: "Total",           value: stats.total,          color: "var(--accent)", icon: "ti-users",              query: "" },
    { label: "Active",          value: stats.active,         color: "var(--green)",  icon: "ti-activity",           query: "active" },
    { label: "Follow-Up Due",   value: stats.followUpDue,    color: "var(--amber)",  icon: "ti-clock",              query: "follow-up overdue" },
    { label: "New",             value: stats.newPatients,    color: "#7c3aed",       icon: "ti-user-plus",          query: "new patient" },
    { label: "Ins. Expiring",   value: stats.insExpiring,    color: "var(--red)",    icon: "ti-shield-exclamation", query: "insurance expiring" },
    { label: "Critical Alerts", value: stats.criticalAlerts, color: "var(--red)",    icon: "ti-alert-triangle",     query: "critical" },
  ];

  return (
    <div style={{
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      display: "grid",
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      flexShrink: 0,
    }}>
      {items.map((s, i) => (
        <button
          key={s.label}
          onClick={() => s.query && onFilter(s.query)}
          style={{
            padding: "10px 14px",
            borderRight: i < items.length - 1 ? "1px solid var(--border)" : "none",
            background: "none", border: "none",
            cursor: s.query ? "pointer" : "default",
            textAlign: "left", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { if (s.query) (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
          title={s.query ? `Filter: ${s.label}` : undefined}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <i className={`ti ${s.icon}`} style={{ fontSize: 11, color: s.color }} />
            <span style={{ fontSize: "var(--font-2xs)", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {s.label}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
            {s.value}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Import Wizard (simple inline) ────────────────────────────────────────────
function ImportModal({ onImport, onClose }: {
  onImport: (rows: Partial<Patient>[]) => void;
  onClose: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Partial<Patient>[]>([]);
  const [parsed, setParsed] = useState(false);

  function parseCsv() {
    const lines = csv.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return {
        firstName:     obj.firstname || obj["first name"] || obj.name?.split(" ")[0] || "",
        lastName:      obj.lastname  || obj["last name"]  || obj.name?.split(" ").slice(1).join(" ") || "",
        name:          obj.name || `${obj.firstname || ""} ${obj.lastname || ""}`.trim(),
        phone:         obj.phone || "",
        email:         obj.email || "",
        dob:           obj.dob || obj["date of birth"] || "",
        gender:        obj.gender || "Other",
        bloodGroup:    obj.bloodgroup || obj["blood group"] || "O+",
        doctor:        obj.doctor || "Dr. Sharma",
        insurer:       obj.insurer || obj.insurance || "None",
        address:       obj.address || "",
      } as Partial<Patient>;
    });
    setPreview(rows);
    setParsed(true);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 620 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Import Patients</div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Paste CSV data below</div>
          </div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {!parsed ? (
            <>
              <div style={{
                padding: "12px", borderRadius: "var(--radius)", background: "var(--surface2)",
                border: "1px solid var(--border)", marginBottom: 12,
                fontSize: "var(--font-xs)", color: "var(--muted)", lineHeight: 1.7,
              }}>
                <strong>Expected columns:</strong> name, phone, email, dob, gender, bloodGroup, doctor, insurer, address
                <br />
                <strong>Example:</strong> name,phone,dob,gender<br />Arjun Sharma,+91 9876543210,1985-04-12,Male
              </div>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder="Paste CSV data here…"
                rows={8}
                style={{ width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: "var(--font-xs)" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={parseCsv} disabled={!csv.trim()}>
                  <i className="ti ti-eye" style={{ fontSize: 13 }} /> Preview
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12, fontSize: "var(--font-sm)", color: "var(--muted)" }}>
                Found <strong>{preview.length}</strong> records to import.
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>DOB</th><th>Doctor</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: "var(--font-sm)" }}>{r.name}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{r.phone}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{r.dob}</td>
                        <td style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>{r.doctor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setParsed(false)}>Back</button>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={() => onImport(preview)}>
                  <i className="ti ti-file-import" style={{ fontSize: 13 }} />
                  Import {preview.length} Patients
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const { toast } = useToast();
  const [dark,            setDark]            = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [activeTab,       setActiveTab]       = useState<NavTab>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "dashboard" : "dashboard"
  );
  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formMode,        setFormMode]        = useState<"create" | "edit" | null>(null);
  const [auditMap,        setAuditMap]        = useState<Record<string, AuditEntry[]>>({});
  const [importOpen,      setImportOpen]      = useState(false);
  const [userRole,        setUserRole]        = useState<UserRole>("receptionist");
  const [listSearch,      setListSearch]      = useState("");  // lifted search for stat bar clicks
  const [loading,         setLoading]         = useState(true);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const previousTabRef = useRef<NavTab | null>(null);

  // ── Confirm modal (replaces all window.confirm calls) ────────────────────────
  type ConfirmModalState = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  };
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  const requestConfirm = useCallback((config: ConfirmModalState) => {
    setConfirmModal(config);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmModal(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmModal) return;
    const action = confirmModal.onConfirm;
    setConfirmModal(null);
    action();
  }, [confirmModal]);

  // Phase 6B: Guard tab activation with permission check
  const handleSetActiveTab = useCallback((tab: NavTab) => {
    if (!canAccessTab(tab, userRole)) {
      denyAccess({
        reason: `You do not have permission to access ${NAV_TABS.find(t => t.id === tab)?.label || tab}`,
        target: tab,
        role: userRole,
        showToast: toast,
      });
      return;
    }
    setActiveTab(tab);
  }, [userRole, toast]);

  // Log tab navigation only when it actually changes (Phase 2B)
  useEffect(() => {
    if (previousTabRef.current !== null && previousTabRef.current !== activeTab) {
      const tab = NAV_TABS.find((t) => t.id === activeTab);
      try {
        logAccess({
          resourceType: "system",
          resourceLabel: tab?.label || activeTab,
          details: `Navigated to ${tab?.label || activeTab}`,
        });
      } catch {
        // Fail silently
      }
    }
    previousTabRef.current = activeTab;
  }, [activeTab]);

  // Phase 6B: Safe fallback when role changes - redirect to first allowed tab
  useEffect(() => {
    if (!canAccessTab(activeTab, userRole)) {
      const firstAllowed = getFirstAllowedTab(userRole);
      setActiveTab(firstAllowed);
      toast(`Role changed - redirected to ${NAV_TABS.find(t => t.id === firstAllowed)?.label || firstAllowed}`, "info");
    }
  }, [userRole, toast]);

  // App connection/status — local vs backend vs Firebase. Purely informational;
  // the app keeps working in localStorage mode regardless of what this reports.
  const [apiMode,            setApiMode]            = useState<ApiMode>("local");
  const [backendConnected,   setBackendConnected]   = useState(false);
  const [hasFirebaseToken,   setHasFirebaseToken]   = useState(false);
  const [statusLoading,      setStatusLoading]      = useState(true);
  const [refreshingPatients, setRefreshingPatients] = useState(false);
  const [lastSavedAt,        setLastSavedAt]        = useState<Date | null>(null);
  const topbarSearchRef = useRef<HTMLInputElement | null>(null);

  // ── refreshPatients ──────────────────────────────────────────────────────────
  // Central patient-loading helper. Pass silent=true during mount to suppress
  // toast noise. Pass silent=false (default) when called manually (refresh btn).
  const refreshPatients = useCallback(async (silent = false) => {
    if (!silent) setRefreshingPatients(true);
    try {
      let fresh: Patient[] | null = null;

      // 1. Try localStorage helper first
      try {
        const saved = await loadPatients();
        if (saved && saved.length > 0) fresh = saved;
      } catch { /* fall through */ }

      // 2. Try apiClient if localStorage had nothing
      if (!fresh) {
        try {
          const ac = apiClient as ApiClientWithStatus & { getPatients?: (limit: number, offset: number) => Promise<unknown> };
          if (typeof ac.getPatients === "function") {
            const res = await ac.getPatients(100000, 0);
            if (Array.isArray(res) && res.length > 0) fresh = res as Patient[];
          }
        } catch { /* fall through */ }
      }

      // 3. Ultimate fallback: seed data
      if (!fresh) fresh = getInitialPatients();

      setPatients(fresh);
      setLastSavedAt(new Date());

      // Keep selectedPatient from going stale after a manual refresh
      setSelectedPatient((prev) => {
        if (!prev) return prev;
        const match = fresh!.find((p) => p.id === prev.id);
        return match ?? null;
      });

      if (!silent) toast("Data refreshed", "success");
    } catch (error) {
      console.error("Failed to refresh patients:", error);
      if (!silent) toast("Failed to refresh data", "error");
    } finally {
      if (!silent) setRefreshingPatients(false);
      setLoading(false);
    }
  }, [toast]);

  // Load initial data — silent so no toast on mount
  useEffect(() => {
    refreshPatients(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App connection/status — checks local vs backend vs Firebase on mount.
  // Each call is feature-detected and individually try/caught: if api.ts
  // doesn't implement one of these yet (or it throws), this just falls back
  // to reporting local mode rather than breaking anything.
  useEffect(() => {
    let cancelled = false;
    const ac = apiClient as ApiClientWithStatus;

    async function loadStatus() {
      setStatusLoading(true);

      try {
        const mode = typeof ac.getMode === "function" ? await ac.getMode() : "local";
        if (!cancelled) setApiMode(mode || "local");
      } catch (error) {
        console.error("Failed to read API mode, defaulting to local:", error);
        if (!cancelled) setApiMode("local");
      }

      try {
        const authStatus = typeof ac.getAuthStatus === "function" ? await ac.getAuthStatus() : null;
        if (!cancelled) {
          setHasFirebaseToken(Boolean(authStatus?.hasFirebaseToken ?? authStatus?.firebaseToken ?? authStatus?.token));
        }
      } catch (error) {
        console.error("Failed to read auth status:", error);
        if (!cancelled) setHasFirebaseToken(false);
      }

      try {
        if (typeof ac.healthCheck === "function") {
          await ac.healthCheck();
          if (!cancelled) setBackendConnected(true);
        } else if (!cancelled) {
          setBackendConnected(false);
        }
      } catch (error) {
        console.error("Backend health check failed, treating backend as offline:", error);
        if (!cancelled) setBackendConnected(false);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }

    loadStatus();
    return () => { cancelled = true; };
  }, []);

  // Persist whenever patients or audit changes (now via localStorage)
  useEffect(() => { 
    savePatients(patients);
  }, [patients]);
  useEffect(() => { 
    saveAuditMap(auditMap);
  }, [auditMap]);

  // Keep selectedPatient in sync with patients array.
  // If the patient was deleted, clear selection and go back to the patients list.
  useEffect(() => {
    if (!selectedPatient) return;
    const fresh = patients.find((p) => p.id === selectedPatient.id);
    if (!fresh) {
      setSelectedPatient(null);
      setActiveTab("patients");
    } else if (fresh !== selectedPatient) {
      setSelectedPatient(fresh);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  // On mobile, if the active tab isn't reachable via the bottom nav or the More sheet
  // (i.e. it was set while on desktop then the window was resized), snap back to dashboard.
  // Also runs on mount so a phone-width initial load never lands on a desktop-only default.
  useEffect(() => {
    function snapTabForViewport() {
      if (window.innerWidth < 768) {
        // Settings is desktop-only UX — phone users shouldn't land there by default
        // or via a stale cross-device state. Snap to dashboard.
        setActiveTab((prev) => prev === "settings" ? "dashboard" : prev);
      }
    }
    snapTabForViewport();
    window.addEventListener("resize", snapTabForViewport);
    return () => window.removeEventListener("resize", snapTabForViewport);
  }, []);

  // Ctrl+K / Cmd+K → focus search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setActiveTab("patients");
        setSelectedPatient(null);
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('input[type="search"]');
          input?.focus();
        }, 80);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Extra keyboard shortcuts — only when not typing inside an input/textarea/select
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
    }

    function handler(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // `/` → focus topbar search
      if (e.key === "/" && !isTyping()) {
        e.preventDefault();
        const input =
          topbarSearchRef.current ??
          document.querySelector<HTMLInputElement>('input[data-topbar]') ??
          document.querySelector<HTMLInputElement>('input[type="search"]');
        input?.focus();
        return;
      }

      // `n` → open new patient modal
      if (e.key === "n" && !isTyping()) {
        e.preventDefault();
        setActiveTab("patients");
        setSelectedPatient(null);
        setFormMode("create");
        return;
      }

      // `Escape` → close profile / return to patients list
      if (e.key === "Escape") {
        if (formMode) { setFormMode(null); return; }
        if (selectedPatient) { setSelectedPatient(null); setActiveTab("patients"); return; }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [formMode, selectedPatient]);

  const stats = useMemo(() => getPatientStats(patients), [patients]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelect = useCallback((p: Patient) => {
    setSelectedPatient(p);
    setActiveTab("patients");
  }, []);

  const handleBack = useCallback(() => setSelectedPatient(null), []);

  // Routes Dashboard's quick-action / patient-link clicks to the right tab or patient profile.
  // Dashboard only knows action ids — it has no router or modal system of its own.
  const handleDashboardAction = useCallback((actionId: string) => {
    const [action, patientId] = actionId.split(":");

    // Actions that reference a specific patient (view-patient:<id>, message-patient:<id>, schedule-followup:<id>)
    if (patientId) {
      const patient = patients.find((p) => p.id === patientId);
      if (!patient) {
        toast("Patient not found", "error");
        return;
      }
      switch (action) {
        case "view-patient":
          handleSelect(patient);
          return;
        case "message-patient":
          setActiveTab("communications");
          return;
        case "schedule-followup":
          setActiveTab("queue");
          return;
        default:
          handleSelect(patient);
          return;
      }
    }

    // Tab-level quick actions
    switch (action) {
      case "add-patient":
        handleSetActiveTab("patients");
        setSelectedPatient(null);
        setFormMode("create");
        return;
      case "book-appointment":
        handleSetActiveTab("appointments");
        return;
      case "check-in":
        handleSetActiveTab("queue");
        return;
      case "create-invoice":
      case "collect-payment":
      case "pending-bills":
      case "print-receipt":
        handleSetActiveTab("billing");
        return;
      case "start-consult":
      case "add-note":
        handleSetActiveTab("consultations");
        return;
      case "create-rx":
        handleSetActiveTab("prescriptions");
        return;
      case "view-labs":
        handleSetActiveTab("lab");
        return;
      case "upload-doc":
        handleSetActiveTab("documents");
        return;
      case "send-message":
        handleSetActiveTab("communications");
        return;
      case "view-reports":
        handleSetActiveTab("reports");
        return;
      default:
        toast(`"${action}" isn't wired up yet`, "error");
    }
  }, [patients, handleSelect, toast, handleSetActiveTab]);

  const handleUpdatePatient = useCallback(async (updated: Patient, action = "edited") => {
    // Optimistic local update first
    setPatients((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelectedPatient((prev) => (prev && prev.id === updated.id ? updated : prev));

    try {
      await apiClient.updatePatient(updated.id, updated);
      setLastSavedAt(new Date());
      const entry = createAuditEntry({
        patientId: updated.id,
        message:   `${CURRENT_USER.name} ${action}: ${updated.name}`,
        type:      action,
        user:      CURRENT_USER.name,
      });
      setAuditMap((prev) => addAuditEntry(prev, updated.id, entry));
      // Only toast for explicit manual edits, not silent background updates
      if (action !== "status-change" && action !== "queue-update") {
        toast(`${updated.name} updated`, "success");
      }
    } catch (error) {
      console.error("Failed to persist patient update:", error);
      toast(`Failed to save changes for ${updated.name}`, "error");
    }
  }, [toast]);

  const handleDeletePatient = useCallback(async (id: string) => {
    const p = patients.find((x) => x.id === id);
    requestConfirm({
      title: "Delete patient?",
      message: `Archive ${p ? p.name : "this patient"}'s record? This will mark the patient as archived and can be restored later.`,
      confirmLabel: "Archive Patient",
      isDanger: true,
      onConfirm: async () => {
        try {
          await apiClient.deletePatient(id, CURRENT_USER.name, "Archived via patient management");
          // Reload patients from storage to get updated soft-deleted state (Phase 7C)
          const updated = await apiClient.getPatients();
          setPatients(updated);
          setSelectedPatient((prev) => (prev?.id === id ? null : prev));
          setActiveTab("patients");
          setLastSavedAt(new Date());
          if (p) {
            const entry = createAuditEntry({ patientId: id, message: `${CURRENT_USER.name} archived patient record ${id}`, type: "archived", user: CURRENT_USER.name });
            setAuditMap((prev) => addAuditEntry(prev, id, entry));
            toast(`Patient archived`, "error");
          }
        } catch (error) {
          console.error("Failed to archive patient:", error);
          toast(`Failed to archive patient: ${error}`, "error");
        }
      },
    });
  }, [patients, toast, requestConfirm]);

  const handleRestorePatient = useCallback(async (id: string) => {
    try {
      await apiClient.restorePatient(id, CURRENT_USER.name);
      // Reload patients from storage to get updated state
      const updated = await apiClient.getPatients();
      setPatients(updated);
      const entry = createAuditEntry({ patientId: id, message: `${CURRENT_USER.name} restored patient record ${id}`, type: "restored", user: CURRENT_USER.name });
      setAuditMap((prev) => addAuditEntry(prev, id, entry));
      toast(`Patient restored`, "success");
    } catch (error) {
      console.error("Failed to restore patient:", error);
      toast(`Failed to restore patient: ${error}`, "error");
    }
  }, [toast]);

  const handleSave = useCallback(async (data: Partial<Patient>) => {
    try {
      if (formMode === "create") {
        const newPatient = await apiClient.createPatient(data) as Patient;
        setPatients((prev) => [newPatient, ...prev]);
        setSelectedPatient(newPatient);
        const entry = createAuditEntry({ patientId: newPatient.id, message: `${CURRENT_USER.name} registered ${newPatient.name}`, type: "created", user: CURRENT_USER.name });
        setAuditMap((prev) => addAuditEntry(prev, newPatient.id, entry));
        toast(`${newPatient.name} registered`, "success");
      } else if (formMode === "edit" && selectedPatient) {
        const updated = { ...selectedPatient, ...data, updatedAt: new Date().toISOString() };
        const result = await apiClient.updatePatient(updated.id, updated) as Patient;
        setPatients((prev) => prev.map((p) => p.id === updated.id ? result : p));
        setSelectedPatient(result);
        const entry = createAuditEntry({ patientId: updated.id, message: `${CURRENT_USER.name} edited ${updated.name}`, type: "edited", user: CURRENT_USER.name });
        setAuditMap((prev) => addAuditEntry(prev, updated.id, entry));
        toast(`${updated.name} saved`, "success");
      }
      setLastSavedAt(new Date());
      setFormMode(null);
    } catch (error) {
      console.error("Failed to save patient:", error);
      toast(`Failed to save patient: ${error}`, "error");
    }
  }, [formMode, selectedPatient, toast]);

  const handleImport = useCallback(async (rows: Partial<Patient>[]) => {
    try {
      const now = new Date().toISOString();
      let imported = 0;
      let skipped  = 0;

      setPatients((prev) => {
        const next = [...prev];

        for (const row of rows) {
          // Assign id / createdAt if missing
          const candidate: Patient = {
            ...row,
            id:        row.id        || `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: row.createdAt || now,
          } as Patient;

          // De-dupe: by id first, then phone+name
          const duplicate = next.find((p) =>
            (candidate.id && p.id === candidate.id) ||
            (candidate.phone && candidate.name &&
              p.phone === candidate.phone && p.name === candidate.name)
          );

          if (duplicate) {
            skipped++;
          } else {
            next.unshift(candidate);
            imported++;
          }
        }

        // Persist the merged list
        savePatients(next);
        return next;
      });

      setLastSavedAt(new Date());
      const entry = createAuditEntry({ patientId: "system", message: `${CURRENT_USER.name} imported ${imported} patients (${skipped} duplicates skipped)`, type: "import", user: CURRENT_USER.name });
      setAuditMap((prev) => addAuditEntry(prev, "system", entry));
      setImportOpen(false);
      toast(
        skipped > 0
          ? `${imported} imported, ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped`
          : `${imported} patient${imported !== 1 ? "s" : ""} imported`,
        "success"
      );
    } catch (error) {
      console.error("Failed to import patients:", error);
      toast(`Failed to import patients: ${error}`, "error");
    }
  }, [toast]);

  const handleRefreshPatients = useCallback(() => refreshPatients(false), [refreshPatients]);

  // Topbar global search — smart navigation on Enter
  const handleSearchEnter = useCallback((q: string) => {
    const lower = q.toLowerCase();
    const matches = patients.filter((p) =>
      p.name?.toLowerCase().includes(lower) ||
      p.id?.toLowerCase().includes(lower) ||
      p.phone?.toLowerCase().includes(lower)
    );
    if (matches.length === 0) {
      toast("No patient found", "error");
    } else if (matches.length === 1) {
      setSelectedPatient(matches[0]);
      handleSetActiveTab("patients");
    } else {
      // Multiple matches — go to patients list so PatientList search can filter
      handleSetActiveTab("patients");
      setSelectedPatient(null);
      setListSearch(q);
      setTimeout(() => {
        const real = document.querySelector<HTMLInputElement>('input[type="search"]:not([data-topbar])');
        if (real) { real.value = q; real.focus(); real.dispatchEvent(new Event("input", { bubbles: true })); }
      }, 60);
    }
  }, [patients, toast, handleSetActiveTab]);

  // Handle logout (frontend-only mode - just clears data)
  const handleLogout = useCallback(() => {
    requestConfirm({
      title: "Log out?",
      message: "You will return to the login screen. Local app data remains on this device.",
      confirmLabel: "Log Out",
      onConfirm: async () => {
        try {
          setPatients([]);
          setAuditMap({});
          setSelectedPatient(null);
          toast("Logged out successfully", "success");
        } catch (error) {
          console.error("Logout error:", error);
          toast("Failed to logout", "error");
        }
      },
    });
  }, [requestConfirm, toast]);

  // ── Stable callbacks for JSX props ─────────────────────────────────────────
  const handleStatsFilter  = useCallback((q: string) => { setListSearch(q); }, []);
  const handleViewPatient  = useCallback((p: Patient) => { setSelectedPatient(p); handleSetActiveTab("patients"); }, [handleSetActiveTab]);
  const handleEditPatient  = useCallback(() => setFormMode("edit"), []);
  const handleNewPatient   = useCallback(() => setFormMode("create"), []);
  const handleOpenImport   = useCallback(() => setImportOpen(true), []);
  const handleCloseForm    = useCallback(() => setFormMode(null), []);
  const handleCloseImport  = useCallback(() => setImportOpen(false), []);

  // ── Render ───────────────────────────────────────────────────────────────────
  // Show main CRM interface (frontend-only mode)
  if (loading) {
    return (
      <div className="crm-root col" style={{ height: "100vh", overflow: "hidden" }}>
        <GlobalStyles dark={dark} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <div style={{ fontSize: "var(--font-lg)", color: "var(--muted)" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-root" style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "row" }}>
      <GlobalStyles dark={dark} />

      <Sidebar
        dark={dark}
        activeTab={activeTab} setActiveTab={setActiveTab}
        stats={stats}
        userRole={userRole} setUserRole={setUserRole}
        patients={patients}
        onLogout={handleLogout}
        setDark={setDark}
        requestConfirm={requestConfirm}
      />

      <BottomNav dark={dark} activeTab={activeTab} setActiveTab={setActiveTab} setDark={setDark} onLogout={handleLogout} userRole={userRole} />

      {/* Main content area */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>

      <ContentTopBar
        dark={dark} setDark={setDark}
        activeTab={activeTab} setActiveTab={setActiveTab}
        userRole={userRole} setUserRole={setUserRole}
        patients={patients}
        onLogout={handleLogout}
        apiMode={apiMode}
        backendConnected={backendConnected}
        hasFirebaseToken={hasFirebaseToken}
        statusLoading={statusLoading}
        onRefresh={handleRefreshPatients}
        refreshing={refreshingPatients}
        lastSavedAt={lastSavedAt}
        onSearchEnter={handleSearchEnter}
        searchInputRef={topbarSearchRef}
      />

      <MobileTopBar
        dark={dark}
        activeTab={activeTab} setActiveTab={setActiveTab}
        patients={patients}
      />

      {/* Stats bar — only on patients tab, only when not in profile view */}
      {activeTab === "patients" && !selectedPatient && (
        <StatsBar
          stats={stats}
          onFilter={handleStatsFilter}
        />
      )}

      {/* Ctrl+K hint — desktop only; mobile has no physical keyboard for this shortcut, and the
          fixed-bottom position would otherwise sit on top of the mobile bottom nav bar */}
      {activeTab === "patients" && !selectedPatient && (
        <div className="desktop-only" style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 50, pointerEvents: "none",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-full)", padding: "5px 14px",
          fontSize: "var(--font-xs)", color: "var(--muted)", boxShadow: "var(--shadow)",
          display: "flex", alignItems: "center", gap: 6,
          opacity: 0.7,
        }}>
          <kbd style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 4, fontSize: "var(--font-2xs)", fontFamily: "monospace" }}>
            Ctrl+K
          </kbd>
          to focus search
        </div>
      )}

      {/* Page content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }} className="page-content-wrap">
        <Suspense fallback={<AppPageFallback />}>
        {(() => {
          // Phase 6B: Guard component rendering - check permissions before rendering
          const tabInfo = NAV_TABS.find(t => t.id === activeTab);
          
          // If user doesn't have access to this tab, show denied panel
          if (!canAccessTab(activeTab, userRole)) {
            return (
              <DeniedAccessPanel 
                tab={tabInfo?.label || activeTab} 
                onReturn={() => handleSetActiveTab(getFirstAllowedTab(userRole))}
              />
            );
          }

          // Otherwise render the appropriate component
          switch (activeTab) {
            case "dashboard":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <Dashboard patients={patients} userRole={userRole} onAction={handleDashboardAction} onUpdatePatient={handleUpdatePatient} />
                </div>
              );
            case "queue":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <QueuePage patients={patients} onUpdatePatient={handleUpdatePatient} onAction={handleDashboardAction} userRole={userRole} />
                </div>
              );
            case "appointments":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <AppointmentsPage patients={patients} onUpdatePatient={handleUpdatePatient} onViewPatient={handleViewPatient} userRole={userRole} />
                </div>
              );
            case "consultations":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <ConsultationsPage patients={patients} userRole={userRole} />
                </div>
              );
            case "prescriptions":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <PrescriptionsPage patients={patients} userRole={userRole} />
                </div>
              );
            case "lab":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <LabPage patients={patients} userRole={userRole} />
                </div>
              );
            case "billing":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <BillingPage patients={patients} userRole={userRole} />
                </div>
              );
            case "documents":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <DocumentsPage patients={patients} onUpdatePatient={handleUpdatePatient} userRole={userRole} />
                </div>
              );
            case "communications":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <CommunicationsPage patients={patients} userRole={userRole} />
                </div>
              );
            case "reports":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <ReportsPage patients={patients} userRole={userRole} />
                </div>
              );
            case "staff":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <StaffPage />
                </div>
              );
            case "settings":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <SettingsPage />
                </div>
              );
            case "audit":
              return (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <AuditPage />
                </div>
              );
            case "patients":
              if (selectedPatient) {
                return (
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <PatientProfile
                      patient={selectedPatient}
                      onBack={handleBack}
                      onEditPatient={handleEditPatient}
                      onUpdatePatient={handleUpdatePatient}
                      onDeletePatient={handleDeletePatient}
                      role={userRole}
                    />
                  </div>
                );
              } else if (formMode === "create" || formMode === "edit") {
                return (
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <PatientForm
                      mode={formMode}
                      patient={formMode === "edit" ? selectedPatient : undefined}
                      onSave={handleSave}
                      onCancel={handleCloseForm}
                      onImport={handleOpenImport}
                      role={userRole}
                    />
                  </div>
                );
              } else {
                return (
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <PatientList
                      patients={patients}
                      onUpdatePatient={handleUpdatePatient}
                      onDeletePatient={handleDeletePatient}
                      onRestorePatient={handleRestorePatient}
                      role={userRole}
                    />
                  </div>
                );
              }
            default:
              return (
                <DeniedAccessPanel 
                  tab={tabInfo?.label || activeTab} 
                  onReturn={() => handleSetActiveTab(getFirstAllowedTab(extendedRole))}
                />
              );
          }
        })()}
        </Suspense>
      </div>

      {/* Modals */}
      {formMode && (
        <PatientForm
          mode={formMode}
          patient={formMode === "edit" ? selectedPatient : null}
          onSave={handleSave}
          onClose={handleCloseForm}
          role={userRole}
        />
      )}
      {importOpen && (
        <ImportModal onImport={handleImport} onClose={handleCloseImport} />
      )}

      {/* Confirm modal — replaces all window.confirm() calls */}
      {confirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}
          onKeyDown={(e) => { if (e.key === "Escape") closeConfirm(); }}
        >
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            padding: "24px",
            maxWidth: 400,
            width: "100%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          }}>
            <div id="confirm-modal-title" style={{ fontWeight: 700, fontSize: "var(--font-lg,1rem)", marginBottom: 8, color: "var(--fg)" }}>
              {confirmModal.title}
            </div>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 24, lineHeight: 1.5 }}>
              {confirmModal.message}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                onClick={closeConfirm}
                autoFocus
              >
                {confirmModal.cancelLabel ?? "Cancel"}
              </button>
              <button
                className="btn"
                onClick={handleConfirm}
                style={{
                  background: confirmModal.isDanger ? "var(--red,#dc2626)" : "var(--accent,#2563eb)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                }}
              >
                {confirmModal.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* /main content area */}
    </div>
  );
}

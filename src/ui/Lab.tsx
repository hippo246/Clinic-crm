import React, { useState } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderNumber: string;
  testType: string;
  priority: "routine" | "urgent" | "stat";
  status: "pending" | "in-progress" | "completed" | "cancelled";
  orderDate: string;
  orderedBy: string;
  clinicalNotes?: string;
}

interface LabResult {
  id: string;
  orderId: string;
  patientId: string;
  patientName: string;
  testType: string;
  parameters: TestParameter[];
  status: "pending" | "review" | "approved" | "rejected";
  critical: boolean;
  reviewedBy?: string;
  reviewDate?: string;
  resultDate: string;
  notes?: string;
}

interface TestParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "normal" | "high" | "low" | "critical";
}

const TEST_TEMPLATES: Record<string, TestParameter[]> = {
  "cbc": [
    { name: "Hemoglobin", value: "", unit: "g/dL", referenceRange: "12-16", flag: "normal" },
    { name: "Hematocrit", value: "", unit: "%", referenceRange: "37-47", flag: "normal" },
    { name: "WBC", value: "", unit: "K/uL", referenceRange: "4.5-11.0", flag: "normal" },
    { name: "RBC", value: "", unit: "M/uL", referenceRange: "4.5-5.5", flag: "normal" },
    { name: "Platelets", value: "", unit: "K/uL", referenceRange: "150-400", flag: "normal" },
  ],
  "bmp": [
    { name: "Glucose", value: "", unit: "mg/dL", referenceRange: "70-100", flag: "normal" },
    { name: "Creatinine", value: "", unit: "mg/dL", referenceRange: "0.7-1.3", flag: "normal" },
    { name: "BUN", value: "", unit: "mg/dL", referenceRange: "7-20", flag: "normal" },
    { name: "Sodium", value: "", unit: "mEq/L", referenceRange: "136-145", flag: "normal" },
    { name: "Potassium", value: "", unit: "mEq/L", referenceRange: "3.5-5.1", flag: "normal" },
  ],
  "lipid": [
    { name: "Total Cholesterol", value: "", unit: "mg/dL", referenceRange: "<200", flag: "normal" },
    { name: "HDL", value: "", unit: "mg/dL", referenceRange: ">40", flag: "normal" },
    { name: "LDL", value: "", unit: "mg/dL", referenceRange: "<100", flag: "normal" },
    { name: "Triglycerides", value: "", unit: "mg/dL", referenceRange: "<150", flag: "normal" },
  ],
  "thyroid": [
    { name: "TSH", value: "", unit: "mIU/L", referenceRange: "0.4-4.0", flag: "normal" },
    { name: "Free T4", value: "", unit: "ng/dL", referenceRange: "0.8-1.8", flag: "normal" },
    { name: "Free T3", value: "", unit: "pg/mL", referenceRange: "2.3-4.2", flag: "normal" },
  ],
  "hba1c": [
    { name: "HbA1c", value: "", unit: "%", referenceRange: "<5.7", flag: "normal" },
  ],
};

export default function LabPage({ patients }: { patients: Patient[] }) {
  const [activeTab, setActiveTab] = useState<"orders" | "results" | "reports">("orders");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [orderTestType, setOrderTestType] = useState("");
  const [orderPriority, setOrderPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [orderNotes, setOrderNotes] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [showEnterResults, setShowEnterResults] = useState(false);
  const [resultOrderId, setResultOrderId] = useState("");
  const [resultParams, setResultParams] = useState<TestParameter[]>([]);
  const [resultNotes, setResultNotes] = useState("");
  const [resultCritical, setResultCritical] = useState(false);

  const [labOrders, setLabOrders] = useState<LabOrder[]>(() =>
    JSON.parse(localStorage.getItem("clinic_crm_lab_orders") || "[]")
  );
  const [labResults, setLabResults] = useState<LabResult[]>(() =>
    JSON.parse(localStorage.getItem("clinic_crm_lab_results") || "[]")
  );

  const saveOrder = (order: LabOrder) => {
    const next = [...labOrders, order];
    localStorage.setItem("clinic_crm_lab_orders", JSON.stringify(next));
    setLabOrders(next);
  };

  const updateOrderStatus = (id: string, status: LabOrder["status"]) => {
    const next = labOrders.map(o => o.id === id ? { ...o, status } : o);
    localStorage.setItem("clinic_crm_lab_orders", JSON.stringify(next));
    setLabOrders(next);
  };

  const saveResult = (result: LabResult) => {
    const next = [...labResults, result];
    localStorage.setItem("clinic_crm_lab_results", JSON.stringify(next));
    setLabResults(next);
  };

  const updateResultStatus = (id: string, status: LabResult["status"]) => {
    const next = labResults.map(r => r.id === id ? { ...r, status, reviewedBy: "Current User", reviewDate: new Date().toISOString() } : r);
    localStorage.setItem("clinic_crm_lab_results", JSON.stringify(next));
    setLabResults(next);
  };

  const pendingOrders = labOrders.filter((o) => o.status === "pending");
  const inProgressOrders = labOrders.filter((o) => o.status === "in-progress");
  const completedOrders = labOrders.filter((o) => o.status === "completed");
  const criticalResults = labResults.filter((r) => r.critical === true);
  const pendingReview = labResults.filter((r) => r.status === "review");

  return (
    <div style={{ padding: "clamp(12px, 4vw, 24px)", maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Lab & Diagnostics
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Orders, results, imaging reports &amp; critical alerts
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, overflowX: "auto", WebkitOverflowScrolling: "touch" as const, paddingBottom: 4, scrollbarWidth: "none" as const }}>
        <StatCard label="Pending" value={pendingOrders.length} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
        <StatCard label="Completed" value={completedOrders.length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
        <StatCard label="Critical" value={criticalResults.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Orders" value={labOrders.length} color="var(--blue)" icon="ti-test-tube" bg="var(--blue-bg)" />
        <StatCard label="Results" value={labResults.length} color="var(--accent)" icon="ti-file-text" bg="var(--accent-soft)" />
      </div>

      {/* Critical Results Alert */}
      {criticalResults.length > 0 && (
        <div className="card card-padded" style={{ marginBottom: 24, border: "2px solid var(--red-border)", background: "var(--red-bg)" }}>
          <div className="section-label" style={{ color: "var(--red)", marginBottom: 12 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
            Critical Results Alert ({criticalResults.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {criticalResults.map((r: any) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 12, background: "var(--surface)", borderRadius: "var(--radius)",
                border: "1px solid var(--red-border)"
              }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "var(--red)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{r.patientName}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.testType} · {fmtDate(r.resultDate)}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", flexShrink: 0, minHeight: 36, padding: "0 14px" }}
                  onClick={() => { setActiveTab("results"); setExpandedResultId(r.id); }}>
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ marginBottom: 16, position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", paddingTop: 4, paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: "calc(var(--radius) + 4px)", padding: 4 }}>
          <TabButton active={activeTab === "orders"} onClick={() => setActiveTab("orders")} icon="ti-test-tube">Orders</TabButton>
          <TabButton active={activeTab === "results"} onClick={() => setActiveTab("results")} icon="ti-file-text">Results</TabButton>
          <TabButton active={activeTab === "reports"} onClick={() => setActiveTab("reports")} icon="ti-chart-bar">Reports</TabButton>
        </div>
      </div>

      {activeTab === "orders" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 16, marginBottom: 24 }}>
          {/* Lab Orders */}
          <div className="card card-padded">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="section-label" style={{ margin: 0 }}>
              <i className="ti ti-test-tube" style={{ marginRight: 6 }} />
              Lab Orders ({pendingOrders.length + inProgressOrders.length})
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowEnterResults(true)} style={{ fontSize: "var(--font-xs)", minHeight: 36, padding: "0 12px" }}>
                <i className="ti ti-clipboard-plus" style={{ fontSize: 14, marginRight: 4 }} />
                Results
              </button>
              <button className="btn btn-primary" onClick={() => setShowNewOrder(true)} style={{ fontSize: "var(--font-xs)", minHeight: 36, padding: "0 12px" }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 4 }} />
                New Order
              </button>
            </div>
          </div>
          {pendingOrders.length === 0 && inProgressOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-test-tube-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No pending lab orders</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...pendingOrders, ...inProgressOrders].map((o) => (
                <div key={o.id}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 12px", background: "var(--surface2)", borderRadius: "var(--radius)",
                    cursor: "pointer", minHeight: 56,
                    borderLeft: o.status === "in-progress" ? "3px solid var(--accent)" : o.priority === "stat" ? "3px solid var(--red)" : o.priority === "urgent" ? "3px solid var(--amber)" : "3px solid transparent",
                  }} onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 3 }}>{o.patientName}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{o.testType}</span>
                        <span style={{ color: "var(--border)" }}>·</span>
                        <span>{fmtDate(o.orderDate)}</span>
                        {o.status === "in-progress" && <span style={{ color: "var(--accent)", fontWeight: 600 }}>In Progress</span>}
                      </div>
                    </div>
                    <span className="badge" style={{
                      flexShrink: 0,
                      fontWeight: 700,
                      background: o.priority === "stat" ? "var(--red-bg)" : o.priority === "urgent" ? "var(--amber-bg)" : "var(--surface3)",
                      color: o.priority === "stat" ? "var(--red)" : o.priority === "urgent" ? "var(--amber)" : "var(--muted)",
                      border: o.priority === "stat" ? "1px solid var(--red-border)" : o.priority === "urgent" ? "1px solid var(--amber-border)" : "1px solid var(--border)",
                    }}>{o.priority.toUpperCase()}</span>
                    <i className={`ti ${expandedOrderId === o.id ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 16, color: "var(--muted)", flexShrink: 0 }} />
                  </div>
                  {expandedOrderId === o.id && (
                    <div style={{ padding: "12px 12px 14px", background: "var(--surface2)", borderRadius: "0 0 var(--radius) var(--radius)", marginTop: -4, borderTop: "1px solid var(--border)" }}>
                      {o.clinicalNotes && (
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 10, padding: "8px 10px", background: "var(--surface3)", borderRadius: "var(--radius)" }}>
                          <i className="ti ti-notes" style={{ marginRight: 4 }} />{o.clinicalNotes}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", minHeight: 40, justifyContent: "center" }} onClick={() => updateOrderStatus(o.id, "in-progress")}>
                          <i className="ti ti-player-play" style={{ fontSize: 12, marginRight: 4 }} />In Progress
                        </button>
                        <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", minHeight: 40, justifyContent: "center" }} onClick={() => updateOrderStatus(o.id, "completed")}>
                          <i className="ti ti-check" style={{ fontSize: 12, marginRight: 4 }} />Complete
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", minHeight: 40, color: "var(--red)", justifyContent: "center" }} onClick={() => updateOrderStatus(o.id, "cancelled")}>
                          <i className="ti ti-x" style={{ fontSize: 12, marginRight: 4 }} />Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lab Results */}
        <div className="card card-padded">
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-file-text" style={{ marginRight: 4 }} />
            Lab Results ({labResults.length})
          </div>
          {labResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-file-off" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No lab results available</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {labResults.slice(0, 5).map((r) => (
                <div key={r.id}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: 12, background: r.critical ? "var(--red-bg)" : "var(--surface2)",
                    borderRadius: "var(--radius)",
                    border: r.critical ? "1px solid var(--red-border)" : "none",
                    cursor: "pointer"
                  }} onClick={() => setExpandedResultId(expandedResultId === r.id ? null : r.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{r.patientName}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.testType} · {fmtDate(r.resultDate)}
                      </div>
                    </div>
                    {r.critical && (
                      <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", flexShrink: 0 }}>
                        Critical
                      </span>
                    )}
                    <i className={`ti ${expandedResultId === r.id ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 14, color: "var(--muted)", flexShrink: 0 }} />
                  </div>
                  {expandedResultId === r.id && r.parameters?.length > 0 && (
                    <div style={{ padding: "10px 12px 12px", background: "var(--surface2)", borderRadius: "0 0 var(--radius) var(--radius)", marginTop: -4, borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {r.parameters.map((p: TestParameter) => (
                          <div key={p.name} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 10px", borderRadius: "var(--radius)",
                            background: p.flag === "critical" ? "var(--red-bg)" : p.flag !== "normal" ? "var(--amber-bg)" : "var(--surface3)",
                            border: p.flag === "critical" ? "1px solid var(--red-border)" : p.flag !== "normal" ? "1px solid var(--amber-border)" : "1px solid transparent",
                          }}>
                            <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)", flex: 1 }}>{p.name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: p.flag === "critical" ? "var(--red)" : p.flag !== "normal" ? "var(--amber)" : "var(--text)" }}>
                                {p.value} <span style={{ fontSize: "var(--font-xs)", fontWeight: 400 }}>{p.unit}</span>
                              </span>
                              {p.flag !== "normal" && (
                                <i className={`ti ${p.flag === "critical" ? "ti-alert-triangle" : p.flag === "high" ? "ti-arrow-up" : "ti-arrow-down"}`}
                                  style={{ fontSize: 12, color: p.flag === "critical" ? "var(--red)" : "var(--amber)", flexShrink: 0 }} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {r.notes && <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 8, padding: "6px 10px", background: "var(--surface3)", borderRadius: "var(--radius)" }}>{r.notes}</div>}
                    </div>
                  )}
                </div>
              ))}
              {labResults.length > 5 && (
                <button
                  onClick={() => setActiveTab("results")}
                  style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--accent)", padding: 8, background: "none", border: "none", cursor: "pointer", width: "100%" }}
                >
                  +{labResults.length - 5} more results — View all →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === "results" && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            <i className="ti ti-file-text" style={{ marginRight: 4 }} />
            Lab Results ({labResults.length})
          </div>
          {labResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
              <i className="ti ti-file-text" style={{ fontSize: 36, marginBottom: 12, display: "block" }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No lab results yet</div>
              <div style={{ fontSize: "var(--font-xs)" }}>Results entered will appear here</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {labResults.map((r) => (
                <div key={r.id}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 12px", minHeight: 60,
                    background: r.critical ? "var(--red-bg)" : "var(--surface2)",
                    borderRadius: "var(--radius)",
                    border: r.critical ? "1px solid var(--red-border)" : "1px solid transparent",
                    borderLeft: r.critical ? "3px solid var(--red)" : r.status === "approved" ? "3px solid var(--green)" : r.status === "review" ? "3px solid var(--amber)" : "3px solid transparent",
                    cursor: "pointer"
                  }} onClick={() => setExpandedResultId(expandedResultId === r.id ? null : r.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{r.patientName}</span>
                        <span className="badge" style={{
                          background: r.status === "approved" ? "var(--green-bg)" : r.status === "review" ? "var(--amber-bg)" : r.status === "rejected" ? "var(--red-bg)" : "var(--surface3)",
                          color: r.status === "approved" ? "var(--green)" : r.status === "review" ? "var(--amber)" : r.status === "rejected" ? "var(--red)" : "var(--muted)",
                          border: r.status === "approved" ? "1px solid var(--green-border)" : r.status === "review" ? "1px solid var(--amber-border)" : r.status === "rejected" ? "1px solid var(--red-border)" : "1px solid var(--border)",
                          fontWeight: 600,
                        }}>{r.status}</span>
                        {r.critical && <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", fontWeight: 700 }}>⚠ Critical</span>}
                      </div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        {r.testType} · {fmtDate(r.resultDate)}
                      </div>
                    </div>
                    <i className={`ti ${expandedResultId === r.id ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 16, color: "var(--muted)", flexShrink: 0 }} />
                  </div>
                  {expandedResultId === r.id && r.parameters?.length > 0 && (
                    <div style={{ padding: "10px 12px 14px", background: "var(--surface2)", borderRadius: "0 0 var(--radius) var(--radius)", marginTop: -4, borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                        {r.parameters.map((p: TestParameter) => (
                          <div key={p.name} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 10px", borderRadius: "var(--radius)",
                            background: p.flag === "critical" ? "var(--red-bg)" : p.flag !== "normal" ? "var(--amber-bg)" : "var(--surface3)",
                            border: p.flag === "critical" ? "1px solid var(--red-border)" : p.flag !== "normal" ? "1px solid var(--amber-border)" : "1px solid transparent",
                          }}>
                            <div>
                              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600 }}>{p.name}</div>
                              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Ref: {p.referenceRange}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "right" }}>
                              <div>
                                <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: p.flag === "critical" ? "var(--red)" : p.flag !== "normal" ? "var(--amber)" : "var(--text)" }}>
                                  {p.value} <span style={{ fontSize: "var(--font-xs)", fontWeight: 400, color: "var(--muted)" }}>{p.unit}</span>
                                </div>
                              </div>
                              {p.flag !== "normal" && (
                                <i className={`ti ${p.flag === "critical" ? "ti-alert-triangle" : p.flag === "high" ? "ti-arrow-up" : "ti-arrow-down"}`}
                                  style={{ fontSize: 14, color: p.flag === "critical" ? "var(--red)" : "var(--amber)", flexShrink: 0 }} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {r.notes && (
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 10, padding: "8px 10px", background: "var(--surface3)", borderRadius: "var(--radius)" }}>
                          <i className="ti ti-notes" style={{ marginRight: 4 }} />{r.notes}
                        </div>
                      )}
                      {r.status !== "approved" && r.status !== "rejected" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <button className="btn btn-primary" style={{ minHeight: 44, fontSize: "var(--font-sm)", justifyContent: "center" }} onClick={(e) => { e.stopPropagation(); updateResultStatus(r.id, "approved"); }}>
                            <i className="ti ti-check" style={{ fontSize: 14, marginRight: 6 }} />Approve
                          </button>
                          <button className="btn btn-ghost" style={{ minHeight: 44, fontSize: "var(--font-sm)", color: "var(--red)", justifyContent: "center", border: "1px solid var(--red-border)" }} onClick={(e) => { e.stopPropagation(); updateResultStatus(r.id, "rejected"); }}>
                            <i className="ti ti-x" style={{ fontSize: 14, marginRight: 6 }} />Reject
                          </button>
                        </div>
                      )}
                      {r.reviewedBy && (
                        <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                          <i className="ti ti-user-check" style={{ fontSize: 12 }} />
                          Reviewed by {r.reviewedBy} · {r.reviewDate ? fmtDate(r.reviewDate) : ""}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>
              <i className="ti ti-chart-bar" style={{ marginRight: 4 }} />
              Lab Summary
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Orders", value: labOrders.length, color: "var(--blue)" },
                { label: "Pending", value: pendingOrders.length, color: "var(--amber)" },
                { label: "In Progress", value: inProgressOrders.length, color: "var(--purple)" },
                { label: "Completed", value: completedOrders.length, color: "var(--green)" },
                { label: "Critical Results", value: criticalResults.length, color: "var(--red)" },
                { label: "Pending Review", value: pendingReview.length, color: "var(--amber)" },
              ].map(s => (
                <div key={s.label} style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>
              <i className="ti ti-scan" style={{ marginRight: 4 }} />
              Imaging Reports
            </div>
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <i className="ti ti-scan" style={{ fontSize: 32, marginBottom: 8 }} />
              <div>No imaging reports available</div>
              <div style={{ fontSize: "var(--font-xs)", marginTop: 4 }}>Imaging reports will appear here when uploaded</div>
            </div>
          </div>
        </div>
      )}

      {showNewOrder && (
        <div className="modal-backdrop" onClick={() => setShowNewOrder(false)}>
          <div className="modal" style={{
            maxWidth: 500, width: "calc(100vw - 32px)",
            position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom))",
            left: "50%", transform: "translateX(-50%)",
            borderRadius: "16px", maxHeight: "90vh", display: "flex", flexDirection: "column",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>New Lab Order</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>Create a new diagnostic order</div>
              </div>
              <button className="btn-icon" style={{ width: 36, height: 36 }} onClick={() => setShowNewOrder(false)}><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Patient</label>
                <select
                  value={selectedPatient?.id || ""}
                  onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const, minHeight: 44 }}
                >
                  <option value="">Select patient...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Test Type</label>
                <select
                  value={orderTestType}
                  onChange={(e) => setOrderTestType(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const, minHeight: 44 }}
                >
                  <option value="">Select test...</option>
                  <option value="cbc">Complete Blood Count (CBC)</option>
                  <option value="bmp">Basic Metabolic Panel (BMP)</option>
                  <option value="lipid">Lipid Panel</option>
                  <option value="thyroid">Thyroid Function</option>
                  <option value="hba1c">HbA1c</option>
                  <option value="urinalysis">Urinalysis</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Priority</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {(["routine", "urgent", "stat"] as const).map(p => (
                    <button key={p} onClick={() => setOrderPriority(p)} style={{
                      padding: "10px 0", borderRadius: "var(--radius)", border: "1px solid",
                      borderColor: orderPriority === p ? (p === "stat" ? "var(--red)" : p === "urgent" ? "var(--amber)" : "var(--accent)") : "var(--border)",
                      background: orderPriority === p ? (p === "stat" ? "var(--red-bg)" : p === "urgent" ? "var(--amber-bg)" : "var(--accent-soft)") : "transparent",
                      color: orderPriority === p ? (p === "stat" ? "var(--red)" : p === "urgent" ? "var(--amber)" : "var(--accent)") : "var(--muted)",
                      fontSize: "var(--font-xs)", fontWeight: 700, cursor: "pointer", textTransform: "uppercase" as const,
                    }}>{p}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Clinical Notes</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Reason for test, relevant clinical context..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical", boxSizing: "border-box" as const }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setShowNewOrder(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, fontSize: "var(--font-sm)", fontWeight: 700 }}
                  disabled={!selectedPatient || !orderTestType}
                  onClick={() => {
                    if (!selectedPatient || !orderTestType) return;
                    const order: LabOrder = {
                      id: Date.now().toString(),
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.name,
                      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
                      testType: orderTestType,
                      priority: orderPriority,
                      status: "pending",
                      orderDate: new Date().toISOString(),
                      orderedBy: "Current User",
                      clinicalNotes: orderNotes || undefined,
                    };
                    saveOrder(order);
                    setShowNewOrder(false);
                    setSelectedPatient(null);
                    setOrderTestType("");
                    setOrderPriority("routine");
                    setOrderNotes("");
                  }}
                >
                  <i className="ti ti-send" style={{ fontSize: 14, marginRight: 6 }} />Submit Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEnterResults && (
        <div className="modal-backdrop" onClick={() => setShowEnterResults(false)}>
          <div className="modal" style={{
            maxWidth: 540, width: "calc(100vw - 32px)",
            position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom))",
            left: "50%", transform: "translateX(-50%)",
            borderRadius: "16px", maxHeight: "92vh", display: "flex", flexDirection: "column",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Enter Lab Results</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>Record test parameter values</div>
              </div>
              <button className="btn-icon" style={{ width: 36, height: 36 }} onClick={() => setShowEnterResults(false)}><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Link to Order (optional)</label>
                <select
                  value={resultOrderId}
                  onChange={(e) => {
                    setResultOrderId(e.target.value);
                    const order = labOrders.find(o => o.id === e.target.value);
                    if (order && TEST_TEMPLATES[order.testType]) {
                      setResultParams(TEST_TEMPLATES[order.testType].map(p => ({ ...p })));
                    } else if (e.target.value === "") {
                      setResultParams([]);
                    }
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const, minHeight: 44 }}
                >
                  <option value="">— No linked order —</option>
                  {labOrders.filter(o => o.status !== "cancelled" && o.status !== "completed").map(o => (
                    <option key={o.id} value={o.id}>{o.patientName} — {o.testType} ({o.orderNumber})</option>
                  ))}
                </select>
              </div>
              {!resultOrderId && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Test Type (load template)</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (TEST_TEMPLATES[e.target.value]) {
                        setResultParams(TEST_TEMPLATES[e.target.value].map(p => ({ ...p })));
                      }
                    }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const, minHeight: 44 }}
                  >
                    <option value="">Select test to load template...</option>
                    <option value="cbc">CBC</option>
                    <option value="bmp">BMP</option>
                    <option value="lipid">Lipid Panel</option>
                    <option value="thyroid">Thyroid Function</option>
                    <option value="hba1c">HbA1c</option>
                  </select>
                </div>
              )}
              {resultParams.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Parameters</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {resultParams.map((p, i) => (
                      <div key={p.name} style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                          <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>{p.name}</span>
                          <span style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Ref: {p.referenceRange} {p.unit}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={p.value}
                            onChange={(e) => {
                              const next = [...resultParams];
                              next[i] = { ...next[i], value: e.target.value };
                              setResultParams(next);
                            }}
                            placeholder={`Value (${p.unit})`}
                            style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", boxSizing: "border-box" as const, minHeight: 40 }}
                          />
                          <select
                            value={p.flag}
                            onChange={(e) => {
                              const next = [...resultParams];
                              next[i] = { ...next[i], flag: e.target.value as TestParameter["flag"] };
                              setResultParams(next);
                            }}
                            style={{
                              padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid",
                              borderColor: p.flag === "critical" ? "var(--red-border)" : p.flag !== "normal" ? "var(--amber-border)" : "var(--border)",
                              background: p.flag === "critical" ? "var(--red-bg)" : p.flag !== "normal" ? "var(--amber-bg)" : "var(--surface3)",
                              color: p.flag === "critical" ? "var(--red)" : p.flag !== "normal" ? "var(--amber)" : "var(--muted)",
                              fontSize: "var(--font-xs)", fontWeight: 600, minHeight: 40,
                            }}
                          >
                            <option value="normal">Normal</option>
                            <option value="high">High ↑</option>
                            <option value="low">Low ↓</option>
                            <option value="critical">Critical ⚠</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <input type="checkbox" checked={resultCritical} onChange={(e) => setResultCritical(e.target.checked)} style={{ width: 18, height: 18 }} />
                  <div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--red)" }}>⚠ Mark as Critical Result</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Will trigger immediate clinical alert</div>
                  </div>
                </label>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Notes</label>
                <textarea
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Lab technician notes, specimen quality, remarks..."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical", boxSizing: "border-box" as const }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => { setShowEnterResults(false); setResultOrderId(""); setResultParams([]); setResultNotes(""); setResultCritical(false); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, fontSize: "var(--font-sm)", fontWeight: 700 }}
                  disabled={resultParams.length === 0 || resultParams.every(p => !p.value)}
                  onClick={() => {
                    const linkedOrder = resultOrderId ? labOrders.find(o => o.id === resultOrderId) : null;
                    const isCritical = resultCritical || resultParams.some(p => p.flag === "critical");
                    const result: LabResult = {
                      id: Date.now().toString(),
                      orderId: resultOrderId || "",
                      patientId: linkedOrder?.patientId || "",
                      patientName: linkedOrder?.patientName || "Manual Entry",
                      testType: linkedOrder?.testType || "Lab Test",
                      parameters: resultParams,
                      status: "review",
                      critical: isCritical,
                      resultDate: new Date().toISOString(),
                      notes: resultNotes || undefined,
                    };
                    saveResult(result);
                    if (resultOrderId) updateOrderStatus(resultOrderId, "completed");
                    setShowEnterResults(false);
                    setResultOrderId("");
                    setResultParams([]);
                    setResultNotes("");
                    setResultCritical(false);
                    setActiveTab("results");
                  }}
                >
                  <i className="ti ti-device-floppy" style={{ fontSize: 14, marginRight: 6 }} />Save Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
    <div className="card card-padded" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 110, flexShrink: 0 }}>
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

function TabButton({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 8px",
        borderRadius: "var(--radius)",
        border: "none",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--accent)" : "var(--muted)",
        fontSize: "var(--font-sm)",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 40,
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
        whiteSpace: "nowrap" as const,
      }}
    >
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 14 }} />}
      {children}
    </button>
  );
}

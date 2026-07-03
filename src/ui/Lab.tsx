import React, { useState, useEffect } from "react";
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
  rejectionReason?: string;
}

interface TestParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "normal" | "high" | "low" | "critical";
}

interface LabTemplate {
  id: string;
  name: string;
  category: string;
  parameters: Omit<TestParameter, "value">[];
}

interface LabActivity {
  timestamp: string;
  action: string;
  patientId?: string;
  patientName?: string;
  details?: string;
}

// ─── Safe localStorage helpers ────────────────────────────────────────────────
const LAB_ORDERS_KEY = "clinic_crm_lab_orders";
const LAB_RESULTS_KEY = "clinic_crm_lab_results";
const LAB_ACTIVITY_KEY = "clinic_crm_lab_activity";
const LAB_TEMPLATES_KEY = "clinic_crm_lab_templates";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled */
  }
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

export default function LabPage({ patients, onUpdatePatient, userRole = "admin" }: { patients: Patient[]; onUpdatePatient?: (updated: Patient, action?: string) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  // Feedback state
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  // State with safe localStorage helpers
  const [labOrders, setLabOrders] = useState<LabOrder[]>(() => readJSON(LAB_ORDERS_KEY, []));
  const [labResults, setLabResults] = useState<LabResult[]>(() => readJSON(LAB_RESULTS_KEY, []));
  const [labActivity, setLabActivity] = useState<LabActivity[]>(() => readJSON(LAB_ACTIVITY_KEY, []));
  const [customTemplates, setCustomTemplates] = useState<LabTemplate[]>(() => {
    const loaded = readJSON(LAB_TEMPLATES_KEY, []);
    return loaded;
  });

  // Tab and modal states
  const [activeTab, setActiveTab] = useState<"orders" | "results" | "reports">("orders");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [showViewOrder, setShowViewOrder] = useState(false);
  const [showEnterResults, setShowEnterResults] = useState(false);
  const [showEditResult, setShowEditResult] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Form states
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [orderTestType, setOrderTestType] = useState("");
  const [orderPriority, setOrderPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [orderNotes, setOrderNotes] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [resultOrderId, setResultOrderId] = useState("");
  const [resultParams, setResultParams] = useState<TestParameter[]>([]);
  const [resultNotes, setResultNotes] = useState("");
  const [resultCritical, setResultCritical] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Editing states
  const [editingOrder, setEditingOrder] = useState<LabOrder | null>(null);
  const [editingResult, setEditingResult] = useState<LabResult | null>(null);
  const [viewingOrder, setViewingOrder] = useState<LabOrder | null>(null);
  const [viewingResult, setViewingResult] = useState<LabResult | null>(null);

  // Filter states
  const [orderFilterStatus, setOrderFilterStatus] = useState<"">("");
  const [orderFilterPriority, setOrderFilterPriority] = useState("");
  const [orderFilterTestType, setOrderFilterTestType] = useState("");
  const [orderFilterDateFrom, setOrderFilterDateFrom] = useState("");
  const [orderFilterDateTo, setOrderFilterDateTo] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [resultFilterStatus, setResultFilterStatus] = useState<"">("");
  const [resultFilterCritical, setResultFilterCritical] = useState(false);
  const [resultFilterTestType, setResultFilterTestType] = useState("");
  const [resultFilterDateFrom, setResultFilterDateFrom] = useState("");
  const [resultFilterDateTo, setResultFilterDateTo] = useState("");
  const [resultSearch, setResultSearch] = useState("");

  const showFeedback = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const logActivity = (action: string, patientId?: string, patientName?: string, details?: string) => {
    const entry: LabActivity = {
      timestamp: new Date().toISOString(),
      action,
      patientId,
      patientName,
      details,
    };
    const updated = [entry, ...labActivity].slice(0, 50);
    setLabActivity(updated);
    writeJSON(LAB_ACTIVITY_KEY, updated);
  };

  function persistOrders(next: LabOrder[]) {
    setLabOrders(next);
    writeJSON(LAB_ORDERS_KEY, next);
  }

  function persistResults(next: LabResult[]) {
    setLabResults(next);
    writeJSON(LAB_RESULTS_KEY, next);
  }

  function persistTemplates(next: LabTemplate[]) {
    setCustomTemplates(next);
    writeJSON(LAB_TEMPLATES_KEY, next);
  }

  function handleCreateOrder() {
    if (!selectedPatient) {
      showFeedback("Please select a patient.", "error");
      return;
    }
    if (!orderTestType) {
      showFeedback("Please select a test type.", "error");
      return;
    }
    if (!orderPriority) {
      showFeedback("Please select a priority.", "error");
      return;
    }

    const order: LabOrder = {
      id: `order-${Date.now()}`,
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
    persistOrders([order, ...labOrders]);
    logActivity("order created", selectedPatient.id, selectedPatient.name, `${order.testType} (${order.orderNumber})`);
    showFeedback("Lab order created successfully.", "success");
    setShowNewOrder(false);
    setSelectedPatient(null);
    setOrderTestType("");
    setOrderPriority("routine");
    setOrderNotes("");
  }

  function handleEditOrder() {
    if (!editingOrder || !selectedPatient) return;
    if (!orderTestType) {
      showFeedback("Please select a test type.", "error");
      return;
    }

    const updated: LabOrder = {
      ...editingOrder,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      testType: orderTestType,
      priority: orderPriority,
      clinicalNotes: orderNotes || undefined,
    };
    persistOrders(labOrders.map(o => o.id === editingOrder.id ? updated : o));
    logActivity("order edited", selectedPatient.id, selectedPatient.name, updated.orderNumber);
    showFeedback("Lab order updated successfully.", "success");
    setEditingOrder(null);
    setShowEditOrder(false);
    setSelectedPatient(null);
    setOrderTestType("");
    setOrderPriority("routine");
    setOrderNotes("");
  }

  function handleUpdateOrderStatus(id: string, status: LabOrder["status"]) {
    const order = labOrders.find(o => o.id === id);
    if (!order) return;
    persistOrders(labOrders.map(o => o.id === id ? { ...o, status } : o));
    logActivity("order status changed", order.patientId, order.patientName, `${order.orderNumber} → ${status}`);
    showFeedback(`Order marked as ${status}.`, "success");
  }

  function handleDeleteOrder(id: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this lab order?",
      onConfirm: () => {
        const order = labOrders.find(o => o.id === id);
        persistOrders(labOrders.filter(o => o.id !== id));
        logActivity("order deleted", order?.patientId, order?.patientName, order?.orderNumber);
        showFeedback("Lab order deleted.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handleCreateResult() {
    const linkedOrder = resultOrderId ? labOrders.find(o => o.id === resultOrderId) : null;
    const isCritical = resultCritical || resultParams.some(p => p.flag === "critical");

    if (!linkedOrder && !selectedPatient) {
      showFeedback("Please select a patient or link to an order.", "error");
      return;
    }
    if (resultParams.length === 0) {
      showFeedback("Please add at least one parameter.", "error");
      return;
    }
    if (resultParams.some(p => !p.name)) {
      showFeedback("All parameters must have a name.", "error");
      return;
    }

    const result: LabResult = {
      id: `result-${Date.now()}`,
      orderId: resultOrderId || "",
      patientId: linkedOrder?.patientId || selectedPatient?.id || "",
      patientName: linkedOrder?.patientName || selectedPatient?.name || "Manual Entry",
      testType: linkedOrder?.testType || orderTestType || "Lab Test",
      parameters: resultParams.map(p => ({ ...p, value: p.value || "0" })),
      status: "review",
      critical: isCritical,
      resultDate: new Date().toISOString(),
      notes: resultNotes || undefined,
    };
    persistResults([result, ...labResults]);
    if (resultOrderId) handleUpdateOrderStatus(resultOrderId, "completed");
    logActivity("result created", result.patientId, result.patientName, result.testType);
    showFeedback("Lab result saved successfully.", "success");
    setShowEnterResults(false);
    setResultOrderId("");
    setResultParams([]);
    setResultNotes("");
    setResultCritical(false);
    setSelectedPatient(null);
    setOrderTestType("");
    setActiveTab("results");
  }

  function handleUpdateResultStatus(id: string, status: LabResult["status"], rejectionReason?: string) {
    const result = labResults.find(r => r.id === id);
    if (!result) return;

    const updated: LabResult = {
      ...result,
      status,
      reviewedBy: "Current User",
      reviewDate: new Date().toISOString(),
      rejectionReason,
    };

    if (status === "approved" && onUpdatePatient) {
      // Note: Patient labResults sync skipped due to type mismatch
      // Lab results are stored in localStorage separately
      logActivity("result approved", result.patientId, result.patientName, result.testType);
      showFeedback("Lab result approved. Saved locally.", "success");
    } else if (status === "approved") {
      logActivity("result approved", result.patientId, result.patientName, result.testType);
      showFeedback("Lab result approved. Saved locally.", "success");
    } else if (status === "rejected") {
      logActivity("result rejected", result.patientId, result.patientName, result.testType, rejectionReason);
      showFeedback("Lab result rejected.", "success");
    } else {
      logActivity("result status changed", result.patientId, result.patientName, `${result.testType} → ${status}`);
      showFeedback(`Result marked as ${status}.`, "success");
    }

    persistResults(labResults.map(r => r.id === id ? updated : r));
    setShowRejectModal(false);
    setRejectionReason("");
  }

  function handleDeleteResult(id: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this lab result?",
      onConfirm: () => {
        const result = labResults.find(r => r.id === id);
        persistResults(labResults.filter(r => r.id !== id));
        logActivity("result deleted", result?.patientId, result?.patientName, result?.testType);
        showFeedback("Lab result deleted.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handleToggleCritical(id: string) {
    const result = labResults.find(r => r.id === id);
    if (!result) return;

    const hasCriticalParam = result.parameters.some(p => p.flag === "critical");
    if (hasCriticalParam && !result.critical) {
      showFeedback("Cannot clear critical flag: result has critical parameters.", "warning");
      return;
    }

    const updated = { ...result, critical: !result.critical };
    persistResults(labResults.map(r => r.id === id ? updated : r));
    logActivity("critical flag toggled", result.patientId, result.patientName, result.testType, updated.critical ? "marked critical" : "cleared critical");
    showFeedback(updated.critical ? "Result marked as critical." : "Critical flag cleared.", "success");
  }

  function handleSaveTemplate() {
    if (resultParams.length === 0) {
      showFeedback("Add parameters to save as template.", "warning");
      return;
    }
    const newTemplate: LabTemplate = {
      id: `tpl-${Date.now()}`,
      name: `Custom Template ${customTemplates.length + 1}`,
      category: orderTestType || "Custom",
      parameters: resultParams.map(({ value, ...rest }) => rest),
    };
    persistTemplates([...customTemplates, newTemplate]);
    logActivity("template saved", undefined, undefined, newTemplate.name);
    showFeedback("Template saved successfully.", "success");
  }

  function handleApplyTemplate(template: LabTemplate) {
    setResultParams(template.parameters.map(p => ({ ...p, value: "" })));
    setOrderTestType(template.category);
    logActivity("template applied", undefined, undefined, template.name);
    showFeedback(`Template "${template.name}" applied.`, "success");
  }

  function handleDeleteTemplate(templateId: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this template?",
      onConfirm: () => {
        persistTemplates(customTemplates.filter(t => t.id !== templateId));
        logActivity("template deleted", undefined, undefined, `Template ID: ${templateId}`);
        showFeedback("Template deleted.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handleExportOrdersCSV() {
    const filtered = labOrders.filter(o => {
      if (orderFilterStatus && o.status !== orderFilterStatus) return false;
      if (orderFilterPriority && o.priority !== orderFilterPriority) return false;
      if (orderFilterTestType && o.testType !== orderFilterTestType) return false;
      if (orderFilterDateFrom && new Date(o.orderDate) < new Date(orderFilterDateFrom)) return false;
      if (orderFilterDateTo && new Date(o.orderDate) > new Date(orderFilterDateTo + "T23:59:59")) return false;
      if (orderSearch) {
        const searchLower = orderSearch.toLowerCase();
        if (!o.patientName.toLowerCase().includes(searchLower) &&
            !o.orderNumber.toLowerCase().includes(searchLower) &&
            !o.testType.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      showFeedback("No orders to export with current filters.", "info");
      return;
    }

    const header = "ID,Order Number,Patient ID,Patient Name,Test Type,Priority,Status,Order Date,Ordered By,Clinical Notes\n";
    const rows = filtered.map(o => [
      `"${o.id}"`,
      `"${o.orderNumber}"`,
      `"${o.patientId}"`,
      `"${o.patientName}"`,
      `"${o.testType}"`,
      `"${o.priority}"`,
      `"${o.status}"`,
      `"${new Date(o.orderDate).toLocaleString()}"`,
      `"${o.orderedBy}"`,
      `"${(o.clinicalNotes || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("orders exported as CSV", undefined, undefined, `${filtered.length} records`);
    showFeedback(`Exported ${filtered.length} order(s) as CSV.`, "success");
  }

  function handleExportResultsCSV() {
    const filtered = labResults.filter(r => {
      if (resultFilterStatus && r.status !== resultFilterStatus) return false;
      if (resultFilterCritical && !r.critical) return false;
      if (resultFilterTestType && r.testType !== resultFilterTestType) return false;
      if (resultFilterDateFrom && new Date(r.resultDate) < new Date(resultFilterDateFrom)) return false;
      if (resultFilterDateTo && new Date(r.resultDate) > new Date(resultFilterDateTo + "T23:59:59")) return false;
      if (resultSearch) {
        const searchLower = resultSearch.toLowerCase();
        if (!r.patientName.toLowerCase().includes(searchLower) &&
            !r.testType.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      showFeedback("No results to export with current filters.", "info");
      return;
    }

    const header = "ID,Order ID,Patient ID,Patient Name,Test Type,Status,Critical,Result Date,Reviewed By,Review Date,Notes\n";
    const rows = filtered.map(r => [
      `"${r.id}"`,
      `"${r.orderId}"`,
      `"${r.patientId}"`,
      `"${r.patientName}"`,
      `"${r.testType}"`,
      `"${r.status}"`,
      `"${r.critical}"`,
      `"${new Date(r.resultDate).toLocaleString()}"`,
      `"${r.reviewedBy || ""}"`,
      `"${r.reviewDate ? new Date(r.reviewDate).toLocaleString() : ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-results-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("results exported as CSV", undefined, undefined, `${filtered.length} records`);
    showFeedback(`Exported ${filtered.length} result(s) as CSV.`, "success");
  }

  function handleExportResultTXT(result: LabResult) {
    const txt = `
LAB RESULT
==========
Patient: ${result.patientName} (${result.patientId})
Test Type: ${result.testType}
Result Date: ${new Date(result.resultDate).toLocaleString()}
Status: ${result.status}
Critical: ${result.critical ? "YES ⚠" : "No"}

PARAMETERS
${result.parameters.map((p, i) => `
${i + 1}. ${p.name}
   Value: ${p.value} ${p.unit}
   Reference Range: ${p.referenceRange}
   Flag: ${p.flag}
`).join("")}

NOTES
${result.notes || "None"}

${result.reviewedBy ? `Reviewed by: ${result.reviewedBy} on ${result.reviewDate ? new Date(result.reviewDate).toLocaleString() : ""}` : ""}

Generated by Clinic CRM
    `.trim();

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-result-${result.patientId}-${new Date(result.resultDate).toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    logActivity("result exported as TXT", result.patientId, result.patientName, result.testType);
    showFeedback("Result exported as TXT.", "success");
  }

  function handleExportActivityCSV() {
    if (labActivity.length === 0) {
      showFeedback("No activity to export.", "info");
      return;
    }

    const header = "Timestamp,Action,Patient ID,Patient Name,Details\n";
    const rows = labActivity.map(a => [
      `"${new Date(a.timestamp).toLocaleString()}"`,
      `"${a.action}"`,
      `"${a.patientId || ""}"`,
      `"${(a.patientName || "").replace(/"/g, '""')}"`,
      `"${(a.details || "").replace(/"/g, '""')}"`,
    ].join(",")).join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-activity-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showFeedback("Activity log exported.", "success");
  }

  function handleClearActivity() {
    setConfirmModal({
      message: "Are you sure you want to clear all activity logs?",
      onConfirm: () => {
        setLabActivity([]);
        writeJSON(LAB_ACTIVITY_KEY, []);
        showFeedback("Activity log cleared.", "success");
        setConfirmModal(null);
      },
    });
  }

  function handlePrintOrder(order: LabOrder) {
    const win = window.open("", "_blank");
    if (!win) {
      showFeedback("Popup blocked. Please allow popups for printing.", "error");
      return;
    }
    win.document.write(`
      <html><head><title>Lab Order - ${order.orderNumber}</title></head>
      <body style="font-family:sans-serif;padding:32px;color:#111;">
        <h2 style="margin-bottom:4px;">Lab Order</h2>
        <div style="color:#555;margin-bottom:20px;">${fmtDate(order.orderDate)} · ${order.orderNumber}</div>
        <div style="margin-bottom:16px;"><strong>Patient:</strong> ${order.patientName} (${order.patientId})</div>
        <div style="margin-bottom:16px;"><strong>Test Type:</strong> ${order.testType}</div>
        <div style="margin-bottom:16px;"><strong>Priority:</strong> ${order.priority.toUpperCase()}</div>
        <div style="margin-bottom:16px;"><strong>Ordered By:</strong> ${order.orderedBy}</div>
        ${order.clinicalNotes ? `<div style="margin-bottom:16px;"><strong>Clinical Notes:</strong> ${order.clinicalNotes}</div>` : ""}
        <div style="margin-top:32px;color:#777;font-size:12px;">Generated by Clinic CRM</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    logActivity("order printed", order.patientId, order.patientName, order.orderNumber);
  }

  function handlePrintResult(result: LabResult) {
    const win = window.open("", "_blank");
    if (!win) {
      showFeedback("Popup blocked. Please allow popups for printing.", "error");
      return;
    }
    const paramsHtml = result.parameters.map(p => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${p.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${p.value} ${p.unit}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${p.referenceRange}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${p.flag}</td>
      </tr>`).join("");
    win.document.write(`
      <html><head><title>Lab Result - ${result.patientName}</title></head>
      <body style="font-family:sans-serif;padding:32px;color:#111;">
        <h2 style="margin-bottom:4px;">Lab Result</h2>
        <div style="color:#555;margin-bottom:20px;">${fmtDate(result.resultDate)}</div>
        <div style="margin-bottom:16px;"><strong>Patient:</strong> ${result.patientName} (${result.patientId})</div>
        <div style="margin-bottom:16px;"><strong>Test Type:</strong> ${result.testType}</div>
        <div style="margin-bottom:16px;"><strong>Status:</strong> ${result.status} ${result.critical ? "⚠ CRITICAL" : ""}</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead><tr style="text-align:left;background:#f3f3f3;">
            <th style="padding:6px 10px;">Parameter</th><th style="padding:6px 10px;">Value</th>
            <th style="padding:6px 10px;">Reference Range</th><th style="padding:6px 10px;">Flag</th>
          </tr></thead>
          <tbody>${paramsHtml}</tbody>
        </table>
        ${result.notes ? `<div style="margin-bottom:16px;"><strong>Notes:</strong> ${result.notes}</div>` : ""}
        ${result.reviewedBy ? `<div style="margin-bottom:16px;"><strong>Reviewed By:</strong> ${result.reviewedBy} · ${result.reviewDate ? fmtDate(result.reviewDate) : ""}</div>` : ""}
        <div style="margin-top:32px;color:#777;font-size:12px;">Generated by Clinic CRM</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    logActivity("result printed", result.patientId, result.patientName, result.testType);
  }

  function handleCreateResultFromOrder(order: LabOrder) {
    setResultOrderId(order.id);
    setSelectedPatient(patients.find(p => p.id === order.patientId) || null);
    setOrderTestType(order.testType);
    if (TEST_TEMPLATES[order.testType]) {
      setResultParams(TEST_TEMPLATES[order.testType].map(p => ({ ...p })));
    }
    setShowEnterResults(true);
    logActivity("creating result from order", order.patientId, order.patientName, order.orderNumber);
  }

  function handleViewOrder(order: LabOrder) {
    setViewingOrder(order);
    setShowViewOrder(true);
  }

  function handleEditOrderModal(order: LabOrder) {
    if (order.status === "completed" || order.status === "cancelled") {
      showFeedback("Only pending or in-progress orders can be edited.", "warning");
      return;
    }
    setEditingOrder(order);
    setSelectedPatient(patients.find(p => p.id === order.patientId) || null);
    setOrderTestType(order.testType);
    setOrderPriority(order.priority);
    setOrderNotes(order.clinicalNotes || "");
    setShowEditOrder(true);
  }

  function handleEditResultModal(result: LabResult) {
    setEditingResult(result);
    setSelectedPatient(patients.find(p => p.id === result.patientId) || null);
    setOrderTestType(result.testType);
    setResultParams(result.parameters.map(p => ({ ...p })));
    setResultNotes(result.notes || "");
    setResultCritical(result.critical);
    setShowEditResult(true);
  }

  function handleUpdateResult() {
    if (!editingResult) return;
    if (resultParams.length === 0) {
      showFeedback("Please add at least one parameter.", "error");
      return;
    }

    const updated: LabResult = {
      ...editingResult,
      parameters: resultParams.map(p => ({ ...p, value: p.value || "0" })),
      notes: resultNotes || undefined,
      critical: resultCritical || resultParams.some(p => p.flag === "critical"),
    };
    persistResults(labResults.map(r => r.id === editingResult.id ? updated : r));
    logActivity("result updated", editingResult.patientId, editingResult.patientName, editingResult.testType);
    showFeedback("Lab result updated successfully.", "success");
    setEditingResult(null);
    setShowEditResult(false);
    setResultParams([]);
    setResultNotes("");
    setResultCritical(false);
    setSelectedPatient(null);
    setOrderTestType("");
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        if (e.key === "Escape") {
          if (confirmModal) setConfirmModal(null);
          if (showNewOrder) setShowNewOrder(false);
          if (showEditOrder) setShowEditOrder(false);
          if (showViewOrder) setShowViewOrder(false);
          if (showEnterResults) setShowEnterResults(false);
          if (showEditResult) setShowEditResult(false);
          if (showRejectModal) setShowRejectModal(false);
          if (showActivity) setShowActivity(false);
          if (showTemplates) setShowTemplates(false);
          if (viewingOrder) setViewingOrder(null);
          if (viewingResult) setViewingResult(null);
        }
        return;
      }
      if (e.key === "Escape") {
        if (confirmModal) setConfirmModal(null);
        if (showNewOrder) setShowNewOrder(false);
        if (showEditOrder) setShowEditOrder(false);
        if (showViewOrder) setShowViewOrder(false);
        if (showEnterResults) setShowEnterResults(false);
        if (showEditResult) setShowEditResult(false);
        if (showRejectModal) setShowRejectModal(false);
        if (showActivity) setShowActivity(false);
        if (showTemplates) setShowTemplates(false);
        if (viewingOrder) setViewingOrder(null);
        if (viewingResult) setViewingResult(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (showNewOrder && selectedPatient && orderTestType) handleCreateOrder();
        if (showEditOrder && editingOrder) handleEditOrder();
        if (showEnterResults) handleCreateResult();
        if (showEditResult && editingResult) handleUpdateResult();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, showNewOrder, showEditOrder, showViewOrder, showEnterResults, showEditResult, showRejectModal, showActivity, showTemplates, viewingOrder, viewingResult, selectedPatient, orderTestType, editingOrder, editingResult, resultParams]);

  const pendingOrders = labOrders.filter((o) => o.status === "pending");
  const inProgressOrders = labOrders.filter((o) => o.status === "in-progress");
  const completedOrders = labOrders.filter((o) => o.status === "completed");
  const criticalResults = labResults.filter((r) => r.critical === true);
  const pendingReview = labResults.filter((r) => r.status === "review");

  return (
    <div style={{ padding: "clamp(12px, 4vw, 24px)", maxWidth: 1400 }}>
      {/* Feedback display */}
      {feedback && (
        <div style={{
          padding: "10px 14px",
          marginBottom: 16,
          background: feedback.type === "success" ? "var(--green-bg)" : feedback.type === "error" ? "var(--red-bg)" : feedback.type === "warning" ? "var(--amber-bg)" : "var(--blue-bg)",
          color: feedback.type === "success" ? "var(--green)" : feedback.type === "error" ? "var(--red)" : feedback.type === "warning" ? "var(--amber)" : "var(--blue)",
          border: `1px solid ${feedback.type === "success" ? "var(--green-border)" : feedback.type === "error" ? "var(--red-border)" : feedback.type === "warning" ? "var(--amber-border)" : "var(--blue-border)"}`,
          borderRadius: "var(--radius)",
          fontSize: "var(--font-sm)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <i className={`ti ${feedback.type === "success" ? "ti-circle-check" : feedback.type === "error" ? "ti-alert-circle" : feedback.type === "warning" ? "ti-alert-triangle" : "ti-info-circle"}`} style={{ fontSize: 14 }} />
          {feedback.message}
        </div>
      )}

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
            Lab & Diagnostics
          </h1>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            Orders, results, imaging reports &amp; critical alerts
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowActivity(!showActivity)}>
            <i className="ti ti-history" style={{ marginRight: 4, fontSize: 12 }} />Activity
          </button>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowTemplates(!showTemplates)}>
            <i className="ti ti-template" style={{ marginRight: 4, fontSize: 12 }} />Templates
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, overflowX: "auto", WebkitOverflowScrolling: "touch" as const, paddingBottom: 4, scrollbarWidth: "none" as const }}>
        <StatCard label="Pending" value={pendingOrders.length} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
        <StatCard label="Completed" value={completedOrders.length} color="var(--green)" icon="ti-check" bg="var(--green-bg)" />
        <StatCard label="Critical" value={criticalResults.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Orders" value={labOrders.length} color="var(--blue)" icon="ti-test-tube" bg="var(--blue-bg)" />
        <StatCard label="Results" value={labResults.length} color="var(--accent)" icon="ti-file-text" bg="var(--accent-soft)" />
      </div>

      {/* Activity Panel */}
      {showActivity && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>Activity Log ({labActivity.length})</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleExportActivityCSV}>
                <i className="ti ti-download" style={{ fontSize: 11, marginRight: 4 }} />Export CSV
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", color: "var(--red)" }} onClick={handleClearActivity}>
                <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 4 }} />Clear
              </button>
            </div>
          </div>
          {labActivity.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
              <i className="ti ti-history" style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: "var(--font-xs)" }}>No activity recorded yet</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {labActivity.map((a, i) => (
                <div key={i} style={{ fontSize: "var(--font-xs)", padding: "8px 10px", background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{a.action}</span>
                    <span style={{ color: "var(--muted)" }}>{fmtDate(a.timestamp)}</span>
                  </div>
                  {a.patientName && <div style={{ color: "var(--muted)" }}>Patient: {a.patientName}</div>}
                  {a.details && <div style={{ color: "var(--muted)" }}>{a.details}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>Test Templates ({customTemplates.length})</div>
            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleSaveTemplate}>
              <i className="ti ti-device-floppy" style={{ fontSize: 11, marginRight: 4 }} />Save Current as Template
            </button>
          </div>
          {customTemplates.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
              <i className="ti ti-template" style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: "var(--font-xs)" }}>No custom templates. Add parameters and save as template.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {customTemplates.map((t) => (
                <div key={t.id} style={{ padding: 10, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 8 }}>{t.category} · {t.parameters.length} params</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", flex: 1 }} onClick={() => handleApplyTemplate(t)}>
                      Apply
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 8px", color: "var(--red)" }} onClick={() => handleDeleteTemplate(t.id)}>
                      <i className="ti ti-trash" style={{ fontSize: 11 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 400, width: "90%" }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 12 }}>Confirm Action</div>
            <div style={{ fontSize: "var(--font-sm)", marginBottom: 16, color: "var(--muted)" }}>{confirmModal.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={confirmModal.onConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

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
        <div className="card card-padded" style={{ overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search by patient, order number, test type..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", flex: 1, minWidth: 200 }}
              />
              <select
                value={orderFilterStatus}
                onChange={(e) => setOrderFilterStatus(e.target.value as "")}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={orderFilterPriority}
                onChange={(e) => setOrderFilterPriority(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Priorities</option>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">Stat</option>
              </select>
              <select
                value={orderFilterTestType}
                onChange={(e) => setOrderFilterTestType(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Test Types</option>
                <option value="cbc">CBC</option>
                <option value="bmp">BMP</option>
                <option value="lipid">Lipid Panel</option>
                <option value="thyroid">Thyroid Function</option>
                <option value="hba1c">HbA1c</option>
                <option value="urinalysis">Urinalysis</option>
                <option value="other">Other</option>
              </select>
              <input
                type="date"
                value={orderFilterDateFrom}
                onChange={(e) => setOrderFilterDateFrom(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <input
                type="date"
                value={orderFilterDateTo}
                onChange={(e) => setOrderFilterDateTo(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              {(orderFilterStatus || orderFilterPriority || orderFilterTestType || orderFilterDateFrom || orderFilterDateTo || orderSearch) && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => { setOrderFilterStatus(""); setOrderFilterPriority(""); setOrderFilterTestType(""); setOrderFilterDateFrom(""); setOrderFilterDateTo(""); setOrderSearch(""); }}>
                  Clear Filters
                </button>
              )}
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={handleExportOrdersCSV}>
                <i className="ti ti-download" style={{ marginRight: 4, fontSize: 11 }} />Export CSV
              </button>
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => setShowNewOrder(true)}>
                <i className="ti ti-plus" style={{ marginRight: 4, fontSize: 11 }} />New Order
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order #</th>
                  <th>Patient</th>
                  <th>Test Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = labOrders.filter(o => {
                    if (orderFilterStatus && o.status !== orderFilterStatus) return false;
                    if (orderFilterPriority && o.priority !== orderFilterPriority) return false;
                    if (orderFilterTestType && o.testType !== orderFilterTestType) return false;
                    if (orderFilterDateFrom && new Date(o.orderDate) < new Date(orderFilterDateFrom)) return false;
                    if (orderFilterDateTo && new Date(o.orderDate) > new Date(orderFilterDateTo + "T23:59:59")) return false;
                    if (orderSearch) {
                      const searchLower = orderSearch.toLowerCase();
                      if (!o.patientName.toLowerCase().includes(searchLower) &&
                          !o.orderNumber.toLowerCase().includes(searchLower) &&
                          !o.testType.toLowerCase().includes(searchLower)) {
                        return false;
                      }
                    }
                    return true;
                  });
                  if (filtered.length === 0) {
                    return (
                      <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-test-tube-off empty-state-icon" /><div className="empty-state-sub">No lab orders found with current filters</div></div></td></tr>
                    );
                  }
                  return filtered.map((o) => (
                    <tr key={o.id} className="tbl-row">
                      <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(o.orderDate)}</td>
                      <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{o.orderNumber}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{o.patientName}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{o.testType}</td>
                      <td>
                        <span className="badge" style={{
                          background: o.priority === "stat" ? "var(--red-bg)" : o.priority === "urgent" ? "var(--amber-bg)" : "var(--surface3)",
                          color: o.priority === "stat" ? "var(--red)" : o.priority === "urgent" ? "var(--amber)" : "var(--muted)",
                          border: o.priority === "stat" ? "1px solid var(--red-border)" : o.priority === "urgent" ? "1px solid var(--amber-border)" : "1px solid var(--border)",
                        }}>{o.priority.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: o.status === "completed" ? "var(--green-bg)" : o.status === "in-progress" ? "var(--accent-soft)" : o.status === "cancelled" ? "var(--red-bg)" : "var(--amber-bg)",
                          color: o.status === "completed" ? "var(--green)" : o.status === "in-progress" ? "var(--accent)" : o.status === "cancelled" ? "var(--red)" : "var(--amber)",
                          border: o.status === "completed" ? "1px solid var(--green-border)" : o.status === "in-progress" ? "1px solid var(--accent-border)" : o.status === "cancelled" ? "1px solid var(--red-border)" : "1px solid var(--amber-border)",
                        }}>{o.status}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleViewOrder(o)}>View</button>
                          {o.status !== "completed" && o.status !== "cancelled" && userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleEditOrderModal(o)}>Edit</button>
                          )}
                          {o.status === "pending" && userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleUpdateOrderStatus(o.id, "in-progress")}>Start</button>
                          )}
                          {o.status === "in-progress" && userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleUpdateOrderStatus(o.id, "completed")}>Complete</button>
                          )}
                          {o.status !== "completed" && o.status !== "cancelled" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleCreateResultFromOrder(o)}>Result</button>
                          )}
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handlePrintOrder(o)}>Print</button>
                          {userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleDeleteOrder(o.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "results" && (
        <div className="card card-padded" style={{ overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search by patient, test type..."
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", flex: 1, minWidth: 200 }}
              />
              <select
                value={resultFilterStatus}
                onChange={(e) => setResultFilterStatus(e.target.value as "")}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--font-sm)" }}>
                <input type="checkbox" checked={resultFilterCritical} onChange={(e) => setResultFilterCritical(e.target.checked)} />
                Critical Only
              </label>
              <select
                value={resultFilterTestType}
                onChange={(e) => setResultFilterTestType(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Test Types</option>
                <option value="cbc">CBC</option>
                <option value="bmp">BMP</option>
                <option value="lipid">Lipid Panel</option>
                <option value="thyroid">Thyroid Function</option>
                <option value="hba1c">HbA1c</option>
              </select>
              <input
                type="date"
                value={resultFilterDateFrom}
                onChange={(e) => setResultFilterDateFrom(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <input
                type="date"
                value={resultFilterDateTo}
                onChange={(e) => setResultFilterDateTo(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              {(resultFilterStatus || resultFilterCritical || resultFilterTestType || resultFilterDateFrom || resultFilterDateTo || resultSearch) && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => { setResultFilterStatus(""); setResultFilterCritical(false); setResultFilterTestType(""); setResultFilterDateFrom(""); setResultFilterDateTo(""); setResultSearch(""); }}>
                  Clear Filters
                </button>
              )}
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={handleExportResultsCSV}>
                <i className="ti ti-download" style={{ marginRight: 4, fontSize: 11 }} />Export CSV
              </button>
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => setShowEnterResults(true)}>
                <i className="ti ti-plus" style={{ marginRight: 4, fontSize: 11 }} />New Result
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Test Type</th>
                  <th>Status</th>
                  <th>Critical</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = labResults.filter(r => {
                    if (resultFilterStatus && r.status !== resultFilterStatus) return false;
                    if (resultFilterCritical && !r.critical) return false;
                    if (resultFilterTestType && r.testType !== resultFilterTestType) return false;
                    if (resultFilterDateFrom && new Date(r.resultDate) < new Date(resultFilterDateFrom)) return false;
                    if (resultFilterDateTo && new Date(r.resultDate) > new Date(resultFilterDateTo + "T23:59:59")) return false;
                    if (resultSearch) {
                      const searchLower = resultSearch.toLowerCase();
                      if (!r.patientName.toLowerCase().includes(searchLower) &&
                          !r.testType.toLowerCase().includes(searchLower)) {
                        return false;
                      }
                    }
                    return true;
                  });
                  if (filtered.length === 0) {
                    return (
                      <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-file-off empty-state-icon" /><div className="empty-state-sub">No lab results found with current filters</div></div></td></tr>
                    );
                  }
                  return filtered.map((r) => (
                    <tr key={r.id} className="tbl-row">
                      <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(r.resultDate)}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{r.patientName}</td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{r.testType}</td>
                      <td>
                        <span className="badge" style={{
                          background: r.status === "approved" ? "var(--green-bg)" : r.status === "review" ? "var(--amber-bg)" : r.status === "rejected" ? "var(--red-bg)" : "var(--surface3)",
                          color: r.status === "approved" ? "var(--green)" : r.status === "review" ? "var(--amber)" : r.status === "rejected" ? "var(--red)" : "var(--muted)",
                          border: r.status === "approved" ? "1px solid var(--green-border)" : r.status === "review" ? "1px solid var(--amber-border)" : r.status === "rejected" ? "1px solid var(--red-border)" : "1px solid var(--border)",
                        }}>{r.status}</span>
                      </td>
                      <td>
                        {r.critical && <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }}>⚠ Critical</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => setViewingResult(r)}>View</button>
                          {userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleEditResultModal(r)}>Edit</button>
                          )}
                          {r.status !== "approved" && r.status !== "rejected" && userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--green)" }} onClick={() => handleUpdateResultStatus(r.id, "approved")}>Approve</button>
                          )}
                          {r.status !== "approved" && r.status !== "rejected" && userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => { setEditingResult(r); setShowRejectModal(true); }}>Reject</button>
                          )}
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleToggleCritical(r.id)}>
                            {r.critical ? "Clear Critical" : "Mark Critical"}
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handlePrintResult(r)}>Print</button>
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={() => handleExportResultTXT(r)}>Export</button>
                          {userRole !== "receptionist" && (
                            <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", color: "var(--red)" }} onClick={() => handleDeleteResult(r.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
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
                { label: "Approved Results", value: labResults.filter(r => r.status === "approved").length, color: "var(--green)" },
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
              <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
              Critical Results ({criticalResults.length})
            </div>
            {criticalResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                <i className="ti ti-check-circle" style={{ fontSize: 32, marginBottom: 8 }} />
                <div>No critical results</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {criticalResults.map((r) => (
                  <div key={r.id} style={{ padding: 12, background: "var(--red-bg)", borderRadius: "var(--radius)", border: "1px solid var(--red-border)" }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--red)" }}>{r.patientName}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{r.testType} · {fmtDate(r.resultDate)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card card-padded">
            <div className="section-label" style={{ marginBottom: 12 }}>
              <i className="ti ti-history" style={{ marginRight: 4 }} />
              Recent Activity ({labActivity.slice(0, 10).length})
            </div>
            {labActivity.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                <i className="ti ti-history" style={{ fontSize: 32, marginBottom: 8 }} />
                <div>No activity recorded yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {labActivity.slice(0, 10).map((a, i) => (
                  <div key={i} style={{ fontSize: "var(--font-xs)", padding: "8px 10px", background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{a.action}</span>
                      <span style={{ color: "var(--muted)" }}>{fmtDate(a.timestamp)}</span>
                    </div>
                    {a.patientName && <div style={{ color: "var(--muted)" }}>Patient: {a.patientName}</div>}
                    {a.details && <div style={{ color: "var(--muted)" }}>{a.details}</div>}
                  </div>
                ))}
              </div>
            )}
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
                <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => { setShowNewOrder(false); setSelectedPatient(null); setOrderTestType(""); setOrderPriority("routine"); setOrderNotes(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, fontSize: "var(--font-sm)", fontWeight: 700 }}
                  disabled={!selectedPatient || !orderTestType}
                  onClick={handleCreateOrder}
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
                      setSelectedPatient(patients.find(p => p.id === order.patientId) || null);
                      setOrderTestType(order.testType);
                    } else if (e.target.value === "") {
                      setResultParams([]);
                      setSelectedPatient(null);
                      setOrderTestType("");
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
              )}
              {!resultOrderId && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Test Type (load template)</label>
                  <select
                    value={orderTestType}
                    onChange={(e) => {
                      setOrderTestType(e.target.value);
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Parameters</label>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => setResultParams([...resultParams, { name: "", value: "", unit: "", referenceRange: "", flag: "normal" }])}>
                      <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 2 }} />Add Row
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {resultParams.map((p, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", position: "relative" }}>
                        {resultParams.length > 1 && (
                          <button
                            className="btn-icon"
                            onClick={() => setResultParams(resultParams.filter((_, idx) => idx !== i))}
                            title="Remove parameter"
                            style={{ position: "absolute", top: 8, right: 8, padding: 4 }}
                          >
                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                          </button>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => {
                              const next = [...resultParams];
                              next[i] = { ...next[i], name: e.target.value };
                              setResultParams(next);
                            }}
                            placeholder="Parameter name"
                            style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                          />
                          <input
                            type="text"
                            value={p.unit}
                            onChange={(e) => {
                              const next = [...resultParams];
                              next[i] = { ...next[i], unit: e.target.value };
                              setResultParams(next);
                            }}
                            placeholder="Unit (e.g., mg/dL)"
                            style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <input
                            type="text"
                            value={p.referenceRange}
                            onChange={(e) => {
                              const next = [...resultParams];
                              next[i] = { ...next[i], referenceRange: e.target.value };
                              setResultParams(next);
                            }}
                            placeholder="Reference range"
                            style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            value={p.value}
                            onChange={(e) => {
                              const next = [...resultParams];
                              next[i] = { ...next[i], value: e.target.value };
                              setResultParams(next);
                            }}
                            placeholder="Value"
                            style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
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
                              fontSize: "var(--font-xs)", fontWeight: 600,
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
                <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => { setShowEnterResults(false); setResultOrderId(""); setResultParams([]); setResultNotes(""); setResultCritical(false); setSelectedPatient(null); setOrderTestType(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, fontSize: "var(--font-sm)", fontWeight: 700 }}
                  disabled={resultParams.length === 0 || resultParams.every(p => !p.value)}
                  onClick={handleCreateResult}
                >
                  <i className="ti ti-device-floppy" style={{ fontSize: 14, marginRight: 6 }} />Save Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {showViewOrder && viewingOrder && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 480, width: "90%", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>
                  <i className="ti ti-test-tube" style={{ marginRight: 4 }} />
                  Lab Order
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{fmtDate(viewingOrder.orderDate)}</div>
              </div>
              <button className="btn-icon" onClick={() => { setShowViewOrder(false); setViewingOrder(null); }} title="Close">
                <i className="ti ti-x" style={{ fontSize: 14 }} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{viewingOrder.patientName}</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{viewingOrder.patientId} · {viewingOrder.orderNumber}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Test Type</div>
              <div style={{ fontSize: "var(--font-sm)" }}>{viewingOrder.testType}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Priority</div>
              <span className="badge" style={{
                background: viewingOrder.priority === "stat" ? "var(--red-bg)" : viewingOrder.priority === "urgent" ? "var(--amber-bg)" : "var(--surface3)",
                color: viewingOrder.priority === "stat" ? "var(--red)" : viewingOrder.priority === "urgent" ? "var(--amber)" : "var(--muted)",
                border: viewingOrder.priority === "stat" ? "1px solid var(--red-border)" : viewingOrder.priority === "urgent" ? "1px solid var(--amber-border)" : "1px solid var(--border)",
              }}>{viewingOrder.priority.toUpperCase()}</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Status</div>
              <span className="badge" style={{
                background: viewingOrder.status === "completed" ? "var(--green-bg)" : viewingOrder.status === "in-progress" ? "var(--accent-soft)" : viewingOrder.status === "cancelled" ? "var(--red-bg)" : "var(--amber-bg)",
                color: viewingOrder.status === "completed" ? "var(--green)" : viewingOrder.status === "in-progress" ? "var(--accent)" : viewingOrder.status === "cancelled" ? "var(--red)" : "var(--amber)",
                border: viewingOrder.status === "completed" ? "1px solid var(--green-border)" : viewingOrder.status === "in-progress" ? "1px solid var(--accent-border)" : viewingOrder.status === "cancelled" ? "1px solid var(--red-border)" : "1px solid var(--amber-border)",
              }}>{viewingOrder.status}</span>
            </div>
            {viewingOrder.clinicalNotes && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Clinical Notes</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{viewingOrder.clinicalNotes}</div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Ordered By</div>
              <div style={{ fontSize: "var(--font-sm)" }}>{viewingOrder.orderedBy}</div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => handlePrintOrder(viewingOrder)}>
                <i className="ti ti-printer" style={{ fontSize: 13, marginRight: 4 }} />
                Print
              </button>
              {viewingOrder.status !== "completed" && viewingOrder.status !== "cancelled" && (
                <button className="btn btn-ghost" onClick={() => handleCreateResultFromOrder(viewingOrder)}>
                  <i className="ti ti-clipboard-plus" style={{ fontSize: 13, marginRight: 4 }} />
                  Create Result
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Result Modal */}
      {viewingResult && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 500, width: "90%", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>
                  <i className="ti ti-file-text" style={{ marginRight: 4 }} />
                  Lab Result
                </div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{fmtDate(viewingResult.resultDate)}</div>
              </div>
              <button className="btn-icon" onClick={() => setViewingResult(null)} title="Close">
                <i className="ti ti-x" style={{ fontSize: 14 }} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{viewingResult.patientName}</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>{viewingResult.patientId}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Test Type</div>
              <div style={{ fontSize: "var(--font-sm)" }}>{viewingResult.testType}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Status</div>
              <span className="badge" style={{
                background: viewingResult.status === "approved" ? "var(--green-bg)" : viewingResult.status === "review" ? "var(--amber-bg)" : viewingResult.status === "rejected" ? "var(--red-bg)" : "var(--surface3)",
                color: viewingResult.status === "approved" ? "var(--green)" : viewingResult.status === "review" ? "var(--amber)" : viewingResult.status === "rejected" ? "var(--red)" : "var(--muted)",
                border: viewingResult.status === "approved" ? "1px solid var(--green-border)" : viewingResult.status === "review" ? "1px solid var(--amber-border)" : viewingResult.status === "rejected" ? "1px solid var(--red-border)" : "1px solid var(--border)",
              }}>{viewingResult.status}</span>
            </div>
            {viewingResult.critical && (
              <div style={{ marginBottom: 12 }}>
                <span className="badge" style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }}>⚠ Critical Result</span>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Parameters</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {viewingResult.parameters.map((p, i) => (
                  <div key={i} style={{
                    padding: "8px 10px", borderRadius: "var(--radius)",
                    background: p.flag === "critical" ? "var(--red-bg)" : p.flag !== "normal" ? "var(--amber-bg)" : "var(--surface3)",
                    border: p.flag === "critical" ? "1px solid var(--red-border)" : p.flag !== "normal" ? "1px solid var(--amber-border)" : "1px solid transparent",
                  }}>
                    <div style={{ fontSize: "var(--font-xs)", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>Ref: {p.referenceRange}</div>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: p.flag === "critical" ? "var(--red)" : p.flag !== "normal" ? "var(--amber)" : "var(--text)" }}>
                      {p.value} {p.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {viewingResult.notes && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{viewingResult.notes}</div>
              </div>
            )}
            {viewingResult.rejectionReason && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--red)", marginBottom: 4 }}>Rejection Reason</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{viewingResult.rejectionReason}</div>
              </div>
            )}
            {viewingResult.reviewedBy && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Reviewed By</div>
                <div style={{ fontSize: "var(--font-sm)" }}>{viewingResult.reviewedBy} · {viewingResult.reviewDate ? fmtDate(viewingResult.reviewDate) : ""}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => handlePrintResult(viewingResult)}>
                <i className="ti ti-printer" style={{ fontSize: 13, marginRight: 4 }} />
                Print
              </button>
              <button className="btn btn-ghost" onClick={() => handleExportResultTXT(viewingResult)}>
                <i className="ti ti-download" style={{ fontSize: 13, marginRight: 4 }} />
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEditOrder && editingOrder && (
        <div className="modal-backdrop" onClick={() => { setShowEditOrder(false); setEditingOrder(null); }}>
          <div className="modal" style={{
            maxWidth: 500, width: "calc(100vw - 32px)",
            position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom))",
            left: "50%", transform: "translateX(-50%)",
            borderRadius: "16px", maxHeight: "90vh", display: "flex", flexDirection: "column",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Edit Lab Order</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>{editingOrder.orderNumber}</div>
              </div>
              <button className="btn-icon" style={{ width: 36, height: 36 }} onClick={() => { setShowEditOrder(false); setEditingOrder(null); setSelectedPatient(null); setOrderTestType(""); setOrderPriority("routine"); setOrderNotes(""); }}><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
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
                <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => { setShowEditOrder(false); setEditingOrder(null); setSelectedPatient(null); setOrderTestType(""); setOrderPriority("routine"); setOrderNotes(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, fontSize: "var(--font-sm)", fontWeight: 700 }}
                  disabled={!selectedPatient || !orderTestType}
                  onClick={handleEditOrder}
                >
                  <i className="ti ti-device-floppy" style={{ fontSize: 14, marginRight: 6 }} />Update Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Result Modal */}
      {showEditResult && editingResult && (
        <div className="modal-backdrop" onClick={() => { setShowEditResult(false); setEditingResult(null); }}>
          <div className="modal" style={{
            maxWidth: 540, width: "calc(100vw - 32px)",
            position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom))",
            left: "50%", transform: "translateX(-50%)",
            borderRadius: "16px", maxHeight: "92vh", display: "flex", flexDirection: "column",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Edit Lab Result</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 2 }}>{editingResult.testType}</div>
              </div>
              <button className="btn-icon" style={{ width: 36, height: 36 }} onClick={() => { setShowEditResult(false); setEditingResult(null); setResultParams([]); setResultNotes(""); setResultCritical(false); setSelectedPatient(null); setOrderTestType(""); }}><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: "var(--font-xs)", fontWeight: 700, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Parameters</label>
                  <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => setResultParams([...resultParams, { name: "", value: "", unit: "", referenceRange: "", flag: "normal" }])}>
                    <i className="ti ti-plus" style={{ fontSize: 11, marginRight: 2 }} />Add Row
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {resultParams.map((p, i) => (
                    <div key={i} style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", position: "relative" }}>
                      {resultParams.length > 1 && (
                        <button
                          className="btn-icon"
                          onClick={() => setResultParams(resultParams.filter((_, idx) => idx !== i))}
                          title="Remove parameter"
                          style={{ position: "absolute", top: 8, right: 8, padding: 4 }}
                        >
                          <i className="ti ti-x" style={{ fontSize: 12 }} />
                        </button>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => {
                            const next = [...resultParams];
                            next[i] = { ...next[i], name: e.target.value };
                            setResultParams(next);
                          }}
                          placeholder="Parameter name"
                          style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                        />
                        <input
                          type="text"
                          value={p.unit}
                          onChange={(e) => {
                            const next = [...resultParams];
                            next[i] = { ...next[i], unit: e.target.value };
                            setResultParams(next);
                          }}
                          placeholder="Unit (e.g., mg/dL)"
                          style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={p.referenceRange}
                          onChange={(e) => {
                            const next = [...resultParams];
                            next[i] = { ...next[i], referenceRange: e.target.value };
                            setResultParams(next);
                          }}
                          placeholder="Reference range"
                          style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={p.value}
                          onChange={(e) => {
                            const next = [...resultParams];
                            next[i] = { ...next[i], value: e.target.value };
                            setResultParams(next);
                          }}
                          placeholder="Value"
                          style={{ padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
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
                            fontSize: "var(--font-xs)", fontWeight: 600,
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
                <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => { setShowEditResult(false); setEditingResult(null); setResultParams([]); setResultNotes(""); setResultCritical(false); setSelectedPatient(null); setOrderTestType(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, fontSize: "var(--font-sm)", fontWeight: 700 }}
                  disabled={resultParams.length === 0}
                  onClick={handleUpdateResult}
                >
                  <i className="ti ti-device-floppy" style={{ fontSize: 14, marginRight: 6 }} />Update Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Result Modal */}
      {showRejectModal && editingResult && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card card-padded" style={{ maxWidth: 400, width: "90%" }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 12 }}>Reject Lab Result</div>
            <div style={{ fontSize: "var(--font-sm)", marginBottom: 16, color: "var(--muted)" }}>Please provide a reason for rejection:</div>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => { setShowRejectModal(false); setEditingResult(null); setRejectionReason(""); }}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => handleUpdateResultStatus(editingResult.id, "rejected", rejectionReason)}>Reject</button>
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

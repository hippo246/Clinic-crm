import React, { useState, useMemo, useRef, useEffect } from "react";
import type { Patient } from "./types";
import { fmtDate } from "./utils";

// ─── Responsive styles ────────────────────────────────────────────────────────
const billingCss = `
  .bl-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  @media (max-width: 768px) {
    .bl-page { padding: 16px !important; }
    .bl-stats { grid-template-columns: repeat(2, 1fr) !important; }
    .bl-insurance-stats { grid-template-columns: repeat(2, 1fr) !important; }
    .bl-section-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
    .bl-section-header .bl-full-btn { width: 100%; }
    .bl-table-scroll .tbl { min-width: 640px; }
    .bl-item-row {
      grid-template-columns: repeat(4, 1fr) !important;
      grid-template-areas: "desc desc desc desc" "qty price total del" !important;
      row-gap: 8px !important;
    }
    .bl-item-desc { grid-area: desc; }
    .bl-item-qty { grid-area: qty; }
    .bl-item-price { grid-area: price; }
    .bl-item-total { grid-area: total; }
    .bl-item-del { grid-area: del; justify-self: center; align-self: center; }
    .bl-modal-actions { flex-direction: column !important; }
    .bl-modal-actions button { width: 100%; }
  }
`;

interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: "draft" | "pending" | "partial" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  paidAmount: number;
  paymentMethod?: "cash" | "card" | "upi" | "bank_transfer" | "insurance";
  paymentHistory: Payment[];
  createdAt: string;
  notes?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Payment {
  id: string;
  amount: number;
  method: "cash" | "card" | "upi" | "bank_transfer" | "insurance";
  date: string;
  reference?: string;
}

interface BillingActivity {
  timestamp: string;
  action: string;
  patientId?: string;
  patientName?: string;
  invoiceNumber?: string;
  details?: string;
}

// ─── Safe localStorage helpers ────────────────────────────────────────────────
const INVOICES_KEY = "clinic_crm_invoices";
const BILLING_ACTIVITY_KEY = "clinic_crm_billing_activity";

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

// Common clinic services with typical prices — lets staff bill in one click
// instead of hand-typing every line item.
const COMMON_SERVICES: { label: string; price: number }[] = [
  { label: "Consultation Fee", price: 500 },
  { label: "Follow-up Consultation", price: 300 },
  { label: "Blood Test - CBC", price: 400 },
  { label: "X-Ray", price: 600 },
  { label: "ECG", price: 350 },
  { label: "Dressing / Wound Care", price: 200 },
  { label: "Injection Administration", price: 150 },
  { label: "Vaccination", price: 800 },
  { label: "Physiotherapy Session", price: 500 },
  { label: "Minor Procedure", price: 1200 },
];

// Common GST/tax slabs for one-click selection
const TAX_PRESETS = [0, 5, 12, 18];

export default function BillingPage({ patients, onUpdatePatient, userRole = "admin" }: { patients: Patient[]; onUpdatePatient?: (updated: Patient, action?: string) => void; userRole?: "receptionist" | "doctor" | "admin" }) {
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "insurance">("invoices");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showEditInvoice, setShowEditInvoice] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi" | "bank_transfer" | "insurance">("cash");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showActivity, setShowActivity] = useState(false);

  // Invoice filters
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<Invoice["status"] | "">("");
  const [invoiceFilterMethod, setInvoiceFilterMethod] = useState<Payment["method"] | "">("");
  const [invoiceFilterDateFrom, setInvoiceFilterDateFrom] = useState("");
  const [invoiceFilterDateTo, setInvoiceFilterDateTo] = useState("");
  const [invoiceFilterOverdue, setInvoiceFilterOverdue] = useState(false);

  const invoices = readJSON<Invoice[]>(INVOICES_KEY, []);
  const [billingActivity, setBillingActivity] = useState<BillingActivity[]>(() => readJSON<BillingActivity[]>(BILLING_ACTIVITY_KEY, []));

  // Auto-clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCreateInvoice) {
          setShowCreateInvoice(false);
        } else if (showPaymentModal) {
          setShowPaymentModal(false);
          setSelectedInvoice(null);
          setPaymentAmount("");
        } else if (confirmModal) {
          setConfirmModal(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        // Save functionality would be handled by the modal's submit button
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateInvoice, showPaymentModal, confirmModal]);

  function showFeedback(message: string, type: "success" | "error" | "info" | "warning" = "info") {
    setFeedback({ type, message });
  }

  function logActivity(action: string, patientId?: string, patientName?: string, invoiceNumber?: string, details?: string) {
    const activity: BillingActivity = {
      timestamp: new Date().toISOString(),
      action,
      patientId,
      patientName,
      invoiceNumber,
      details,
    };
    const next = [activity, ...billingActivity].slice(0, 50);
    setBillingActivity(next);
    writeJSON(BILLING_ACTIVITY_KEY, next);
  }
  
  // Enhance invoices with missing fields
  const enhancedInvoices = useMemo(() => {
    return invoices.map((inv: any) => ({
      ...inv,
      invoiceNumber: inv.invoiceNumber || `INV-${inv.id.split("-")[1]}`,
      items: inv.items || [{ id: "1", description: inv.description || "Services", quantity: 1, unitPrice: inv.amount || 0, total: inv.amount || 0 }],
      subtotal: inv.subtotal || inv.amount || 0,
      tax: inv.tax || 0,
      discount: inv.discount || 0,
      total: inv.total || inv.amount || 0,
      paidAmount: inv.paidAmount || (inv.status === "paid" ? inv.amount : 0),
      paymentHistory: inv.paymentHistory || [],
    }));
  }, [invoices]);

  const totalRevenue = enhancedInvoices.reduce((sum: number, inv: Invoice) => sum + inv.paidAmount, 0);
  const pendingAmount = enhancedInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.total - inv.paidAmount), 0);
  const overdueInvoices = enhancedInvoices.filter((inv: Invoice) => inv.status === "overdue");
  const pendingInvoices = enhancedInvoices.filter((inv: Invoice) => inv.status === "pending");

  const insuranceStats = useMemo(() => {
    const active = patients.filter(p => p.insuranceStatus === "Active").length;
    const expired = patients.filter(p => p.insuranceStatus === "Expired").length;
    const expiring = patients.filter(p => p.insuranceStatus === "Expiring").length;
    const none = patients.filter(p => p.insuranceStatus === "None").length;
    return { active, expired, expiring, none };
  }, [patients]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return enhancedInvoices.filter((inv: Invoice) => {
      if (invoiceFilterStatus && inv.status !== invoiceFilterStatus) return false;
      if (invoiceFilterMethod && inv.paymentMethod !== invoiceFilterMethod) return false;
      if (invoiceFilterDateFrom && new Date(inv.createdAt) < new Date(invoiceFilterDateFrom)) return false;
      if (invoiceFilterDateTo && new Date(inv.createdAt) > new Date(invoiceFilterDateTo + "T23:59:59")) return false;
      if (invoiceFilterOverdue && inv.status !== "overdue") return false;
      if (invoiceSearch) {
        const searchLower = invoiceSearch.toLowerCase();
        if (!inv.patientName.toLowerCase().includes(searchLower) &&
            !inv.patientId.toLowerCase().includes(searchLower) &&
            !inv.invoiceNumber.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [enhancedInvoices, invoiceSearch, invoiceFilterStatus, invoiceFilterMethod, invoiceFilterDateFrom, invoiceFilterDateTo, invoiceFilterOverdue]);

  const handleCreateInvoice = (invoiceData: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "paymentHistory">) => {
    const existingInvoices = readJSON<Invoice[]>(INVOICES_KEY, []);
    const year = new Date().getFullYear();
    // Sequential per year, e.g. INV-2026-0001, instead of a raw timestamp
    const seq = existingInvoices.filter((i: any) => (i.invoiceNumber || "").startsWith(`INV-${year}-`)).length + 1;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${year}-${String(seq).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      paymentHistory: [],
    };
    writeJSON(INVOICES_KEY, [...existingInvoices, newInvoice]);
    setShowCreateInvoice(false);
    logActivity("invoice created", invoiceData.patientId, invoiceData.patientName, newInvoice.invoiceNumber, `Total: $${invoiceData.total.toFixed(2)}`);
    showFeedback(`Invoice ${newInvoice.invoiceNumber} created successfully!`, "success");
  };

  const handleRecordPayment = () => {
    if (!selectedInvoice || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showFeedback("Please enter a valid payment amount.", "error");
      return;
    }

    const remainingBalance = selectedInvoice.total - selectedInvoice.paidAmount;
    if (amount > remainingBalance) {
      setConfirmModal({
        message: `Payment amount ($${amount.toFixed(2)}) exceeds remaining balance ($${remainingBalance.toFixed(2)}). Record as overpayment?`,
        onConfirm: () => {
          processPayment(selectedInvoice, amount);
        },
      });
      return;
    }

    processPayment(selectedInvoice, amount);
  };

  function processPayment(invoice: Invoice, amount: number) {
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      amount,
      method: paymentMethod,
      date: new Date().toISOString(),
    };

    const updatedInvoices = enhancedInvoices.map((inv: Invoice) => {
      if (inv.id === invoice.id) {
        const newPaidAmount = inv.paidAmount + amount;
        const newStatus = newPaidAmount >= inv.total ? "paid" : newPaidAmount > 0 ? "partial" : inv.status;
        return {
          ...inv,
          paidAmount: newPaidAmount,
          status: newStatus,
          paymentMethod: paymentMethod,
          paymentHistory: [...inv.paymentHistory, newPayment],
        };
      }
      return inv;
    });

    writeJSON(INVOICES_KEY, updatedInvoices);
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    logActivity("payment recorded", invoice.patientId, invoice.patientName, invoice.invoiceNumber, `$${amount.toFixed(2)} via ${paymentMethod}`);
    showFeedback(`Payment of $${amount.toFixed(2)} recorded successfully!`, "success");
  }

  const handlePrintInvoice = (inv: Invoice) => {
    const w = window.open("", "_blank");
    if (!w) {
      showFeedback("Please allow pop-ups for this site to print invoices.", "error");
      return;
    }
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = inv.items.map(it => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${esc(it.description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${it.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${it.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${it.total.toFixed(2)}</td>
      </tr>`).join("");
    w.document.write(`
      <html><head><title>${esc(inv.invoiceNumber)}</title></head>
      <body style="font-family:-apple-system,Arial,sans-serif;padding:32px;color:#111;">
        <h2 style="margin-bottom:4px;">Invoice ${esc(inv.invoiceNumber)}</h2>
        <div style="color:#666;margin-bottom:20px;">
          Patient: ${esc(inv.patientName)} &nbsp;·&nbsp; Date: ${esc(fmtDate(inv.createdAt))} &nbsp;·&nbsp; Due: ${esc(fmtDate(inv.dueDate))}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #111;">Description</th>
            <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #111;">Qty</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111;">Price</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111;">Total</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;">
          <div style="width:240px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Subtotal</span><span>$${inv.subtotal.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Tax</span><span>$${inv.tax.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Discount</span><span>-$${inv.discount.toFixed(2)}</span></div>
            <div style="border-top:1px solid #111;margin:8px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-weight:700;"><span>Total</span><span>$${inv.total.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;color:#666;"><span>Paid</span><span>$${inv.paidAmount.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;color:#666;"><span>Balance</span><span>$${(inv.total - inv.paidAmount).toFixed(2)}</span></div>
          </div>
        </div>
        ${inv.notes ? `<div style="margin-top:20px;color:#666;"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ""}
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
    logActivity("invoice printed", inv.patientId, inv.patientName, inv.invoiceNumber);
  };

  function handlePrintReceipt(invoice: Invoice, payment: Payment) {
    const w = window.open("", "_blank");
    if (!w) {
      showFeedback("Please allow pop-ups for this site to print receipts.", "error");
      return;
    }
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`
      <html><head><title>Receipt - ${esc(invoice.invoiceNumber)}</title></head>
      <body style="font-family:-apple-system,Arial,sans-serif;padding:32px;color:#111;">
        <h2 style="margin-bottom:4px;">Payment Receipt</h2>
        <div style="color:#666;margin-bottom:20px;">
          Receipt #: ${esc(payment.id)} &nbsp;·&nbsp; Invoice: ${esc(invoice.invoiceNumber)} &nbsp;·&nbsp; Date: ${esc(fmtDate(payment.date))}
        </div>
        <div style="margin-bottom:20px;">
          <div style="font-weight:700;">Patient: ${esc(invoice.patientName)}</div>
        </div>
        <div style="padding:16px;background:#f5f5f5;border-radius:8px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span>Amount Paid</span>
            <span style="font-size:1.5em;font-weight:700;color:var(--green);">$${payment.amount.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>Payment Method</span>
            <span style="font-weight:600;">${payment.method.toUpperCase()}</span>
          </div>
        </div>
        <div style="color:#666;font-size:0.9em;">
          Invoice Total: $${invoice.total.toFixed(2)} &nbsp;·&nbsp; Remaining Balance: $${(invoice.total - invoice.paidAmount).toFixed(2)}
        </div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
    logActivity("receipt printed", invoice.patientId, invoice.patientName, invoice.invoiceNumber, `$${payment.amount.toFixed(2)}`);
  }

  function handleUpdateInvoiceStatus(id: string, status: Invoice["status"]) {
    const updatedInvoices = enhancedInvoices.map((inv: Invoice) =>
      inv.id === id ? { ...inv, status } : inv
    );
    writeJSON(INVOICES_KEY, updatedInvoices);
    const invoice = enhancedInvoices.find((i: Invoice) => i.id === id);
    logActivity("invoice status updated", invoice?.patientId, invoice?.patientName, invoice?.invoiceNumber, `Status: ${status}`);
    showFeedback(`Invoice marked as ${status}.`, "success");
  }

  function handleDeleteInvoice(id: string) {
    setConfirmModal({
      message: "Are you sure you want to delete this invoice? This action cannot be undone.",
      onConfirm: () => {
        const invoice = enhancedInvoices.find((i: Invoice) => i.id === id);
        const updatedInvoices = enhancedInvoices.filter((inv: Invoice) => inv.id !== id);
        writeJSON(INVOICES_KEY, updatedInvoices);
        logActivity("invoice deleted", invoice?.patientId, invoice?.patientName, invoice?.invoiceNumber);
        showFeedback("Invoice deleted.", "success");
      },
    });
  }

  function handleDuplicateInvoice(invoice: Invoice) {
    const existingInvoices = readJSON<Invoice[]>(INVOICES_KEY, []);
    const year = new Date().getFullYear();
    const seq = existingInvoices.filter((i: any) => (i.invoiceNumber || "").startsWith(`INV-${year}-`)).length + 1;
    const newInvoice: Invoice = {
      ...invoice,
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${year}-${String(seq).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      status: "draft",
      paidAmount: 0,
      paymentHistory: [],
      items: invoice.items.map((item, idx) => ({ ...item, id: `item-${Date.now()}-${idx}` })),
    };
    writeJSON(INVOICES_KEY, [...existingInvoices, newInvoice]);
    logActivity("invoice duplicated", invoice.patientId, invoice.patientName, invoice.invoiceNumber, `New: ${newInvoice.invoiceNumber}`);
    showFeedback(`Invoice duplicated as ${newInvoice.invoiceNumber}.`, "success");
  }

  function handleEditInvoiceModal(invoice: Invoice) {
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      setConfirmModal({
        message: "This invoice is paid or cancelled. Editing may affect payment records. Continue?",
        onConfirm: () => {
          setEditingInvoice(invoice);
          setShowEditInvoice(true);
        },
      });
      return;
    }
    setEditingInvoice(invoice);
    setShowEditInvoice(true);
  }

  function handleUpdateInvoice(invoiceData: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "paymentHistory">) {
    if (!editingInvoice) return;
    const updatedInvoices = enhancedInvoices.map((inv: Invoice) =>
      inv.id === editingInvoice.id ? { ...invoiceData, id: inv.id, invoiceNumber: inv.invoiceNumber, createdAt: inv.createdAt, paymentHistory: inv.paymentHistory } : inv
    );
    writeJSON(INVOICES_KEY, updatedInvoices);
    setShowEditInvoice(false);
    setEditingInvoice(null);
    logActivity("invoice updated", invoiceData.patientId, invoiceData.patientName, editingInvoice.invoiceNumber, `Total: $${invoiceData.total.toFixed(2)}`);
    showFeedback(`Invoice ${editingInvoice.invoiceNumber} updated successfully.`, "success");
  }

  function handleExportInvoicesCSV() {
    if (enhancedInvoices.length === 0) {
      showFeedback("No invoices to export.", "info");
      return;
    }
    const headers = ["Invoice Number", "Patient", "Patient ID", "Date", "Due Date", "Subtotal", "Tax", "Discount", "Total", "Paid", "Balance", "Status", "Payment Method"];
    const rows = enhancedInvoices.map((inv: Invoice) => [
      inv.invoiceNumber,
      inv.patientName,
      inv.patientId,
      fmtDate(inv.createdAt),
      fmtDate(inv.dueDate),
      inv.subtotal.toFixed(2),
      inv.tax.toFixed(2),
      inv.discount.toFixed(2),
      inv.total.toFixed(2),
      inv.paidAmount.toFixed(2),
      (inv.total - inv.paidAmount).toFixed(2),
      inv.status,
      inv.paymentMethod || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity("invoices exported");
    showFeedback(`Exported ${enhancedInvoices.length} invoice(s) as CSV.`, "success");
  }

  function handleExportPaymentsCSV() {
    const allPayments = enhancedInvoices.flatMap((inv: Invoice) =>
      inv.paymentHistory.map((pay: Payment) => ({
        ...pay,
        invoiceNumber: inv.invoiceNumber,
        patientName: inv.patientName,
        patientId: inv.patientId,
      }))
    );
    if (allPayments.length === 0) {
      showFeedback("No payments to export.", "info");
      return;
    }
    const headers = ["Payment ID", "Invoice Number", "Patient", "Patient ID", "Date", "Amount", "Method", "Reference"];
    const rows = allPayments.map((p: any) => [
      p.id,
      p.invoiceNumber,
      p.patientName,
      p.patientId,
      fmtDate(p.date),
      p.amount.toFixed(2),
      p.method,
      p.reference || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity("payments exported");
    showFeedback(`Exported ${allPayments.length} payment(s) as CSV.`, "success");
  }

  function handleExportInsuranceCSV() {
    if (patients.length === 0) {
      showFeedback("No patients to export.", "info");
      return;
    }
    const headers = ["Patient ID", "Name", "Insurance Status", "Expiry Date"];
    const rows = patients.map((p: Patient) => [
      p.id,
      p.name,
      p.insuranceStatus || "None",
      (p as any).insuranceExpiry ? fmtDate((p as any).insuranceExpiry) : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity("insurance exported");
    showFeedback(`Exported ${patients.length} patient(s) insurance data as CSV.`, "success");
  }

  function handleExportActivityCSV() {
    if (billingActivity.length === 0) {
      showFeedback("No activity to export.", "info");
      return;
    }
    const headers = ["Timestamp", "Action", "Patient ID", "Patient Name", "Invoice Number", "Details"];
    const rows = billingActivity.map((a: BillingActivity) => [
      fmtDate(a.timestamp),
      a.action,
      a.patientId || "",
      a.patientName || "",
      a.invoiceNumber || "",
      a.details || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing_activity_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported ${billingActivity.length} activity entries as CSV.`, "success");
  }

  function handleClearActivity() {
    setConfirmModal({
      message: "Are you sure you want to clear all billing activity logs?",
      onConfirm: () => {
        setBillingActivity([]);
        writeJSON(BILLING_ACTIVITY_KEY, []);
        showFeedback("Activity log cleared.", "success");
      },
    });
  }

  return (
    <div className="bl-page" style={{ padding: 24, maxWidth: 1600 }}>
      <style>{billingCss}</style>
      {/* Feedback Display */}
      {feedback && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 2000,
          padding: "12px 20px", borderRadius: "var(--radius)",
          background: feedback.type === "success" ? "var(--green-bg)" :
                    feedback.type === "error" ? "var(--red-bg)" :
                    feedback.type === "warning" ? "var(--amber-bg)" : "var(--blue-bg)",
          color: feedback.type === "success" ? "var(--green)" :
                 feedback.type === "error" ? "var(--red)" :
                 feedback.type === "warning" ? "var(--amber)" : "var(--blue)",
          border: feedback.type === "success" ? "1px solid var(--green-border)" :
                 feedback.type === "error" ? "1px solid var(--red-border)" :
                 feedback.type === "warning" ? "1px solid var(--amber-border)" : "1px solid var(--blue-border)",
          fontWeight: 600, fontSize: "var(--font-sm)",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          <i className={`ti ${feedback.type === "success" ? "ti-check" : feedback.type === "error" ? "ti-x-circle" : feedback.type === "warning" ? "ti-alert-triangle" : "ti-info-circle"}`} style={{ fontSize: 16 }} />
          {feedback.message}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Billing & Payments
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Manage invoices, payments, insurance claims, and receipts
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={() => setShowActivity(!showActivity)}>
            <i className="ti ti-history" style={{ marginRight: 4, fontSize: 12 }} />Activity ({billingActivity.length})
          </button>
        </div>
      </div>

      {/* Activity Panel */}
      {showActivity && (
        <div className="card card-padded" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>Activity Log ({billingActivity.length})</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px" }} onClick={handleExportActivityCSV}>
                <i className="ti ti-download" style={{ fontSize: 11, marginRight: 4 }} />Export CSV
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "4px 10px", color: "var(--red)" }} onClick={handleClearActivity}>
                <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 4 }} />Clear
              </button>
            </div>
          </div>
          {billingActivity.length === 0 ? (
            <div className="empty-state"><div className="empty-state-sub">No activity recorded</div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {billingActivity.slice(0, 20).map((a, i) => (
                <div key={i} style={{ fontSize: "var(--font-xs)", padding: 8, background: "var(--surface2)", borderRadius: "var(--radius)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{a.action}</div>
                  <div style={{ color: "var(--muted)" }}>{fmtDate(a.timestamp)}</div>
                  {(a.patientName || a.invoiceNumber || a.details) && (
                    <div style={{ color: "var(--muted)" }}>
                      {a.patientName && `${a.patientName} · `}
                      {a.invoiceNumber && `${a.invoiceNumber} · `}
                      {a.details}
                    </div>
                  )}
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
              <button className="btn btn-danger" style={{ background: "var(--red)", color: "#fff" }} onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Overview */}
      <div className="bl-stats" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="var(--green)" icon="ti-currency-dollar" bg="var(--green-bg)" />
        <StatCard label="Pending" value={`$${pendingAmount.toFixed(2)}`} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
        <StatCard label="Overdue" value={overdueInvoices.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Paid Invoices" value={enhancedInvoices.filter((i: Invoice) => i.status === "paid").length} color="var(--blue)" icon="ti-check" bg="var(--blue-bg)" />
        <StatCard label="Total Invoices" value={enhancedInvoices.length} color="var(--accent)" icon="ti-receipt" bg="var(--accent-soft)" />
      </div>

      {enhancedInvoices.length === 0 && (
        <div className="card card-padded" style={{ marginBottom: 24, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "var(--muted)" }}>
            <i className="ti ti-file-invoice" style={{ fontSize: 48 }} />
          </div>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 8 }}>No invoices yet</div>
          <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)", marginBottom: 16 }}>
            Start creating invoices to track payments and manage billing
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateInvoice(true)}>
            <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
            Create Your First Invoice
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <TabButton active={activeTab === "invoices"} onClick={() => setActiveTab("invoices")}>Invoices</TabButton>
          <TabButton active={activeTab === "payments"} onClick={() => setActiveTab("payments")}>Payments</TabButton>
          <TabButton active={activeTab === "insurance"} onClick={() => setActiveTab("insurance")}>Insurance</TabButton>
        </div>
      </div>

      {activeTab === "invoices" && (
        <div>
          <div className="bl-section-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Invoice Management</div>
            <button className="btn btn-primary bl-full-btn" onClick={() => setShowCreateInvoice(true)}>
              <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
              Create Invoice
            </button>
          </div>

          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search by patient, invoice number..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", flex: 1, minWidth: 200 }}
              />
              <select
                value={invoiceFilterStatus}
                onChange={(e) => setInvoiceFilterStatus(e.target.value as Invoice["status"] | "")}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={invoiceFilterMethod}
                onChange={(e) => setInvoiceFilterMethod(e.target.value as Payment["method"] | "")}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="insurance">Insurance</option>
              </select>
              <input
                type="date"
                value={invoiceFilterDateFrom}
                onChange={(e) => setInvoiceFilterDateFrom(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <input
                type="date"
                value={invoiceFilterDateTo}
                onChange={(e) => setInvoiceFilterDateTo(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--font-sm)" }}>
                <input type="checkbox" checked={invoiceFilterOverdue} onChange={(e) => setInvoiceFilterOverdue(e.target.checked)} />
                Overdue Only
              </label>
              {(invoiceSearch || invoiceFilterStatus || invoiceFilterMethod || invoiceFilterDateFrom || invoiceFilterDateTo || invoiceFilterOverdue) && (
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={() => { setInvoiceSearch(""); setInvoiceFilterStatus(""); setInvoiceFilterMethod(""); setInvoiceFilterDateFrom(""); setInvoiceFilterDateTo(""); setInvoiceFilterOverdue(false); }}>
                  Clear Filters
                </button>
              )}
              <button className="btn btn-primary" style={{ fontSize: "var(--font-xs)", padding: "6px 10px" }} onClick={handleExportInvoicesCSV}>
                <i className="ti ti-download" style={{ marginRight: 4, fontSize: 11 }} />Export CSV
              </button>
            </div>
          </div>

          <div className="card bl-table-scroll">
            <table className="tbl" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><i className="ti ti-file-off" style={{ fontSize: 32, color: "var(--muted)" }} /></div>
                      <div className="empty-state-sub">
                        {enhancedInvoices.length === 0 ? "No invoices yet. Create your first invoice to get started." : "No invoices found with current filters"}
                      </div>
                      {enhancedInvoices.length === 0 && (
                        <button className="btn btn-primary" style={{ marginTop: 12, fontSize: "var(--font-xs)" }} onClick={() => setShowCreateInvoice(true)}>
                          <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />Create Invoice
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : filteredInvoices.map((inv: Invoice) => (
                  <tr key={inv.id} className="tbl-row">
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{inv.patientName}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(inv.createdAt)}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>{fmtDate(inv.dueDate)}</td>
                    <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>${inv.total.toFixed(2)}</td>
                    <td style={{ fontSize: "var(--font-sm)" }}>${inv.paidAmount.toFixed(2)}</td>
                    <td>
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }}
                            onClick={() => { setSelectedInvoice(inv); setShowPaymentModal(true); }}
                          >
                            Pay
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleEditInvoiceModal(inv)} title="Edit">
                          <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handlePrintInvoice(inv)} title="Print invoice">
                          <i className="ti ti-print" style={{ fontSize: 12 }} />
                        </button>
                        {(inv.status === "paid" || inv.status === "partial") && inv.paymentHistory.length > 0 && (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handlePrintReceipt(inv, inv.paymentHistory[inv.paymentHistory.length - 1])} title="Print receipt">
                            <i className="ti ti-receipt" style={{ fontSize: 12 }} />
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handleDuplicateInvoice(inv)} title="Duplicate">
                          <i className="ti ti-copy" style={{ fontSize: 12 }} />
                        </button>
                        {inv.status === "draft" || inv.status === "pending" ? (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--amber)" }} onClick={() => handleUpdateInvoiceStatus(inv.id, "cancelled")} title="Cancel">
                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                          </button>
                        ) : null}
                        {userRole !== "doctor" && (
                          <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px", color: "var(--red)" }} onClick={() => handleDeleteInvoice(inv.id)} title="Delete">
                            <i className="ti ti-trash" style={{ fontSize: 12 }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div>
          <div className="bl-section-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Payment History</div>
            <button className="btn btn-primary bl-full-btn" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={handleExportPaymentsCSV}>
              <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
              Export CSV
            </button>
          </div>
          <div className="card card-padded">
            {enhancedInvoices.flatMap((inv: Invoice) =>
              inv.paymentHistory.map((pay: Payment) => (
                <div key={pay.id} style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)",
                  marginBottom: 8
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: "var(--green-bg)", color: "var(--green)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className="ti ti-check" style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>${pay.amount.toFixed(2)} - {inv.patientName}</div>
                    <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                      Invoice {inv.invoiceNumber} · {fmtDate(pay.date)} · {pay.method.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handlePrintInvoice(inv)} title="View invoice">
                      <i className="ti ti-file-text" style={{ fontSize: 12 }} />
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handlePrintReceipt(inv, pay)} title="Print receipt">
                      <i className="ti ti-print" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </div>
              ))
            )}
            {enhancedInvoices.flatMap((inv: Invoice) => inv.paymentHistory).length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon"><i className="ti ti-cash-off" style={{ fontSize: 32, color: "var(--muted)" }} /></div>
                <div className="empty-state-sub">No payment history found</div>
                <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 8 }}>Record payments from the Invoices tab</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "insurance" && (
        <div>
          <div className="bl-section-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Insurance Overview</div>
            <button className="btn btn-primary bl-full-btn" style={{ fontSize: "var(--font-xs)", padding: "6px 12px" }} onClick={handleExportInsuranceCSV}>
              <i className="ti ti-download" style={{ fontSize: 12, marginRight: 4 }} />
              Export CSV
            </button>
          </div>
          <div className="bl-insurance-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard label="Active" value={insuranceStats.active} color="var(--green)" icon="ti-shield-check" bg="var(--green-bg)" />
            <StatCard label="Expiring" value={insuranceStats.expiring} color="var(--amber)" icon="ti-shield-exclamation" bg="var(--amber-bg)" />
            <StatCard label="Expired" value={insuranceStats.expired} color="var(--red)" icon="ti-shield-x" bg="var(--red-bg)" />
            <StatCard label="No Insurance" value={insuranceStats.none} color="var(--muted)" icon="ti-shield-off" bg="var(--surface3)" />
          </div>

          {insuranceStats.expired > 0 && (
            <div className="card card-padded" style={{ marginBottom: 16, border: "2px solid var(--red-border)", background: "var(--red-bg)" }}>
              <div className="section-label" style={{ color: "var(--red)", marginBottom: 12 }}>
                <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                Expired Insurance ({insuranceStats.expired})
              </div>
              <div style={{ fontSize: "var(--font-sm)", color: "var(--red)" }}>
                {insuranceStats.expired} patients have expired insurance. Please contact them to update their coverage.
              </div>
            </div>
          )}

          <div className="card card-padded">
            <div style={{ fontSize: "var(--font-sm)", fontWeight: 700, marginBottom: 12 }}>Patients by Insurance Status</div>
            <div className="bl-table-scroll">
              <table className="tbl" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Expiry Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.length === 0 ? (
                    <tr><td colSpan={5}>
                      <div className="empty-state">
                        <div className="empty-state-icon"><i className="ti ti-users" style={{ fontSize: 32, color: "var(--muted)" }} /></div>
                        <div className="empty-state-sub">No patients found</div>
                      </div>
                    </td></tr>
                  ) : patients.map((p: Patient) => (
                    <tr key={p.id} className="tbl-row">
                      <td style={{ fontSize: "var(--font-sm)" }}>{p.id}</td>
                      <td style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span className="badge" style={{
                          background: p.insuranceStatus === "Active" ? "var(--green-bg)" :
                                   p.insuranceStatus === "Expiring" ? "var(--amber-bg)" :
                                   p.insuranceStatus === "Expired" ? "var(--red-bg)" : "var(--surface3)",
                          color: p.insuranceStatus === "Active" ? "var(--green)" :
                                 p.insuranceStatus === "Expiring" ? "var(--amber)" :
                                 p.insuranceStatus === "Expired" ? "var(--red)" : "var(--muted)",
                          border: p.insuranceStatus === "Active" ? "1px solid var(--green-border)" :
                                 p.insuranceStatus === "Expiring" ? "1px solid var(--amber-border)" :
                                 p.insuranceStatus === "Expired" ? "1px solid var(--red-border)" : "1px solid var(--border)",
                          fontSize: "var(--font-xs)",
                        }}>
                          {p.insuranceStatus || "None"}
                        </span>
                      </td>
                      <td style={{ fontSize: "var(--font-sm)" }}>{(p as any).insuranceExpiry ? fmtDate((p as any).insuranceExpiry) : "-"}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }}
                          onClick={() => showFeedback("Patient navigation requires parent integration.", "info")}
                          title="View patient"
                        >
                          <i className="ti ti-user" style={{ fontSize: 12 }} />
                        </button>
                        {p.insuranceStatus === "Active" && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }}
                            onClick={() => {
                              setSelectedInvoice(null);
                              setShowCreateInvoice(true);
                              setTimeout(() => {
                                const patientSelect = document.querySelector('select[value=""]') as HTMLSelectElement;
                                if (patientSelect) {
                                  patientSelect.value = p.id;
                                  patientSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                              }, 100);
                            }}
                            title="Create insurance invoice"
                          >
                            <i className="ti ti-file-invoice" style={{ fontSize: 12 }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateInvoice && (
        <CreateInvoiceModal
          patients={patients}
          onClose={() => setShowCreateInvoice(false)}
          onCreateInvoice={handleCreateInvoice}
        />
      )}

      {/* Edit Invoice Modal */}
      {showEditInvoice && editingInvoice && (
        <EditInvoiceModal
          patients={patients}
          invoice={editingInvoice}
          onClose={() => { setShowEditInvoice(false); setEditingInvoice(null); }}
          onUpdateInvoice={handleUpdateInvoice}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-backdrop" onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); setPaymentAmount(""); }}>
          <div className="modal" style={{ maxWidth: 400, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Record Payment</div>
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                Invoice {selectedInvoice.invoiceNumber} · Balance: ${(selectedInvoice.total - selectedInvoice.paidAmount).toFixed(2)}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Amount ($)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="insurance">Insurance</option>
                </select>
              </div>
              <div className="bl-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); setPaymentAmount(""); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleRecordPayment} disabled={!paymentAmount}>
                  Record Payment
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
  value: string | number;
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

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const colors: Record<Invoice["status"], { bg: string; color: string; border: string }> = {
    draft: { bg: "var(--gray-bg)", color: "var(--gray)", border: "var(--gray-border)" },
    pending: { bg: "var(--amber-bg)", color: "var(--amber)", border: "var(--amber-border)" },
    partial: { bg: "var(--blue-bg)", color: "var(--blue)", border: "var(--blue-border)" },
    paid: { bg: "var(--green-bg)", color: "var(--green)", border: "var(--green-border)" },
    overdue: { bg: "var(--red-bg)", color: "var(--red)", border: "var(--red-border)" },
    cancelled: { bg: "var(--gray-bg)", color: "var(--gray)", border: "var(--gray-border)" },
  };
  const c = colors[status];
  return (
    <span className="badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: "var(--font-xs)" }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CreateInvoiceModal({ 
  patients, 
  onClose, 
  onCreateInvoice 
}: { 
  patients: Patient[]; 
  onClose: () => void; 
  onCreateInvoice: (data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "paymentHistory">) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([{ id: "item-1", description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false); // becomes true after a submit attempt, drives inline error highlighting
  const nextItemId = useRef(1);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax - discount;

  // Per-item validity — used both for the live inline highlighting and for the actual submit gate,
  // so the button's behavior always matches what's shown on screen.
  const itemIssues = items.map(item => {
    if (!item.description.trim()) return "description";
    if (!item.quantity || item.quantity <= 0) return "quantity";
    if (!item.unitPrice || item.unitPrice <= 0) return "price";
    return null;
  });
  const hasItemErrors = itemIssues.some(issue => issue !== null);
  const canSubmit = !!selectedPatient && items.length > 0 && !hasItemErrors;

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    nextItemId.current += 1;
    setItems([...items, { id: `item-${nextItemId.current}`, description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  // One-click add a common clinic service, fully filled in — no typing required
  const addPresetItem = (service: { label: string; price: number }) => {
    nextItemId.current += 1;
    setItems([...items, { id: `item-${nextItemId.current}`, description: service.label, quantity: 1, unitPrice: service.price, total: service.price }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!selectedPatient || !canSubmit) return; // inline messages below already show exactly what's missing

    onCreateInvoice({
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      items,
      subtotal,
      tax,
      discount,
      total,
      status: "pending",
      dueDate,
      paidAmount: 0,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, width: "92vw", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Create Invoice</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient *</label>
            <select
              value={selectedPatient?.id || ""}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: `1px solid ${touched && !selectedPatient ? "var(--red)" : "var(--border)"}`, fontSize: "var(--font-sm)" }}
            >
              <option value="">Select patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
            {touched && !selectedPatient && (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 4 }}>Please select a patient</div>
            )}
            {selectedPatient && (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <span>ID: {selectedPatient.id}</span>
                {selectedPatient.age ? <span>· Age {selectedPatient.age}</span> : null}
                {selectedPatient.phone ? <span>· {selectedPatient.phone}</span> : null}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Line Items *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value=""
                  onChange={(e) => {
                    const svc = COMMON_SERVICES.find(s => s.label === e.target.value);
                    if (svc) addPresetItem(svc);
                  }}
                  style={{ fontSize: "var(--font-xs)", padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface1)" }}
                >
                  <option value="">+ Quick add service…</option>
                  {COMMON_SERVICES.map(s => (
                    <option key={s.label} value={s.label}>{s.label} (${s.price})</option>
                  ))}
                </select>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={addItem}>
                  <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add Item
                </button>
              </div>
            </div>
            {items.map((item, index) => {
              const issue = itemIssues[index];
              const errBorder = (field: "description" | "quantity" | "price") =>
                touched && issue === field ? "1px solid var(--red)" : "1px solid var(--border)";
              return (
              <div key={item.id} className="bl-item-row" style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  className="bl-item-desc"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: errBorder("description"), fontSize: "var(--font-sm)" }}
                />
                <input
                  type="number"
                  placeholder="Qty"
                  min={0}
                  step={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                  className="bl-item-qty"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: errBorder("quantity"), fontSize: "var(--font-sm)" }}
                />
                <input
                  type="number"
                  placeholder="Price"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                  className="bl-item-price"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: errBorder("price"), fontSize: "var(--font-sm)" }}
                />
                <div className="bl-item-total" style={{ padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", textAlign: "right" }}>
                  ${item.total.toFixed(2)}
                </div>
                {items.length > 1 && (
                  <button className="btn-icon bl-item-del" onClick={() => removeItem(item.id)} title="Remove line item">
                    <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                  </button>
                )}
              </div>
              );
            })}
            {touched && hasItemErrors && (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 2 }}>
                Every line item needs a description, a quantity greater than 0, and a price greater than 0.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {TAX_PRESETS.map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setTaxRate(rate)}
                    className="btn btn-ghost"
                    style={{
                      fontSize: "var(--font-xs)", padding: "2px 8px",
                      background: taxRate === rate ? "var(--accent-soft)" : undefined,
                      color: taxRate === rate ? "var(--accent)" : undefined,
                    }}
                  >
                    {rate}% GST
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Discount ($)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
            />
          </div>

          <div style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Subtotal</span>
              <span style={{ fontSize: "var(--font-sm)" }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Tax</span>
              <span style={{ fontSize: "var(--font-sm)" }}>${tax.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Discount</span>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--red)" }}>-${discount.toFixed(2)}</span>
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: "var(--font-md)", fontWeight: 800, color: "var(--accent)" }}>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="bl-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              <i className="ti ti-receipt" style={{ fontSize: 12, marginRight: 5 }} />
              Create Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditInvoiceModal({
  patients,
  invoice,
  onClose,
  onUpdateInvoice,
}: {
  patients: Patient[];
  invoice: Invoice;
  onClose: () => void;
  onUpdateInvoice: (data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "paymentHistory">) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(() => patients.find(p => p.id === invoice.patientId) || null);
  const [items, setItems] = useState<InvoiceItem[]>(invoice.items);
  const [taxRate, setTaxRate] = useState(invoice.tax / (invoice.subtotal || 1) * 100);
  const [discount, setDiscount] = useState(invoice.discount);
  const [dueDate, setDueDate] = useState(invoice.dueDate.split("T")[0]);
  const [notes, setNotes] = useState(invoice.notes || "");
  const [touched, setTouched] = useState(false);
  const nextItemId = useRef(1);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax - discount;

  const itemIssues = items.map(item => {
    if (!item.description.trim()) return "description";
    if (!item.quantity || item.quantity <= 0) return "quantity";
    if (!item.unitPrice || item.unitPrice <= 0) return "price";
    return null;
  });
  const hasItemErrors = itemIssues.some(issue => issue !== null);
  const canSubmit = !!selectedPatient && items.length > 0 && !hasItemErrors;

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    nextItemId.current += 1;
    setItems([...items, { id: `item-${nextItemId.current}`, description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const addPresetItem = (service: { label: string; price: number }) => {
    nextItemId.current += 1;
    setItems([...items, { id: `item-${nextItemId.current}`, description: service.label, quantity: 1, unitPrice: service.price, total: service.price }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!selectedPatient || !canSubmit) return;

    onUpdateInvoice({
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      items,
      subtotal,
      tax,
      discount,
      total,
      status: invoice.status,
      dueDate,
      paidAmount: invoice.paidAmount,
      paymentMethod: invoice.paymentMethod,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, width: "92vw", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Edit Invoice {invoice.invoiceNumber}</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Patient *</label>
            <select
              value={selectedPatient?.id || ""}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: `1px solid ${touched && !selectedPatient ? "var(--red)" : "var(--border)"}`, fontSize: "var(--font-sm)" }}
            >
              <option value="">Select patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
            {touched && !selectedPatient && (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 4 }}>Please select a patient</div>
            )}
            {selectedPatient && (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <span>ID: {selectedPatient.id}</span>
                {selectedPatient.age ? <span>· Age {selectedPatient.age}</span> : null}
                {selectedPatient.phone ? <span>· {selectedPatient.phone}</span> : null}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>Line Items *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value=""
                  onChange={(e) => {
                    const svc = COMMON_SERVICES.find(s => s.label === e.target.value);
                    if (svc) addPresetItem(svc);
                  }}
                  style={{ fontSize: "var(--font-xs)", padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface1)" }}
                >
                  <option value="">+ Quick add service…</option>
                  {COMMON_SERVICES.map(s => (
                    <option key={s.label} value={s.label}>{s.label} (${s.price})</option>
                  ))}
                </select>
                <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)" }} onClick={addItem}>
                  <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add Item
                </button>
              </div>
            </div>
            {items.map((item, index) => {
              const issue = itemIssues[index];
              const errBorder = (field: "description" | "quantity" | "price") =>
                touched && issue === field ? "1px solid var(--red)" : "1px solid var(--border)";
              return (
              <div key={item.id} className="bl-item-row" style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  className="bl-item-desc"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: errBorder("description"), fontSize: "var(--font-sm)" }}
                />
                <input
                  type="number"
                  placeholder="Qty"
                  min={0}
                  step={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                  className="bl-item-qty"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: errBorder("quantity"), fontSize: "var(--font-sm)" }}
                />
                <input
                  type="number"
                  placeholder="Price"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                  className="bl-item-price"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: errBorder("price"), fontSize: "var(--font-sm)" }}
                />
                <div className="bl-item-total" style={{ padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius)", fontSize: "var(--font-sm)", textAlign: "right" }}>
                  ${item.total.toFixed(2)}
                </div>
                {items.length > 1 && (
                  <button className="btn-icon bl-item-del" onClick={() => removeItem(item.id)} title="Remove line item">
                    <i className="ti ti-trash" style={{ fontSize: 12, color: "var(--red)" }} />
                  </button>
                )}
              </div>
              );
            })}
            {touched && hasItemErrors && (
              <div style={{ fontSize: "var(--font-xs)", color: "var(--red)", marginTop: 2 }}>
                Every line item needs a description, a quantity greater than 0, and a price greater than 0.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {TAX_PRESETS.map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setTaxRate(rate)}
                    className="btn btn-ghost"
                    style={{
                      fontSize: "var(--font-xs)", padding: "2px 8px",
                      background: taxRate === rate ? "var(--accent-soft)" : undefined,
                      color: taxRate === rate ? "var(--accent)" : undefined,
                    }}
                  >
                    {rate}% GST
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Discount ($)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 4, display: "block" }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "var(--font-sm)", resize: "vertical" }}
            />
          </div>

          <div style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius)", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Subtotal</span>
              <span style={{ fontSize: "var(--font-sm)" }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Tax</span>
              <span style={{ fontSize: "var(--font-sm)" }}>${tax.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>Discount</span>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--red)" }}>-${discount.toFixed(2)}</span>
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: "var(--font-md)", fontWeight: 800, color: "var(--accent)" }}>${total.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "var(--muted)" }}>
              <span>Previously Paid</span>
              <span>${invoice.paidAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="bl-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              <i className="ti ti-device-floppy" style={{ fontSize: 12, marginRight: 5 }} />
              Update Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

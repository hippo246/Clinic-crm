import React, { useState, useMemo, useRef } from "react";
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

export default function BillingPage({ patients }: { patients: Patient[] }) {
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "insurance">("invoices");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi" | "bank_transfer" | "insurance">("cash");

  const invoices = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]");
  
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

  const handleCreateInvoice = (invoiceData: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "paymentHistory">) => {
    const existingInvoices = JSON.parse(localStorage.getItem("clinic_crm_invoices") || "[]");
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
    localStorage.setItem("clinic_crm_invoices", JSON.stringify([...existingInvoices, newInvoice]));
    setShowCreateInvoice(false);
    alert(`Invoice ${newInvoice.invoiceNumber} created successfully!`);
  };

  const handleRecordPayment = () => {
    if (!selectedInvoice || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      amount,
      method: paymentMethod,
      date: new Date().toISOString(),
    };

    const updatedInvoices = enhancedInvoices.map((inv: Invoice) => {
      if (inv.id === selectedInvoice.id) {
        const newPaidAmount = inv.paidAmount + amount;
        const newStatus = newPaidAmount >= inv.total ? "paid" : newPaidAmount > 0 ? "partial" : inv.status;
        return {
          ...inv,
          paidAmount: newPaidAmount,
          status: newStatus,
          paymentHistory: [...inv.paymentHistory, newPayment],
        };
      }
      return inv;
    });

    localStorage.setItem("clinic_crm_invoices", JSON.stringify(updatedInvoices));
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    alert(`Payment of $${amount} recorded successfully!`);
  };

  const handlePrintInvoice = (inv: Invoice) => {
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups for this site to print invoices."); return; }
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
          </div>
        </div>
        ${inv.notes ? `<div style="margin-top:20px;color:#666;"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ""}
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="bl-page" style={{ padding: 24, maxWidth: 1600 }}>
      <style>{billingCss}</style>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Billing & Payments
        </h1>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
          Manage invoices, payments, insurance claims, and receipts
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="bl-stats" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="var(--green)" icon="ti-currency-dollar" bg="var(--green-bg)" />
        <StatCard label="Pending" value={`$${pendingAmount.toFixed(2)}`} color="var(--amber)" icon="ti-clock" bg="var(--amber-bg)" />
        <StatCard label="Overdue" value={overdueInvoices.length} color="var(--red)" icon="ti-alert-triangle" bg="var(--red-bg)" />
        <StatCard label="Paid Invoices" value={enhancedInvoices.filter((i: Invoice) => i.status === "paid").length} color="var(--blue)" icon="ti-check" bg="var(--blue-bg)" />
        <StatCard label="Total Invoices" value={enhancedInvoices.length} color="var(--accent)" icon="ti-receipt" bg="var(--accent-soft)" />
      </div>

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
          <div className="bl-section-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>Invoice Management</div>
            <button className="btn btn-primary bl-full-btn" onClick={() => setShowCreateInvoice(true)}>
              <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} />
              Create Invoice
            </button>
          </div>

          <div className="card bl-table-scroll">
            <table className="tbl">
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
                {enhancedInvoices.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-sub">No invoices found</div></div></td></tr>
                ) : enhancedInvoices.map((inv: Invoice) => (
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
                      <div style={{ display: "flex", gap: 4 }}>
                        {inv.status !== "paid" && (
                          <button 
                            className="btn btn-primary" 
                            style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }}
                            onClick={() => { setSelectedInvoice(inv); setShowPaymentModal(true); }}
                          >
                            Pay
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ fontSize: "var(--font-xs)", padding: "2px 8px" }} onClick={() => handlePrintInvoice(inv)} title="Print invoice">
                          <i className="ti ti-print" style={{ fontSize: 12 }} />
                        </button>
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
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Payment History</div>
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
                  <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)", fontSize: "var(--font-xs)", flexShrink: 0 }}>
                    Completed
                  </span>
                </div>
              ))
            )}
            {enhancedInvoices.flatMap((inv: Invoice) => inv.paymentHistory).length === 0 && (
              <div className="empty-state">
                <div className="empty-state-sub">No payment history found</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "insurance" && (
        <div>
          <div style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>Insurance Overview</div>
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

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
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
                  max={selectedInvoice.total - selectedInvoice.paidAmount}
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
                <button className="btn btn-ghost" onClick={() => setShowPaymentModal(false)}>Cancel</button>
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

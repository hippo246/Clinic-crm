// LocalStorage-based API Client (Frontend-only mode, hybrid-ready)

// ── Audit logging (Phase 2B) ──────────────────────────────────────────────────
import { logAction,logAccess,logModification,logExport,logDeletion,safeAudit } from "../shared/services/auditLogger";

// ── Storage key constants ──────────────────────────────────────────────────
const STORAGE_KEY        = "clinic_crm_patients_v1";
const AUDIT_KEY          = "clinic_crm_audit_v1";
const KEY_APPOINTMENTS   = "clinic_crm_appointments";
const KEY_CONSULTATIONS  = "clinic_crm_consultations";
const KEY_PRESCRIPTIONS  = "clinic_crm_prescriptions";
const KEY_DOCUMENTS      = "clinic_crm_documents";
const KEY_INVOICES       = "clinic_crm_invoices";
const KEY_COMMUNICATIONS = "clinic_crm_communications";
const KEY_FOLLOWUPS      = "clinic_crm_followups";
const KEY_CONSENTS       = "clinic_crm_consents";
const KEY_FIREBASE_TOKEN = "firebase_token";

// ── API mode ───────────────────────────────────────────────────────────────
type ApiMode = "local" | "backend";

const _rawMode    = (import.meta.env.VITE_API_MODE as string) ?? "local";
const _baseUrl    = (import.meta.env.VITE_API_BASE_URL as string) ?? "";
// Fall back to local if backend mode requested but no base URL provided
const RESOLVED_MODE: ApiMode = (_rawMode === "backend" && _baseUrl) ? "backend" : "local";

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private firebaseToken: string | null = null;

  constructor() {
    this.firebaseToken = localStorage.getItem(KEY_FIREBASE_TOKEN);
  }

  // ── Safe localStorage helpers ────────────────────────────────────────────
  private readJSON<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      console.warn(`[api] Corrupt localStorage key "${key}", using fallback.`);
      return fallback;
    }
  }

  private writeJSON(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[api] Failed to write localStorage key "${key}":`, e);
    }
  }

  // ── Mode & auth status ───────────────────────────────────────────────────
  getMode(): ApiMode {
    return RESOLVED_MODE;
  }

  getAuthStatus(): { hasFirebaseToken: boolean; mode: ApiMode } {
    return { hasFirebaseToken: this.firebaseToken !== null, mode: RESOLVED_MODE };
  }

  // ── Private fetch helper (for future backend calls) ──────────────────────
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${_baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    };
    if (this.firebaseToken) {
      headers["Authorization"] = `Bearer ${this.firebaseToken}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`[api] ${res.status} ${res.statusText}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  setFirebaseToken(token: string) {
    this.firebaseToken = token;
    localStorage.setItem(KEY_FIREBASE_TOKEN, token);
  }

  clearFirebaseToken() {
    this.firebaseToken = null;
    localStorage.removeItem(KEY_FIREBASE_TOKEN);
  }

  private getPatientsInternal(): any[] {
    return this.readJSON<any[]>(STORAGE_KEY, []);
  }

  private setPatients(patients: any[]) {
    this.writeJSON(STORAGE_KEY, patients);
  }

  // Patients
  async getPatients(limit = 20, offset = 0): Promise<any[]> {
    const patients = this.getPatientsInternal();
    // Log only on first page load to avoid spam (offset === 0)
    if (offset === 0) {
      safeAudit(() => {
        logAccess({
          resourceType: "patient",
          details: "Patient list accessed",
        });
      });
    }
    return patients.slice(offset, offset + limit);
  }

  async getPatient(id: string): Promise<any> {
    const patients = this.getPatientsInternal();
    const patient = patients.find((p: any) => p.id === id) || null;
    safeAudit(() => {
      logAccess({
        resourceType: "patient",
        resourceId: id,
        resourceLabel: patient?.name || id,
        details: "Patient profile viewed",
      });
    });
    return patient;
  }

  async createPatient(patient: any): Promise<any> {
    const patients = this.getPatientsInternal();
    const newPatient = { ...patient, id: `CLN-${Date.now()}`, createdAt: new Date().toISOString() };
    patients.unshift(newPatient);
    this.setPatients(patients);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "patient",
        resourceId: newPatient.id,
        resourceLabel: newPatient.id,
        details: "Patient created",
        success: true,
      });
    });
    return newPatient;
  }

  async updatePatient(id: string, patient: any): Promise<any> {
    const patients = this.getPatientsInternal();
    const index = patients.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      patients[index] = { ...patients[index], ...patient, updatedAt: new Date().toISOString() };
      this.setPatients(patients);
      safeAudit(() => {
        logModification({
          resourceType: "patient",
          resourceId: id,
          resourceLabel: id,
          details: "Patient updated",
          success: true,
        });
      });
      return patients[index];
    }
    safeAudit(() => {
      logAction({
        action: "update",
        resourceType: "patient",
        resourceId: id,
        details: "Patient update failed - not found",
        success: false,
        errorMessage: "Patient not found",
      });
    });
    throw new Error("Patient not found");
  }

  async deletePatient(id: string, actor?: string, reason?: string) {
    let patients = this.getPatientsInternal();
    const index = patients.findIndex((p: any) => p.id === id);
    
    if (index === -1) {
      throw new Error("Patient not found");
    }

    // Save status before archive for restore (Phase 7C)
    const previousStatus = patients[index].status;

    // Soft delete: mark as deleted instead of removing from storage
    patients[index] = {
      ...patients[index],
      deletedAt: new Date().toISOString(),
      deletedBy: actor || "unknown",
      deleteReason: reason || "Deleted via patient management",
      status: "Archived",
      statusBeforeArchive: previousStatus,
      updatedAt: new Date().toISOString(),
    };
    
    this.setPatients(patients);
    
    safeAudit(() => {
      logAction({
        action: "soft_delete",
        resourceType: "patient",
        resourceId: id,
        details: `Patient soft-deleted by ${actor || "unknown"}` + (reason ? `: ${reason}` : ""),
        success: true,
      });
    });
    
    return { success: true };
  }

  async restorePatient(id: string, actor?: string) {
    let patients = this.getPatientsInternal();
    const index = patients.findIndex((p: any) => p.id === id);
    
    if (index === -1) {
      throw new Error("Patient not found");
    }

    const patient = patients[index];
    const previousStatus = patient.statusBeforeArchive || "Active";

    // Restore: clear deleted metadata and restore status
    patients[index] = {
      ...patient,
      deletedAt: undefined,
      deletedBy: undefined,
      deleteReason: undefined,
      archivedAt: undefined,
      archivedBy: undefined,
      archiveReason: undefined,
      restoredAt: new Date().toISOString(),
      restoredBy: actor || "unknown",
      status: previousStatus,
      updatedAt: new Date().toISOString(),
    };
    
    this.setPatients(patients);
    
    safeAudit(() => {
      logAction({
        action: "restore",
        resourceType: "patient",
        resourceId: id,
        details: `Patient record restored by ${actor || "unknown"}`,
        success: true,
      });
    });
    
    return { success: true };
  }

  async searchPatients(query: string) {
    const patients = this.getPatientsInternal();
    const lowerQuery = query.toLowerCase();
    return patients.filter((p: any) =>
      p.name?.toLowerCase().includes(lowerQuery) ||
      p.id?.toLowerCase().includes(lowerQuery) ||
      p.phone?.includes(query)
    );
  }

  async importPatients(patients: any[]) {
    const existingPatients = this.getPatientsInternal();
    const imported = patients.map((p, i) => ({
      ...p,
      id: `CLN-${Date.now()}-${i}`,
      createdAt: new Date().toISOString()
    }));
    const allPatients = [...imported, ...existingPatients];
    this.setPatients(allPatients);
    safeAudit(() => {
      logAction({
        action: "import",
        resourceType: "patient",
        details: `Imported ${imported.length} patients`,
        success: true,
      });
    });
    return { imported: imported.length, errors: [] };
  }

  // Audit Logs
  async getAuditLogs(params?: any) {
    return [];
  }

  async getPatientAuditLogs(patientId: string) {
    return [];
  }

  // Settings
  async createBackup() {
    const patients = this.getPatientsInternal();
    return { success: true, count: patients.length };
  }

  async updateRetentionPolicy(policy: any) {
    return { success: true };
  }

  // Health check
  async healthCheck(): Promise<{ status: string; mode: ApiMode; backendConnected: boolean; error?: string }> {
    if (RESOLVED_MODE === "local") {
      return { status: "ok", mode: "local", backendConnected: false };
    }
    try {
      const result = await this.request<{ status: string }>("/health");
      return { status: result.status ?? "ok", mode: "backend", backendConnected: true };
    } catch (e: any) {
      return { status: "degraded", mode: "backend", backendConnected: false, error: e?.message ?? "Unknown error" };
    }
  }

  private getStorageData(key: string): any[] {
    return this.readJSON<any[]>(key, []);
  }

  private setStorageData(key: string, data: any[]) {
    this.writeJSON(key, data);
  }

  async bookAppointment(appointment: any) {
    const appointments = this.getStorageData(KEY_APPOINTMENTS);
    const newAppointment = { ...appointment, id: `apt-${Date.now()}`, createdAt: new Date().toISOString() };
    appointments.push(newAppointment);
    this.setStorageData(KEY_APPOINTMENTS, appointments);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "appointment",
        resourceId: newAppointment.id,
        details: "Appointment booked",
        success: true,
      });
    });
    return { success: true, appointment: newAppointment };
  }

  async getAppointments(patientId?: string) {
    const appointments = this.getStorageData(KEY_APPOINTMENTS);
    if (patientId) {
      return appointments.filter((a: any) => a.patient_id === patientId);
    }
    return appointments;
  }

  async updateAppointment(appointmentId: string, appointment: any) {
    const appointments = this.getStorageData(KEY_APPOINTMENTS);
    const index = appointments.findIndex((a: any) => a.id === appointmentId);
    if (index !== -1) {
      appointments[index] = { ...appointments[index], ...appointment, updatedAt: new Date().toISOString() };
      this.setStorageData(KEY_APPOINTMENTS, appointments);
      safeAudit(() => {
        logModification({
          resourceType: "appointment",
          resourceId: appointmentId,
          details: "Appointment updated",
          success: true,
        });
      });
      return { success: true, appointment: appointments[index] };
    }
    return { success: false, error: 'Appointment not found' };
  }

  async cancelAppointment(appointmentId: string) {
    const appointments = this.getStorageData(KEY_APPOINTMENTS);
    const index = appointments.findIndex((a: any) => a.id === appointmentId);
    if (index !== -1) {
      appointments[index].status = 'cancelled';
      appointments[index].cancelledAt = new Date().toISOString();
      this.setStorageData(KEY_APPOINTMENTS, appointments);
      safeAudit(() => {
        logAction({
          action: "update",
          resourceType: "appointment",
          resourceId: appointmentId,
          details: "Appointment cancelled",
          success: true,
        });
      });
      return { success: true };
    }
    return { success: false, error: 'Appointment not found' };
  }

  async startConsultation(consultation: any) {
    const consultations = this.getStorageData(KEY_CONSULTATIONS);
    const newConsultation = { ...consultation, id: `con-${Date.now()}`, createdAt: new Date().toISOString(), status: 'in_progress' };
    consultations.push(newConsultation);
    this.setStorageData(KEY_CONSULTATIONS, consultations);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "consultation",
        resourceId: newConsultation.id,
        details: "Consultation started",
        success: true,
      });
    });
    return { success: true, consultation: newConsultation };
  }

  async getConsultations(patientId?: string) {
    const consultations = this.getStorageData(KEY_CONSULTATIONS);
    if (patientId) {
      return consultations.filter((c: any) => c.patient_id === patientId);
    }
    return consultations;
  }

  async updateConsultation(consultationId: string, consultation: any) {
    const consultations = this.getStorageData(KEY_CONSULTATIONS);
    const index = consultations.findIndex((c: any) => c.id === consultationId);
    if (index !== -1) {
      consultations[index] = { ...consultations[index], ...consultation, updatedAt: new Date().toISOString() };
      this.setStorageData(KEY_CONSULTATIONS, consultations);
      safeAudit(() => {
        logModification({
          resourceType: "consultation",
          resourceId: consultationId,
          details: "Consultation updated",
          success: true,
        });
      });
      return { success: true, consultation: consultations[index] };
    }
    return { success: false, error: 'Consultation not found' };
  }

  async completeConsultation(consultationId: string) {
    const consultations = this.getStorageData(KEY_CONSULTATIONS);
    const index = consultations.findIndex((c: any) => c.id === consultationId);
    if (index !== -1) {
      consultations[index].status = 'completed';
      consultations[index].completedAt = new Date().toISOString();
      this.setStorageData(KEY_CONSULTATIONS, consultations);
      safeAudit(() => {
        logAction({
          action: "update",
          resourceType: "consultation",
          resourceId: consultationId,
          details: "Consultation completed",
          success: true,
        });
      });
      return { success: true };
    }
    return { success: false, error: 'Consultation not found' };
  }

  async createPrescriptions(prescriptions: any[]) {
    const existingPrescriptions = this.getStorageData(KEY_PRESCRIPTIONS);
    const newPrescriptions = prescriptions.map(p => ({
      ...p,
      id: `rx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: p.status || 'active'
    }));
    const allPrescriptions = [...newPrescriptions, ...existingPrescriptions];
    this.setStorageData(KEY_PRESCRIPTIONS, allPrescriptions);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "prescription",
        details: `Created ${newPrescriptions.length} prescriptions`,
        success: true,
      });
    });
    return { success: true, prescriptions: newPrescriptions };
  }

  async getPrescriptions(patientId?: string) {
    const prescriptions = this.getStorageData(KEY_PRESCRIPTIONS);
    if (patientId) {
      return prescriptions.filter((p: any) => p.patient_id === patientId);
    }
    return prescriptions;
  }

  async updatePrescription(prescriptionId: string, prescription: any) {
    const prescriptions = this.getStorageData(KEY_PRESCRIPTIONS);
    const index = prescriptions.findIndex((p: any) => p.id === prescriptionId);
    if (index !== -1) {
      prescriptions[index] = { ...prescriptions[index], ...prescription, updatedAt: new Date().toISOString() };
      this.setStorageData(KEY_PRESCRIPTIONS, prescriptions);
      safeAudit(() => {
        logModification({
          resourceType: "prescription",
          resourceId: prescriptionId,
          details: "Prescription updated",
          success: true,
        });
      });
      return { success: true, prescription: prescriptions[index] };
    }
    return { success: false, error: 'Prescription not found' };
  }

  async dispensePrescription(prescriptionId: string) {
    const prescriptions = this.getStorageData(KEY_PRESCRIPTIONS);
    const index = prescriptions.findIndex((p: any) => p.id === prescriptionId);
    if (index !== -1) {
      prescriptions[index].status = 'dispensed';
      prescriptions[index].dispensedAt = new Date().toISOString();
      this.setStorageData(KEY_PRESCRIPTIONS, prescriptions);
      safeAudit(() => {
        logAction({
          action: "update",
          resourceType: "prescription",
          resourceId: prescriptionId,
          details: "Prescription dispensed",
          success: true,
        });
      });
      return { success: true };
    }
    return { success: false, error: 'Prescription not found' };
  }

  async uploadFiles(files: File[], metadata: any) {
    const documents = this.getStorageData(KEY_DOCUMENTS);
    const newDocuments = files.map((file, i) => ({
      id: `doc-${Date.now()}-${i}`,
      patient_id: metadata.patient_id,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      ...metadata
    }));
    const allDocuments = [...newDocuments, ...documents];
    this.setStorageData(KEY_DOCUMENTS, allDocuments);
    safeAudit(() => {
      logAction({
        action: "file_upload",
        resourceType: "document",
        details: `Uploaded ${newDocuments.length} documents`,
        success: true,
      });
    });
    return { success: true, documents: newDocuments };
  }

  async getDocuments(patientId?: string) {
    const documents = this.getStorageData(KEY_DOCUMENTS);
    if (patientId) {
      return documents.filter((d: any) => d.patient_id === patientId);
    }
    return documents;
  }

  async downloadDocument(documentId: string) {
    const documents = this.getStorageData(KEY_DOCUMENTS);
    const doc = documents.find((d: any) => d.id === documentId);
    if (doc) {
      // Phase 8J: Return sanitized document metadata (PHI-safe)
      const sanitizedMetadata = {
        id: doc.id,
        patientId: doc.patientId,
        type: doc.type,
        name: doc.name,
        uploadDate: doc.uploadDate,
        expiryDate: doc.expiryDate,
        signed: doc.signed,
        signedDate: doc.signedDate,
        signedBy: doc.signedBy,
        renewedDate: doc.renewedDate,
        renewedBy: doc.renewedBy,
        // Explicitly exclude: patientName, phone, email, dob, address, document content
      };
      safeAudit(() => {
        logAction({
          action: "file_download",
          resourceType: "document",
          resourceId: documentId,
          resourceLabel: doc.id, // Use ID instead of name for PHI-safe audit
          details: "Document metadata downloaded",
          success: true,
        });
      });
      return new Blob([JSON.stringify(sanitizedMetadata)], { type: 'application/json' });
    }
    return new Blob();
  }

  async deleteDocument(documentId: string) {
    const documents = this.getStorageData(KEY_DOCUMENTS);
    const doc = documents.find((d: any) => d.id === documentId);
    const filtered = documents.filter((d: any) => d.id !== documentId);
    this.setStorageData(KEY_DOCUMENTS, filtered);
    safeAudit(() => {
      logDeletion({
        resourceType: "document",
        resourceId: documentId,
        resourceLabel: doc?.name,
        details: "Document deleted",
        success: true,
      });
    });
    return { success: true };
  }

  async createInvoice(invoice: any) {
    const invoices = this.getStorageData(KEY_INVOICES);
    const newInvoice = { ...invoice, id: `inv-${Date.now()}`, createdAt: new Date().toISOString(), status: 'pending' };
    invoices.push(newInvoice);
    this.setStorageData(KEY_INVOICES, invoices);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "billing",
        resourceId: newInvoice.id,
        details: "Invoice created",
        success: true,
      });
    });
    return { success: true, invoice: newInvoice };
  }

  async getInvoices(patientId?: string) {
    const invoices = this.getStorageData(KEY_INVOICES);
    if (patientId) {
      return invoices.filter((i: any) => i.patient_id === patientId);
    }
    return invoices;
  }

  async updateInvoice(invoiceId: string, invoice: any) {
    const invoices = this.getStorageData(KEY_INVOICES);
    const index = invoices.findIndex((i: any) => i.id === invoiceId);
    if (index !== -1) {
      invoices[index] = { ...invoices[index], ...invoice, updatedAt: new Date().toISOString() };
      this.setStorageData(KEY_INVOICES, invoices);
      safeAudit(() => {
        logModification({
          resourceType: "billing",
          resourceId: invoiceId,
          details: "Invoice updated",
          success: true,
        });
      });
      return { success: true, invoice: invoices[index] };
    }
    return { success: false, error: 'Invoice not found' };
  }

  async markInvoicePaid(invoiceId: string) {
    const invoices = this.getStorageData(KEY_INVOICES);
    const index = invoices.findIndex((i: any) => i.id === invoiceId);
    if (index !== -1) {
      invoices[index].status = 'paid';
      invoices[index].paidAt = new Date().toISOString();
      this.setStorageData(KEY_INVOICES, invoices);
      safeAudit(() => {
        logAction({
          action: "update",
          resourceType: "billing",
          resourceId: invoiceId,
          details: "Invoice marked as paid",
          success: true,
        });
      });
      return { success: true };
    }
    return { success: false, error: 'Invoice not found' };
  }

  async sendCommunication(message: any) {
    const communications = this.getStorageData(KEY_COMMUNICATIONS);
    const newMessage = { ...message, id: `com-${Date.now()}`, sentAt: new Date().toISOString() };
    communications.push(newMessage);
    this.setStorageData(KEY_COMMUNICATIONS, communications);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "communication",
        resourceId: newMessage.id,
        details: "Communication sent",
        success: true,
      });
    });
    return { success: true, message: newMessage };
  }

  async getCommunicationHistory(patientId?: string) {
    const communications = this.getStorageData(KEY_COMMUNICATIONS);
    if (patientId) {
      return communications.filter((c: any) => c.patient_id === patientId);
    }
    return communications;
  }

  async scheduleFollowUp(followUp: any) {
    const followUps = this.getStorageData(KEY_FOLLOWUPS);
    const newFollowUp = { ...followUp, id: `fup-${Date.now()}`, createdAt: new Date().toISOString(), status: 'scheduled' };
    followUps.push(newFollowUp);
    this.setStorageData(KEY_FOLLOWUPS, followUps);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "system",
        resourceId: newFollowUp.id,
        details: "Follow-up scheduled",
        success: true,
      });
    });
    return { success: true, followUp: newFollowUp };
  }

  async getFollowUps(patientId?: string) {
    const followUps = this.getStorageData(KEY_FOLLOWUPS);
    if (patientId) {
      return followUps.filter((f: any) => f.patient_id === patientId);
    }
    return followUps;
  }

  async updateFollowUp(followUpId: string, followUp: any) {
    const followUps = this.getStorageData(KEY_FOLLOWUPS);
    const index = followUps.findIndex((f: any) => f.id === followUpId);
    if (index !== -1) {
      followUps[index] = { ...followUps[index], ...followUp, updatedAt: new Date().toISOString() };
      this.setStorageData(KEY_FOLLOWUPS, followUps);
      safeAudit(() => {
        logModification({
          resourceType: "system",
          resourceId: followUpId,
          details: "Follow-up updated",
          success: true,
        });
      });
      return { success: true, followUp: followUps[index] };
    }
    return { success: false, error: 'Follow-up not found' };
  }

  async completeFollowUp(followUpId: string) {
    const followUps = this.getStorageData(KEY_FOLLOWUPS);
    const index = followUps.findIndex((f: any) => f.id === followUpId);
    if (index !== -1) {
      followUps[index].status = 'completed';
      followUps[index].completedAt = new Date().toISOString();
      this.setStorageData(KEY_FOLLOWUPS, followUps);
      safeAudit(() => {
        logAction({
          action: "update",
          resourceType: "system",
          resourceId: followUpId,
          details: "Follow-up completed",
          success: true,
        });
      });
      return { success: true };
    }
    return { success: false, error: 'Follow-up not found' };
  }

  async createConsent(consent: any) {
    const consents = this.getStorageData(KEY_CONSENTS);
    const newConsent = { ...consent, id: `con-${Date.now()}`, createdAt: new Date().toISOString(), status: 'signed' };
    consents.push(newConsent);
    this.setStorageData(KEY_CONSENTS, consents);
    safeAudit(() => {
      logAction({
        action: "create",
        resourceType: "document",
        resourceId: newConsent.id,
        details: "Consent created",
        success: true,
      });
    });
    return { success: true, consent: newConsent };
  }

  async getConsents(patientId?: string) {
    const consents = this.getStorageData(KEY_CONSENTS);
    if (patientId) {
      return consents.filter((c: any) => c.patient_id === patientId);
    }
    return consents;
  }

  async signConsent(consentId: string) {
    const consents = this.getStorageData(KEY_CONSENTS);
    const index = consents.findIndex((c: any) => c.id === consentId);
    if (index !== -1) {
      consents[index].status = 'signed';
      consents[index].signedAt = new Date().toISOString();
      this.setStorageData(KEY_CONSENTS, consents);
      safeAudit(() => {
        logAction({
          action: "update",
          resourceType: "document",
          resourceId: consentId,
          details: "Consent signed",
          success: true,
        });
      });
      return { success: true };
    }
    return { success: false, error: 'Consent not found' };
  }

  async validateFirebaseToken(token: string) { return { success: true }; }
}

export const apiClient = new ApiClient();

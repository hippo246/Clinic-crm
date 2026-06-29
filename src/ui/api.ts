// LocalStorage-based API Client (Frontend-only mode, hybrid-ready)

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
    return patients.slice(offset, offset + limit);
  }

  async getPatient(id: string): Promise<any> {
    const patients = this.getPatientsInternal();
    return patients.find((p: any) => p.id === id) || null;
  }

  async createPatient(patient: any): Promise<any> {
    const patients = this.getPatientsInternal();
    const newPatient = { ...patient, id: `CLN-${Date.now()}`, createdAt: new Date().toISOString() };
    patients.unshift(newPatient);
    this.setPatients(patients);
    return newPatient;
  }

  async updatePatient(id: string, patient: any): Promise<any> {
    const patients = this.getPatientsInternal();
    const index = patients.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      patients[index] = { ...patients[index], ...patient, updatedAt: new Date().toISOString() };
      this.setPatients(patients);
      return patients[index];
    }
    throw new Error("Patient not found");
  }

  async deletePatient(id: string) {
    let patients = this.getPatientsInternal();
    patients = patients.filter((p: any) => p.id !== id);
    this.setPatients(patients);
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
      return { success: true };
    }
    return { success: false, error: 'Appointment not found' };
  }

  async startConsultation(consultation: any) {
    const consultations = this.getStorageData(KEY_CONSULTATIONS);
    const newConsultation = { ...consultation, id: `con-${Date.now()}`, createdAt: new Date().toISOString(), status: 'in_progress' };
    consultations.push(newConsultation);
    this.setStorageData(KEY_CONSULTATIONS, consultations);
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
      return new Blob([JSON.stringify(doc)], { type: 'application/json' });
    }
    return new Blob();
  }

  async deleteDocument(documentId: string) {
    const documents = this.getStorageData(KEY_DOCUMENTS);
    const filtered = documents.filter((d: any) => d.id !== documentId);
    this.setStorageData(KEY_DOCUMENTS, filtered);
    return { success: true };
  }

  async createInvoice(invoice: any) {
    const invoices = this.getStorageData(KEY_INVOICES);
    const newInvoice = { ...invoice, id: `inv-${Date.now()}`, createdAt: new Date().toISOString(), status: 'pending' };
    invoices.push(newInvoice);
    this.setStorageData(KEY_INVOICES, invoices);
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
      return { success: true };
    }
    return { success: false, error: 'Invoice not found' };
  }

  async sendCommunication(message: any) {
    const communications = this.getStorageData(KEY_COMMUNICATIONS);
    const newMessage = { ...message, id: `com-${Date.now()}`, sentAt: new Date().toISOString() };
    communications.push(newMessage);
    this.setStorageData(KEY_COMMUNICATIONS, communications);
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
      return { success: true };
    }
    return { success: false, error: 'Follow-up not found' };
  }

  async createConsent(consent: any) {
    const consents = this.getStorageData(KEY_CONSENTS);
    const newConsent = { ...consent, id: `con-${Date.now()}`, createdAt: new Date().toISOString(), status: 'signed' };
    consents.push(newConsent);
    this.setStorageData(KEY_CONSENTS, consents);
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
      return { success: true };
    }
    return { success: false, error: 'Consent not found' };
  }

  async validateFirebaseToken(token: string) { return { success: true }; }
}

export const apiClient = new ApiClient();

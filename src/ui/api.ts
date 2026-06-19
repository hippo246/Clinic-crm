// LocalStorage-based API Client (Frontend-only mode)
const STORAGE_KEY = "clinic_crm_patients_v1";
const AUDIT_KEY = "clinic_crm_audit_v1";

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private firebaseToken: string | null = null;

  constructor() {
    // Load Firebase token from localStorage
    this.firebaseToken = localStorage.getItem('firebase_token');
  }

  setFirebaseToken(token: string) {
    this.firebaseToken = token;
    localStorage.setItem('firebase_token', token);
  }

  clearFirebaseToken() {
    this.firebaseToken = null;
    localStorage.removeItem('firebase_token');
  }

  private getPatientsInternal(): any[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private setPatients(patients: any[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
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
  async healthCheck() {
    return { status: "ok", mode: "frontend-only" };
  }

  // Medical Workflow - localStorage persistence
  private getStorageData(key: string): any[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private setStorageData(key: string, data: any[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  async bookAppointment(appointment: any) {
    const appointments = this.getStorageData('clinic_crm_appointments');
    const newAppointment = { ...appointment, id: `apt-${Date.now()}`, createdAt: new Date().toISOString() };
    appointments.push(newAppointment);
    this.setStorageData('clinic_crm_appointments', appointments);
    return { success: true, appointment: newAppointment };
  }

  async getAppointments(patientId?: string) {
    const appointments = this.getStorageData('clinic_crm_appointments');
    if (patientId) {
      return appointments.filter((a: any) => a.patient_id === patientId);
    }
    return appointments;
  }

  async updateAppointment(appointmentId: string, appointment: any) {
    const appointments = this.getStorageData('clinic_crm_appointments');
    const index = appointments.findIndex((a: any) => a.id === appointmentId);
    if (index !== -1) {
      appointments[index] = { ...appointments[index], ...appointment, updatedAt: new Date().toISOString() };
      this.setStorageData('clinic_crm_appointments', appointments);
      return { success: true, appointment: appointments[index] };
    }
    return { success: false, error: 'Appointment not found' };
  }

  async cancelAppointment(appointmentId: string) {
    const appointments = this.getStorageData('clinic_crm_appointments');
    const index = appointments.findIndex((a: any) => a.id === appointmentId);
    if (index !== -1) {
      appointments[index].status = 'cancelled';
      appointments[index].cancelledAt = new Date().toISOString();
      this.setStorageData('clinic_crm_appointments', appointments);
      return { success: true };
    }
    return { success: false, error: 'Appointment not found' };
  }

  async startConsultation(consultation: any) {
    const consultations = this.getStorageData('clinic_crm_consultations');
    const newConsultation = { ...consultation, id: `con-${Date.now()}`, createdAt: new Date().toISOString(), status: 'in_progress' };
    consultations.push(newConsultation);
    this.setStorageData('clinic_crm_consultations', consultations);
    return { success: true, consultation: newConsultation };
  }

  async getConsultations(patientId?: string) {
    const consultations = this.getStorageData('clinic_crm_consultations');
    if (patientId) {
      return consultations.filter((c: any) => c.patient_id === patientId);
    }
    return consultations;
  }

  async updateConsultation(consultationId: string, consultation: any) {
    const consultations = this.getStorageData('clinic_crm_consultations');
    const index = consultations.findIndex((c: any) => c.id === consultationId);
    if (index !== -1) {
      consultations[index] = { ...consultations[index], ...consultation, updatedAt: new Date().toISOString() };
      this.setStorageData('clinic_crm_consultations', consultations);
      return { success: true, consultation: consultations[index] };
    }
    return { success: false, error: 'Consultation not found' };
  }

  async completeConsultation(consultationId: string) {
    const consultations = this.getStorageData('clinic_crm_consultations');
    const index = consultations.findIndex((c: any) => c.id === consultationId);
    if (index !== -1) {
      consultations[index].status = 'completed';
      consultations[index].completedAt = new Date().toISOString();
      this.setStorageData('clinic_crm_consultations', consultations);
      return { success: true };
    }
    return { success: false, error: 'Consultation not found' };
  }

  async createPrescriptions(prescriptions: any[]) {
    const existingPrescriptions = this.getStorageData('clinic_crm_prescriptions');
    const newPrescriptions = prescriptions.map(p => ({
      ...p,
      id: `rx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: p.status || 'active'
    }));
    const allPrescriptions = [...newPrescriptions, ...existingPrescriptions];
    this.setStorageData('clinic_crm_prescriptions', allPrescriptions);
    return { success: true, prescriptions: newPrescriptions };
  }

  async getPrescriptions(patientId?: string) {
    const prescriptions = this.getStorageData('clinic_crm_prescriptions');
    if (patientId) {
      return prescriptions.filter((p: any) => p.patient_id === patientId);
    }
    return prescriptions;
  }

  async updatePrescription(prescriptionId: string, prescription: any) {
    const prescriptions = this.getStorageData('clinic_crm_prescriptions');
    const index = prescriptions.findIndex((p: any) => p.id === prescriptionId);
    if (index !== -1) {
      prescriptions[index] = { ...prescriptions[index], ...prescription, updatedAt: new Date().toISOString() };
      this.setStorageData('clinic_crm_prescriptions', prescriptions);
      return { success: true, prescription: prescriptions[index] };
    }
    return { success: false, error: 'Prescription not found' };
  }

  async dispensePrescription(prescriptionId: string) {
    const prescriptions = this.getStorageData('clinic_crm_prescriptions');
    const index = prescriptions.findIndex((p: any) => p.id === prescriptionId);
    if (index !== -1) {
      prescriptions[index].status = 'dispensed';
      prescriptions[index].dispensedAt = new Date().toISOString();
      this.setStorageData('clinic_crm_prescriptions', prescriptions);
      return { success: true };
    }
    return { success: false, error: 'Prescription not found' };
  }

  async uploadFiles(files: File[], metadata: any) {
    const documents = this.getStorageData('clinic_crm_documents');
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
    this.setStorageData('clinic_crm_documents', allDocuments);
    return { success: true, documents: newDocuments };
  }

  async getDocuments(patientId?: string) {
    const documents = this.getStorageData('clinic_crm_documents');
    if (patientId) {
      return documents.filter((d: any) => d.patient_id === patientId);
    }
    return documents;
  }

  async downloadDocument(documentId: string) {
    const documents = this.getStorageData('clinic_crm_documents');
    const doc = documents.find((d: any) => d.id === documentId);
    if (doc) {
      return new Blob([JSON.stringify(doc)], { type: 'application/json' });
    }
    return new Blob();
  }

  async deleteDocument(documentId: string) {
    const documents = this.getStorageData('clinic_crm_documents');
    const filtered = documents.filter((d: any) => d.id !== documentId);
    this.setStorageData('clinic_crm_documents', filtered);
    return { success: true };
  }

  async createInvoice(invoice: any) {
    const invoices = this.getStorageData('clinic_crm_invoices');
    const newInvoice = { ...invoice, id: `inv-${Date.now()}`, createdAt: new Date().toISOString(), status: 'pending' };
    invoices.push(newInvoice);
    this.setStorageData('clinic_crm_invoices', invoices);
    return { success: true, invoice: newInvoice };
  }

  async getInvoices(patientId?: string) {
    const invoices = this.getStorageData('clinic_crm_invoices');
    if (patientId) {
      return invoices.filter((i: any) => i.patient_id === patientId);
    }
    return invoices;
  }

  async updateInvoice(invoiceId: string, invoice: any) {
    const invoices = this.getStorageData('clinic_crm_invoices');
    const index = invoices.findIndex((i: any) => i.id === invoiceId);
    if (index !== -1) {
      invoices[index] = { ...invoices[index], ...invoice, updatedAt: new Date().toISOString() };
      this.setStorageData('clinic_crm_invoices', invoices);
      return { success: true, invoice: invoices[index] };
    }
    return { success: false, error: 'Invoice not found' };
  }

  async markInvoicePaid(invoiceId: string) {
    const invoices = this.getStorageData('clinic_crm_invoices');
    const index = invoices.findIndex((i: any) => i.id === invoiceId);
    if (index !== -1) {
      invoices[index].status = 'paid';
      invoices[index].paidAt = new Date().toISOString();
      this.setStorageData('clinic_crm_invoices', invoices);
      return { success: true };
    }
    return { success: false, error: 'Invoice not found' };
  }

  async sendCommunication(message: any) {
    const communications = this.getStorageData('clinic_crm_communications');
    const newMessage = { ...message, id: `com-${Date.now()}`, sentAt: new Date().toISOString() };
    communications.push(newMessage);
    this.setStorageData('clinic_crm_communications', communications);
    return { success: true, message: newMessage };
  }

  async getCommunicationHistory(patientId?: string) {
    const communications = this.getStorageData('clinic_crm_communications');
    if (patientId) {
      return communications.filter((c: any) => c.patient_id === patientId);
    }
    return communications;
  }

  async scheduleFollowUp(followUp: any) {
    const followUps = this.getStorageData('clinic_crm_followups');
    const newFollowUp = { ...followUp, id: `fup-${Date.now()}`, createdAt: new Date().toISOString(), status: 'scheduled' };
    followUps.push(newFollowUp);
    this.setStorageData('clinic_crm_followups', followUps);
    return { success: true, followUp: newFollowUp };
  }

  async getFollowUps(patientId?: string) {
    const followUps = this.getStorageData('clinic_crm_followups');
    if (patientId) {
      return followUps.filter((f: any) => f.patient_id === patientId);
    }
    return followUps;
  }

  async updateFollowUp(followUpId: string, followUp: any) {
    const followUps = this.getStorageData('clinic_crm_followups');
    const index = followUps.findIndex((f: any) => f.id === followUpId);
    if (index !== -1) {
      followUps[index] = { ...followUps[index], ...followUp, updatedAt: new Date().toISOString() };
      this.setStorageData('clinic_crm_followups', followUps);
      return { success: true, followUp: followUps[index] };
    }
    return { success: false, error: 'Follow-up not found' };
  }

  async completeFollowUp(followUpId: string) {
    const followUps = this.getStorageData('clinic_crm_followups');
    const index = followUps.findIndex((f: any) => f.id === followUpId);
    if (index !== -1) {
      followUps[index].status = 'completed';
      followUps[index].completedAt = new Date().toISOString();
      this.setStorageData('clinic_crm_followups', followUps);
      return { success: true };
    }
    return { success: false, error: 'Follow-up not found' };
  }

  async createConsent(consent: any) {
    const consents = this.getStorageData('clinic_crm_consents');
    const newConsent = { ...consent, id: `con-${Date.now()}`, createdAt: new Date().toISOString(), status: 'signed' };
    consents.push(newConsent);
    this.setStorageData('clinic_crm_consents', consents);
    return { success: true, consent: newConsent };
  }

  async getConsents(patientId?: string) {
    const consents = this.getStorageData('clinic_crm_consents');
    if (patientId) {
      return consents.filter((c: any) => c.patient_id === patientId);
    }
    return consents;
  }

  async signConsent(consentId: string) {
    const consents = this.getStorageData('clinic_crm_consents');
    const index = consents.findIndex((c: any) => c.id === consentId);
    if (index !== -1) {
      consents[index].status = 'signed';
      consents[index].signedAt = new Date().toISOString();
      this.setStorageData('clinic_crm_consents', consents);
      return { success: true };
    }
    return { success: false, error: 'Consent not found' };
  }

  async validateFirebaseToken(token: string) { return { success: true }; }
}

export const apiClient = new ApiClient();

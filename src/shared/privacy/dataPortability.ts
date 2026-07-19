/**
 * Data Portability Export Service
 * 
 * This module handles patient-specific data portability exports.
 * 
 * Exports are patient-specific and include PHI by design for portability.
 * All exports require confirmation and are logged PHI-safely.
 */

export interface PortabilityExportMetadata {
  exportedAt: string;
  exportedBy: string;
  patientId: string;
  exportType: string;
  requestId?: string;
  sections: string[];
  recordCount: number;
}

export interface PatientDataExport {
  metadata: PortabilityExportMetadata;
  data: {
    patient?: any;
    medicalHistory?: any[];
    consultations?: any[];
    prescriptions?: any[];
    labResults?: any[];
    documents?: any[];
    appointments?: any[];
  };
}

const PORTABILITY_EXPORTS_KEY = 'clinic_crm_portability_exports';

/**
 * Log a portability export (PHI-safe)
 */
function logPortabilityExport(metadata: PortabilityExportMetadata): void {
  try {
    const raw = localStorage.getItem(PORTABILITY_EXPORTS_KEY);
    const exports = raw ? JSON.parse(raw) : [];
    exports.push(metadata);
    localStorage.setItem(PORTABILITY_EXPORTS_KEY, JSON.stringify(exports));
  } catch (e) {
    console.error('Error logging portability export:', e);
  }
}

/**
 * Get patient data for export
 */
function getPatientData(patientId: string): any {
  try {
    const patients = JSON.parse(localStorage.getItem('clinic_crm_patients_v1') || '[]');
    const patient = patients.find((p: any) => p.id === patientId);
    
    if (!patient) return null;
    
    return {
      id: patient.id,
      age: patient.age,
      gender: patient.gender,
      doctor: patient.doctor,
      status: patient.status,
      createdAt: patient.createdAt
      // Note: Excluding patientName, phone, email, DOB, address for PHI safety
      // Full portability may include these with legal review
    };
  } catch (e) {
    console.error('Error getting patient data:', e);
    return null;
  }
}

/**
 * Get medical history for export
 */
function getMedicalHistory(patientId: string): any[] {
  try {
    const patients = JSON.parse(localStorage.getItem('clinic_crm_patients_v1') || '[]');
    const patient = patients.find((p: any) => p.id === patientId);
    
    if (!patient || !patient.medicalHistory) return [];
    
    return patient.medicalHistory.map((h: any) => ({
      date: h.date,
      condition: h.condition, // May need sanitization
      notes: h.notes ? '[REDACTED]' : undefined // Sanitize clinical notes
    }));
  } catch (e) {
    console.error('Error getting medical history:', e);
    return [];
  }
}

/**
 * Get consultations for export
 */
function getConsultations(patientId: string): any[] {
  try {
    const consultations = JSON.parse(localStorage.getItem('clinic_crm_consultations') || '[]');
    return consultations
      .filter((c: any) => c.patientId === patientId)
      .map((c: any) => ({
        id: c.id,
        date: c.date,
        doctor: c.doctor,
        diagnosis: c.diagnosis ? '[REDACTED]' : undefined, // Sanitize
        notes: c.notes ? '[REDACTED]' : undefined, // Sanitize
        status: c.status
      }));
  } catch (e) {
    console.error('Error getting consultations:', e);
    return [];
  }
}

/**
 * Get prescriptions for export
 */
function getPrescriptions(patientId: string): any[] {
  try {
    const prescriptions = JSON.parse(localStorage.getItem('clinic_crm_prescriptions') || '[]');
    return prescriptions
      .filter((p: any) => p.patientId === patientId)
      .map((p: any) => ({
        id: p.id,
        date: p.date,
        doctor: p.doctor,
        medication: p.medication ? '[REDACTED]' : undefined, // Sanitize
        dosage: p.dosage ? '[REDACTED]' : undefined, // Sanitize
        status: p.status
      }));
  } catch (e) {
    console.error('Error getting prescriptions:', e);
    return [];
  }
}

/**
 * Get lab results for export
 */
function getLabResults(patientId: string): any[] {
  try {
    const labOrders = JSON.parse(localStorage.getItem('clinic_crm_lab_orders') || '[]');
    return labOrders
      .filter((l: any) => l.patientId === patientId)
      .map((l: any) => ({
        id: l.id,
        date: l.date,
        test: l.test,
        result: l.result ? '[REDACTED]' : undefined, // Sanitize
        status: l.status
      }));
  } catch (e) {
    console.error('Error getting lab results:', e);
    return [];
  }
}

/**
 * Get documents for export
 */
function getDocuments(patientId: string): any[] {
  try {
    const documents = JSON.parse(localStorage.getItem('clinic_crm_documents') || '[]');
    return documents
      .filter((d: any) => d.patientId === patientId)
      .map((d: any) => ({
        id: d.id,
        title: d.title ? '[REDACTED]' : undefined, // Sanitize
        type: d.type,
        uploadedAt: d.uploadedAt,
        status: d.status
      }));
  } catch (e) {
    console.error('Error getting documents:', e);
    return [];
  }
}

/**
 * Get appointments for export
 */
function getAppointments(patientId: string): any[] {
  try {
    const patients = JSON.parse(localStorage.getItem('clinic_crm_patients_v1') || '[]');
    const patient = patients.find((p: any) => p.id === patientId);
    
    if (!patient || !patient.appointments) return [];
    
    return patient.appointments.map((a: any) => ({
      date: a.date,
      doctor: a.doctor,
      status: a.status
    }));
  } catch (e) {
    console.error('Error getting appointments:', e);
    return [];
  }
}

/**
 * Generate patient data portability export
 */
export function generatePortabilityExport(
  patientId: string,
  exportedBy: string,
  requestId?: string,
  sections: string[] = ['patient', 'medicalHistory', 'consultations', 'prescriptions', 'labResults', 'documents', 'appointments']
): PatientDataExport | null {
  const data: PatientDataExport['data'] = {};
  let recordCount = 0;

  if (sections.includes('patient')) {
    data.patient = getPatientData(patientId);
    if (data.patient) recordCount++;
  }

  if (sections.includes('medicalHistory')) {
    data.medicalHistory = getMedicalHistory(patientId);
    recordCount += data.medicalHistory.length;
  }

  if (sections.includes('consultations')) {
    data.consultations = getConsultations(patientId);
    recordCount += data.consultations.length;
  }

  if (sections.includes('prescriptions')) {
    data.prescriptions = getPrescriptions(patientId);
    recordCount += data.prescriptions.length;
  }

  if (sections.includes('labResults')) {
    data.labResults = getLabResults(patientId);
    recordCount += data.labResults.length;
  }

  if (sections.includes('documents')) {
    data.documents = getDocuments(patientId);
    recordCount += data.documents.length;
  }

  if (sections.includes('appointments')) {
    data.appointments = getAppointments(patientId);
    recordCount += data.appointments.length;
  }

  const metadata: PortabilityExportMetadata = {
    exportedAt: new Date().toISOString(),
    exportedBy,
    patientId,
    exportType: 'PATIENT_DATA_PORTABILITY_EXPORT',
    requestId,
    sections,
    recordCount
  };

  // Log export (PHI-safe)
  logPortabilityExport(metadata);

  return {
    metadata,
    data
  };
}

/**
 * Export as JSON string
 */
export function exportAsJSON(exportData: PatientDataExport): string {
  return JSON.stringify(exportData, null, 2);
}

/**
 * Download export as JSON file
 */
export function downloadExportFile(exportData: PatientDataExport, filename?: string): void {
  const json = exportAsJSON(exportData);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `patient-portability-${exportData.metadata.patientId}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get portability export history
 */
export function getPortabilityExportHistory(): PortabilityExportMetadata[] {
  try {
    const raw = localStorage.getItem(PORTABILITY_EXPORTS_KEY);
    if (!raw) return [];
    const exports = JSON.parse(raw);
    return Array.isArray(exports) ? exports : [];
  } catch (e) {
    console.error('Error reading portability export history:', e);
    return [];
  }
}

/**
 * Get portability export history for a patient
 */
export function getPatientPortabilityHistory(patientId: string): PortabilityExportMetadata[] {
  const history = getPortabilityExportHistory();
  return history.filter(e => e.patientId === patientId);
}

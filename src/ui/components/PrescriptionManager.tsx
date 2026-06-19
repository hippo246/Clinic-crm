import React, { useState, useMemo } from 'react';

interface Prescription {
  id?: string;
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage: string;
  dosage_unit: string;
  dosage_form: string;
  frequency: string;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'as_needed' | 'prn';
  route: string;
  duration: string;
  duration_unit: 'days' | 'weeks' | 'months' | 'indefinite';
  start_date: string;
  end_date?: string;
  instructions: string;
  special_instructions?: string;
  refills: number;
  refills_remaining?: number;
  refill_history?: Array<{ date: string; filled_by: string }>;
  expiry_date?: string;
  prescribing_doctor?: string;
  diagnosis?: string;
  indication?: string;
  warnings?: string;
  side_effects?: string;
  interactions?: string[];
  status?: 'active' | 'completed' | 'discontinued' | 'on_hold';
  notes?: string;
  // Enhanced medical fields
  drug_classification?: string;
  therapeutic_class?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  prior_authorization?: boolean;
  prior_auth_status?: 'not_required' | 'pending' | 'approved' | 'denied';
  quantity_dispensed?: string;
  days_supply?: number;
  dea_schedule?: 'not_controlled' | 'C-II' | 'C-III' | 'C-IV' | 'C-V';
  ndc_code?: string;
  manufacturer?: string;
  lot_number?: string;
  medication_expiry?: string;
  storage_requirements?: string;
  monitoring_parameters?: string;
  lab_monitoring?: string;
  contraindications?: string;
  pregnancy_category?: 'A' | 'B' | 'C' | 'D' | 'X' | 'N';
  breastfeeding_warning?: boolean;
  pediatric_dosing?: string;
  geriatric_dosing?: string;
  food_interactions?: string;
  alternative_medications?: string;
}

interface PrescriptionManagerProps {
  patientId: string;
  patientName: string;
  consultationId?: string;
  onSavePrescriptions: (prescriptions: Prescription[]) => void;
  onCancel: () => void;
}

// Simple drug interaction database (in a real app, this would be a comprehensive API)
const DRUG_INTERACTIONS: Record<string, string[]> = {
  'warfarin': ['aspirin', 'ibuprofen', 'naproxen', 'clopidogrel'],
  'aspirin': ['warfarin', 'ibuprofen', 'naproxen', 'heparin'],
  'ibuprofen': ['warfarin', 'aspirin', 'naproxen', 'corticosteroids'],
  'naproxen': ['warfarin', 'aspirin', 'ibuprofen'],
  'lisinopril': ['potassium', 'nsaids', 'diuretics'],
  'metformin': ['contrast dye', 'alcohol', 'cimetidine'],
  'digoxin': ['verapamil', 'amiodarone', 'quinidine'],
  'insulin': ['beta blockers', 'corticosteroids', 'thiazides'],
};

function checkDrugInteractions(medications: string[]): Array<{ med1: string; med2: string; severity: 'high' | 'medium' | 'low' }> {
  const interactions: Array<{ med1: string; med2: string; severity: 'high' | 'medium' | 'low' }> = [];
  const normalizedMeds = medications.map(m => m.toLowerCase().trim());

  for (let i = 0; i < normalizedMeds.length; i++) {
    for (let j = i + 1; j < normalizedMeds.length; j++) {
      const med1 = normalizedMeds[i];
      const med2 = normalizedMeds[j];

      // Check if med1 has interactions with med2
      if (DRUG_INTERACTIONS[med1]?.includes(med2)) {
        interactions.push({
          med1: medications[i],
          med2: medications[j],
          severity: 'high'
        });
      }
      // Check if med2 has interactions with med1
      if (DRUG_INTERACTIONS[med2]?.includes(med1)) {
        interactions.push({
          med1: medications[j],
          med2: medications[i],
          severity: 'high'
        });
      }
    }
  }

  return interactions;
}

export function PrescriptionManager({ patientId, patientName, consultationId, onSavePrescriptions, onCancel }: PrescriptionManagerProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([{
    medication_name: '',
    generic_name: '',
    brand_name: '',
    dosage: '',
    dosage_unit: 'mg',
    dosage_form: 'tablet',
    frequency: '',
    frequency_type: 'daily',
    route: 'oral',
    duration: '',
    duration_unit: 'days',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    instructions: '',
    special_instructions: '',
    refills: 0,
    refills_remaining: 0,
    refill_history: [],
    expiry_date: '',
    prescribing_doctor: '',
    diagnosis: '',
    indication: '',
    warnings: '',
    side_effects: '',
    interactions: [],
    status: 'active',
    notes: '',
    drug_classification: '',
    therapeutic_class: '',
    pharmacy_name: '',
    pharmacy_phone: '',
    prior_authorization: false,
    prior_auth_status: 'not_required',
    quantity_dispensed: '',
    days_supply: 0,
    dea_schedule: 'not_controlled',
    ndc_code: '',
    manufacturer: '',
    lot_number: '',
    medication_expiry: '',
    storage_requirements: '',
    monitoring_parameters: '',
    lab_monitoring: '',
    contraindications: '',
    pregnancy_category: 'N',
    breastfeeding_warning: false,
    pediatric_dosing: '',
    geriatric_dosing: '',
    food_interactions: '',
    alternative_medications: ''
  }]);
  const [loading, setLoading] = useState(false);

  // Check for drug interactions
  const drugInteractions = useMemo(() => {
    const medications = prescriptions
      .filter(p => p.medication_name.trim() !== '')
      .map(p => p.medication_name);
    return checkDrugInteractions(medications);
  }, [prescriptions]);

  // Check for expiring prescriptions
  const expiringPrescriptions = useMemo(() => {
    const today = new Date();
    const warningThreshold = 30; // 30 days warning
    const expiring: Array<{ index: number; medication: string; expiryDate: string; daysUntilExpiry: number }> = [];

    prescriptions.forEach((prescription, index) => {
      if (prescription.expiry_date) {
        const expiryDate = new Date(prescription.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= warningThreshold && daysUntilExpiry > 0) {
          expiring.push({
            index,
            medication: prescription.medication_name || 'Unnamed medication',
            expiryDate: prescription.expiry_date,
            daysUntilExpiry
          });
        } else if (daysUntilExpiry <= 0) {
          expiring.push({
            index,
            medication: prescription.medication_name || 'Unnamed medication',
            expiryDate: prescription.expiry_date,
            daysUntilExpiry
          });
        }
      }
    });

    return expiring;
  }, [prescriptions]);

  // Check for low refills
  const lowRefillPrescriptions = useMemo(() => {
    const refillThreshold = 2; // Warn when 2 or fewer refills remaining
    const lowRefills: Array<{ index: number; medication: string; refillsRemaining: number }> = [];

    prescriptions.forEach((prescription, index) => {
      if (prescription.refills <= refillThreshold && prescription.refills >= 0) {
        lowRefills.push({
          index,
          medication: prescription.medication_name || 'Unnamed medication',
          refillsRemaining: prescription.refills
        });
      }
    });

    return lowRefills;
  }, [prescriptions]);

  const addPrescription = () => {
    setPrescriptions([...prescriptions, {
      medication_name: '',
      generic_name: '',
      brand_name: '',
      dosage: '',
      dosage_unit: 'mg',
      dosage_form: 'tablet',
      frequency: '',
      frequency_type: 'daily',
      route: 'oral',
      duration: '',
      duration_unit: 'days',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      instructions: '',
      special_instructions: '',
      refills: 0,
      refills_remaining: 0,
      refill_history: [],
      expiry_date: '',
      prescribing_doctor: '',
      diagnosis: '',
      indication: '',
      warnings: '',
      side_effects: '',
      interactions: [],
      status: 'active',
      notes: '',
      drug_classification: '',
      therapeutic_class: '',
      pharmacy_name: '',
      pharmacy_phone: '',
      prior_authorization: false,
      prior_auth_status: 'not_required',
      quantity_dispensed: '',
      days_supply: 0,
      dea_schedule: 'not_controlled',
      ndc_code: '',
      manufacturer: '',
      lot_number: '',
      medication_expiry: '',
      storage_requirements: '',
      monitoring_parameters: '',
      lab_monitoring: '',
      contraindications: '',
      pregnancy_category: 'N',
      breastfeeding_warning: false,
      pediatric_dosing: '',
      geriatric_dosing: '',
      food_interactions: '',
      alternative_medications: ''
    }]);
  };

  const removePrescription = (index: number) => {
    if (prescriptions.length > 1) {
      setPrescriptions(prescriptions.filter((_, i) => i !== index));
    }
  };

  const updatePrescription = (index: number, field: keyof Prescription, value: string | number) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validPrescriptions = prescriptions.map(p => ({
        ...p,
        patient_id: patientId,
        consultation_id: consultationId,
        status: (p.status || 'active') as 'active' | 'completed' | 'discontinued' | 'on_hold'
      }));

      await onSavePrescriptions(validPrescriptions);
    } catch (error) {
      console.error('Failed to save prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPrescriptions = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString();
    
    const prescriptionsHTML = prescriptions.map((prescription, index) => `
      <div style="page-break-inside: avoid; margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px;">
          <h2 style="margin: 0; font-size: 18px; color: #333;">Prescription #${index + 1}</h2>
          <span style="background: ${prescription.status === 'active' ? '#10b981' : prescription.status === 'completed' ? '#3b82f6' : '#f59e0b'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${prescription.status?.toUpperCase() || 'ACTIVE'}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: #666; font-size: 12px;">MEDICATION:</strong>
            <div style="font-size: 16px; font-weight: 600; color: #333;">${prescription.medication_name}</div>
            ${prescription.generic_name ? `<div style="font-size: 12px; color: #666;">Generic: ${prescription.generic_name}</div>` : ''}
          </div>
          <div>
            <strong style="color: #666; font-size: 12px;">DOSAGE:</strong>
            <div style="font-size: 16px; font-weight: 600; color: #333;">${prescription.dosage} ${prescription.dosage_unit} - ${prescription.dosage_form}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: #666; font-size: 12px;">FREQUENCY:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.frequency} (${prescription.frequency_type})</div>
          </div>
          <div>
            <strong style="color: #666; font-size: 12px;">ROUTE:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.route}</div>
          </div>
        </div>

        <div style="display: grid; grid-templateColumns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: #666; font-size: 12px;">DURATION:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.duration} ${prescription.duration_unit}</div>
          </div>
          <div>
            <strong style="color: #666; font-size: 12px;">DATES:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.start_date} ${prescription.end_date ? 'to ' + prescription.end_date : ''}</div>
          </div>
        </div>

        <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
          <strong style="color: #666; font-size: 12px;">INSTRUCTIONS:</strong>
          <div style="font-size: 14px; color: #333; margin-top: 5px;">${prescription.instructions}</div>
          ${prescription.special_instructions ? `<div style="font-size: 13px; color: #666; margin-top: 8px; font-style: italic;">${prescription.special_instructions}</div>` : ''}
        </div>

        ${prescription.warnings ? `
        <div style="background: #fef2f2; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #dc2626;">
          <strong style="color: #dc2626; font-size: 12px;">⚠️ WARNINGS:</strong>
          <div style="font-size: 13px; color: #991b1b; margin-top: 5px;">${prescription.warnings}</div>
        </div>
        ` : ''}

        ${prescription.side_effects ? `
        <div style="background: #fffbeb; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #f59e0b;">
          <strong style="color: #b45309; font-size: 12px;">SIDE EFFECTS:</strong>
          <div style="font-size: 13px; color: #92400e; margin-top: 5px;">${prescription.side_effects}</div>
        </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; padding-top: 15px; border-top: 1px solid #eee;">
          <div>
            <strong style="color: #666; font-size: 12px;">REFILLS:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.refills} total (${prescription.refills_remaining || 0} remaining)</div>
          </div>
          <div>
            <strong style="color: #666; font-size: 12px;">EXPIRY:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.expiry_date || 'N/A'}</div>
          </div>
          <div>
            <strong style="color: #666; font-size: 12px;">DOCTOR:</strong>
            <div style="font-size: 14px; color: #333;">${prescription.prescribing_doctor || 'N/A'}</div>
          </div>
        </div>

        ${prescription.diagnosis || prescription.indication ? `
        <div style="background: #eff6ff; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          ${prescription.diagnosis ? `<div><strong style="color: #1e40af; font-size: 12px;">DIAGNOSIS:</strong> <span style="font-size: 13px; color: #1e3a8a;">${prescription.diagnosis}</span></div>` : ''}
          ${prescription.indication ? `<div style="margin-top: 5px;"><strong style="color: #1e40af; font-size: 12px;">INDICATION:</strong> <span style="font-size: 13px; color: #1e3a8a;">${prescription.indication}</span></div>` : ''}
        </div>
        ` : ''}

        ${prescription.notes ? `
        <div style="font-size: 12px; color: #666; font-style: italic; margin-top: 10px;">
          <strong>Notes:</strong> ${prescription.notes}
        </div>
        ` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${patientName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            margin: 0;
            color: #333;
            background: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #333;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            color: #333;
          }
          .header .subtitle {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
          }
          .patient-info {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .patient-info div {
            font-size: 14px;
          }
          .patient-info strong {
            color: #666;
            font-size: 12px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 11px;
            color: #999;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
          @page {
            margin: 1cm;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 MEDICAL PRESCRIPTION</h1>
          <div class="subtitle">ClinicOS - Electronic Health Records</div>
        </div>

        <div class="patient-info">
          <div><strong>PATIENT:</strong> ${patientName}</div>
          <div><strong>PATIENT ID:</strong> ${patientId}</div>
          <div><strong>DATE:</strong> ${currentDate}</div>
          <div><strong>CONSULTATION ID:</strong> ${consultationId || 'N/A'}</div>
        </div>

        ${prescriptionsHTML}

        <div class="footer">
          <p>This is an electronically generated prescription. Please verify all information before dispensing.</p>
          <p>Generated by ClinicOS · Confidential Medical Information · ${currentDate}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-right: 10px;">Print</button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Close</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            Prescriptions
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#0369a1' }}>
            <strong>Patient:</strong> {patientName}
          </p>
        </div>

        {/* Drug Interaction Warnings */}
        {drugInteractions.length > 0 && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#dc2626' }}>
                Drug Interaction Warnings
              </h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#991b1b' }}>
              {drugInteractions.map((interaction, index) => (
                <li key={index}>
                  <strong>{interaction.med1}</strong> may interact with <strong>{interaction.med2}</strong> ({interaction.severity} severity)
                </li>
              ))}
            </ul>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#991b1b', fontStyle: 'italic' }}>
              Please review these interactions before proceeding.
            </p>
          </div>
        )}

        {/* Prescription Expiry Alerts */}
        {expiringPrescriptions.length > 0 && (
          <div style={{
            background: '#fefce8',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>⏰</span>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#ca8a04' }}>
                Prescription Expiry Alerts
              </h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#854d0e' }}>
              {expiringPrescriptions.map((expiring, index) => (
                <li key={index}>
                  <strong>{expiring.medication}</strong> {expiring.daysUntilExpiry <= 0 ? 'has expired' : `expires in ${expiring.daysUntilExpiry} days`} ({expiring.expiryDate})
                </li>
              ))}
            </ul>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#854d0e', fontStyle: 'italic' }}>
              Please review expiry dates before proceeding.
            </p>
          </div>
        )}

        {/* Refill Reminders */}
        {lowRefillPrescriptions.length > 0 && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>💊</span>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#1d4ed8' }}>
                Refill Reminders
              </h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#1e40af' }}>
              {lowRefillPrescriptions.map((refill, index) => (
                <li key={index}>
                  <strong>{refill.medication}</strong> has {refill.refillsRemaining} refill{refill.refillsRemaining !== 1 ? 's' : ''} remaining
                </li>
              ))}
            </ul>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#1e40af', fontStyle: 'italic' }}>
              Consider increasing refills for these medications.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {prescriptions.map((prescription, index) => (
            <div key={index} style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1rem',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                  Medication #{index + 1}
                </h3>
                {prescriptions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePrescription(index)}
                    style={{
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Medication Name *
                  </label>
                  <input
                    type="text"
                    value={prescription.medication_name}
                    onChange={(e) => updatePrescription(index, 'medication_name', e.target.value)}
                    required
                    placeholder="e.g., Amoxicillin"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Generic Name
                  </label>
                  <input
                    type="text"
                    value={prescription.generic_name || ''}
                    onChange={(e) => updatePrescription(index, 'generic_name', e.target.value)}
                    placeholder="e.g., Amoxicillin trihydrate"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={prescription.brand_name || ''}
                    onChange={(e) => updatePrescription(index, 'brand_name', e.target.value)}
                    placeholder="e.g., Amoxil"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Dosage *
                  </label>
                  <input
                    type="text"
                    value={prescription.dosage}
                    onChange={(e) => updatePrescription(index, 'dosage', e.target.value)}
                    required
                    placeholder="e.g., 500"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Dosage Unit *
                  </label>
                  <select
                    value={prescription.dosage_unit}
                    onChange={(e) => updatePrescription(index, 'dosage_unit', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="mcg">mcg</option>
                    <option value="ml">ml</option>
                    <option value="units">units</option>
                    <option value="IU">IU</option>
                    <option value="%">%</option>
                  </select>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Dosage Form *
                  </label>
                  <select
                    value={prescription.dosage_form}
                    onChange={(e) => updatePrescription(index, 'dosage_form', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="liquid">Liquid/Syrup</option>
                    <option value="injection">Injection</option>
                    <option value="cream">Cream</option>
                    <option value="ointment">Ointment</option>
                    <option value="drops">Drops</option>
                    <option value="inhaler">Inhaler</option>
                    <option value="patch">Patch</option>
                    <option value="suppository">Suppository</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Frequency *
                  </label>
                  <input
                    type="text"
                    value={prescription.frequency}
                    onChange={(e) => updatePrescription(index, 'frequency', e.target.value)}
                    required
                    placeholder="e.g., 3x daily"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Frequency Type *
                  </label>
                  <select
                    value={prescription.frequency_type}
                    onChange={(e) => updatePrescription(index, 'frequency_type', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="as_needed">As Needed</option>
                    <option value="prn">PRN (Pro Re Nata)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Route *
                  </label>
                  <select
                    value={prescription.route}
                    onChange={(e) => updatePrescription(index, 'route', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="oral">Oral</option>
                    <option value="intravenous">Intravenous</option>
                    <option value="intramuscular">Intramuscular</option>
                    <option value="topical">Topical</option>
                    <option value="inhaled">Inhaled</option>
                    <option value="rectal">Rectal</option>
                    <option value="sublingual">Sublingual</option>
                    <option value="buccal">Buccal</option>
                    <option value="nasal">Nasal</option>
                    <option value="ophthalmic">Ophthalmic</option>
                    <option value="otic">Otic (Ear)</option>
                  </select>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Duration *
                  </label>
                  <input
                    type="text"
                    value={prescription.duration}
                    onChange={(e) => updatePrescription(index, 'duration', e.target.value)}
                    required
                    placeholder="e.g., 7"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Duration Unit *
                  </label>
                  <select
                    value={prescription.duration_unit}
                    onChange={(e) => updatePrescription(index, 'duration_unit', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="indefinite">Indefinite</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={prescription.start_date}
                    onChange={(e) => updatePrescription(index, 'start_date', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={prescription.end_date || ''}
                    onChange={(e) => updatePrescription(index, 'end_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Refills
                  </label>
                  <input
                    type="number"
                    value={prescription.refills}
                    onChange={(e) => updatePrescription(index, 'refills', parseInt(e.target.value))}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Refills Remaining
                  </label>
                  <input
                    type="number"
                    value={prescription.refills_remaining || 0}
                    onChange={(e) => updatePrescription(index, 'refills_remaining', parseInt(e.target.value))}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={prescription.expiry_date || ''}
                    onChange={(e) => updatePrescription(index, 'expiry_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Prescribing Doctor
                  </label>
                  <input
                    type="text"
                    value={prescription.prescribing_doctor || ''}
                    onChange={(e) => updatePrescription(index, 'prescribing_doctor', e.target.value)}
                    placeholder="e.g., Dr. Smith"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Status
                  </label>
                  <select
                    value={prescription.status || 'active'}
                    onChange={(e) => updatePrescription(index, 'status', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Drug Classification
                  </label>
                  <select
                    value={prescription.drug_classification || ''}
                    onChange={(e) => updatePrescription(index, 'drug_classification', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Analgesic">Analgesic</option>
                    <option value="Antihypertensive">Antihypertensive</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Antidepressant">Antidepressant</option>
                    <option value="Antipsychotic">Antipsychotic</option>
                    <option value="Anticoagulant">Anticoagulant</option>
                    <option value="Anti-inflammatory">Anti-inflammatory</option>
                    <option value="Antihistamine">Antihistamine</option>
                    <option value="Bronchodilator">Bronchodilator</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Dermatological">Dermatological</option>
                    <option value="Endocrine">Endocrine</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Immunosuppressant">Immunosuppressant</option>
                    <option value="Vaccine">Vaccine</option>
                    <option value="Vitamin/Supplement">Vitamin/Supplement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Therapeutic Class
                  </label>
                  <input
                    type="text"
                    value={prescription.therapeutic_class || ''}
                    onChange={(e) => updatePrescription(index, 'therapeutic_class', e.target.value)}
                    placeholder="e.g., Penicillin, Beta-blocker"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Quantity Dispensed
                  </label>
                  <input
                    type="text"
                    value={prescription.quantity_dispensed || ''}
                    onChange={(e) => updatePrescription(index, 'quantity_dispensed', e.target.value)}
                    placeholder="e.g., 30 tablets"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Days Supply
                  </label>
                  <input
                    type="number"
                    value={prescription.days_supply || 0}
                    onChange={(e) => updatePrescription(index, 'days_supply', parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="e.g., 30"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    DEA Schedule
                  </label>
                  <select
                    value={prescription.dea_schedule || 'not_controlled'}
                    onChange={(e) => updatePrescription(index, 'dea_schedule', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="not_controlled">Not Controlled</option>
                    <option value="C-II">Schedule II</option>
                    <option value="C-III">Schedule III</option>
                    <option value="C-IV">Schedule IV</option>
                    <option value="C-V">Schedule V</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    NDC Code
                  </label>
                  <input
                    type="text"
                    value={prescription.ndc_code || ''}
                    onChange={(e) => updatePrescription(index, 'ndc_code', e.target.value)}
                    placeholder="e.g., 12345-678-90"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={prescription.manufacturer || ''}
                    onChange={(e) => updatePrescription(index, 'manufacturer', e.target.value)}
                    placeholder="e.g., Pfizer"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Pharmacy Name
                  </label>
                  <input
                    type="text"
                    value={prescription.pharmacy_name || ''}
                    onChange={(e) => updatePrescription(index, 'pharmacy_name', e.target.value)}
                    placeholder="e.g., CVS Pharmacy"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Pharmacy Phone
                  </label>
                  <input
                    type="tel"
                    value={prescription.pharmacy_phone || ''}
                    onChange={(e) => updatePrescription(index, 'pharmacy_phone', e.target.value)}
                    placeholder="e.g., +1-555-0123"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Prior Authorization
                  </label>
                  <select
                    value={prescription.prior_authorization ? 'yes' : 'no'}
                    onChange={(e) => updatePrescription(index, 'prior_authorization', e.target.value === 'yes')}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              {prescription.prior_authorization && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Prior Auth Status
                  </label>
                  <select
                    value={prescription.prior_auth_status || 'not_required'}
                    onChange={(e) => updatePrescription(index, 'prior_auth_status', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="not_required">Not Required</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Instructions *
                </label>
                <textarea
                  value={prescription.instructions}
                  onChange={(e) => updatePrescription(index, 'instructions', e.target.value)}
                  required
                  rows={2}
                  placeholder="e.g., Take with food, complete full course"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Special Instructions
                </label>
                <textarea
                  value={prescription.special_instructions || ''}
                  onChange={(e) => updatePrescription(index, 'special_instructions', e.target.value)}
                  rows={2}
                  placeholder="e.g., Take on empty stomach, avoid alcohol"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Diagnosis
                  </label>
                  <input
                    type="text"
                    value={prescription.diagnosis || ''}
                    onChange={(e) => updatePrescription(index, 'diagnosis', e.target.value)}
                    placeholder="e.g., Bacterial infection"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Indication
                  </label>
                  <input
                    type="text"
                    value={prescription.indication || ''}
                    onChange={(e) => updatePrescription(index, 'indication', e.target.value)}
                    placeholder="e.g., Treatment of infection"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Warnings
                </label>
                <textarea
                  value={prescription.warnings || ''}
                  onChange={(e) => updatePrescription(index, 'warnings', e.target.value)}
                  rows={2}
                  placeholder="e.g., May cause drowsiness, do not drive"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Side Effects
                </label>
                <textarea
                  value={prescription.side_effects || ''}
                  onChange={(e) => updatePrescription(index, 'side_effects', e.target.value)}
                  rows={2}
                  placeholder="e.g., Nausea, headache, dizziness"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Notes
                </label>
                <textarea
                  value={prescription.notes || ''}
                  onChange={(e) => updatePrescription(index, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>Advanced Medical Information</h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Lot Number
                  </label>
                  <input
                    type="text"
                    value={prescription.lot_number || ''}
                    onChange={(e) => updatePrescription(index, 'lot_number', e.target.value)}
                    placeholder="e.g., ABC123"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Medication Expiry
                  </label>
                  <input
                    type="date"
                    value={prescription.medication_expiry || ''}
                    onChange={(e) => updatePrescription(index, 'medication_expiry', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Pregnancy Category
                  </label>
                  <select
                    value={prescription.pregnancy_category || 'N'}
                    onChange={(e) => updatePrescription(index, 'pregnancy_category', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="N">N (Not classified)</option>
                    <option value="A">A (No risk)</option>
                    <option value="B">B (No evidence of risk)</option>
                    <option value="C">C (Risk cannot be ruled out)</option>
                    <option value="D">D (Positive evidence of risk)</option>
                    <option value="X">X (Contraindicated)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Storage Requirements
                </label>
                <input
                  type="text"
                  value={prescription.storage_requirements || ''}
                  onChange={(e) => updatePrescription(index, 'storage_requirements', e.target.value)}
                  placeholder="e.g., Store at room temperature, protect from light"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Monitoring Parameters
                </label>
                <textarea
                  value={prescription.monitoring_parameters || ''}
                  onChange={(e) => updatePrescription(index, 'monitoring_parameters', e.target.value)}
                  rows={2}
                  placeholder="e.g., Monitor blood pressure, liver function tests"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Lab Monitoring
                </label>
                <textarea
                  value={prescription.lab_monitoring || ''}
                  onChange={(e) => updatePrescription(index, 'lab_monitoring', e.target.value)}
                  rows={2}
                  placeholder="e.g., CBC, kidney function, electrolytes"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Contraindications
                </label>
                <textarea
                  value={prescription.contraindications || ''}
                  onChange={(e) => updatePrescription(index, 'contraindications', e.target.value)}
                  rows={2}
                  placeholder="e.g., Severe liver impairment, hypersensitivity"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Pediatric Dosing
                </label>
                <textarea
                  value={prescription.pediatric_dosing || ''}
                  onChange={(e) => updatePrescription(index, 'pediatric_dosing', e.target.value)}
                  rows={2}
                  placeholder="e.g., 10mg/kg/day divided every 8 hours"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Geriatric Dosing
                </label>
                <textarea
                  value={prescription.geriatric_dosing || ''}
                  onChange={(e) => updatePrescription(index, 'geriatric_dosing', e.target.value)}
                  rows={2}
                  placeholder="e.g., Start at half dose, titrate slowly"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Food Interactions
                </label>
                <textarea
                  value={prescription.food_interactions || ''}
                  onChange={(e) => updatePrescription(index, 'food_interactions', e.target.value)}
                  rows={2}
                  placeholder="e.g., Take with food, avoid grapefruit juice"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Alternative Medications
                </label>
                <textarea
                  value={prescription.alternative_medications || ''}
                  onChange={(e) => updatePrescription(index, 'alternative_medications', e.target.value)}
                  rows={2}
                  placeholder="e.g., Amoxicillin, Cephalexin"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem',
                }}>
                  <input
                    type="checkbox"
                    checked={prescription.breastfeeding_warning || false}
                    onChange={(e) => updatePrescription(index, 'breastfeeding_warning', e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Breastfeeding Warning
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addPrescription}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#f3f4f6',
              color: '#374151',
              border: '2px dashed #d1d5db',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '1.5rem',
            }}
          >
            + Add Another Medication
          </button>

          <div style={{
            display: 'flex',
            gap: '1rem',
          }}>
            <button
              type="button"
              onClick={handlePrintPrescriptions}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              🖨️ Print Preview
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Save Prescriptions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

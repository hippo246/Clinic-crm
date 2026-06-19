import React, { useState } from 'react';

interface ConsentManagerProps {
  patientId: string;
  patientName: string;
  onSignConsent: (consent: any) => void;
  onCancel: () => void;
}

export function ConsentManager({ patientId, patientName, onSignConsent, onCancel }: ConsentManagerProps) {
  const [selectedConsent, setSelectedConsent] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessSignature, setWitnessSignature] = useState(false);
  const [loading, setLoading] = useState(false);

  const consentTypes = [
    { id: 'treatment', label: 'Treatment Consent', description: 'Consent for medical treatment and procedures' },
    { id: 'surgery', label: 'Surgery Consent', description: 'Consent for surgical procedures' },
    { id: 'medication', label: 'Medication Consent', description: 'Consent for prescribed medications' },
    { id: 'privacy', label: 'Privacy Consent', description: 'Consent for handling of personal health information' },
    { id: 'research', label: 'Research Participation', description: 'Consent for participation in clinical research' },
    { id: 'blood', label: 'Blood Transfusion', description: 'Consent for blood transfusion procedures' },
    { id: 'imaging', label: 'Medical Imaging', description: 'Consent for diagnostic imaging procedures' },
    { id: 'telehealth', label: 'Telehealth Services', description: 'Consent for remote consultation services' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsent) return;

    setLoading(true);

    try {
      const consent = {
        patient_id: patientId,
        consent_type: selectedConsent,
        witness_name: witnessName,
        witness_signature: witnessSignature,
        signed_at: new Date().toISOString(),
        status: 'signed'
      };

      await onSignConsent(consent);
    } catch (error) {
      console.error('Failed to sign consent:', error);
    } finally {
      setLoading(false);
    }
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
        maxWidth: '600px',
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
            Patient Consent
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Type of Consent *
            </label>
            <select
              value={selectedConsent}
              onChange={(e) => setSelectedConsent(e.target.value)}
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
              <option value="">Select consent type...</option>
              {consentTypes.map((consent) => (
                <option key={consent.id} value={consent.id}>
                  {consent.label}
                </option>
              ))}
            </select>
          </div>

          {selectedConsent && (
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                {consentTypes.find(c => c.id === selectedConsent)?.description}
              </p>
            </div>
          )}

          <div style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>
              Consent Terms
            </h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: '1.5' }}>
              I, the undersigned, hereby consent to the above procedure/treatment. I understand the risks, benefits, and alternatives as explained by the healthcare provider. I acknowledge that I have been given the opportunity to ask questions and that all my questions have been answered to my satisfaction.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Witness Name (if applicable)
            </label>
            <input
              type="text"
              value={witnessName}
              onChange={(e) => setWitnessName(e.target.value)}
              placeholder="Full name of witness"
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

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={witnessSignature}
                onChange={(e) => setWitnessSignature(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Witness signature obtained
            </label>
          </div>

          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#166534' }}>
              <strong>Electronic Signature:</strong> By clicking "Sign Consent", I acknowledge that I am signing this consent form electronically and agree to be bound by its terms.
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
          }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedConsent}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: loading || !selectedConsent ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading || !selectedConsent ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing...' : 'Sign Consent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

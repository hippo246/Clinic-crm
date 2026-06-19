import React, { useState } from 'react';

interface PatientOverviewProps {
  patient: any;
  onUpdatePatient: (patient: any) => void;
}

export function PatientOverview({ patient, onUpdatePatient }: PatientOverviewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'documents' | 'notes' | 'followups' | 'consents' | 'audit'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'followups', label: 'Follow-ups', icon: '🔄' },
    { id: 'consents', label: 'Consents', icon: '✍️' },
    { id: 'audit', label: 'Audit Log', icon: '🔒' },
  ];

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
            {patient.name}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            Patient ID: {patient.id?.slice(0, 8)}...
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
        }}>
          <button style={{
            padding: '0.5rem 1rem',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
          }}>
            Edit Patient
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab.id ? '#2563eb' : '#f3f4f6',
              color: activeTab === tab.id ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab patient={patient} />
      )}

      {activeTab === 'timeline' && (
        <TimelineTab patient={patient} />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab patient={patient} />
      )}

      {activeTab === 'notes' && (
        <NotesTab patient={patient} />
      )}

      {activeTab === 'followups' && (
        <FollowUpsTab patient={patient} />
      )}

      {activeTab === 'consents' && (
        <ConsentsTab patient={patient} />
      )}

      {activeTab === 'audit' && (
        <AuditTab patient={patient} />
      )}
    </div>
  );
}

function OverviewTab({ patient }: { patient: any }) {
  return (
    <div>
      {/* Vital Information */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '1rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#0369a1', fontWeight: '500' }}>
            Age
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#0369a1' }}>
            {calculateAge(patient.date_of_birth)}
          </p>
        </div>

        <div style={{
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '1rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', fontWeight: '500' }}>
            Blood Group
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#92400e' }}>
            {patient.blood_group || 'N/A'}
          </p>
        </div>

        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '1rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#166534', fontWeight: '500' }}>
            Status
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#166534' }}>
            {patient.status || 'Active'}
          </p>
        </div>

        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '1rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#991b1b', fontWeight: '500' }}>
            Risk Score
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#991b1b' }}>
            {patient.risk_score || 0}/100
          </p>
        </div>
      </div>

      {/* Patient Details */}
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '1.5rem',
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Patient Information
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
              Date of Birth
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
              {patient.date_of_birth || 'N/A'}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
              Gender
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
              {patient.gender || 'N/A'}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
              Phone
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
              {patient.phone || 'N/A'}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
              Email
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
              {patient.email || 'N/A'}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
              Address
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
              {patient.address || 'N/A'}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
              Insurance
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
              {patient.insurer || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ patient }: { patient: any }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
        Medical Timeline
      </h3>
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          Timeline events will appear here
        </p>
      </div>
    </div>
  );
}

function DocumentsTab({ patient }: { patient: any }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
        Medical Documents
      </h3>
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          No documents uploaded yet
        </p>
        <button style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}>
          Upload Document
        </button>
      </div>
    </div>
  );
}

function NotesTab({ patient }: { patient: any }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
        Clinical Notes
      </h3>
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          No clinical notes yet
        </p>
        <button style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}>
          Add Note
        </button>
      </div>
    </div>
  );
}

function FollowUpsTab({ patient }: { patient: any }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
        Follow-up Schedule
      </h3>
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          No follow-ups scheduled
        </p>
        <button style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}>
          Schedule Follow-up
        </button>
      </div>
    </div>
  );
}

function ConsentsTab({ patient }: { patient: any }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
        Patient Consents
      </h3>
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          No consents on file
        </p>
        <button style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}>
          Request Consent
        </button>
      </div>
    </div>
  );
}

function AuditTab({ patient }: { patient: any }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
        Audit Log
      </h3>
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          Audit log entries will appear here
        </p>
      </div>
    </div>
  );
}

function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

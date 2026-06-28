import React, { useState } from 'react';

interface PatientCommunicationProps {
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  onCallPatient: (patientId: string) => void;
  onSendMessage: (message: any) => void;
  onCancel: () => void;
}

export function PatientCommunication({ patientId, patientName, patientPhone, patientEmail, onCallPatient, onSendMessage, onCancel }: PatientCommunicationProps) {
  const [activeTab, setActiveTab] = useState<'call' | 'message'>('call');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('sms');
  const [loading, setLoading] = useState(false);

  const handleCall = () => {
    if (patientPhone) {
      onCallPatient(patientId);
    } else {
      alert('Patient phone number not available');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);

    try {
      const messageData = {
        patient_id: patientId,
        message_type: messageType,
        content: message,
        recipient: messageType === 'email' ? patientEmail : patientPhone
      };

      await onSendMessage(messageData);
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
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
      <style>{`
        @media (max-width: 640px) {
          .pc-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
      <div className="pc-modal" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        width: '100%',
        maxWidth: '500px',
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
            Patient Communication
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
          {patientPhone && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#0369a1' }}>
              <strong>Phone:</strong> {patientPhone}
            </p>
          )}
          {patientEmail && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#0369a1' }}>
              <strong>Email:</strong> {patientEmail}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '1.5rem',
          borderBottom: '2px solid #e5e7eb',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('call')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: activeTab === 'call' ? '#2563eb' : 'transparent',
              color: activeTab === 'call' ? 'white' : '#6b7280',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              borderBottom: activeTab === 'call' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            📞 Call Patient
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('message')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: activeTab === 'message' ? '#2563eb' : 'transparent',
              color: activeTab === 'message' ? 'white' : '#6b7280',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              borderBottom: activeTab === 'message' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            💬 Send Message
          </button>
        </div>

        {activeTab === 'call' && (
          <div>
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📞</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                Call {patientName}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                {patientPhone || 'No phone number available'}
              </p>
              <button
                onClick={handleCall}
                disabled={!patientPhone}
                style={{
                  padding: '0.75rem 2rem',
                  background: patientPhone ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: patientPhone ? 'pointer' : 'not-allowed',
                }}
              >
                {patientPhone ? 'Start Call' : 'No Phone Number'}
              </button>
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
              padding: '1rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e' }}>
                <strong>Note:</strong> All calls are logged for audit purposes and HIPAA compliance.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'message' && (
          <form onSubmit={handleSendMessage}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
              }}>
                Message Type *
              </label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
              }}>
                Recipient
              </label>
              <div style={{
                padding: '0.75rem',
                background: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: '#6b7280',
              }}>
                {messageType === 'sms' ? patientPhone || 'No phone number' : patientEmail || 'No email'}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
              }}>
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                placeholder="Type your message here..."
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
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                {message.length} characters
                {messageType === 'sms' && ` / ${Math.floor(160 / 160)} SMS segments`}
              </p>
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e' }}>
                <strong>Security Notice:</strong> All messages are encrypted and logged for HIPAA compliance. Do not include sensitive medical information in SMS messages.
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
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

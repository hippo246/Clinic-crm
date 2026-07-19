import React, { useCallback, useState } from 'react';
import {
  validateRequired,
  validateDate,
  validateMaxLength,
  safeString,
} from '../../shared/validation/validators';
import { validateAppointmentData } from '../../shared/validation/entityValidation';
import { Feedback } from '../../shared/components/feedback/Feedback';

interface AppointmentBookingProps {
  patientId: string;
  patientName: string;
  onBookAppointment: (appointment: any) => void;
  onCancel: () => void;
}

export function AppointmentBooking({ patientId, patientName, onBookAppointment, onCancel }: AppointmentBookingProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState('consultation');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  const showFeedback = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
      setFeedback({ type, message });
    },
    []
  );

  function validateAppointment(): boolean {
    const errs: Record<string, string> = {};

    // Validate date
    const dateError = validateRequired(date, 'Date');
    if (dateError) {
      errs.date = dateError;
    } else if (!validateDate(date)) {
      errs.date = 'Invalid date format';
    }

    // Validate time
    const timeError = validateRequired(time, 'Time');
    if (timeError) {
      errs.time = timeError;
    }

    // Validate reason
    const reasonError = validateRequired(reason, 'Reason for visit');
    if (reasonError) {
      errs.reason = reasonError;
    } else {
      const reasonLengthError = validateMaxLength(reason, 500, 'Reason for visit');
      if (reasonLengthError) errs.reason = reasonLengthError;
    }

    // Validate notes (optional but has max length)
    if (notes) {
      const notesLengthError = validateMaxLength(notes, 1000, 'Additional notes');
      if (notesLengthError) errs.notes = notesLengthError;
    }

    setErrors(errs);

    // Use shared entity validation as final check
    const appointmentData = {
      patient_id: patientId,
      date: date,
      appointmentDate: date,
      appointment_time: time,
      appointmentTime: time,
      duration,
      appointment_type: type,
      appointmentType: type,
      reason,
      notes,
      status: 'scheduled'
    };

    const entityValidation = validateAppointmentData(appointmentData);
    if (!entityValidation.valid && entityValidation.errors.length > 0) {
      // Add entity-level errors to field errors
      entityValidation.errors.forEach((err) => {
        if (err.toLowerCase().includes('date')) errs.date = errs.date || err;
        else if (err.toLowerCase().includes('patient')) errs.patient = errs.patient || err;
        else if (err.toLowerCase().includes('doctor')) errs.doctor = errs.doctor || err;
      });
      setErrors(errs);
      return false;
    }

    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAppointment()) {
      return;
    }

    setLoading(true);

    try {
      const appointment = {
        patient_id: patientId,
        appointment_date: date,
        appointment_time: time,
        duration,
        appointment_type: type,
        reason: safeString(reason).trim(),
        notes: safeString(notes).trim(),
        status: 'scheduled'
      };

      await onBookAppointment(appointment);
      showFeedback('Appointment saved locally.', 'success');
    } catch (error) {
      console.error('Failed to book appointment:', error);
      showFeedback(
        'Failed to save appointment. Please check your details and try again.',
        'error'
      );
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
            Book Appointment
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

        {Object.keys(errors).length > 0 && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#dc2626', fontWeight: '500' }}>
              Please fix the following errors:
            </p>
            <ul style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.875rem', color: '#dc2626' }}>
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {feedback && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Feedback
              message={feedback.message}
              type={feedback.type}
              onClose={() => setFeedback(null)}
              duration={4000}
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
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
              Time *
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
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

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Duration (minutes) *
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
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
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
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
              Appointment Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
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
              <option value="consultation">Consultation</option>
              <option value="follow-up">Follow-up</option>
              <option value="procedure">Procedure</option>
              <option value="check-up">Check-up</option>
              <option value="emergency">Emergency</option>
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
              Reason for Visit *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Describe the reason for this appointment"
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

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional information (optional)"
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

          <div style={{
            display: 'flex',
            gap: '1rem',
          }}>
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
                background: loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

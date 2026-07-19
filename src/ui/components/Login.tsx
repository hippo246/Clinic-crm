import React, { useState } from 'react';
import { login as firebaseLogin } from '../../firebase';
import { apiClient } from '../api';
import { logSecurity } from '../../shared/services/auditLogger';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login with Firebase
      const { user, token } = await firebaseLogin(email, password);
      
      // Set Firebase token in API client
      apiClient.setFirebaseToken(token);
      
      // Validate token with backend
      await apiClient.validateFirebaseToken(token);
      
      // Log successful login (Phase 2B → 10F: PHI-safe logging)
      try {
        logSecurity({
          type: "successful_login",
          severity: "low",
          title: "Successful login",
          description: "User logged in successfully",
          userName: "[REDACTED]", // Phase 10F: Do not log email/PHI
          userRole: "unknown",
          ipAddress: "local",
        });
      } catch {
        // Fail silently
      }
      
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      
      // Log failed login attempt (Phase 2B → 10F: PHI-safe logging)
      try {
        logSecurity({
          type: "failed_login",
          severity: "medium",
          title: "Failed login attempt",
          description: "Login failed",
          userName: "[REDACTED]", // Phase 10F: Do not log email/PHI
          userRole: "unknown",
          ipAddress: "local",
        });
      } catch {
        // Fail silently
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          textAlign: 'center',
          color: '#333',
        }}>
          Clinic CRM Login
        </h2>

        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '6px',
          padding: '0.75rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          color: '#856404',
        }}>
          <strong>Demo Mode:</strong> This is a frontend demo. Production requires backend authentication and RBAC enforcement.
        </div>
        
        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#555',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="Enter your email"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#555',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#999' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{
          marginTop: '1rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#666',
        }}>
          <p>Frontend demo authentication. Production requires backend auth with proper security controls.</p>
        </div>
      </div>
    </div>
  );
}

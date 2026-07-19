/**
 * API State Helper
 * Minimal loading and error state components for API mode
 */

import React from 'react';

/**
 * Loading state component
 */
export function ApiLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      color: 'var(--muted)',
      fontSize: 'var(--font-sm)',
    }}>
      <i className="ti ti-loader-2" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }} />
      <span>{message}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * Error state component
 */
export function ApiError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 16,
      color: 'var(--error)',
      fontSize: 'var(--font-sm)',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
    }}>
      <i className="ti ti-alert-circle" style={{ fontSize: 20 }} />
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 12px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

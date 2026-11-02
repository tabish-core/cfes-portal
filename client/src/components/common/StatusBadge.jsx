import React from 'react';
import './StatusBadge.css';

/**
 * Maps arbitrary status keywords to semantic variants.
 */
const getVariantFromStatus = (status) => {
  if (!status) return 'neutral';
  const s = String(status).toLowerCase();

  if (['approved', 'synced', 'active', 'completed', 'success', 'connected'].includes(s)) {
    return 'success';
  }
  if (['draft', 'pending', 'in-progress', 'in_progress', 'warning', 'in progress'].includes(s)) {
    return 'warning';
  }
  if (['rejected', 'failed', 'error', 'danger', 'inactive', 'disconnected'].includes(s)) {
    return 'danger';
  }
  if (['submitted', 'syncing', 'info', 'processing'].includes(s)) {
    return 'info';
  }
  return 'neutral';
};

/**
 * Reusable StatusBadge component for CFES enterprise portal.
 */
const StatusBadge = ({
  status,
  variant,
  label,
  children,
  dot = true,
  size = 'sm',
  className = '',
  ...props
}) => {
  const resolvedVariant = variant || getVariantFromStatus(status);
  const displayText = label || children || status || 'Unknown';

  return (
    <span
      className={`cfes-badge cfes-badge--${resolvedVariant} cfes-badge--${size} ${className}`}
      {...props}
    >
      {dot && <span className="cfes-badge-dot" />}
      <span className="cfes-badge-text">{displayText}</span>
    </span>
  );
};

export default StatusBadge;

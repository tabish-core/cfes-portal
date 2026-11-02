import React from 'react';
import './Input.css';

/**
 * Reusable Input component for CFES enterprise portal.
 */
const Input = ({
  label,
  error,
  helperText,
  id,
  type = 'text',
  size = 'md',
  fullWidth = true,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  const inputId = id || (label ? `cfes-input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`cfes-form-group ${fullWidth ? 'cfes-form-group--full' : ''} ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId} className="cfes-form-label">
          {label}
        </label>
      )}
      <div className="cfes-input-wrapper">
        <input
          id={inputId}
          type={type}
          className={`cfes-input cfes-input--${size} ${error ? 'cfes-input--error' : ''} ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <span className="cfes-form-error">{error}</span>
      ) : helperText ? (
        <span className="cfes-form-helper">{helperText}</span>
      ) : null}
    </div>
  );
};

export default Input;

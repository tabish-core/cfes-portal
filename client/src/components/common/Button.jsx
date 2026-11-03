import React from 'react';
import Icon from './Icon';
import './Button.css';

/**
 * Reusable Button component for CFES enterprise portal.
 * @param {'primary' | 'secondary' | 'subtle' | 'danger' | 'danger-subtle' | 'ghost'} variant
 * @param {'sm' | 'md' | 'lg'} size
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  loading = false,
  disabled = false,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  const isBusy = Boolean(isLoading || loading);

  return (
    <button
      type={type}
      disabled={disabled || isBusy}
      className={`cfes-btn cfes-btn--${variant} cfes-btn--${size} ${
        isBusy ? 'cfes-btn--loading' : ''
      } ${className}`}
      {...props}
    >
      {isBusy ? (
        <>
          <span className="cfes-btn-spinner">
            <Icon name="spinner" size={size === 'sm' ? 14 : 16} />
          </span>
          {children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="cfes-btn-icon">
              {typeof icon === 'string' ? (
                <Icon name={icon} size={size === 'sm' ? 14 : 16} />
              ) : (
                icon
              )}
            </span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className="cfes-btn-icon">
              {typeof icon === 'string' ? (
                <Icon name={icon} size={size === 'sm' ? 14 : 16} />
              ) : (
                icon
              )}
            </span>
          )}
        </>
      )}
    </button>
  );
};

export default Button;

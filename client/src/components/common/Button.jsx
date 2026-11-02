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
  disabled = false,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`cfes-btn cfes-btn--${variant} cfes-btn--${size} ${
        isLoading ? 'cfes-btn--loading' : ''
      } ${className}`}
      {...props}
    >
      {isLoading ? (
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

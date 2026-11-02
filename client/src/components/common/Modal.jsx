import React, { useEffect } from 'react';
import Icon from './Icon';
import './Modal.css';

/**
 * Reusable Modal component for CFES enterprise portal.
 */
const Modal = ({
  isOpen = false,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="cfes-modal-backdrop"
      onClick={closeOnBackdrop && onClose ? onClose : undefined}
    >
      <div
        className={`cfes-modal cfes-modal--${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'cfes-modal-title' : undefined}
      >
        {title && (
          <div className="cfes-modal-header">
            <h3 id="cfes-modal-title" className="cfes-modal-title">
              {title}
            </h3>
            {onClose && (
              <button
                type="button"
                className="cfes-modal-close-btn"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        )}
        <div className="cfes-modal-body">{children}</div>
        {footer && <div className="cfes-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;

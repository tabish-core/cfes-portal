import React from 'react';
import Icon from '../../common/Icon';

/**
 * AssignmentInfoSection — Header details for CCP / Class Project
 * Fields: Department, Program, Course Title, Course Code, Announced Date, Due Date, Total Marks
 */
const AssignmentInfoSection = ({ data, onChange, validationErrors = [] }) => {
  const fields = [
    { label: 'Department', key: 'department', placeholder: 'e.g., Software Engineering' },
    { label: 'Program', key: 'program', placeholder: 'e.g., BE or BS(CS)' },
    { label: 'Course Title', key: 'courseTitle', placeholder: 'e.g., Digital Logic Design', required: true },
    { label: 'Course Code', key: 'courseCode', placeholder: 'e.g., CSC301' },
    { label: 'Announced Date', key: 'announcedDate', type: 'date' },
    { label: 'Due Date', key: 'dueDate', type: 'date' },
    { label: 'Total Marks', key: 'totalMarks', placeholder: 'e.g., 20 or 100' },
  ];

  const hasError = (key) => validationErrors.some((e) => e.field === `headerInfo.${key}`);
  const getError = (key) => validationErrors.find((e) => e.field === `headerInfo.${key}`)?.message;

  return (
    <section className="cfes-ccp-card" aria-labelledby="ccp-assignment-info-heading">
      <div className="cfes-ccp-card-header">
        <h2 id="ccp-assignment-info-heading" className="cfes-ccp-card-title">
          <Icon name="document" size={18} />
          <span>Section A: Assignment Information</span>
        </h2>
        <span className="cfes-ccp-card-tag">Project Overview</span>
      </div>

      <div className="cfes-ccp-grid-info">
        {fields.map((field) => {
          const isInvalid = hasError(field.key);
          const inputId = `ccp-info-${field.key}`;
          return (
            <div key={field.key} className="cfes-ccp-form-group">
              <label
                htmlFor={inputId}
                className={`cfes-ccp-label ${isInvalid ? 'cfes-ccp-label--error' : ''}`}
              >
                {field.label}
                {field.required && <span className="cfes-ccp-required">*</span>}
              </label>
              <input
                id={inputId}
                type={field.type || 'text'}
                value={data[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder || `Enter ${field.label}`}
                className={`cfes-ccp-input ${isInvalid ? 'cfes-ccp-input--error' : ''}`}
                aria-required={field.required}
                aria-invalid={isInvalid}
              />
              {isInvalid && (
                <span className="cfes-ccp-error-text" role="alert">
                  {getError(field.key)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AssignmentInfoSection;

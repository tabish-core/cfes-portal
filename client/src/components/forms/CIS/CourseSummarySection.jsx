import React from 'react';

const inputStyle = {
  padding: '0.5rem 0.8rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '6px',
  fontSize: '0.9rem',
  outline: 'none',
  colorScheme: 'light',
  width: '100%',
  boxSizing: 'border-box'
};

const inputErrorStyle = {
  ...inputStyle,
  border: '1px solid #ef4444',
  backgroundColor: '#fef2f2',
};

const labelStyle = {
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#475569',
  display: 'block'
};

const labelErrorStyle = {
  ...labelStyle,
  color: '#b91c1c',
};

/**
 * CourseSummarySection — Core course identifiers
 * Fields: courseCode, courseName, creditHours
 */
const CourseSummarySection = ({ data, onChange, validationErrors = [] }) => {
  const fields = [
    { label: 'Course Code', key: 'courseCode' },
    { label: 'Course Name', key: 'courseName' },
    { label: 'Credit Hours', key: 'creditHours' },
  ];

  const hasError = (key) => validationErrors.some((e) => e.field === `courseSummary.${key}`);
  const getError = (key) => validationErrors.find((e) => e.field === `courseSummary.${key}`)?.message;

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        Course Summary
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {fields.map((field) => {
          const isInvalid = hasError(field.key);
          return (
            <div key={field.key}>
              <label style={isInvalid ? labelErrorStyle : labelStyle}>
                {field.label}
                {isInvalid && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
              </label>
              <input
                type="text"
                value={data[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={`Enter ${field.label}`}
                style={isInvalid ? inputErrorStyle : inputStyle}
              />
              {isInvalid && (
                <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
                  {getError(field.key)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CourseSummarySection;

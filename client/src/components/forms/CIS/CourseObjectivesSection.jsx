import React from 'react';

const textareaStyle = {
  width: '100%',
  padding: '0.8rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '6px',
  fontSize: '0.9rem',
  outline: 'none',
  colorScheme: 'light',
  boxSizing: 'border-box',
  minHeight: '120px',
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: '1.6'
};

const textareaErrorStyle = {
  ...textareaStyle,
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
 * CourseObjectivesSection — Course objectives textarea
 */
const CourseObjectivesSection = ({ value, onChange, hasError = false, errorMessage = '' }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
      Course Objectives
    </h3>
    <label style={hasError ? labelErrorStyle : labelStyle}>
      List the main objectives of this course
      {hasError && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
    </label>
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter course objectives..."
      style={hasError ? textareaErrorStyle : textareaStyle}
    />
    {hasError && errorMessage && (
      <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
        {errorMessage}
      </span>
    )}
  </div>
);

export default CourseObjectivesSection;

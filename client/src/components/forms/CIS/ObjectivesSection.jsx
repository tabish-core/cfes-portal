import React from 'react';

const textareaStyle = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '6px',
  fontSize: '0.9rem',
  outline: 'none',
  colorScheme: 'light',
  boxSizing: 'border-box',
  minHeight: '80px',
  resize: 'vertical',
  fontFamily: 'inherit'
};

const labelStyle = {
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#475569',
  display: 'block'
};

/**
 * ObjectivesSection — Course description, objectives, and learning outcomes overview
 */
const ObjectivesSection = ({ data, onChange }) => {
  const fields = [
    { label: 'Course Description', key: 'courseDescription' },
    { label: 'Course Objectives', key: 'courseObjectives' },
    { label: 'Learning Outcomes', key: 'learningOutcomes' },
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        Course Objectives &amp; Outcomes
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {fields.map((field) => (
          <div key={field.key}>
            <label style={labelStyle}>{field.label}</label>
            <textarea
              value={data[field.key] || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={`Enter ${field.label}`}
              style={textareaStyle}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObjectivesSection;

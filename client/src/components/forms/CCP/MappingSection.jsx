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
  boxSizing: 'border-box',
};

const labelStyle = {
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#475569',
  display: 'block',
};

/**
 * MappingSection — CLO, SDG, Knowledge Profile, and Complex Problem Solving mapping table
 */
const MappingSection = ({ data, onChange }) => {
  const fields = [
    {
      label: 'Mapped CLO',
      key: 'mappedClo',
      placeholder: 'e.g., CLO3',
      help: 'Course Learning Outcome assessed by this project',
    },
    {
      label: 'SDG',
      key: 'sdg',
      placeholder: 'e.g., 4 & 9',
      help: 'Sustainable Development Goal(s) targeted',
    },
    {
      label: 'Knowledge Profile (only for PEC)',
      key: 'knowledgeProfile',
      placeholder: 'e.g., WK3 (Engineering Fundamentals), WK5 (Engineering Design)',
      help: 'Relevant Washington Accord / PEC knowledge profile (WK1-WK8)',
    },
    {
      label: 'Complex Problem Solving Mapped',
      key: 'complexProblemSolvingMapped',
      placeholder: 'e.g., WP1 (Range of Conflicting Requirements), WP2, WP3',
      help: 'Complex problem attributes mapped for this project',
    },
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '1rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.5rem',
        }}
      >
        CLO &amp; Attribute Mapping
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {fields.map((field) => (
          <div key={field.key}>
            <label style={labelStyle}>{field.label}</label>
            <input
              type="text"
              value={data[field.key] || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              style={inputStyle}
            />
            {field.help && (
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                {field.help}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MappingSection;

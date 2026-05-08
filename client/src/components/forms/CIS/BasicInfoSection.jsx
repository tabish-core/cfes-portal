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

const labelStyle = {
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#475569',
  display: 'block'
};

/**
 * BasicInfoSection — Instructor and scheduling details
 * Fields: instructor, designation, prerequisites, semester,
 *         email, phone, consultingHours, officeLocation
 */
const BasicInfoSection = ({ data, onChange }) => {
  const fields = [
    { label: 'Instructor', key: 'instructor' },
    { label: 'Designation', key: 'designation' },
    { label: 'Prerequisites', key: 'prerequisites' },
    { label: 'Semester', key: 'semester' },
    { label: 'Email', key: 'email', type: 'email' },
    { label: 'Phone', key: 'phone', type: 'tel' },
    { label: 'Consulting Hours', key: 'consultingHours' },
    { label: 'Office Location', key: 'officeLocation' },
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        Basic Information
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {fields.map((field) => (
          <div key={field.key}>
            <label style={labelStyle}>{field.label}</label>
            <input
              type={field.type || 'text'}
              value={data[field.key] || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={`Enter ${field.label}`}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BasicInfoSection;

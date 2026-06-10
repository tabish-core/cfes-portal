import React from 'react';

const CourseInfoSection = ({ data, onChange, validationErrors = [] }) => {
  const fields = [
    { label: 'Faculty Name', key: 'facultyName', type: 'text' },
    { label: 'Program', key: 'program', type: 'text' },
    { label: 'Course Title', key: 'courseTitle', type: 'text' },
    { label: 'Course Code', key: 'courseCode', type: 'text' },
    { label: 'EDP Code', key: 'edpCode', type: 'text' },
    { label: 'Session Day', key: 'sessionDay', type: 'text' },
    { label: 'Time Slot', key: 'timeSlot', type: 'text' },
    { label: 'Location', key: 'location', type: 'text' },
  ];

  // Check if a field has a validation error
  const hasError = (key) => validationErrors.some((e) => e.field === `courseInfo.${key}`);

  return (
    <div className="course-info-section" style={{ marginBottom: '3rem' }}>
      <h3 style={{ 
        marginBottom: '1.5rem', 
        color: '#1e293b', 
        fontSize: '1.2rem',
        fontWeight: '600',
        borderBottom: '2px solid #e2e8f0', 
        paddingBottom: '0.75rem' 
      }}>
        Section 1: Course Information
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {fields.map((field) => {
          const isInvalid = hasError(field.key);
          return (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ 
                marginBottom: '0.35rem', 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                color: isInvalid ? '#b91c1c' : '#475569',
                display: 'block'
              }}>
                {field.label}
                {isInvalid && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
              </label>
              <input
                type={field.type}
                value={data[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={`Enter ${field.label}`}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: `1px solid ${isInvalid ? '#ef4444' : '#cbd5e1'}`,
                  backgroundColor: isInvalid ? '#fef2f2' : '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
              />
              {isInvalid && (
                <span style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '0.25rem' }}>
                  {validationErrors.find((e) => e.field === `courseInfo.${field.key}`)?.message}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CourseInfoSection;

import React from 'react';

const FacultyInfoSection = ({
  facultyInfo = {},
  onChange,
  activeSemesterName = '',
  validationErrors = []
}) => {
  const hasError = (field) =>
    validationErrors.some((e) => e.field === `facultyInfo.${field}` || e.field === field);
  const getErrorMessage = (field) =>
    validationErrors.find((e) => e.field === `facultyInfo.${field}` || e.field === field)?.message;

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3
        style={{
          marginBottom: '1.5rem',
          color: '#1e293b',
          fontSize: '1.2rem',
          fontWeight: '600',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.75rem',
        }}
      >
        Section 1: Faculty Information
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Faculty Name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label
            htmlFor="facultyName"
            style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: hasError('facultyName') ? '#b91c1c' : '#475569',
              display: 'block',
            }}
          >
            Faculty Member Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="facultyName"
            type="text"
            className="tt-form-input"
            style={{
              padding: '0.6rem 0.8rem',
              border: `1px solid ${hasError('facultyName') ? '#ef4444' : '#cbd5e1'}`,
              backgroundColor: hasError('facultyName') ? '#fef2f2' : '#ffffff',
              color: '#1e293b',
              borderRadius: '6px',
              fontSize: '0.95rem',
              outline: 'none',
            }}
            placeholder="e.g. Dr. Israr Ali"
            value={facultyInfo.facultyName || ''}
            onChange={(e) => onChange('facultyName', e.target.value)}
          />
          {hasError('facultyName') && (
            <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px' }}>
              {getErrorMessage('facultyName')}
            </span>
          )}
        </div>

        {/* Academic Designation */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label
            htmlFor="designation"
            style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569',
              display: 'block',
            }}
          >
            Academic Designation
          </label>
          <input
            id="designation"
            type="text"
            className="tt-form-input"
            style={{
              padding: '0.6rem 0.8rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderRadius: '6px',
              fontSize: '0.95rem',
              outline: 'none',
            }}
            placeholder="e.g. Assistant Professor, Lecturer"
            value={facultyInfo.designation || ''}
            onChange={(e) => onChange('designation', e.target.value)}
          />
        </div>

        {/* Department */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label
            htmlFor="department"
            style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569',
              display: 'block',
            }}
          >
            Department
          </label>
          <input
            id="department"
            type="text"
            className="tt-form-input"
            style={{
              padding: '0.6rem 0.8rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderRadius: '6px',
              fontSize: '0.95rem',
              outline: 'none',
            }}
            placeholder="e.g. Department of Computer Science"
            value={facultyInfo.department || 'Department of Computer Science'}
            onChange={(e) => onChange('department', e.target.value)}
          />
        </div>

        {/* Faculty / School Heading */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label
            htmlFor="facultySchool"
            style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569',
              display: 'block',
            }}
          >
            Faculty / School Heading
          </label>
          <input
            id="facultySchool"
            type="text"
            className="tt-form-input"
            style={{
              padding: '0.6rem 0.8rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderRadius: '6px',
              fontSize: '0.95rem',
              outline: 'none',
            }}
            placeholder="Faculty of Engineering Sciences and Technology"
            value={facultyInfo.facultySchool || 'Faculty of Engineering Sciences and Technology'}
            onChange={(e) => onChange('facultySchool', e.target.value)}
          />
        </div>

        {/* Academic Term */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label
            htmlFor="academicTerm"
            style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569',
              display: 'block',
            }}
          >
            Academic Term / Semester
          </label>
          <input
            id="academicTerm"
            type="text"
            className="tt-form-input"
            style={{
              padding: '0.6rem 0.8rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderRadius: '6px',
              fontSize: '0.95rem',
              outline: 'none',
            }}
            placeholder={activeSemesterName || 'e.g. Fall 2024'}
            value={facultyInfo.academicTerm || activeSemesterName || ''}
            onChange={(e) => onChange('academicTerm', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default FacultyInfoSection;

import React from 'react';

const CourseDetailsSection = ({ data, onChange }) => {
  const sectionHeaderStyle = {
    marginBottom: '1.5rem',
    color: '#1e293b',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0.75rem'
  };

  const labelStyle = {
    marginBottom: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#475569',
    display: 'block'
  };

  const inputStyle = {
    padding: '0.6rem 0.8rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem'
  };

  const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={sectionHeaderStyle}>Course Information</h3>
      
      <div style={gridStyle}>
        <div style={formGroupStyle}>
          <label style={labelStyle}>Teacher's Name</label>
          <input type="text" style={inputStyle} value={data.teacherName || ''} onChange={(e) => onChange('teacherName', e.target.value)} />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Department</label>
          <input type="text" style={inputStyle} value={data.department || ''} onChange={(e) => onChange('department', e.target.value)} />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Course Title</label>
          <input type="text" style={inputStyle} value={data.courseTitle || ''} onChange={(e) => onChange('courseTitle', e.target.value)} />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Course Code</label>
          <input type="text" style={inputStyle} value={data.courseCode || ''} onChange={(e) => onChange('courseCode', e.target.value)} />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Credit Hours</label>
          <input type="text" style={inputStyle} value={data.creditHours || ''} onChange={(e) => onChange('creditHours', e.target.value)} />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Semester</label>
          <input type="text" style={inputStyle} value={data.semester || ''} onChange={(e) => onChange('semester', e.target.value)} />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>No. of Students</label>
          <input type="number" style={inputStyle} value={data.noOfStudents || ''} onChange={(e) => onChange('noOfStudents', e.target.value)} />
        </div>
      </div>
    </div>
  );
};

export default CourseDetailsSection;

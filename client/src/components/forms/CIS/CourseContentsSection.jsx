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

const labelStyle = {
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#475569',
  display: 'block'
};

/**
 * CourseContentsSection — Course contents / syllabus topics textarea
 */
const CourseContentsSection = ({ value, onChange }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
      Course Contents
    </h3>
    <label style={labelStyle}>List the syllabus topics and course contents</label>
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter course contents / syllabus topics..."
      style={textareaStyle}
    />
  </div>
);

export default CourseContentsSection;

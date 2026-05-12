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
  width: '80px',
  boxSizing: 'border-box',
  textAlign: 'center'
};

const labelStyle = {
  fontSize: '0.85rem',
  fontWeight: '500',
  color: '#334155'
};

/**
 * GradingPolicySection — Assessment weightage breakdown and grading notes
 * Fields: quizzes, assignments, project, midterm, finalExam, instructorGradingPolicy
 */
const GradingPolicySection = ({ data, onChange }) => {
  const items = [
    { label: 'Quizzes', key: 'quizzes' },
    { label: 'Assignments', key: 'assignments' },
    { label: 'Project / Lab', key: 'project' },
    { label: 'Midterm Exam', key: 'midterm' },
    { label: 'Final Exam', key: 'finalExam' },
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        Grading Policy
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {items.map((item) => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={labelStyle}>{item.label}:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={data[item.key] || ''}
              onChange={(e) => onChange(item.key, e.target.value)}
              placeholder="%"
              style={inputStyle}
            />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GradingPolicySection;

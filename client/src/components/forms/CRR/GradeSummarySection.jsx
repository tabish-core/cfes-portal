import React from 'react';

const GradeSummarySection = ({ data, onChange }) => {
  const sectionHeaderStyle = {
    marginBottom: '1.5rem',
    color: '#1e293b',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0.75rem'
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
    boxSizing: 'border-box',
    textAlign: 'center'
  };

  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'F'];

  const handleGradeChange = (grade, value) => {
    onChange('gradeSummary', { ...data, [grade]: value });
  };

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={sectionHeaderStyle}>Grade Summary</h3>
      
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem', width: '150px', textAlign: 'left' }}>Grade</th>
              {grades.map(grade => (
                <th key={grade} style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>
                  {grade}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#1e293b', textAlign: 'left', verticalAlign: 'middle' }}>
                No. of Students
              </td>
              {grades.map(grade => (
                <td key={grade} style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                  <input type="number" style={inputStyle} value={data[grade] || ''} onChange={(e) => handleGradeChange(grade, e.target.value)} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Class Average</label>
        <input 
          type="text" 
          style={{ ...inputStyle, width: '200px', textAlign: 'left' }} 
          value={data.classAverage || ''}
          onChange={(e) => handleGradeChange('classAverage', e.target.value)}
          placeholder="e.g. 75.5 (C+)"
        />
      </div>
    </div>
  );
};

export default GradeSummarySection;

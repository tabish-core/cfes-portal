import React from 'react';

const GradeSummarySection = ({ data, onChange }) => {
  const inputStyle = {
    padding: '0.6rem 0.4rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '4px',
    fontSize: '0.85rem',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'center'
  };

  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'F'];

  const handleGradeChange = (grade, value) => {
    onChange('gradeSummary', { ...data, [grade]: value });
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      <h3 style={{
        backgroundColor: '#e2e8f0',
        padding: '0.75rem',
        border: '1px solid #cbd5e1',
        margin: '0 0 1rem 0',
        color: '#1e293b',
        fontSize: '1rem',
        fontWeight: '700'
      }}>
        C. GRADE SUMMARY
      </h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', width: '120px' }}>GRADE</th>
              {grades.map(grade => (
                <th key={grade} style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 'bold' }}>
                  {grade}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.6rem', border: '1px solid #cbd5e1', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: '600' }}>
                NO. OF<br/>STUDENTS
              </td>
              {grades.map(grade => (
                <td key={grade} style={{ padding: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <input type="number" style={inputStyle} value={data[grade] || ''} onChange={(e) => handleGradeChange(grade, e.target.value)} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontWeight: '600', color: '#334155' }}>
        <span style={{ marginRight: '1rem' }}>CLASS AVERAGE:</span>
        <input 
          type="text" 
          style={{
            border: 'none',
            borderBottom: '1px solid #94a3b8',
            width: '200px',
            textAlign: 'center',
            outline: 'none',
            fontSize: '0.95rem'
          }} 
          value={data.classAverage || ''}
          onChange={(e) => handleGradeChange('classAverage', e.target.value)}
          placeholder="e.g. 75.5 (C+)"
        />
      </div>
    </div>
  );
};

export default GradeSummarySection;

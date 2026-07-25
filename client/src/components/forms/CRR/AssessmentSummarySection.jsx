import React from 'react';

const AssessmentSummarySection = ({ data, onChange }) => {
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
    boxSizing: 'border-box'
  };

  const handleRowChange = (index, field, value) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange('assessmentSummary', newData);
  };

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={sectionHeaderStyle}>Assessment Summary</h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>CLO Number</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>CLO Attainment (%)</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>Mapped GAS</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>GAS Attainment (%)</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>Assessment Name</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#1e293b', verticalAlign: 'middle' }}>
                  {row.clo}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                  <input type="text" style={inputStyle} value={row.cloAttainment || ''} onChange={(e) => handleRowChange(index, 'cloAttainment', e.target.value)} />
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                  <input type="text" style={inputStyle} value={row.mappedGAs || ''} onChange={(e) => handleRowChange(index, 'mappedGAs', e.target.value)} />
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                  <input type="text" style={inputStyle} value={row.gaAttainment || ''} onChange={(e) => handleRowChange(index, 'gaAttainment', e.target.value)} />
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                  <input type="text" style={inputStyle} value={row.assessmentName || ''} onChange={(e) => handleRowChange(index, 'assessmentName', e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssessmentSummarySection;

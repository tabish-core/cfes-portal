import React from 'react';

const AssessmentSummarySection = ({ data, onChange }) => {
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

  const handleRowChange = (index, field, value) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange('assessmentSummary', newData);
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
        B. ASSESSMENT SUMMARY (ON COHORT LEVEL)
      </h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', width: '90px' }}>CLO Number</th>
              <th style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', width: '120px' }}>CLO Attainment (%)</th>
              <th style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', width: '120px' }}>Mapped GAS</th>
              <th style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', width: '120px' }}>GAS Attainment (%)</th>
              <th style={{ padding: '0.6rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>Assessment Name</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                <td style={{ padding: '0.4rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>
                  {row.clo}
                </td>
                <td style={{ padding: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <input type="text" style={inputStyle} value={row.cloAttainment || ''} onChange={(e) => handleRowChange(index, 'cloAttainment', e.target.value)} />
                </td>
                <td style={{ padding: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <input type="text" style={inputStyle} value={row.mappedGAs || ''} onChange={(e) => handleRowChange(index, 'mappedGAs', e.target.value)} />
                </td>
                <td style={{ padding: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <input type="text" style={inputStyle} value={row.gaAttainment || ''} onChange={(e) => handleRowChange(index, 'gaAttainment', e.target.value)} />
                </td>
                <td style={{ padding: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <input type="text" style={{...inputStyle, textAlign: 'left', paddingLeft: '0.8rem'}} value={row.assessmentName || ''} onChange={(e) => handleRowChange(index, 'assessmentName', e.target.value)} />
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

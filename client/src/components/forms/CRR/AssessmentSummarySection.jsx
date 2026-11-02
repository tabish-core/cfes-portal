import React from 'react';
import Icon from '../../common/Icon';

const AssessmentSummarySection = ({ data, onChange }) => {
  const handleRowChange = (index, field, value) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange('assessmentSummary', newData);
  };

  return (
    <section className="cfes-crr-card" aria-labelledby="crr-assessment-summary-heading">
      <div className="cfes-crr-card-header">
        <h2 id="crr-assessment-summary-heading" className="cfes-crr-card-title">
          <Icon name="check" size={18} />
          <span>Assessment Summary</span>
        </h2>
        <span className="cfes-crr-card-tag">CLO &amp; GA Attainments</span>
      </div>

      <div
        className="cfes-table-scroll-container"
        tabIndex={0}
        aria-label="Assessment summary attainment data table"
        style={{
          overflowX: 'auto',
          width: '100%',
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          border: '1px solid var(--cfes-slate-300)',
          borderRadius: 'var(--cfes-radius-lg)',
        }}
      >
        <table className="cfes-crr-table" style={{ minWidth: '650px' }}>
          <thead>
            <tr>
              <th style={{ width: '15%' }}>CLO Number</th>
              <th style={{ width: '20%' }}>CLO Attainment (%)</th>
              <th style={{ width: '20%' }}>Mapped GAS</th>
              <th style={{ width: '20%' }}>GAS Attainment (%)</th>
              <th style={{ width: '25%' }}>Assessment Name</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                <td style={{ fontWeight: 700, color: 'var(--cfes-slate-800)', whiteSpace: 'nowrap' }}>
                  {row.clo}
                </td>
                <td>
                  <input
                    type="text"
                    className="cfes-crr-table-input"
                    value={row.cloAttainment || ''}
                    onChange={(e) => handleRowChange(index, 'cloAttainment', e.target.value)}
                    placeholder="e.g. 78%"
                    aria-label={`CLO Attainment for ${row.clo || `row ${index + 1}`}`}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="cfes-crr-table-input"
                    value={row.mappedGAs || ''}
                    onChange={(e) => handleRowChange(index, 'mappedGAs', e.target.value)}
                    placeholder="e.g. GA1, GA2"
                    aria-label={`Mapped GAS for ${row.clo || `row ${index + 1}`}`}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="cfes-crr-table-input"
                    value={row.gaAttainment || ''}
                    onChange={(e) => handleRowChange(index, 'gaAttainment', e.target.value)}
                    placeholder="e.g. 72%"
                    aria-label={`GAS Attainment for ${row.clo || `row ${index + 1}`}`}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="cfes-crr-table-input"
                    value={row.assessmentName || ''}
                    onChange={(e) => handleRowChange(index, 'assessmentName', e.target.value)}
                    placeholder="e.g. Final Exam Q1"
                    aria-label={`Assessment Name for ${row.clo || `row ${index + 1}`}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AssessmentSummarySection;

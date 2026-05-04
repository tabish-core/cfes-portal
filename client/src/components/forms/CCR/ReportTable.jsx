import React from 'react';

const ACTIVITY_OPTIONS = ['Q', 'A', 'P', 'MT', 'FE'];

const ReportTable = ({ data, onChange, title, rowLabelPrefix, rowLabelField, showSpecialRows }) => {
  const cellStyle = {
    padding: '0.75rem 0.5rem',
    border: '1px solid #e2e8f0',
    color: '#334155',
    fontSize: '0.9rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '6px',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    outline: 'none',
    colorScheme: 'light',
    transition: 'border-color 0.2s ease'
  };

  const renderRow = (row, index) => (
    <tr key={`${rowLabelPrefix.toLowerCase()}-${row[rowLabelField]}`}>
      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>
        {rowLabelPrefix} {row[rowLabelField]}
      </td>
      <td style={cellStyle}>
        <input
          type="date"
          value={row.scheduleDate}
          onChange={(e) => onChange(index, 'scheduleDate', e.target.value)}
          style={inputStyle}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="time"
          value={row.timeIn}
          onChange={(e) => onChange(index, 'timeIn', e.target.value)}
          style={inputStyle}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="time"
          value={row.timeOut}
          onChange={(e) => onChange(index, 'timeOut', e.target.value)}
          style={inputStyle}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="text"
          value={row.topicCovered}
          onChange={(e) => onChange(index, 'topicCovered', e.target.value)}
          placeholder="Topics covered"
          style={inputStyle}
        />
      </td>
      <td style={cellStyle}>
        <select
          value={row.activityType}
          onChange={(e) => onChange(index, 'activityType', e.target.value)}
          style={inputStyle}
        >
          <option value="">Select</option>
          {ACTIVITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>
      <td style={cellStyle}>
        <input
          type="number"
          step="0.5"
          min="0"
          value={row.hoursCompleted}
          onChange={(e) => onChange(index, 'hoursCompleted', e.target.value)}
          placeholder="Hours"
          style={inputStyle}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="text"
          value={row.signature}
          onChange={(e) => onChange(index, 'signature', e.target.value)}
          placeholder="Signature"
          style={inputStyle}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="text"
          value={row.remarks}
          onChange={(e) => onChange(index, 'remarks', e.target.value)}
          placeholder="Remarks"
          style={inputStyle}
        />
      </td>
    </tr>
  );

  const renderSpecialRow = (label) => (
    <tr key={`special-${label}`} style={{ backgroundColor: '#f1f5f9' }}>
      <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', color: '#334155', padding: '1rem' }}>
        {label}
      </td>
    </tr>
  );

  return (
    <div className="report-table-section" style={{ marginTop: '3rem' }}>
      <h3 style={{
        marginBottom: '1.5rem',
        color: '#1e293b',
        fontSize: '1.2rem',
        fontWeight: '600',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '0.75rem'
      }}>
        {title}
      </h3>

      {showSpecialRows && (
        <div style={{
          marginBottom: '1rem',
          fontSize: '0.75rem',
          color: '#64748b',
          fontStyle: 'italic',
          fontWeight: '500'
        }}>
          Activity Type {'=>'} Q/A/P/MT/FE (Q=Quiz, A=Assignment, P=Project, MT=Midterm Exam, FE=Final Exam)
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '80px' }}>{rowLabelPrefix} No.</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '160px' }}>Schedule Date</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '110px' }}>Time In</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '110px' }}>Time Out</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', minWidth: '200px' }}>Topic Covered</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '150px' }}>Activity Type</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '150px' }}>Hours</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '150px' }}>Signature</th>
              <th style={{ ...cellStyle, fontWeight: '700', color: '#0f172a', width: '200px' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const elements = [renderRow(row, index)];

              if (showSpecialRows) {
                if (row[rowLabelField] === 7) {
                  elements.push(renderSpecialRow('Mid Term Exam'));
                }
                if (row[rowLabelField] === 15) {
                  elements.push(renderSpecialRow('Final Exams'));
                }
              }

              return elements;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportTable;

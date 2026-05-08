import React from 'react';

const cellStyle = {
  padding: '0.5rem',
  border: '1px solid #e2e8f0',
  color: '#334155',
  fontSize: '0.85rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.4rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '4px',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  outline: 'none',
  colorScheme: 'light'
};

const thStyle = {
  ...cellStyle,
  fontWeight: '700',
  color: '#0f172a',
  backgroundColor: '#f1f5f9',
  whiteSpace: 'nowrap'
};

const btnStyle = {
  padding: '0.4rem 0.9rem',
  border: 'none',
  borderRadius: '5px',
  fontSize: '0.8rem',
  fontWeight: '600',
  cursor: 'pointer'
};

const EMPTY_ROW = {
  week: '',
  lectureNo: '',
  topicCovered: '',
  clo: '',
  assessmentTool: ''
};

/**
 * WeeklyPlanTable — Weekly teaching plan
 * Supports dynamic add/remove rows.
 *
 * Props:
 *   data        — array of row objects
 *   onChange     — (index, field, value) => void
 *   onAddRow    — () => void
 *   onRemoveRow — (index) => void
 */
const WeeklyPlanTable = ({ data, onChange, onAddRow, onRemoveRow }) => (
  <div style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
        Weekly Teaching Plan
      </h3>
      <button
        type="button"
        onClick={onAddRow}
        style={{ ...btnStyle, backgroundColor: '#3949ab', color: '#fff' }}
      >
        + Add Row
      </button>
    </div>

    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '80px' }}>Week</th>
            <th style={{ ...thStyle, width: '100px' }}>Lecture No</th>
            <th style={{ ...thStyle, minWidth: '280px' }}>Topic Covered</th>
            <th style={{ ...thStyle, width: '120px' }}>CLO</th>
            <th style={{ ...thStyle, width: '180px' }}>Assessment Tool</th>
            <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.week}
                  onChange={(e) => onChange(index, 'week', e.target.value)}
                  placeholder={`${index + 1}`}
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.lectureNo}
                  onChange={(e) => onChange(index, 'lectureNo', e.target.value)}
                  placeholder="L1, L2..."
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.topicCovered}
                  onChange={(e) => onChange(index, 'topicCovered', e.target.value)}
                  placeholder="Enter topic covered"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.clo}
                  onChange={(e) => onChange(index, 'clo', e.target.value)}
                  placeholder="CLO-1"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.assessmentTool}
                  onChange={(e) => onChange(index, 'assessmentTool', e.target.value)}
                  placeholder="Quiz, Assignment..."
                  style={inputStyle}
                />
              </td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                {data.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveRow(index)}
                    title="Remove row"
                    style={{
                      ...btnStyle,
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export { EMPTY_ROW };
export default WeeklyPlanTable;

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

const CATEGORY_OPTIONS = [
  'Quiz',
  'Assignment',
  'Midterm',
  'Final Exam',
  'Project',
  'Lab',
  'Presentation',
  'Class Participation',
  'Other'
];

const EMPTY_ROW = {
  category: '',
  assessmentTool: '',
  cloMapped: '',
  cloMarks: '',
  weightPercentage: '',
  totalMarks: '',
  assessmentDate: ''
};

/**
 * OBATable — Outcome-Based Assessment table
 * Supports dynamic add/remove rows.
 *
 * Props:
 *   data        — array of row objects
 *   onChange     — (index, field, value) => void
 *   onAddRow    — () => void
 *   onRemoveRow — (index) => void
 */
const OBATable = ({ data, onChange, onAddRow, onRemoveRow }) => (
  <div style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
        Outcome-Based Assessment (OBA)
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
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '150px' }}>Category</th>
            <th style={{ ...thStyle, minWidth: '180px' }}>Assessment Tool</th>
            <th style={{ ...thStyle, width: '120px' }}>CLO Mapped</th>
            <th style={{ ...thStyle, width: '100px' }}>CLO Marks</th>
            <th style={{ ...thStyle, width: '100px' }}>Weight %</th>
            <th style={{ ...thStyle, width: '110px' }}>Total Marks</th>
            <th style={{ ...thStyle, width: '140px' }}>Assessment Date</th>
            <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td style={cellStyle}>
                <select
                  value={row.category}
                  onChange={(e) => onChange(index, 'category', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.assessmentTool}
                  onChange={(e) => onChange(index, 'assessmentTool', e.target.value)}
                  placeholder="e.g., Quiz 1, Assignment 2"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.cloMapped}
                  onChange={(e) => onChange(index, 'cloMapped', e.target.value)}
                  placeholder="CLO-1, CLO-2"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="number"
                  min="0"
                  value={row.cloMarks}
                  onChange={(e) => onChange(index, 'cloMarks', e.target.value)}
                  placeholder="Marks"
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={row.weightPercentage}
                  onChange={(e) => onChange(index, 'weightPercentage', e.target.value)}
                  placeholder="%"
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="number"
                  min="0"
                  value={row.totalMarks}
                  onChange={(e) => onChange(index, 'totalMarks', e.target.value)}
                  placeholder="Total"
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="date"
                  value={row.assessmentDate}
                  onChange={(e) => onChange(index, 'assessmentDate', e.target.value)}
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
export default OBATable;

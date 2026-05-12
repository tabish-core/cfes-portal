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
  cloNumber: '',
  cloStatement: '',
  btLevel: '',
  gaMapping: '',
  acmKaMapping: '',
  sgdMapping: '',
  weightPercentage: ''
};

/**
 * CLOTable — Course Learning Outcomes mapping table
 * Supports dynamic add/remove rows.
 *
 * Props:
 *   data     — array of row objects
 *   onChange — (index, field, value) => void
 *   onAddRow — () => void
 *   onRemoveRow — (index) => void
 */
const CLOTable = ({ data, onChange, onAddRow, onRemoveRow }) => (
  <div style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
        Course Learning Outcomes (CLOs)
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
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '80px' }}>CLO #</th>
            <th style={{ ...thStyle, minWidth: '220px' }}>CLO Statement</th>
            <th style={{ ...thStyle, width: '90px' }}>BT Level</th>
            <th style={{ ...thStyle, width: '110px' }}>GA Mapping</th>
            <th style={{ ...thStyle, width: '120px' }}>ACM KA Mapping</th>
            <th style={{ ...thStyle, width: '110px' }}>SGD Mapping</th>
            <th style={{ ...thStyle, width: '100px' }}>Weight %</th>
            <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.cloNumber}
                  onChange={(e) => onChange(index, 'cloNumber', e.target.value)}
                  placeholder={`CLO-${index + 1}`}
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.cloStatement}
                  onChange={(e) => onChange(index, 'cloStatement', e.target.value)}
                  placeholder="Enter CLO statement"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.btLevel}
                  onChange={(e) => onChange(index, 'btLevel', e.target.value)}
                  placeholder="C1, C2..."
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.gaMapping}
                  onChange={(e) => onChange(index, 'gaMapping', e.target.value)}
                  placeholder="GA"
                  style={inputStyle}
                />
              </td>
              
              {/* MERGED ACM KA COLUMN */}
              {index === 0 && (
                <td style={cellStyle} rowSpan={data.length}>
                  <textarea
                    value={row.acmKaMapping}
                    onChange={(e) => {
                      // Update all rows to keep them in sync
                      for(let i=0; i<data.length; i++) {
                        onChange(i, 'acmKaMapping', e.target.value);
                      }
                    }}
                    placeholder="ACM KA"
                    style={{ ...inputStyle, height: '100px', resize: 'vertical' }}
                  />
                </td>
              )}

              {/* MERGED SGD COLUMN */}
              {index === 0 && (
                <td style={cellStyle} rowSpan={data.length}>
                  <textarea
                    value={row.sgdMapping}
                    onChange={(e) => {
                      // Update all rows to keep them in sync
                      for(let i=0; i<data.length; i++) {
                        onChange(i, 'sgdMapping', e.target.value);
                      }
                    }}
                    placeholder="SGD"
                    style={{ ...inputStyle, height: '100px', resize: 'vertical' }}
                  />
                </td>
              )}

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
export default CLOTable;

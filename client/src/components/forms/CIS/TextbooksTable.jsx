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
  serialNo: '',
  bookTitle: '',
  authors: '',
  editionPublicationPublisher: ''
};

/**
 * TextbooksTable — Textbooks and reference materials
 * Supports dynamic add/remove rows.
 *
 * Props:
 *   data        — array of row objects
 *   onChange     — (index, field, value) => void
 *   onAddRow    — () => void
 *   onRemoveRow — (index) => void
 */
const TextbooksTable = ({ data, onChange, onAddRow, onRemoveRow }) => (
  <div style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
        Textbooks &amp; References
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
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '70px' }}>S.No</th>
            <th style={{ ...thStyle, minWidth: '250px' }}>Book Title</th>
            <th style={{ ...thStyle, width: '200px' }}>Authors</th>
            <th style={{ ...thStyle, minWidth: '220px' }}>Edition / Publication / Publisher</th>
            <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: '600' }}>
                <input
                  type="text"
                  value={row.serialNo}
                  onChange={(e) => onChange(index, 'serialNo', e.target.value)}
                  placeholder={`${index + 1}`}
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.bookTitle}
                  onChange={(e) => onChange(index, 'bookTitle', e.target.value)}
                  placeholder="Enter book title"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.authors}
                  onChange={(e) => onChange(index, 'authors', e.target.value)}
                  placeholder="Author name(s)"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={row.editionPublicationPublisher}
                  onChange={(e) => onChange(index, 'editionPublicationPublisher', e.target.value)}
                  placeholder="e.g., 3rd Ed, Pearson, 2020"
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
export default TextbooksTable;

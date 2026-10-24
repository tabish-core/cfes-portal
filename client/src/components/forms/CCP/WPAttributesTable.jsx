import React from 'react';

const cellStyle = {
  padding: '0.65rem 0.75rem',
  border: '1px solid #e2e8f0',
  color: '#334155',
  fontSize: '0.88rem',
  verticalAlign: 'top',
};

const thStyle = {
  ...cellStyle,
  fontWeight: '700',
  color: '#0f172a',
  backgroundColor: '#f1f5f9',
};

const textareaStyle = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '4px',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  outline: 'none',
  colorScheme: 'light',
  minHeight: '65px',
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: '1.5',
};

/**
 * WPAttributesTable — Table for Washington Accord / Computing Accord
 * Complex Problem Solving Attributes (WP1 through WP8) and justifications.
 */
const WPAttributesTable = ({ attributes = [], onChange }) => {
  const handleFieldChange = (index, field, value) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '1rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.5rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          CCP / CEP Attributes Mapped (WP1 – WP8)
        </h3>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Check &ldquo;Mapped&rdquo; for applicable attributes and provide course-specific justification
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '65px', textAlign: 'center' }}>WP</th>
              <th style={{ ...thStyle, width: '38%' }}>Attributes of Complex Problem Solving</th>
              <th style={{ ...thStyle, width: '85px', textAlign: 'center' }}>Mapped</th>
              <th style={thStyle}>Justification</th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr, index) => {
              const isChecked = Boolean(attr.isMapped);
              return (
                <tr
                  key={attr.code || index}
                  style={{
                    backgroundColor: isChecked ? '#f8fafc' : '#ffffff',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: '700',
                      color: isChecked ? '#3949ab' : '#64748b',
                    }}
                  >
                    {attr.code}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.2rem' }}>
                      {attr.title}
                    </div>
                    {attr.description && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4' }}>
                        {attr.description}
                      </div>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', cursor: 'pointer', padding: '0.25rem' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleFieldChange(index, 'isMapped', e.target.checked)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#3949ab',
                          cursor: 'pointer',
                        }}
                      />
                    </label>
                  </td>
                  <td style={cellStyle}>
                    <textarea
                      value={attr.justification || ''}
                      onChange={(e) => handleFieldChange(index, 'justification', e.target.value)}
                      placeholder={
                        isChecked
                          ? 'Explain how this project addresses this complex problem attribute...'
                          : 'Enter justification (or NA if not mapped)...'
                      }
                      style={{
                        ...textareaStyle,
                        border: isChecked ? '1px solid #94a3b8' : '1px solid #cbd5e1',
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WPAttributesTable;

import React from 'react';
import Icon from '../../common/Icon';

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
    <section className="cfes-ccp-card" aria-labelledby="ccp-wp-attributes-heading">
      <div className="cfes-ccp-card-header">
        <h2 id="ccp-wp-attributes-heading" className="cfes-ccp-card-title">
          <Icon name="document" size={18} />
          <span>Section E: CCP / CEP Attributes Mapped (WP1 – WP8)</span>
        </h2>
        <span className="cfes-ccp-card-tag">Washington Accord / NCEAC</span>
      </div>

      <p style={{ margin: '0 0 var(--cfes-space-4) 0', fontSize: 'var(--cfes-font-sm)', color: 'var(--cfes-slate-600)' }}>
        Check &ldquo;Mapped&rdquo; for applicable complex problem-solving attributes and provide a course-specific justification.
      </p>

      <div
        className="cfes-table-scroll-container"
        tabIndex={0}
        aria-label="Washington Accord WP1 through WP8 complex problem solving attributes table"
        style={{
          overflowX: 'auto',
          width: '100%',
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          border: '1px solid var(--cfes-slate-300)',
          borderRadius: 'var(--cfes-radius-lg)',
        }}
      >
        <table className="cfes-ccp-wp-table" style={{ minWidth: '660px' }}>
          <thead>
            <tr>
              <th style={{ width: '70px', textAlign: 'center', whiteSpace: 'nowrap' }}>WP</th>
              <th style={{ width: '40%', minWidth: '240px' }}>Attributes of Complex Problem Solving</th>
              <th style={{ width: '90px', textAlign: 'center', whiteSpace: 'nowrap' }}>Mapped</th>
              <th style={{ minWidth: '260px' }}>Course Justification</th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr, index) => {
              const isChecked = Boolean(attr.isMapped);
              return (
                <tr
                  key={attr.code || index}
                  style={{
                    backgroundColor: isChecked ? 'var(--cfes-slate-50)' : 'var(--cfes-white)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`cfes-ccp-wp-code-badge ${
                        isChecked ? 'cfes-ccp-wp-code-badge--active' : ''
                      }`}
                    >
                      {attr.code}
                    </span>
                  </td>
                  <td>
                    <div className="cfes-ccp-wp-title">{attr.title}</div>
                    {attr.description && (
                      <div className="cfes-ccp-wp-desc">{attr.description}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <label style={{ display: 'inline-flex', cursor: 'pointer', padding: '0.25rem' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleFieldChange(index, 'isMapped', e.target.checked)}
                        className="cfes-ccp-checkbox"
                        aria-label={`Map ${attr.code}: ${attr.title}`}
                      />
                    </label>
                  </td>
                  <td>
                    <textarea
                      value={attr.justification || ''}
                      onChange={(e) => handleFieldChange(index, 'justification', e.target.value)}
                      placeholder={
                        isChecked
                          ? 'Explain how this project addresses this complex problem attribute...'
                          : 'Enter justification (or NA if not mapped)...'
                      }
                      className={`cfes-ccp-wp-textarea ${isChecked ? 'cfes-ccp-wp-textarea--active' : ''}`}
                      aria-label={`Justification for ${attr.code}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default WPAttributesTable;

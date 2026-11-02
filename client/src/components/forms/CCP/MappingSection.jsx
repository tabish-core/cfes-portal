import React from 'react';
import Icon from '../../common/Icon';

/**
 * MappingSection — CLO, SDG, Knowledge Profile, and Complex Problem Solving mapping table
 */
const MappingSection = ({ data, onChange }) => {
  const fields = [
    {
      label: 'Mapped CLO',
      key: 'mappedClo',
      placeholder: 'e.g., CLO3',
      help: 'Course Learning Outcome assessed by this project',
    },
    {
      label: 'Sustainable Development Goals (SDG)',
      key: 'sdg',
      placeholder: 'e.g., 4 & 9',
      help: 'Targeted UN Sustainable Development Goal(s)',
    },
    {
      label: 'Knowledge Profile (only for PEC)',
      key: 'knowledgeProfile',
      placeholder: 'e.g., WK3 (Engineering Fundamentals), WK5 (Engineering Design)',
      help: 'Relevant Washington Accord / PEC knowledge profile (WK1–WK8)',
    },
    {
      label: 'Complex Problem Solving Mapped',
      key: 'complexProblemSolvingMapped',
      placeholder: 'e.g., WP1 (Conflicting Requirements), WP2, WP3',
      help: 'Complex problem attributes mapped for this project',
    },
  ];

  return (
    <section className="cfes-ccp-card" aria-labelledby="ccp-mapping-heading">
      <div className="cfes-ccp-card-header">
        <h2 id="ccp-mapping-heading" className="cfes-ccp-card-title">
          <Icon name="book" size={18} />
          <span>Section B: CLO &amp; Attribute Mapping</span>
        </h2>
        <span className="cfes-ccp-card-tag">Accreditation Profiles</span>
      </div>

      <div className="cfes-ccp-grid-mapping">
        {fields.map((field) => {
          const inputId = `ccp-map-${field.key}`;
          return (
            <div key={field.key} className="cfes-ccp-form-group">
              <label htmlFor={inputId} className="cfes-ccp-label">
                {field.label}
              </label>
              <input
                id={inputId}
                type="text"
                value={data[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="cfes-ccp-input"
              />
              {field.help && (
                <span className="cfes-ccp-help-text">
                  {field.help}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MappingSection;

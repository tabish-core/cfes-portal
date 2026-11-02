import React from 'react';
import Icon from '../../common/Icon';

/**
 * ProblemStatementSection — Narrative sections for CCP/CEP problem statement,
 * constraints/assumptions, modern tool usage, and expected outcomes.
 */
const ProblemStatementSection = ({
  problemStatement,
  constraintsAssumptions,
  computationalTools,
  expectedOutcomes,
  onChange,
  validationErrors = [],
}) => {
  const hasError = (field) => validationErrors.some((e) => e.field === field);
  const getError = (field) => validationErrors.find((e) => e.field === field)?.message;

  const sections = [
    {
      key: 'problemStatement',
      label: 'Problem Statement',
      value: problemStatement,
      placeholder:
        'CEP/CCP shall be properly defined. Enter comprehensive problem statement or project description...',
      required: true,
      minHeight: '110px',
    },
    {
      key: 'constraintsAssumptions',
      label: 'Constraints & Assumptions',
      value: constraintsAssumptions,
      placeholder:
        'Specify design constraints, hardware/software limitations, environmental/safety factors, and operational assumptions...',
      minHeight: '85px',
    },
    {
      key: 'computationalTools',
      label: 'Identification of areas where use of computational / modern tool is required',
      value: computationalTools,
      placeholder:
        'Specify required simulators, computational toolsets, IDEs, hardware-software co-design tools (e.g. ModelSim, Vivado, MATLAB, Docker)...',
      minHeight: '85px',
    },
    {
      key: 'expectedOutcomes',
      label: 'Expected Outcomes',
      value: expectedOutcomes,
      placeholder:
        'List expected concrete outcomes, functional deliverables, test bench results, or prototype performance criteria...',
      minHeight: '85px',
    },
  ];

  return (
    <section className="cfes-ccp-card" aria-labelledby="ccp-problem-specs-heading">
      <div className="cfes-ccp-card-header">
        <h2 id="ccp-problem-specs-heading" className="cfes-ccp-card-title">
          <Icon name="document" size={18} />
          <span>Section C: Problem Statement &amp; Specifications</span>
        </h2>
        <span className="cfes-ccp-card-tag">Technical Requirements</span>
      </div>

      <div className="cfes-ccp-narrative-group">
        {sections.map((sec) => {
          const isInvalid = hasError(sec.key);
          const textareaId = `ccp-narrative-${sec.key}`;
          return (
            <div key={sec.key} className="cfes-ccp-form-group">
              <label
                htmlFor={textareaId}
                className={`cfes-ccp-label ${isInvalid ? 'cfes-ccp-label--error' : ''}`}
              >
                {sec.label}
                {sec.required && <span className="cfes-ccp-required">*</span>}
              </label>
              <textarea
                id={textareaId}
                value={sec.value || ''}
                onChange={(e) => onChange(sec.key, e.target.value)}
                placeholder={sec.placeholder}
                className={`cfes-ccp-textarea ${isInvalid ? 'cfes-ccp-textarea--error' : ''}`}
                style={{ minHeight: sec.minHeight || '90px' }}
                aria-required={sec.required}
                aria-invalid={isInvalid}
              />
              {isInvalid && (
                <span className="cfes-ccp-error-text" role="alert">
                  {getError(sec.key)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProblemStatementSection;

import React from 'react';

const textareaStyle = {
  width: '100%',
  padding: '0.8rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '6px',
  fontSize: '0.9rem',
  outline: 'none',
  colorScheme: 'light',
  boxSizing: 'border-box',
  minHeight: '90px',
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: '1.6',
};

const textareaErrorStyle = {
  ...textareaStyle,
  border: '1px solid #ef4444',
  backgroundColor: '#fef2f2',
};

const labelStyle = {
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#475569',
  display: 'block',
};

const labelErrorStyle = {
  ...labelStyle,
  color: '#b91c1c',
};

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
    <div style={{ marginBottom: '2rem' }}>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '1rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.5rem',
        }}
      >
        Problem Statement &amp; Specifications
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {sections.map((sec) => {
          const isInvalid = hasError(sec.key);
          return (
            <div key={sec.key}>
              <label style={isInvalid ? labelErrorStyle : labelStyle}>
                {sec.label}
                {sec.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
              </label>
              <textarea
                value={sec.value || ''}
                onChange={(e) => onChange(sec.key, e.target.value)}
                placeholder={sec.placeholder}
                style={{
                  ...(isInvalid ? textareaErrorStyle : textareaStyle),
                  minHeight: sec.minHeight || '90px',
                }}
              />
              {isInvalid && (
                <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem', display: 'block' }}>
                  {getError(sec.key)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProblemStatementSection;

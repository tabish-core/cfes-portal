import React from 'react';

const CourseLearningOutcomesSection = ({ data, onChange }) => {
  const sectionHeaderStyle = {
    marginBottom: '1.5rem',
    color: '#1e293b',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0.75rem'
  };

  const textareaStyle = {
    width: '100%',
    padding: '0.6rem 0.8rem',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
    lineHeight: '1.5',
    marginTop: '0.5rem',
    transition: 'border-color 0.2s'
  };

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '2rem'
  };

  const questionTitleStyle = {
    color: '#334155',
    fontSize: '0.95rem',
    fontWeight: '600',
    marginBottom: '0.5rem'
  };

  const radioContainerStyle = { 
    display: 'flex', 
    gap: '1.5rem',
    marginTop: '0.25rem' 
  };

  const radioLabelStyle = { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.5rem', 
    cursor: 'pointer',
    color: '#1e293b',
    fontSize: '0.95rem'
  };

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={sectionHeaderStyle}>Course Learning Outcomes</h3>
      
      <div>
        
        {/* Question 1 */}
        <div style={labelStyle}>
          <div style={questionTitleStyle}>1. Were the Course Learning Outcomes adequate?</div>
          <div style={radioContainerStyle}>
            <label style={radioLabelStyle}>
              <input 
                type="radio" 
                name="outcomesAdequate"
                checked={data.outcomesAdequate === 'Yes'} 
                onChange={() => onChange('learningOutcomes', { ...data, outcomesAdequate: 'Yes' })}
                style={{ width: '16px', height: '16px', accentColor: '#3949ab' }}
              />
              Yes
            </label>
            <label style={radioLabelStyle}>
              <input 
                type="radio" 
                name="outcomesAdequate"
                checked={data.outcomesAdequate === 'No'} 
                onChange={() => onChange('learningOutcomes', { ...data, outcomesAdequate: 'No' })}
                style={{ width: '16px', height: '16px', accentColor: '#3949ab' }}
              />
              No
            </label>
          </div>
          
          {data.outcomesAdequate === 'No' && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Suggest Revision:</div>
              <textarea 
                style={textareaStyle} 
                value={data.revisionSuggestion || ''} 
                onChange={(e) => onChange('learningOutcomes', { ...data, revisionSuggestion: e.target.value })}
                placeholder="Enter possible revisions here..."
              />
            </div>
          )}
        </div>

        {/* Question 2 */}
        <div style={labelStyle}>
          <div style={questionTitleStyle}>2. Comment on CLO Attainment</div>
          <div style={radioContainerStyle}>
            <label style={radioLabelStyle}>
              <input 
                type="radio" 
                name="cloAttainmentStatus"
                checked={data.cloAttainmentStatus === 'Satisfied'} 
                onChange={() => onChange('learningOutcomes', { ...data, cloAttainmentStatus: 'Satisfied' })}
                style={{ width: '16px', height: '16px', accentColor: '#3949ab' }}
              />
              Satisfied
            </label>
            <label style={radioLabelStyle}>
              <input 
                type="radio" 
                name="cloAttainmentStatus"
                checked={data.cloAttainmentStatus === 'Not Satisfied'} 
                onChange={() => onChange('learningOutcomes', { ...data, cloAttainmentStatus: 'Not Satisfied' })}
                style={{ width: '16px', height: '16px', accentColor: '#3949ab' }}
              />
              Not Satisfied
            </label>
          </div>

          {data.cloAttainmentStatus === 'Not Satisfied' && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Possible Reasons:</div>
              <textarea 
                style={textareaStyle} 
                value={data.cloAttainmentReason || ''} 
                onChange={(e) => onChange('learningOutcomes', { ...data, cloAttainmentReason: e.target.value })}
                placeholder="Enter possible reasons here..."
              />
            </div>
          )}
        </div>

        {/* Question 3 */}
        <div style={labelStyle}>
          <div style={questionTitleStyle}>3. Comment on PLO Attainment</div>
          <div style={radioContainerStyle}>
            <label style={radioLabelStyle}>
              <input 
                type="radio" 
                name="ploAttainmentStatus"
                checked={data.ploAttainmentStatus === 'Satisfied'} 
                onChange={() => onChange('learningOutcomes', { ...data, ploAttainmentStatus: 'Satisfied' })}
                style={{ width: '16px', height: '16px', accentColor: '#3949ab' }}
              />
              Satisfied
            </label>
            <label style={radioLabelStyle}>
              <input 
                type="radio" 
                name="ploAttainmentStatus"
                checked={data.ploAttainmentStatus === 'Not Satisfied'} 
                onChange={() => onChange('learningOutcomes', { ...data, ploAttainmentStatus: 'Not Satisfied' })}
                style={{ width: '16px', height: '16px', accentColor: '#3949ab' }}
              />
              Not Satisfied
            </label>
          </div>

          {data.ploAttainmentStatus === 'Not Satisfied' && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Possible Reasons:</div>
              <textarea 
                style={textareaStyle} 
                value={data.ploAttainmentReason || ''} 
                onChange={(e) => onChange('learningOutcomes', { ...data, ploAttainmentReason: e.target.value })}
                placeholder="Enter possible reasons here..."
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CourseLearningOutcomesSection;

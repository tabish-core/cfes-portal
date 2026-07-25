import React from 'react';

const CourseLearningOutcomesSection = ({ data, onChange }) => {
  const textareaStyle = {
    width: '100%',
    padding: '0.6rem 0.8rem',
    border: 'none',
    borderBottom: '1px solid #94a3b8',
    backgroundColor: 'transparent',
    color: '#1e293b',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'vertical',
    minHeight: '60px',
    lineHeight: '1.5',
    marginTop: '0.5rem'
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    color: '#334155',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  const numberStyle = {
    minWidth: '24px',
    fontWeight: 'bold'
  };

  const radioContainerStyle = { 
    display: 'flex', 
    gap: '1.5rem',
    marginTop: '0.5rem' 
  };

  const radioLabelStyle = { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.5rem', 
    cursor: 'pointer' 
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      <h3 style={{
        backgroundColor: '#e2e8f0',
        padding: '0.75rem',
        border: '1px solid #cbd5e1',
        margin: '0 0 1.5rem 0',
        color: '#1e293b',
        fontSize: '1rem',
        fontWeight: '700'
      }}>
        D. COURSE LEARNING OUTCOMES
      </h3>
      
      <div style={{ paddingLeft: '1rem' }}>
        
        {/* Question 1 */}
        <div style={labelStyle}>
          <span style={numberStyle}>1.</span>
          <div style={{ width: '100%' }}>
            <div>WERE THE COURSE LEARNING OUTCOMES ADEQUATE?</div>
            <div style={radioContainerStyle}>
              <label style={radioLabelStyle}>
                <input 
                  type="radio" 
                  name="outcomesAdequate"
                  checked={data.outcomesAdequate === 'Yes'} 
                  onChange={() => onChange('learningOutcomes', { ...data, outcomesAdequate: 'Yes' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Yes
              </label>
              <label style={radioLabelStyle}>
                <input 
                  type="radio" 
                  name="outcomesAdequate"
                  checked={data.outcomesAdequate === 'No'} 
                  onChange={() => onChange('learningOutcomes', { ...data, outcomesAdequate: 'No' })}
                  style={{ width: '16px', height: '16px' }}
                />
                No
              </label>
            </div>
            
            {data.outcomesAdequate === 'No' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>SUGGEST REVISION:</div>
                <textarea 
                  style={textareaStyle} 
                  value={data.revisionSuggestion || ''} 
                  onChange={(e) => onChange('learningOutcomes', { ...data, revisionSuggestion: e.target.value })}
                  placeholder="Enter possible revisions here..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Question 2 */}
        <div style={labelStyle}>
          <span style={numberStyle}>2.</span>
          <div style={{ width: '100%' }}>
            <div>COMMENT ON CLO ATTAINMENT</div>
            <div style={radioContainerStyle}>
              <label style={radioLabelStyle}>
                <input 
                  type="radio" 
                  name="cloAttainmentStatus"
                  checked={data.cloAttainmentStatus === 'Satisfied'} 
                  onChange={() => onChange('learningOutcomes', { ...data, cloAttainmentStatus: 'Satisfied' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Satisfied
              </label>
              <label style={radioLabelStyle}>
                <input 
                  type="radio" 
                  name="cloAttainmentStatus"
                  checked={data.cloAttainmentStatus === 'Not Satisfied'} 
                  onChange={() => onChange('learningOutcomes', { ...data, cloAttainmentStatus: 'Not Satisfied' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Not Satisfied
              </label>
            </div>

            {data.cloAttainmentStatus === 'Not Satisfied' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>POSSIBLE REASONS:</div>
                <textarea 
                  style={textareaStyle} 
                  value={data.cloAttainmentReason || ''} 
                  onChange={(e) => onChange('learningOutcomes', { ...data, cloAttainmentReason: e.target.value })}
                  placeholder="Enter possible reasons here..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Question 3 */}
        <div style={labelStyle}>
          <span style={numberStyle}>3.</span>
          <div style={{ width: '100%' }}>
            <div>COMMENT ON PLO ATTAINMENT</div>
            <div style={radioContainerStyle}>
              <label style={radioLabelStyle}>
                <input 
                  type="radio" 
                  name="ploAttainmentStatus"
                  checked={data.ploAttainmentStatus === 'Satisfied'} 
                  onChange={() => onChange('learningOutcomes', { ...data, ploAttainmentStatus: 'Satisfied' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Satisfied
              </label>
              <label style={radioLabelStyle}>
                <input 
                  type="radio" 
                  name="ploAttainmentStatus"
                  checked={data.ploAttainmentStatus === 'Not Satisfied'} 
                  onChange={() => onChange('learningOutcomes', { ...data, ploAttainmentStatus: 'Not Satisfied' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Not Satisfied
              </label>
            </div>

            {data.ploAttainmentStatus === 'Not Satisfied' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>POSSIBLE REASONS:</div>
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
    </div>
  );
};

export default CourseLearningOutcomesSection;

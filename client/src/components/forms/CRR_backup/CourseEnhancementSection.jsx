import React from 'react';

const CourseEnhancementSection = ({ data, onChange }) => {
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
    minHeight: '80px',
    lineHeight: '1.5',
    marginTop: '0.5rem'
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    color: '#334155',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  const numberStyle = {
    minWidth: '24px',
    fontWeight: 'bold',
    marginTop: '0.1rem'
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
        fontWeight: '700',
        textTransform: 'uppercase'
      }}>
        E. Course Enhancement/Improvement
      </h3>
      
      <div style={{ paddingLeft: '1rem' }}>
        
        <div style={labelStyle}>
          <span style={numberStyle}>1.</span>
          <div style={{ width: '100%' }}>
            <div style={{ lineHeight: '1.4', textTransform: 'uppercase' }}>
              COURSE ENHANCEMENT / IMPROVEMENT
            </div>
            <textarea 
              style={textareaStyle} 
              value={data.courseEnhancementComment || ''} 
              onChange={(e) => onChange('courseEnhancement', { ...data, courseEnhancementComment: e.target.value })}
              placeholder="Enter details..."
            />
          </div>
        </div>

        <div style={labelStyle}>
          <span style={numberStyle}>2.</span>
          <div style={{ width: '100%' }}>
            <div style={{ lineHeight: '1.4', textTransform: 'uppercase' }}>
              IMPLEMENTATION OF CHANGES PROPOSED IN EARLIER COURSE REVIEW REPORTS
            </div>
            <textarea 
              style={textareaStyle} 
              value={data.implementationComments || ''} 
              onChange={(e) => onChange('courseEnhancement', { ...data, implementationComments: e.target.value })}
              placeholder="Enter details..."
            />
          </div>
        </div>

        <div style={labelStyle}>
          <span style={numberStyle}>3.</span>
          <div style={{ width: '100%' }}>
            <div style={{ lineHeight: '1.4', textTransform: 'uppercase' }}>
              CONTINUING APPROPRIATENESS OF THE COURSE CURRICULUM
            </div>
            <textarea 
              style={textareaStyle} 
              value={data.appropriatenessComments || ''} 
              onChange={(e) => onChange('courseEnhancement', { ...data, appropriatenessComments: e.target.value })}
              placeholder="Enter details..."
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default CourseEnhancementSection;

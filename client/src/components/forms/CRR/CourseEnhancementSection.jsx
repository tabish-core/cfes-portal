import React from 'react';

const CourseEnhancementSection = ({ data, onChange }) => {
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

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={sectionHeaderStyle}>Course Enhancement</h3>
      
      <div>
        
        <div style={labelStyle}>
          <div style={questionTitleStyle}>
            1. Course Enhancement / Improvement
          </div>
          <textarea 
            style={textareaStyle} 
            value={data.courseEnhancementComment || ''} 
            onChange={(e) => onChange('courseEnhancement', { ...data, courseEnhancementComment: e.target.value })}
            placeholder="Enter details..."
          />
        </div>

        <div style={labelStyle}>
          <div style={questionTitleStyle}>
            2. Implementation of changes proposed in earlier Course Review Reports
          </div>
          <textarea 
            style={textareaStyle} 
            value={data.implementationComments || ''} 
            onChange={(e) => onChange('courseEnhancement', { ...data, implementationComments: e.target.value })}
            placeholder="Enter details..."
          />
        </div>

        <div style={labelStyle}>
          <div style={questionTitleStyle}>
            3. Continuing appropriateness of the Course Curriculum
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
  );
};

export default CourseEnhancementSection;

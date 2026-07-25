import React from 'react';

const SignatureSection = ({ data, onChange, facultyName }) => {
  const sectionHeaderStyle = {
    marginBottom: '1.5rem',
    color: '#1e293b',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0.75rem'
  };

  const containerStyle = {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: '4rem'
  };

  const signatureBoxStyle = {
    textAlign: 'center', 
    width: '250px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  const signatureLineStyle = {
    height: '80px',
    width: '100%',
    borderBottom: '2px solid #cbd5e1',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    fontSize: '0.9rem',
    paddingBottom: '0.5rem'
  };

  const nameStyle = { 
    fontSize: '1rem', 
    fontWeight: '700', 
    color: '#1e293b', 
    marginTop: '0.5rem', 
    textTransform: 'uppercase',
    minHeight: '24px'
  };

  const roleStyle = { 
    fontSize: '0.85rem', 
    color: '#64748b', 
    marginTop: '0.25rem' 
  };

  const dateContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '1.5rem',
    width: '100%'
  };

  const dateInputStyle = {
    padding: '0.6rem 0.8rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={sectionHeaderStyle}>Instructor Information</h3>
      
      <div style={containerStyle}>
        
        {/* Instructor Signature Block */}
        <div style={signatureBoxStyle}>
          <div style={signatureLineStyle}>
            Signature
          </div>
          <div style={nameStyle}>
            {facultyName || 'Course Instructor'}
          </div>
          <div style={roleStyle}>
            (COURSE INSTRUCTOR)
          </div>
          <div style={dateContainerStyle}>
            <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', alignSelf: 'flex-start' }}>Date</label>
            <input 
              type="date" 
              style={dateInputStyle} 
              value={data.instructorDate || ''} 
              onChange={(e) => onChange('signatures', { ...data, instructorDate: e.target.value })}
            />
          </div>
        </div>

        {/* Head of Department Signature Block */}
        <div style={signatureBoxStyle}>
          <div style={signatureLineStyle}>
            Signature
          </div>
          <div style={nameStyle}>
            Head of Department
          </div>
          <div style={roleStyle}>
            (HEAD OF DEPARTMENT)
          </div>
          <div style={dateContainerStyle}>
            <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', alignSelf: 'flex-start' }}>Date</label>
            <input 
              type="date" 
              style={dateInputStyle} 
              value={data.hodDate || ''} 
              onChange={(e) => onChange('signatures', { ...data, hodDate: e.target.value })}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default SignatureSection;

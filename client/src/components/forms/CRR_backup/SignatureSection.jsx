import React from 'react';

const SignatureSection = ({ data, onChange, facultyName }) => {
  const containerStyle = {
    border: '2px solid #1e293b',
    padding: '2rem',
    marginTop: '3rem',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '2rem'
  };

  const signatureBoxStyle = {
    textAlign: 'center', 
    width: '280px',
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
    minHeight: '24px' // keep space even if empty
  };

  const roleStyle = { 
    fontSize: '0.85rem', 
    color: '#64748b', 
    marginTop: '0.25rem' 
  };

  const dateInputStyle = {
    marginTop: '1rem',
    padding: '0.5rem',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    color: '#1e293b',
    fontSize: '0.9rem',
    outline: 'none',
    textAlign: 'center',
    width: '150px'
  };

  return (
    <div style={containerStyle}>
      
      {/* Instructor Signature Block */}
      <div style={signatureBoxStyle}>
        <div style={signatureLineStyle}>
          Signature
        </div>
        <div style={nameStyle}>
          {facultyName || '____________________'}
        </div>
        <div style={roleStyle}>
          (COURSE INSTRUCTOR)
        </div>
        <input 
          type="date" 
          style={dateInputStyle} 
          value={data.instructorDate || ''} 
          onChange={(e) => onChange('signatures', { ...data, instructorDate: e.target.value })}
        />
      </div>

      {/* Head of Department Signature Block */}
      <div style={signatureBoxStyle}>
        <div style={signatureLineStyle}>
          Signature
        </div>
        <div style={nameStyle}>
          ____________________
        </div>
        <div style={roleStyle}>
          (HEAD OF DEPARTMENT)
        </div>
        <input 
          type="date" 
          style={dateInputStyle} 
          value={data.hodDate || ''} 
          onChange={(e) => onChange('signatures', { ...data, hodDate: e.target.value })}
        />
      </div>

    </div>
  );
};

export default SignatureSection;

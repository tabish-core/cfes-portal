import React from 'react';

const CourseDetailsSection = ({ data, onChange }) => {
  const inputStyle = {
    padding: '0.6rem 0.8rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '6px',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box'
  };


  return (
    <div style={{ marginBottom: '3rem' }}>
      <h3 style={{
        backgroundColor: '#e2e8f0',
        padding: '0.75rem',
        border: '1px solid #cbd5e1',
        margin: '0 0 1rem 0',
        color: '#1e293b',
        fontSize: '1rem',
        fontWeight: '700'
      }}>
        A. COURSE DETAILS
      </h3>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
        <tbody>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', width: '5%', textAlign: 'center', fontWeight: 'bold' }}>1</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', width: '20%', fontWeight: '600' }}>TEACHER'S NAME:</td>
            <td colSpan="3" style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>
              <input type="text" style={inputStyle} value={data.teacherName || ''} onChange={(e) => onChange('teacherName', e.target.value)} />
            </td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>2</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', fontWeight: '600' }}>DEPARTMENT:</td>
            <td colSpan="3" style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>
              <input type="text" style={inputStyle} value={data.department || ''} onChange={(e) => onChange('department', e.target.value)} />
            </td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>3</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', fontWeight: '600' }}>COURSE TITLE:</td>
            <td colSpan="3" style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>
              <input type="text" style={inputStyle} value={data.courseTitle || ''} onChange={(e) => onChange('courseTitle', e.target.value)} />
            </td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>4</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', fontWeight: '600' }}>COURSE CODE:</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', width: '30%' }}>
              <input type="text" style={inputStyle} value={data.courseCode || ''} onChange={(e) => onChange('courseCode', e.target.value)} />
            </td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', width: '20%', fontWeight: '600', display: 'flex', alignItems: 'center', borderBottom: 'none', borderRight: 'none', borderLeft: 'none', borderTop: 'none' }}>
              <span style={{width: '20px', display: 'inline-block', textAlign: 'center', fontWeight: 'bold', marginRight: '10px'}}>5</span> CREDIT HOURS:
            </td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', width: '25%' }}>
              <input type="text" style={inputStyle} value={data.creditHours || ''} onChange={(e) => onChange('creditHours', e.target.value)} />
            </td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>5</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', fontWeight: '600' }}>SEMESTER:</td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>
              <input type="text" style={inputStyle} value={data.semester || ''} onChange={(e) => onChange('semester', e.target.value)} />
            </td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', fontWeight: '600', display: 'flex', alignItems: 'center', borderBottom: 'none', borderRight: 'none', borderLeft: 'none', borderTop: 'none' }}>
              <span style={{width: '20px', display: 'inline-block', textAlign: 'center', fontWeight: 'bold', marginRight: '10px'}}>6</span> NO. OF STUDENTS:
            </td>
            <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>
              <input type="number" style={inputStyle} value={data.noOfStudents || ''} onChange={(e) => onChange('noOfStudents', e.target.value)} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CourseDetailsSection;

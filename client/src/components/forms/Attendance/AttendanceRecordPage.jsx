import React from 'react';

const AttendanceRecordPage = () => {
  return (
    <div style={{ padding: '0.5rem 0' }}>
      <p
        style={{
          margin: '0 0 0.75rem 0',
          fontSize: '1rem',
          color: '#334155',
          fontWeight: '500',
          lineHeight: '1.5'
        }}
      >
        Attendance record is available at the following link:
      </p>
      <div>
        <a
          href="https://iulms.edu.pk/sic/AttendanceSheet.php"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            color: '#3949ab',
            fontSize: '1rem',
            fontWeight: '600',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            outlineOffset: '2px'
          }}
        >
          https://iulms.edu.pk/sic/AttendanceSheet.php
        </a>
      </div>
    </div>
  );
};

export default AttendanceRecordPage;

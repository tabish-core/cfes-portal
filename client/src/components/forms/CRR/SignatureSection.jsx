import React from 'react';
import Icon from '../../common/Icon';

const SignatureSection = ({ data, onChange, facultyName }) => {
  return (
    <section className="cfes-crr-card" aria-labelledby="crr-signatures-heading">
      <div className="cfes-crr-card-header">
        <h2 id="crr-signatures-heading" className="cfes-crr-card-title">
          <Icon name="users" size={18} />
          <span>Institutional Review &amp; Signatures</span>
        </h2>
        <span className="cfes-crr-card-tag">Formal Endorsements</span>
      </div>

      <div className="cfes-crr-signatures-grid">
        {/* Course Instructor */}
        <div className="cfes-crr-signature-box">
          <div className="cfes-crr-signature-line">
            Digital Signature / Endorsement
          </div>
          <div className="cfes-crr-signature-name">
            {facultyName || 'Course Instructor'}
          </div>
          <div className="cfes-crr-signature-role">
            Course Instructor
          </div>
          <div className="cfes-crr-signature-date">
            <label htmlFor="crr-instructor-date" className="cfes-crr-signature-date-label">
              Instructor Review Date
            </label>
            <input
              id="crr-instructor-date"
              type="date"
              className="cfes-crr-signature-date-input"
              value={data.instructorDate || ''}
              onChange={(e) => onChange('signatures', { ...data, instructorDate: e.target.value })}
            />
          </div>
        </div>

        {/* Head of Department */}
        <div className="cfes-crr-signature-box">
          <div className="cfes-crr-signature-line">
            Departmental Approval
          </div>
          <div className="cfes-crr-signature-name">
            Head of Department
          </div>
          <div className="cfes-crr-signature-role">
            Head of Department (HOD)
          </div>
          <div className="cfes-crr-signature-date">
            <label htmlFor="crr-hod-date" className="cfes-crr-signature-date-label">
              HOD Endorsement Date
            </label>
            <input
              id="crr-hod-date"
              type="date"
              className="cfes-crr-signature-date-input"
              value={data.hodDate || ''}
              onChange={(e) => onChange('signatures', { ...data, hodDate: e.target.value })}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignatureSection;

import React from 'react';
import Icon from '../../common/Icon';

const CourseDetailsSection = ({ data, onChange }) => {
  return (
    <section className="cfes-crr-card" aria-labelledby="crr-course-details-heading">
      <div className="cfes-crr-card-header">
        <h2 id="crr-course-details-heading" className="cfes-crr-card-title">
          <Icon name="book" size={18} />
          <span>Course Information</span>
        </h2>
        <span className="cfes-crr-card-tag">General Details</span>
      </div>

      <div className="cfes-crr-details-grid">
        <div className="cfes-crr-form-group">
          <label htmlFor="crr-teacher-name" className="cfes-crr-label">
            Teacher&apos;s Name
          </label>
          <input
            id="crr-teacher-name"
            type="text"
            className="cfes-crr-input"
            value={data.teacherName || ''}
            onChange={(e) => onChange('teacherName', e.target.value)}
            placeholder="e.g. Dr. John Doe"
          />
        </div>

        <div className="cfes-crr-form-group">
          <label htmlFor="crr-department" className="cfes-crr-label">
            Department
          </label>
          <input
            id="crr-department"
            type="text"
            className="cfes-crr-input"
            value={data.department || ''}
            onChange={(e) => onChange('department', e.target.value)}
            placeholder="e.g. Computer Science"
          />
        </div>

        <div className="cfes-crr-form-group">
          <label htmlFor="crr-course-title" className="cfes-crr-label">
            Course Title
          </label>
          <input
            id="crr-course-title"
            type="text"
            className="cfes-crr-input"
            value={data.courseTitle || ''}
            onChange={(e) => onChange('courseTitle', e.target.value)}
            placeholder="e.g. Data Structures and Algorithms"
          />
        </div>

        <div className="cfes-crr-form-group">
          <label htmlFor="crr-course-code" className="cfes-crr-label">
            Course Code
          </label>
          <input
            id="crr-course-code"
            type="text"
            className="cfes-crr-input"
            value={data.courseCode || ''}
            onChange={(e) => onChange('courseCode', e.target.value)}
            placeholder="e.g. CS201"
          />
        </div>

        <div className="cfes-crr-form-group">
          <label htmlFor="crr-credit-hours" className="cfes-crr-label">
            Credit Hours
          </label>
          <input
            id="crr-credit-hours"
            type="text"
            className="cfes-crr-input"
            value={data.creditHours || ''}
            onChange={(e) => onChange('creditHours', e.target.value)}
            placeholder="e.g. 3 (3,0)"
          />
        </div>

        <div className="cfes-crr-form-group">
          <label htmlFor="crr-semester" className="cfes-crr-label">
            Semester
          </label>
          <input
            id="crr-semester"
            type="text"
            className="cfes-crr-input"
            value={data.semester || ''}
            onChange={(e) => onChange('semester', e.target.value)}
            placeholder="e.g. Spring 2024 (Sec A)"
          />
        </div>

        <div className="cfes-crr-form-group">
          <label htmlFor="crr-no-of-students" className="cfes-crr-label">
            No. of Students
          </label>
          <input
            id="crr-no-of-students"
            type="number"
            min="0"
            className="cfes-crr-input"
            value={data.noOfStudents || ''}
            onChange={(e) => onChange('noOfStudents', e.target.value)}
            placeholder="e.g. 45"
          />
        </div>
      </div>
    </section>
  );
};

export default CourseDetailsSection;

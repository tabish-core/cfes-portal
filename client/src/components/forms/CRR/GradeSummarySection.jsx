import React from 'react';
import Icon from '../../common/Icon';

const GradeSummarySection = ({ data, onChange }) => {
  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'F'];

  const handleGradeChange = (grade, value) => {
    onChange('gradeSummary', { ...data, [grade]: value });
  };

  return (
    <section className="cfes-crr-card" aria-labelledby="crr-grade-summary-heading">
      <div className="cfes-crr-card-header">
        <h2 id="crr-grade-summary-heading" className="cfes-crr-card-title">
          <Icon name="document" size={18} />
          <span>Grade Summary</span>
        </h2>
        <span className="cfes-crr-card-tag">Student Grade Distribution</span>
      </div>

      <div
        className="cfes-table-scroll-container"
        tabIndex={0}
        aria-label="Student letter grade distribution table"
        style={{
          overflowX: 'auto',
          width: '100%',
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          border: '1px solid var(--cfes-slate-300)',
          borderRadius: 'var(--cfes-radius-lg)',
        }}
      >
        <table className="cfes-crr-table" style={{ minWidth: '600px', textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ width: '160px', textAlign: 'left', whiteSpace: 'nowrap' }}>Grade</th>
              {grades.map((grade) => (
                <th key={grade} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {grade}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700, color: 'var(--cfes-slate-800)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                No. of Students
              </td>
              {grades.map((grade) => (
                <td key={grade}>
                  <input
                    type="number"
                    min="0"
                    className="cfes-crr-table-input cfes-crr-table-input--center"
                    value={data[grade] || ''}
                    onChange={(e) => handleGradeChange(grade, e.target.value)}
                    placeholder="0"
                    aria-label={`Number of students with grade ${grade}`}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="cfes-crr-class-average-bar">
        <label htmlFor="crr-class-average" className="cfes-crr-class-average-label">
          Class Average (GPA / %):
        </label>
        <input
          id="crr-class-average"
          type="text"
          className="cfes-crr-class-average-input"
          value={data.classAverage || ''}
          onChange={(e) => handleGradeChange('classAverage', e.target.value)}
          placeholder="e.g. 75.5 (C+)"
          aria-label="Class Average"
        />
      </div>
    </section>
  );
};

export default GradeSummarySection;

import React from 'react';
import Icon from '../../common/Icon';

const CourseLearningOutcomesSection = ({ data, onChange }) => {
  return (
    <section className="cfes-crr-card" aria-labelledby="crr-clo-evaluation-heading">
      <div className="cfes-crr-card-header">
        <h2 id="crr-clo-evaluation-heading" className="cfes-crr-card-title">
          <Icon name="book" size={18} />
          <span>Course Learning Outcomes Evaluation</span>
        </h2>
        <span className="cfes-crr-card-tag">Attainment Assessment</span>
      </div>

      <div>
        {/* Question 1: Adequacy */}
        <div className="cfes-crr-question-block">
          <div className="cfes-crr-question-title">
            1. Were the Course Learning Outcomes (CLOs) adequate?
          </div>
          <div className="cfes-crr-radio-group">
            <label className="cfes-crr-radio-label">
              <input
                type="radio"
                name="outcomesAdequate"
                className="cfes-crr-radio-input"
                checked={data.outcomesAdequate === 'Yes'}
                onChange={() => onChange('learningOutcomes', { ...data, outcomesAdequate: 'Yes' })}
              />
              <span>Yes</span>
            </label>
            <label className="cfes-crr-radio-label">
              <input
                type="radio"
                name="outcomesAdequate"
                className="cfes-crr-radio-input"
                checked={data.outcomesAdequate === 'No'}
                onChange={() => onChange('learningOutcomes', { ...data, outcomesAdequate: 'No' })}
              />
              <span>No</span>
            </label>
          </div>

          {data.outcomesAdequate === 'No' && (
            <div className="cfes-crr-conditional-box">
              <label htmlFor="crr-revision-suggestion" className="cfes-crr-conditional-label">
                Suggested Revisions:
              </label>
              <textarea
                id="crr-revision-suggestion"
                className="cfes-crr-textarea"
                value={data.revisionSuggestion || ''}
                onChange={(e) => onChange('learningOutcomes', { ...data, revisionSuggestion: e.target.value })}
                placeholder="Enter specific recommendations for outcome revision..."
              />
            </div>
          )}
        </div>

        {/* Question 2: CLO Attainment */}
        <div className="cfes-crr-question-block">
          <div className="cfes-crr-question-title">
            2. Comment on CLO Attainment Status
          </div>
          <div className="cfes-crr-radio-group">
            <label className="cfes-crr-radio-label">
              <input
                type="radio"
                name="cloAttainmentStatus"
                className="cfes-crr-radio-input"
                checked={data.cloAttainmentStatus === 'Satisfied'}
                onChange={() => onChange('learningOutcomes', { ...data, cloAttainmentStatus: 'Satisfied' })}
              />
              <span>Satisfied</span>
            </label>
            <label className="cfes-crr-radio-label">
              <input
                type="radio"
                name="cloAttainmentStatus"
                className="cfes-crr-radio-input"
                checked={data.cloAttainmentStatus === 'Not Satisfied'}
                onChange={() => onChange('learningOutcomes', { ...data, cloAttainmentStatus: 'Not Satisfied' })}
              />
              <span>Not Satisfied</span>
            </label>
          </div>

          {data.cloAttainmentStatus === 'Not Satisfied' && (
            <div className="cfes-crr-conditional-box">
              <label htmlFor="crr-clo-attainment-reason" className="cfes-crr-conditional-label">
                Reasons for Non-Attainment:
              </label>
              <textarea
                id="crr-clo-attainment-reason"
                className="cfes-crr-textarea"
                value={data.cloAttainmentReason || ''}
                onChange={(e) => onChange('learningOutcomes', { ...data, cloAttainmentReason: e.target.value })}
                placeholder="Detail the root causes, cohort gaps, or delivery obstacles encountered..."
              />
            </div>
          )}
        </div>

        {/* Question 3: PLO Attainment */}
        <div className="cfes-crr-question-block">
          <div className="cfes-crr-question-title">
            3. Comment on PLO / GA Attainment Status
          </div>
          <div className="cfes-crr-radio-group">
            <label className="cfes-crr-radio-label">
              <input
                type="radio"
                name="ploAttainmentStatus"
                className="cfes-crr-radio-input"
                checked={data.ploAttainmentStatus === 'Satisfied'}
                onChange={() => onChange('learningOutcomes', { ...data, ploAttainmentStatus: 'Satisfied' })}
              />
              <span>Satisfied</span>
            </label>
            <label className="cfes-crr-radio-label">
              <input
                type="radio"
                name="ploAttainmentStatus"
                className="cfes-crr-radio-input"
                checked={data.ploAttainmentStatus === 'Not Satisfied'}
                onChange={() => onChange('learningOutcomes', { ...data, ploAttainmentStatus: 'Not Satisfied' })}
              />
              <span>Not Satisfied</span>
            </label>
          </div>

          {data.ploAttainmentStatus === 'Not Satisfied' && (
            <div className="cfes-crr-conditional-box">
              <label htmlFor="crr-plo-attainment-reason" className="cfes-crr-conditional-label">
                Reasons for Non-Attainment:
              </label>
              <textarea
                id="crr-plo-attainment-reason"
                className="cfes-crr-textarea"
                value={data.ploAttainmentReason || ''}
                onChange={(e) => onChange('learningOutcomes', { ...data, ploAttainmentReason: e.target.value })}
                placeholder="Detail specific Graduate Attribute attainment challenges..."
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CourseLearningOutcomesSection;

import React from 'react';
import Icon from '../../common/Icon';

const CourseEnhancementSection = ({ data, onChange }) => {
  return (
    <section className="cfes-crr-card" aria-labelledby="crr-enhancement-heading">
      <div className="cfes-crr-card-header">
        <h2 id="crr-enhancement-heading" className="cfes-crr-card-title">
          <Icon name="refresh" size={18} />
          <span>Continuous Quality Improvement (CQI)</span>
        </h2>
        <span className="cfes-crr-card-tag">Course Enhancement</span>
      </div>

      <div>
        <div className="cfes-crr-enhancement-block">
          <label htmlFor="crr-enhancement-comment" className="cfes-crr-enhancement-title" style={{ display: 'block' }}>
            1. Course Enhancement / Improvement Actions for Next Offering
          </label>
          <textarea
            id="crr-enhancement-comment"
            className="cfes-crr-textarea"
            value={data.courseEnhancementComment || ''}
            onChange={(e) => onChange('courseEnhancement', { ...data, courseEnhancementComment: e.target.value })}
            placeholder="Document concrete pedagogical improvements, lab revisions, or pedagogical enhancements..."
          />
        </div>

        <div className="cfes-crr-enhancement-block">
          <label htmlFor="crr-implementation-comments" className="cfes-crr-enhancement-title" style={{ display: 'block' }}>
            2. Implementation of Changes Proposed in Earlier Course Review Reports
          </label>
          <textarea
            id="crr-implementation-comments"
            className="cfes-crr-textarea"
            value={data.implementationComments || ''}
            onChange={(e) => onChange('courseEnhancement', { ...data, implementationComments: e.target.value })}
            placeholder="Assess how recommendations from the previous semester were incorporated..."
          />
        </div>

        <div className="cfes-crr-enhancement-block">
          <label htmlFor="crr-appropriateness-comments" className="cfes-crr-enhancement-title" style={{ display: 'block' }}>
            3. Continuing Appropriateness of the Course Curriculum &amp; Textbooks
          </label>
          <textarea
            id="crr-appropriateness-comments"
            className="cfes-crr-textarea"
            value={data.appropriatenessComments || ''}
            onChange={(e) => onChange('courseEnhancement', { ...data, appropriatenessComments: e.target.value })}
            placeholder="Review textbook relevancy, software versions, and topic alignment with emerging trends..."
          />
        </div>
      </div>
    </section>
  );
};

export default CourseEnhancementSection;

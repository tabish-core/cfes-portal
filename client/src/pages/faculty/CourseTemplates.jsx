import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import Icon from '../../components/common/Icon';
import './CourseTemplates.css';

import {
  FORM_TEMPLATES,
  resolveTemplateLink,
  resolveChecklistUrl as resolveChecklistBackUrl,
} from '../../services/courseNavigation.service';

const CourseTemplates = () => {
  const { courseId, offeringId } = useParams();
  const [offering, setOffering] = useState(null);

  const checklistUrl = resolveChecklistBackUrl(offeringId, courseId);
  const backLabel = offeringId || courseId ? 'Back to Checklist' : 'Back to Dashboard';

  useEffect(() => {
    if (!offeringId || offeringId === 'undefined' || offeringId === 'null') return;
    let isMounted = true;
    api.get(`/offerings/${offeringId}`)
      .then(({ data }) => {
        if (isMounted) {
          setOffering(data.data?.offering || data.offering);
        }
      })
      .catch((err) => {
        console.warn('Could not load offering details for templates:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [offeringId]);

  return (
    <div className="cfes-templates-container">
      {/* ── Breadcrumb & Back Navigation Bar ── */}
      <div className="cfes-templates-nav-bar">
        <div className="cfes-templates-nav-left">
          <Link to={checklistUrl} className="cfes-templates-back-btn" title="Return to course checklist">
            <Icon name="chevron-left" size={14} />
            <span>{backLabel}</span>
          </Link>
          <nav aria-label="Breadcrumb" className="cfes-templates-breadcrumbs">
            <Link to={checklistUrl} className="cfes-templates-crumb-link">
              Course Checklist
            </Link>
            <span className="cfes-templates-crumb-sep">
              <Icon name="chevron-right" size={12} />
            </span>
            <span className="cfes-templates-crumb-current" aria-current="page">
              Course Forms
            </span>
          </nav>
        </div>

        {offering && (
          <div className="cfes-templates-course-badge">
            <Icon name="book" size={14} />
            <strong>{offering.course?.courseCode}</strong>
            <span>{offering.course?.courseName}</span>
            <span>({offering.semester?.name ? `${offering.semester.name} • ` : ''}Sec {offering.section || 'A'})</span>
          </div>
        )}
      </div>

      {/* ── Header Card ── */}
      <div className="cfes-templates-header-card">
        <div className="cfes-templates-header-info">
          <h1 className="cfes-templates-title">Select Course Form Template</h1>
          <p className="cfes-templates-subtitle">
            Choose a course document template to edit, review, and synchronize for this course offering.
          </p>
        </div>
      </div>

      {/* ── Available Templates Grid ── */}
      <div className="cfes-templates-panel">
        <h2 className="cfes-templates-panel-heading">Available Academic Form Templates</h2>
        <div className="cfes-templates-grid">
          {FORM_TEMPLATES.map((form) => {
            const targetUrl = resolveTemplateLink(form, offeringId, courseId);
            return (
              <Link
                key={form.formType}
                to={targetUrl}
                className="cfes-template-card"
                title={`Open and edit ${form.name}`}
              >
                <div>
                  <div className="cfes-template-card-header">
                    <span className="cfes-template-code-badge">{form.formType}</span>
                    {form.tag && <span className="cfes-template-tag">{form.tag}</span>}
                  </div>
                  <h3 className="cfes-template-name">{form.name}</h3>
                  <p className="cfes-template-desc">{form.description}</p>
                </div>
                <div className="cfes-template-footer">
                  <span>Open Form</span>
                  <Icon name="chevron-right" size={13} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CourseTemplates;

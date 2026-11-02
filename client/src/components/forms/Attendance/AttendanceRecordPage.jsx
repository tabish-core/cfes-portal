import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../common/Icon';
import { resolveChecklistUrl } from '../../../services/courseNavigation.service';
import './AttendanceRecordPage.css';

/**
 * AttendanceRecordPage — Institutional Attendance Record guidance & LMS portal link.
 * Directs faculty to Iqra University's official LMS attendance system.
 */
const AttendanceRecordPage = ({ courseId, offeringId }) => {
  const lmsUrl = 'https://iulms.edu.pk/sic/AttendanceSheet.php';
  const checklistUrl = resolveChecklistUrl(offeringId, courseId);

  return (
    <div className="cfes-ar-container">
      <div className="cfes-ar-card">
        <div className="cfes-ar-badge">
          <Icon name="document" size={14} />
          <span>Official University System</span>
        </div>

        <div className="cfes-ar-header">
          <h2 className="cfes-ar-title">Attendance Record &amp; Verification</h2>
          <p className="cfes-ar-description">
            Student attendance is centrally tracked, calculated, and maintained through
            the university&apos;s official Learning Management System (LMS).
          </p>
        </div>

        <div className="cfes-ar-guidance-box">
          <div className="cfes-ar-guidance-heading">
            <Icon name="book" size={16} />
            <span>Institutional Policy &amp; Workflow</span>
          </div>
          <p className="cfes-ar-guidance-text">
            To view, verify, or print the official attendance sheet for this course offering,
            please access the official LMS portal using the link below. The portal provides
            real-time student roster percentages and aggregate attendance sheets required for course
            file submission.
          </p>
        </div>

        <div className="cfes-ar-action-group">
          <div className="cfes-ar-action-meta">
            <span className="cfes-ar-action-label">Official LMS Attendance Destination:</span>
            <code className="cfes-ar-action-url-display">{lmsUrl}</code>
          </div>

          <div className="cfes-ar-action-buttons">
            <a
              href={lmsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cfes-ar-lms-btn"
              id="cfes-ar-lms-link"
              aria-label="Open Official University LMS Attendance Sheet in a new tab"
            >
              <span>Open LMS Attendance Portal</span>
              <Icon name="external" size={16} />
            </a>
          </div>
        </div>

        <div className="cfes-ar-notice">
          <span className="cfes-ar-notice-icon">
            <Icon name="alert" size={18} />
          </span>
          <div className="cfes-ar-notice-content">
            <div className="cfes-ar-notice-title">Authentication Notice</div>
            <div>
              Please log in with your official Iqra University faculty credentials when prompted by the LMS portal.
              Ensure you select the matching semester and course section to verify student attendance records.
            </div>
          </div>
        </div>

        <div className="cfes-ar-footer-nav">
          <Link
            to={checklistUrl}
            className="cfes-ar-back-link"
            id="cfes-ar-back-to-checklist"
            aria-label="Return to Course File Checklist"
          >
            <Icon name="chevron-left" size={14} />
            <span>Back to Checklist</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AttendanceRecordPage;

/**
 * TermsOfService.jsx — Public Terms of Service page for the CFES Faculty Portal.
 * Required for Google OAuth External Verification and university governance.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/common/Icon';
import './LegalPages.css';

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Service — CFES Faculty Portal | Iqra University';
  }, []);

  return (
    <div className="legal-page">
      {/* ── Public Top Navigation Header ── */}
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/login" className="legal-brand-link">
            <div className="legal-brand-logo">IU</div>
            <div className="legal-brand-text">
              <span className="legal-brand-title">CFES Faculty Portal</span>
              <span className="legal-brand-sub">Iqra University</span>
            </div>
          </Link>

          <nav className="legal-header-nav" aria-label="Policy Navigation">
            <Link to="/privacy-policy" className="legal-nav-pill">
              Privacy Policy
            </Link>
            <Link to="/terms" className="legal-nav-pill active">
              Terms of Service
            </Link>
            <Link to="/login" className="legal-back-btn">
              <Icon name="arrowLeft" size={12} />
              <span>Back to Portal</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main Terms Content ── */}
      <main className="legal-main">
        {/* Document Header */}
        <div className="legal-doc-header">
          <h1 className="legal-doc-title">Terms of Service</h1>
          <p className="legal-doc-desc">
            Rules, operational requirements, and authorized usage policies governing access to the
            Course File Editing &amp; Submission System (CFES) at Iqra University.
          </p>
          <div className="legal-doc-meta">
            <span><strong>Effective Date:</strong> November 2, 2026</span>
            <span>•</span>
            <span><strong>System:</strong> CFES v1.0</span>
            <span>•</span>
            <span><strong>Institution:</strong> Iqra University</span>
          </div>
        </div>

        <div className="legal-layout-grid">
          {/* Quick Navigation Sidebar (Desktop) */}
          <aside className="legal-sidebar" aria-label="Table of Contents">
            <div className="legal-toc-title">Terms Sections</div>
            <ul className="legal-toc-list">
              <li><a href="#acceptance" className="legal-toc-link">1. Acceptance of Terms</a></li>
              <li><a href="#authorized-use" className="legal-toc-link">2. Authorized Portal Usage</a></li>
              <li><a href="#account-security" className="legal-toc-link">3. Account Responsibilities</a></li>
              <li><a href="#document-accuracy" className="legal-toc-link">4. Document Accuracy</a></li>
              <li><a href="#drive-usage" className="legal-toc-link">5. Google Drive Integration</a></li>
              <li><a href="#prohibited-acts" className="legal-toc-link">6. Prohibited Activities</a></li>
              <li><a href="#intellectual-property" className="legal-toc-link">7. Intellectual Property</a></li>
              <li><a href="#service-availability" className="legal-toc-link">8. Availability &amp; Maintenance</a></li>
              <li><a href="#suspension" className="legal-toc-link">9. Suspension &amp; Revocation</a></li>
              <li><a href="#contact-terms" className="legal-toc-link">10. Administrative Contacts</a></li>
            </ul>
          </aside>

          {/* Terms Text Card */}
          <article className="legal-content-card">
            {/* Administrator Notice Callout */}
            <div className="legal-admin-notice" role="alert">
              <div className="legal-notice-icon">
                <Icon name="info" size={20} />
              </div>
              <div className="legal-notice-content">
                <h4>Institutional Review Notice</h4>
                <p>
                  These Terms of Service govern internal academic operations within Iqra University.
                  Institutional administrators should review and ratify disciplinary terms and formal
                  departmental contacts prior to submission for external OAuth verification.
                </p>
              </div>
            </div>

            {/* 1. Acceptance of Terms */}
            <section id="acceptance" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">1.</span> Acceptance of Terms
              </h2>
              <p className="legal-text">
                By logging into or accessing the <strong>Course File Editing &amp; Submission System (CFES)</strong>,
                you agree to comply with and be bound by these Terms of Service, along with Iqra University&apos;s
                academic regulations, faculty codes of conduct, and information technology policies.
              </p>
              <p className="legal-text">
                If you do not agree with any part of these terms, you must refrain from using the portal
                and immediately contact your Head of Department or the system administrator.
              </p>
            </section>

            {/* 2. Authorized Portal Usage */}
            <section id="authorized-use" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">2.</span> Authorized Portal Usage
              </h2>
              <p className="legal-text">
                CFES is an official institutional platform designed exclusively for:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Faculty Members:</strong> Preparing, editing, submitting, and synchronizing statutory
                  course file documentation (CIS, CCR, reflections, exam question papers, student answer copies)
                  for assigned course offerings.
                </li>
                <li>
                  <strong>Heads of Department (HoD):</strong> Reviewing departmental submissions, monitoring
                  curriculum compliance, and validating faculty course files.
                </li>
                <li>
                  <strong>Deans &amp; Academic Administrators:</strong> Institutional audit oversight, accreditation
                  monitoring, and university-wide course file verification.
                </li>
              </ul>
              <p className="legal-text">
                Access by unauthorized individuals, students, or external third parties is strictly prohibited.
              </p>
            </section>

            {/* 3. Account Security & Credentials */}
            <section id="account-security" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">3.</span> Account Responsibilities &amp; Credential Security
              </h2>
              <ul className="legal-list">
                <li>
                  <strong>Credential Confidentiality:</strong> Users are solely responsible for maintaining the
                  confidentiality of their portal password. You must never share your login credentials with
                  teaching assistants, students, or colleagues.
                </li>
                <li>
                  <strong>Activity Attribution:</strong> All document submissions, edits, and file synchronizations
                  performed under your account credentials are formally attributed to you as an official academic record.
                </li>
                <li>
                  <strong>Compromised Accounts:</strong> If you suspect that your account has been accessed without
                  authorization, you must immediately report the incident to the Department of Computer Science or
                  the portal administrator.
                </li>
              </ul>
            </section>

            {/* 4. Document Accuracy & Integrity */}
            <section id="document-accuracy" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">4.</span> Academic Document Accuracy &amp; Integrity
              </h2>
              <p className="legal-text">
                The integrity of course files is essential for institutional quality assurance and Higher Education
                Commission (HEC) / National Computing Education Accreditation Council (NCEAC) accreditation:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Factual Accuracy:</strong> Faculty must ensure all submitted Course Information Sheets (CIS),
                  weekly lesson plans, textbook citations, and assessment criteria accurately reflect the curriculum
                  delivered in the assigned section.
                </li>
                <li>
                  <strong>Authentic Assessment Artifacts:</strong> Uploaded examination question papers, quizzes,
                  and sample student answer scripts (best, average, and worst samples) must be genuine artifacts
                  from the corresponding semester.
                </li>
                <li>
                  <strong>Prohibition of Falsification:</strong> Falsifying marks, attendance, syllabus coverage,
                  or student evaluation metrics constitutes academic misconduct subject to institutional disciplinary
                  proceedings under university bylaws.
                </li>
              </ul>
            </section>

            {/* 5. Google Drive Integration */}
            <section id="drive-usage" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">5.</span> Appropriate Use of Google Drive Integration
              </h2>
              <p className="legal-text">
                The portal connects to an authorized institutional Google Drive workspace to archive official
                course files:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Academic Scope Only:</strong> The Google Drive repository is strictly reserved for
                  curriculum documents, assessment artifacts, and accreditation records generated through CFES.
                </li>
                <li>
                  <strong>No Personal File Storage:</strong> Users may not attempt to utilize the integrated
                  storage for personal, non-academic, commercial, or copyrighted materials unrelated to course delivery.
                </li>
                <li>
                  <strong>No External Hierarchy Tampering:</strong> The automated folder structure
                  (<code>Semester &rarr; Faculty &rarr; Course Offering &rarr; Category</code>) is maintained
                  programmatically by CFES. Users must not rename, delete, move, or detach these folders directly
                  in Google Drive, as doing so may cause synchronization failures.
                </li>
                <li>
                  <strong>File Size and Format Limitations:</strong> Uploads must adhere to supported file formats
                  (PDF, DOCX, XLSX, PPTX) and designated file-size thresholds (e.g. 50 MB for lecture packages and
                  exam bundles).
                </li>
              </ul>
            </section>

            {/* 6. Prohibited Activities */}
            <section id="prohibited-acts" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">6.</span> Prohibited Activities &amp; System Misuse
              </h2>
              <p className="legal-text">
                Users are strictly prohibited from engaging in any of the following activities:
              </p>
              <ul className="legal-list">
                <li>Attempting to probe, scan, or test the vulnerability of CFES endpoints, servers, or authentication gates.</li>
                <li>Attempting to access, modify, or delete course files belonging to other faculty members without HoD/Dean authorization.</li>
                <li>Uploading files containing computer viruses, malware, trojans, or malicious scripts.</li>
                <li>Interfering with or disrupting the integrity, performance, or availability of the portal or connected Google APIs.</li>
                <li>Using automated bots, crawlers, or scrapers to extract course file records or student data.</li>
                <li>Bypassing or manipulating role-based permissions or JWT authorization tokens.</li>
              </ul>
            </section>

            {/* 7. Intellectual Property */}
            <section id="intellectual-property" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">7.</span> Intellectual Property &amp; Institutional Ownership
              </h2>
              <ul className="legal-list">
                <li>
                  <strong>Institutional Records:</strong> Course outlines, examination papers, institutional
                  rubrics, and continuous quality improvement reports compiled within CFES constitute official
                  records of Iqra University.
                </li>
                <li>
                  <strong>System Software:</strong> The CFES software, interface designs, templates, and backend
                  architecture are the proprietary assets of the institution and its development team.
                </li>
                <li>
                  <strong>Faculty Attribution:</strong> Authorship and academic attribution of original lecture
                  notes and pedagogical materials are respected in accordance with university intellectual property policies.
                </li>
              </ul>
            </section>

            {/* 8. Availability & Maintenance */}
            <section id="service-availability" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">8.</span> Service Availability &amp; Modifications
              </h2>
              <p className="legal-text">
                While Iqra University endeavors to maintain continuous availability of CFES during active academic
                semesters:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Maintenance Windows:</strong> The portal may be temporarily unavailable during scheduled
                  system upgrades, database backups, or infrastructure deployments.
                </li>
                <li>
                  <strong>Third-Party Dependencies:</strong> Cloud synchronization depends on Google Cloud Platform
                  and MongoDB Atlas availability. The university is not liable for temporary delays resulting from
                  external provider outages.
                </li>
                <li>
                  <strong>Policy Revisions:</strong> The university reserves the right to modify these Terms of
                  Service to reflect regulatory updates or technical enhancements. Continued use of the portal
                  following updates indicates acceptance of the amended terms.
                </li>
              </ul>
            </section>

            {/* 9. Suspension & Revocation */}
            <section id="suspension" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">9.</span> Account Suspension &amp; Access Revocation
              </h2>
              <p className="legal-text">
                Iqra University reserves the right to suspend or revoke access to CFES at any time under the
                following conditions:
              </p>
              <ul className="legal-list">
                <li>Separation or conclusion of a faculty member&apos;s employment or teaching contract.</li>
                <li>Breach of these Terms of Service or institutional codes of conduct.</li>
                <li>Engagement in academic falsification, security tampering, or unauthorized system access.</li>
              </ul>
            </section>

            {/* 10. Administrative Contacts */}
            <section id="contact-terms" className="legal-section" style={{ marginBottom: 0 }}>
              <h2 className="legal-section-title">
                <span className="legal-section-number">10.</span> Administrative &amp; Support Inquiries
              </h2>
              <p className="legal-text">
                For account access requests, error reporting, or questions regarding these Terms of Service,
                please contact:
              </p>

              <div className="legal-contact-grid">
                <div className="legal-contact-card">
                  <h4>Departmental Leadership</h4>
                  <p><strong>Dr. Israr Ali</strong></p>
                  <p>Head of Department (HoD), Computer Science</p>
                  <p>Iqra University, Main Campus</p>
                  <p style={{ marginTop: '0.25rem' }}>
                    Email: <code>israr.ali@iqra.edu.pk</code>
                  </p>
                </div>

                <div className="legal-contact-card">
                  <h4>Portal Support &amp; Administration</h4>
                  <p><strong>CFES Technical Administration Team</strong></p>
                  <p>Department of Computer Science</p>
                  <p>Iqra University</p>
                  <p style={{ marginTop: '0.25rem' }}>
                    Email: <code>admin@iqra.edu.pk</code>
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--cfes-slate-500)', marginTop: '0.25rem' }}>
                    *(Subject to administrative confirmation)
                  </p>
                </div>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* ── Public Footer ── */}
      <footer className="legal-footer">
        <div className="legal-footer-links">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms">Terms of Service</Link>
          <span>•</span>
          <Link to="/login">Faculty Portal Login</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} Iqra University. All rights reserved. Course File Editing &amp; Submission System (CFES).</p>
      </footer>
    </div>
  );
};

export default TermsOfService;

/**
 * PrivacyPolicy.jsx — Public Privacy Policy page for the CFES Faculty Portal.
 * Required for Google OAuth External Verification and university governance.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/common/Icon';
import './LegalPages.css';

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy — CFES Faculty Portal | Iqra University';
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
            <Link to="/privacy-policy" className="legal-nav-pill active">
              Privacy Policy
            </Link>
            <Link to="/terms" className="legal-nav-pill">
              Terms of Service
            </Link>
            <Link to="/login" className="legal-back-btn">
              <Icon name="arrowLeft" size={12} />
              <span>Back to Portal</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main Policy Content ── */}
      <main className="legal-main">
        {/* Document Header */}
        <div className="legal-doc-header">
          <h1 className="legal-doc-title">Privacy Policy</h1>
          <p className="legal-doc-desc">
            Learn how the Course File Editing &amp; Submission System (CFES) collects,
            handles, protects, and synchronizes academic documentation and user information.
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
            <div className="legal-toc-title">Policy Sections</div>
            <ul className="legal-toc-list">
              <li><a href="#introduction" className="legal-toc-link">1. Institutional Scope</a></li>
              <li><a href="#information-collected" className="legal-toc-link">2. Information Collected</a></li>
              <li><a href="#auth-security" className="legal-toc-link">3. Authentication &amp; Accounts</a></li>
              <li><a href="#google-integration" className="legal-toc-link">4. Google Drive &amp; OAuth</a></li>
              <li><a href="#data-usage" className="legal-toc-link">5. How Information Is Used</a></li>
              <li><a href="#storage-retention" className="legal-toc-link">6. Storage &amp; Retention</a></li>
              <li><a href="#disclosure" className="legal-toc-link">7. Third-Party Sharing</a></li>
              <li><a href="#user-rights" className="legal-toc-link">8. Faculty &amp; User Rights</a></li>
              <li><a href="#contact" className="legal-toc-link">9. Inquiries &amp; Contact</a></li>
            </ul>
          </aside>

          {/* Policy Text Card */}
          <article className="legal-content-card">
            {/* Administrator Notice Callout */}
            <div className="legal-admin-notice" role="alert">
              <div className="legal-notice-icon">
                <Icon name="info" size={20} />
              </div>
              <div className="legal-notice-content">
                <h4>Institutional &amp; Administrator Review Notice</h4>
                <p>
                  This Privacy Policy reflects the active technical architecture of the CFES Faculty
                  Portal. Institutional contact emails and specific university data-retention bylaws
                  are subject to administrative confirmation by Iqra University prior to final
                  external OAuth app verification.
                </p>
              </div>
            </div>

            {/* 1. Introduction & Institutional Scope */}
            <section id="introduction" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">1.</span> Institutional Scope &amp; Purpose
              </h2>
              <p className="legal-text">
                The <strong>Course File Editing &amp; Submission System (CFES)</strong> is an internal,
                centralized academic platform designed and operated for faculty members, Heads of
                Department (HoD), and Deans of Iqra University.
              </p>
              <p className="legal-text">
                The primary purpose of CFES is to assist faculty in preparing, compiling, editing,
                verifying, and archiving statutory academic course files (including Course Information
                Sheets, assessments, continuous reflections, and accreditation documentation) in
                conformity with institutional standards.
              </p>
            </section>

            {/* 2. Information Collected */}
            <section id="information-collected" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">2.</span> Information Collected &amp; Processed
              </h2>
              <p className="legal-text">
                CFES collects and processes only the information necessary to fulfill academic
                administration, accreditation verification, and course file management:
              </p>

              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Category</th>
                      <th>Data Elements Collected</th>
                      <th style={{ width: '30%' }}>Operational Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>User Profile</strong></td>
                      <td>Full Name, Institutional Email (e.g. <code>@iqra.edu.pk</code>), Academic Designation (Faculty, HoD, Dean), Department affiliation.</td>
                      <td>Identity verification, access control, and attributing course submissions.</td>
                    </tr>
                    <tr>
                      <td><strong>Academic Course Metadata</strong></td>
                      <td>Course codes, course names, credit hours, offering sections, semesters, academic calendars, timetables.</td>
                      <td>Organizing academic structures and assigning course files to corresponding faculty.</td>
                    </tr>
                    <tr>
                      <td><strong>Academic Documents &amp; Forms</strong></td>
                      <td>
                        Course Information Sheets (CIS), Course Completion Reports (CCR/CCP),
                        Continuous Quality Improvement (CRR) reports, course objectives, weekly lecture plans,
                        and textbook references.
                      </td>
                      <td>Compiling statutory course files and generating standardized PDF/DOCX records.</td>
                    </tr>
                    <tr>
                      <td><strong>Assessment Records</strong></td>
                      <td>
                        Quizzes, assignments, midterm and final examination question papers,
                        and sample graded student answer copies (anonymized best, average, and worst copies).
                      </td>
                      <td>Mandatory institutional documentation for OBE accreditation and academic audits.</td>
                    </tr>
                    <tr>
                      <td><strong>Outcome-Based Education (OBE)</strong></td>
                      <td>Student enrollment IDs, student names, assessment marks, and CLO attainment metrics.</td>
                      <td>Computing Course Learning Outcome (CLO) and Program Learning Outcome (PLO) achievement.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. Authentication & Account Security */}
            <section id="auth-security" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">3.</span> Authentication &amp; Account Security
              </h2>
              <p className="legal-text">
                CFES employs industry-standard safeguards to protect institutional accounts:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Cryptographic Password Hashing:</strong> All user passwords are salted and
                  hashed using <code>bcrypt</code> (10 rounds). Plaintext passwords are never logged,
                  stored, or accessible to system administrators.
                </li>
                <li>
                  <strong>Stateless Session Security:</strong> Sessions are authenticated using signed
                  JSON Web Tokens (JWT) with configurable expiration, verified against a cryptographically
                  secure server-side secret.
                </li>
                <li>
                  <strong>Role-Based Access Control (RBAC):</strong> Access is restricted according to
                  institutional roles (Faculty, Head of Department, and Dean), ensuring faculty can only
                  modify their assigned course offerings.
                </li>
              </ul>
            </section>

            {/* 4. Google Drive & OAuth Integration */}
            <section id="google-integration" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">4.</span> Google OAuth &amp; Google Drive Integration
              </h2>
              <p className="legal-text">
                The CFES Faculty Portal integrates with Google Drive API v3 to archive and organize official
                course documentation in cloud storage.
              </p>

              <div className="legal-highlight-box">
                <div className="legal-highlight-title">
                  <Icon name="check" size={16} />
                  <span>Google API Services User Data Policy Compliance</span>
                </div>
                <p className="legal-highlight-text">
                  &ldquo;CFES Faculty Portal&apos;s use and transfer to any other app of information received
                  from Google APIs will adhere to the{' '}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--cfes-navy-900)', textDecoration: 'underline' }}
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.&rdquo;
                </p>
              </div>

              <h3 style={{ fontSize: 'var(--cfes-font-md)', color: 'var(--cfes-slate-900)', margin: '1rem 0 0.5rem' }}>
                A. Requested Scope
              </h3>
              <p className="legal-text">
                The application requests the following OAuth 2.0 permission scope:
              </p>
              <ul className="legal-list">
                <li>
                  <code>https://www.googleapis.com/auth/drive</code> &mdash; Full access to see, create, edit,
                  and organize course files and folders within the configured university storage container.
                </li>
              </ul>

              <h3 style={{ fontSize: 'var(--cfes-font-md)', color: 'var(--cfes-slate-900)', margin: '1rem 0 0.5rem' }}>
                B. Why Google Drive Permissions Are Requested
              </h3>
              <p className="legal-text">
                Google Drive permissions are strictly utilized for the following automated functions:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Automated Hierarchy Resolution:</strong> Creating and organizing structured academic
                  folder trees (<code>Semester &rarr; Faculty &rarr; Course Offering &rarr; Category</code>)
                  under the university&apos;s designated root repository.
                </li>
                <li>
                  <strong>Document Archiving:</strong> Uploading generated Course Information Sheets (CIS),
                  Course Control Reports (CCR), continuous improvement dossiers, and faculty lecture files.
                </li>
                <li>
                  <strong>In-Place Revisions:</strong> Updating existing Drive files when a faculty member
                  re-generates a document after modifying form data, preserving previous version links.
                </li>
                <li>
                  <strong>Verification &amp; Preview:</strong> Generating secure web view links accessible to
                  HoDs and Deans during formal accreditation checks.
                </li>
              </ul>

              <h3 style={{ fontSize: 'var(--cfes-font-md)', color: 'var(--cfes-slate-900)', margin: '1rem 0 0.5rem' }}>
                C. Institutional Integration Architecture
              </h3>
              <p className="legal-text">
                The Google Drive connection is authorized once at an institutional level via the system
                administrator to link the portal with the university&apos;s designated destination folder.
                Individual faculty members are <strong>not</strong> required to provide personal Google OAuth
                credentials to synchronize course files.
              </p>

              <h3 style={{ fontSize: 'var(--cfes-font-md)', color: 'var(--cfes-slate-900)', margin: '1rem 0 0.5rem' }}>
                D. Token Encryption &amp; Protection
              </h3>
              <p className="legal-text">
                Google OAuth refresh tokens are encrypted at rest in MongoDB using authenticated
                <strong> AES-256-GCM</strong> cipher algorithms with scrypt-derived encryption keys. Plaintext
                refresh tokens are never returned to client browsers or exposed in application logs.
              </p>
            </section>

            {/* 5. How Information Is Used */}
            <section id="data-usage" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">5.</span> How Information Is Accessed &amp; Used
              </h2>
              <p className="legal-text">
                All data collected within CFES is strictly confined to internal academic operations:
              </p>
              <ul className="legal-list">
                <li>Managing curriculum compliance and semester course offerings.</li>
                <li>Verifying that all mandatory course documents (CIS, exam samples, reflections) are submitted before deadlines.</li>
                <li>Providing Heads of Department and Deans with real-time audit visibility into departmental course files.</li>
                <li>Fulfilling external higher education quality audits (e.g. HEC, NCEAC) through standardized document generation.</li>
              </ul>
              <p className="legal-text">
                <strong>No Commercial Use:</strong> We do not sell, rent, monetize, or use faculty or student
                data for commercial advertising or marketing of any kind.
              </p>
            </section>

            {/* 6. Storage & Retention */}
            <section id="storage-retention" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">6.</span> Data Storage &amp; Retention Practices
              </h2>
              <ul className="legal-list">
                <li>
                  <strong>Primary Database:</strong> Structured records, metadata, user profiles, and form
                  inputs are stored in a managed MongoDB Atlas environment with encrypted transport (TLS 1.2+)
                  and encrypted storage.
                </li>
                <li>
                  <strong>Document Storage:</strong> Binary document files (PDFs, DOCX, examination artifacts)
                  are stored within the authorized university Google Drive repository.
                </li>
                <li>
                  <strong>Retention Period:</strong> Course file records and assessment samples are retained
                  for the duration mandated by Iqra University academic regulations and national higher education
                  accreditation guidelines.
                </li>
                <li>
                  <strong>Data Disposal:</strong> Obsolete or deprecated records may be purged or archived by
                  authorized university database administrators upon formal request.
                </li>
              </ul>
            </section>

            {/* 7. Third-Party Sharing */}
            <section id="disclosure" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">7.</span> Third-Party Service Providers
              </h2>
              <p className="legal-text">
                Data is transferred only to third-party infrastructure providers supporting the portal&apos;s
                core hosting and storage operations:
              </p>
              <ul className="legal-list">
                <li><strong>Google Cloud APIs:</strong> For Google Drive document storage and folder organization.</li>
                <li><strong>MongoDB Atlas:</strong> For secure database hosting and encrypted token persistence.</li>
                <li><strong>Render / Cloud Hosting:</strong> For hosting backend application services over HTTPS.</li>
                <li><strong>Vercel:</strong> For serving the static frontend user interface.</li>
              </ul>
              <p className="legal-text">
                All service providers are bound by strict enterprise confidentiality and security standards.
              </p>
            </section>

            {/* 8. User Rights */}
            <section id="user-rights" className="legal-section">
              <h2 className="legal-section-title">
                <span className="legal-section-number">8.</span> Faculty &amp; User Rights
              </h2>
              <p className="legal-text">
                Faculty members and authorized users hold the following rights within the portal:
              </p>
              <ul className="legal-list">
                <li>Accessing and reviewing all academic documents generated under their assigned course offerings.</li>
                <li>Correcting, editing, and re-synchronizing course outline data prior to final administrative lock.</li>
                <li>Requesting password resets or account modifications through departmental administration.</li>
              </ul>
            </section>

            {/* 9. Contact Information */}
            <section id="contact" className="legal-section" style={{ marginBottom: 0 }}>
              <h2 className="legal-section-title">
                <span className="legal-section-number">9.</span> Contact Information
              </h2>
              <p className="legal-text">
                For inquiries regarding this Privacy Policy, data protection practices, or administrative
                audits, please contact the portal administration:
              </p>

              <div className="legal-contact-grid">
                <div className="legal-contact-card">
                  <h4>Academic Supervision</h4>
                  <p><strong>Dr. Israr Ali</strong></p>
                  <p>Head of Department (HoD), Computer Science</p>
                  <p>Iqra University, Main Campus</p>
                  <p style={{ marginTop: '0.25rem' }}>
                    Email: <code>israr.ali@iqra.edu.pk</code>
                  </p>
                </div>

                <div className="legal-contact-card">
                  <h4>Portal Administration</h4>
                  <p><strong>CFES Technical &amp; Database Team</strong></p>
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

export default PrivacyPolicy;

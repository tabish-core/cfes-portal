/**
 * legalPagesFrontend.test.js — Frontend unit & integration tests for Public Legal Pages.
 *
 * Verifies:
 *  1. Routing integrity:
 *     - /privacy-policy is publicly accessible (outside ProtectedRoute)
 *     - /terms is publicly accessible (outside ProtectedRoute)
 *  2. Privacy Policy content compliance:
 *     - Google OAuth scope (https://www.googleapis.com/auth/drive) is documented
 *     - Mandatory Google API Services User Data Policy / Limited Use clause is present
 *     - Automated hierarchy resolution (Semester -> Faculty -> Course) is explained
 *     - AES-256-GCM token encryption and bcrypt credential hashing are accurately described
 *     - Academic documents (CIS, CCR/CCP, exam papers, student samples, OBE) are detailed
 *     - Administrator review callout and institutional contacts are present
 *  3. Terms of Service content compliance:
 *     - Authorized usage by Faculty, HoD, and Dean is stated
 *     - Academic document accuracy and prohibition of falsification are defined
 *     - Google Drive appropriate use rules and folder tampering restrictions are included
 *     - Credential security and prohibited acts are covered
 *     - Administrator contact information is included
 *  4. Public Navigation Links:
 *     - Login page contains public links to /privacy-policy and /terms
 *     - Sidebar contains policy links for authenticated users
 *     - Both legal pages contain back-to-portal navigation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_JSX_PATH = path.resolve(__dirname, '../App.jsx');
const LOGIN_JSX_PATH = path.resolve(__dirname, '../pages/auth/Login.jsx');
const SIDEBAR_JSX_PATH = path.resolve(__dirname, '../components/layout/Sidebar.jsx');
const PRIVACY_JSX_PATH = path.resolve(__dirname, '../pages/public/PrivacyPolicy.jsx');
const TERMS_JSX_PATH = path.resolve(__dirname, '../pages/public/TermsOfService.jsx');
const LEGAL_CSS_PATH = path.resolve(__dirname, '../pages/public/LegalPages.css');

describe('Public Legal Pages & Google OAuth Verification Integration Tests', () => {
  describe('1. Routing Configuration in App.jsx', () => {
    const appContent = fs.readFileSync(APP_JSX_PATH, 'utf-8');

    test('imports PrivacyPolicy and TermsOfService components', () => {
      assert.ok(
        appContent.includes("import PrivacyPolicy from './pages/public/PrivacyPolicy';"),
        'App.jsx must import PrivacyPolicy from ./pages/public/PrivacyPolicy'
      );
      assert.ok(
        appContent.includes("import TermsOfService from './pages/public/TermsOfService';"),
        'App.jsx must import TermsOfService from ./pages/public/TermsOfService'
      );
    });

    test('registers /privacy-policy route as a public unauthenticated route', () => {
      assert.ok(
        appContent.includes('<Route path="/privacy-policy" element={<PrivacyPolicy />} />'),
        'App.jsx must register Route path="/privacy-policy"'
      );
      // Ensure it is before ProtectedRoute blocks
      const protectedIndex = appContent.indexOf('<Route element={<ProtectedRoute />}>');
      const privacyIndex = appContent.indexOf('path="/privacy-policy"');
      assert.ok(
        privacyIndex > 0 && privacyIndex < protectedIndex,
        '/privacy-policy must be declared before any ProtectedRoute to ensure public access'
      );
    });

    test('registers /terms route as a public unauthenticated route', () => {
      assert.ok(
        appContent.includes('<Route path="/terms" element={<TermsOfService />} />'),
        'App.jsx must register Route path="/terms"'
      );
      const protectedIndex = appContent.indexOf('<Route element={<ProtectedRoute />}>');
      const termsIndex = appContent.indexOf('path="/terms"');
      assert.ok(
        termsIndex > 0 && termsIndex < protectedIndex,
        '/terms must be declared before any ProtectedRoute to ensure public access'
      );
    });
  });

  describe('2. Privacy Policy Page Content & Regulatory Compliance', () => {
    const privacyContent = fs.readFileSync(PRIVACY_JSX_PATH, 'utf-8');

    test('includes the mandatory Google API Services User Data Policy / Limited Use statement', () => {
      assert.ok(
        privacyContent.includes('Google API Services User Data Policy'),
        'Must cite the Google API Services User Data Policy'
      );
      assert.ok(
        privacyContent.includes('Limited Use requirements'),
        'Must explicitly state adherence to Limited Use requirements'
      );
    });

    test('explicitly documents the requested Google Drive OAuth scope', () => {
      assert.ok(
        privacyContent.includes('https://www.googleapis.com/auth/drive'),
        'Must specify the https://www.googleapis.com/auth/drive scope'
      );
    });

    test('explains automated folder hierarchy and operational purpose', () => {
      assert.ok(
        privacyContent.includes('Semester &rarr; Faculty &rarr; Course Offering &rarr; Category') ||
        privacyContent.includes('Semester') && privacyContent.includes('Faculty') && privacyContent.includes('Course Offering'),
        'Must explain the Semester -> Faculty -> Course Offering folder hierarchy'
      );
      assert.ok(
        privacyContent.includes('Course Information Sheets (CIS)'),
        'Must mention CIS documents'
      );
    });

    test('describes cryptographic security practices (AES-256-GCM and bcrypt)', () => {
      assert.ok(
        privacyContent.includes('AES-256-GCM'),
        'Must detail AES-256-GCM token encryption at rest'
      );
      assert.ok(
        privacyContent.includes('bcrypt'),
        'Must detail bcrypt password hashing'
      );
    });

    test('covers data categories: user profiles, academic metadata, assessment samples, and OBE', () => {
      assert.ok(privacyContent.includes('User Profile'), 'Must list User Profile category');
      assert.ok(privacyContent.includes('Academic Course Metadata'), 'Must list Course Metadata');
      assert.ok(privacyContent.includes('Outcome-Based Education (OBE)'), 'Must list OBE category');
      assert.ok(privacyContent.includes('student answer copies'), 'Must mention assessment sample copies');
    });

    test('includes administrator review notice and contact details', () => {
      assert.ok(
        privacyContent.includes('Institutional &amp; Administrator Review Notice') ||
        privacyContent.includes('Administrator Review Notice'),
        'Must include administrator review callout'
      );
      assert.ok(
        privacyContent.includes('Dr. Israr Ali'),
        'Must cite academic supervisor Dr. Israr Ali'
      );
      assert.ok(
        privacyContent.includes('israr.ali@iqra.edu.pk'),
        'Must list departmental contact email'
      );
    });
  });

  describe('3. Terms of Service Page Content & Academic Rules', () => {
    const termsContent = fs.readFileSync(TERMS_JSX_PATH, 'utf-8');

    test('defines authorized roles (Faculty, HoD, Dean)', () => {
      assert.ok(termsContent.includes('Faculty Members:'), 'Must specify Faculty role');
      assert.ok(termsContent.includes('Heads of Department (HoD):'), 'Must specify HoD role');
      assert.ok(termsContent.includes('Deans &amp; Academic Administrators:'), 'Must specify Dean role');
    });

    test('enforces academic document accuracy and prohibits falsification', () => {
      assert.ok(
        termsContent.includes('Academic Document Accuracy &amp; Integrity'),
        'Must have section on Document Accuracy'
      );
      assert.ok(
        termsContent.includes('Prohibition of Falsification:'),
        'Must prohibit falsification of marks or curriculum coverage'
      );
    });

    test('defines Google Drive acceptable use and prohibits folder hierarchy tampering', () => {
      assert.ok(
        termsContent.includes('Appropriate Use of Google Drive Integration'),
        'Must include section on Google Drive usage'
      );
      assert.ok(
        termsContent.includes('No External Hierarchy Tampering:'),
        'Must prohibit external folder renaming, deletion, or detaching'
      );
    });

    test('prohibits security bypass, unauthorized access, and malicious uploads', () => {
      assert.ok(
        termsContent.includes('Prohibited Activities &amp; System Misuse'),
        'Must include Prohibited Activities section'
      );
      assert.ok(
        termsContent.includes('viruses, malware, trojans'),
        'Must prohibit malicious file uploads'
      );
    });

    test('includes administrator notice and departmental contact details', () => {
      assert.ok(
        termsContent.includes('Institutional Review Notice'),
        'Must include administrator notice'
      );
      assert.ok(
        termsContent.includes('Dr. Israr Ali'),
        'Must cite academic supervisor Dr. Israr Ali'
      );
    });
  });

  describe('4. Navigation & Cross-Linking Integrity', () => {
    const loginContent = fs.readFileSync(LOGIN_JSX_PATH, 'utf-8');
    const sidebarContent = fs.readFileSync(SIDEBAR_JSX_PATH, 'utf-8');
    const privacyContent = fs.readFileSync(PRIVACY_JSX_PATH, 'utf-8');
    const termsContent = fs.readFileSync(TERMS_JSX_PATH, 'utf-8');

    test('Login page links to both /privacy-policy and /terms with discreet styling', () => {
      assert.ok(
        loginContent.includes('to="/privacy-policy"'),
        'Login.jsx must link to /privacy-policy'
      );
      assert.ok(
        loginContent.includes('to="/terms"'),
        'Login.jsx must link to /terms'
      );
      assert.ok(
        loginContent.includes('login-legal-link--secondary'),
        'Terms of Service link must have secondary styling'
      );
    });

    test('Sidebar does NOT contain legal links (discreet presentation requirement)', () => {
      assert.strictEqual(
        sidebarContent.includes('to="/privacy-policy"'),
        false,
        'Sidebar.jsx must NOT include a link to /privacy-policy'
      );
      assert.strictEqual(
        sidebarContent.includes('to="/terms"'),
        false,
        'Sidebar.jsx must NOT include a link to /terms'
      );
    });

    test('Privacy Policy links to Terms of Service and Back to Portal', () => {
      assert.ok(
        privacyContent.includes('to="/terms"'),
        'PrivacyPolicy.jsx must link to /terms'
      );
      assert.ok(
        privacyContent.includes('to="/login"'),
        'PrivacyPolicy.jsx must link back to /login'
      );
    });

    test('Terms of Service links to Privacy Policy and Back to Portal', () => {
      assert.ok(
        termsContent.includes('to="/privacy-policy"'),
        'TermsOfService.jsx must link to /privacy-policy'
      );
      assert.ok(
        termsContent.includes('to="/login"'),
        'TermsOfService.jsx must link back to /login'
      );
    });
  });

  describe('5. CSS Design System & Responsive Styling', () => {
    const cssContent = fs.readFileSync(LEGAL_CSS_PATH, 'utf-8');

    test('utilizes CFES design system tokens', () => {
      assert.ok(cssContent.includes('--cfes-navy-800'), 'Must use --cfes-navy-800 token');
      assert.ok(cssContent.includes('--cfes-slate-50'), 'Must use --cfes-slate-50 token');
      assert.ok(cssContent.includes('--cfes-font-sans'), 'Must use --cfes-font-sans token');
      assert.ok(cssContent.includes('--cfes-radius-lg'), 'Must use --cfes-radius-lg token');
    });

    test('includes responsive media queries for tablet and mobile', () => {
      assert.ok(cssContent.includes('@media (max-width: 900px)'), 'Must include 900px breakpoint');
      assert.ok(cssContent.includes('@media (max-width: 600px)'), 'Must include 600px breakpoint');
    });

    test('includes print stylesheet for administrative audits', () => {
      assert.ok(cssContent.includes('@media print'), 'Must include @media print block');
    });
  });
});

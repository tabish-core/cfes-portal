/**
 * courseFormNavigation.test.js — Regression and unit tests for Course Forms
 * navigation, breadcrumb hierarchy, URL resolution, and Weekly Plan (WP)
 * redirection to the canonical Course Information Sheet (CIS).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveChecklistUrl,
  resolveTemplatesUrl,
  resolveFormTitle,
  FORM_TITLES,
  FORM_TEMPLATES,
  resolveTemplateLink,
  resolveWpRedirectUrl,
  buildFormBreadcrumbs,
} from '../services/courseNavigation.service.js';

describe('1. CourseForm URL Resolution & Safety Guards', () => {
  test('returns offering-scoped checklist URL when valid offeringId is provided', () => {
    const url = resolveChecklistUrl('offering-123', 'course-456');
    assert.strictEqual(url, '/faculty/offering/offering-123');
  });

  test('returns legacy course-scoped checklist URL when only courseId is provided', () => {
    const url = resolveChecklistUrl(null, 'course-456');
    assert.strictEqual(url, '/faculty/course/course-456');
  });

  test('never generates URLs with literal "undefined" string for offeringId', () => {
    const url = resolveChecklistUrl('undefined', 'course-456');
    assert.strictEqual(url, '/faculty/course/course-456');
    assert.ok(!url.includes('undefined'));
  });

  test('never generates URLs with literal "null" string for offeringId', () => {
    const url = resolveChecklistUrl('null', 'course-456');
    assert.strictEqual(url, '/faculty/course/course-456');
    assert.ok(!url.includes('null'));
  });

  test('safely falls back to /faculty/dashboard when both identifiers are missing or invalid', () => {
    assert.strictEqual(resolveChecklistUrl(undefined, undefined), '/faculty/dashboard');
    assert.strictEqual(resolveChecklistUrl('undefined', 'undefined'), '/faculty/dashboard');
    assert.strictEqual(resolveChecklistUrl('null', 'null'), '/faculty/dashboard');
    assert.strictEqual(resolveChecklistUrl(null, null), '/faculty/dashboard');
  });

  test('returns offering-scoped templates URL when valid offeringId is provided', () => {
    const url = resolveTemplatesUrl('offering-789', 'course-abc');
    assert.strictEqual(url, '/faculty/offering/offering-789/templates');
  });

  test('returns legacy course-scoped templates URL when only courseId is provided', () => {
    const url = resolveTemplatesUrl(null, 'course-abc');
    assert.strictEqual(url, '/faculty/course/course-abc/templates');
  });

  test('templates URL never outputs "undefined" or "null" in path', () => {
    const urlUndef = resolveTemplatesUrl('undefined', 'course-abc');
    assert.strictEqual(urlUndef, '/faculty/course/course-abc/templates');

    const urlNull = resolveTemplatesUrl('null', 'null');
    assert.strictEqual(urlNull, '/faculty/dashboard');
  });
});

describe('2. Form Title Resolution for Breadcrumbs and Shell', () => {
  test('maps CIS to "Course Information Sheet"', () => {
    assert.strictEqual(resolveFormTitle('CIS'), 'Course Information Sheet');
  });

  test('maps CCR to "Course Control Report"', () => {
    assert.strictEqual(resolveFormTitle('CCR'), 'Course Control Report');
  });

  test('maps TIMETABLE to "Timetable & Consulting Hours"', () => {
    assert.strictEqual(resolveFormTitle('TIMETABLE'), 'Timetable & Consulting Hours');
  });

  test('maps AR to "Attendance Record"', () => {
    assert.strictEqual(resolveFormTitle('AR'), 'Attendance Record');
  });

  test('maps WP to "Weekly Plan"', () => {
    assert.strictEqual(resolveFormTitle('WP'), 'Weekly Plan');
  });

  test('maps CCC to "Course Completion Certificate"', () => {
    assert.strictEqual(resolveFormTitle('CCC'), 'Course Completion Certificate');
  });

  test('maps CRR to "Course Review Report (Theory)"', () => {
    assert.strictEqual(resolveFormTitle('CRR'), 'Course Review Report (Theory)');
  });

  test('falls back to raw formType or "Course Form" when unknown', () => {
    assert.strictEqual(resolveFormTitle('CUSTOM_FORM'), 'CUSTOM_FORM');
    assert.strictEqual(resolveFormTitle(null), 'Course Form');
    assert.strictEqual(resolveFormTitle(''), 'Course Form');
  });
});

describe('3. Weekly Plan (WP) Redirection & Scoping Integrity', () => {
  test('WP route redirects to canonical CIS with #weekly-plan anchor in offering scope', () => {
    const target = resolveWpRedirectUrl('offering-555', 'course-999');
    assert.strictEqual(target, '/offering/offering-555/form/CIS#weekly-plan');
    assert.ok(target.includes('CIS#weekly-plan'));
    assert.ok(target.includes('offering-555'));
  });

  test('WP route redirects to legacy course CIS with #weekly-plan anchor when only courseId exists', () => {
    const target = resolveWpRedirectUrl(null, 'course-999');
    assert.strictEqual(target, '/course/course-999/form/CIS#weekly-plan');
  });

  test('WP route safely falls back to dashboard if neither offering nor course exists', () => {
    const target = resolveWpRedirectUrl(undefined, undefined);
    assert.strictEqual(target, '/faculty/dashboard');
  });

  test('WP target NEVER outputs literal "undefined" in URL', () => {
    const target = resolveWpRedirectUrl('undefined', 'course-123');
    assert.strictEqual(target, '/course/course-123/form/CIS#weekly-plan');
    assert.ok(!target.includes('undefined'));
  });
});

describe('4. CourseTemplates Navigation & Form Links', () => {
  test('FORM_TEMPLATES includes all standard forms without omitting WP', () => {
    const formTypes = FORM_TEMPLATES.map((f) => f.formType);
    assert.ok(formTypes.includes('CIS'));
    assert.ok(formTypes.includes('WP'));
    assert.ok(formTypes.includes('CCR'));
    assert.ok(formTypes.includes('TIMETABLE'));
    assert.ok(formTypes.includes('AR'));
    assert.ok(formTypes.includes('LECTURES'));
    assert.ok(formTypes.includes('CCC'));
    assert.ok(formTypes.includes('CRR'));
  });

  test('WP template correctly routes to CIS#weekly-plan under offering scope', () => {
    const wpTemplate = FORM_TEMPLATES.find((f) => f.formType === 'WP');
    assert.ok(wpTemplate);
    assert.strictEqual(wpTemplate.targetFormType, 'CIS');
    assert.strictEqual(wpTemplate.hash, '#weekly-plan');

    const link = resolveTemplateLink(wpTemplate, 'offering-abc', 'course-xyz');
    assert.strictEqual(link, '/offering/offering-abc/form/CIS#weekly-plan');
  });

  test('standard CIS template routes to standard /form/CIS without hash', () => {
    const cisTemplate = FORM_TEMPLATES.find((f) => f.formType === 'CIS');
    const link = resolveTemplateLink(cisTemplate, 'offering-abc', 'course-xyz');
    assert.strictEqual(link, '/offering/offering-abc/form/CIS');
  });

  test('CCR template routes to /offering/:id/form/CCR', () => {
    const ccrTemplate = FORM_TEMPLATES.find((f) => f.formType === 'CCR');
    const link = resolveTemplateLink(ccrTemplate, 'offering-abc', 'course-xyz');
    assert.strictEqual(link, '/offering/offering-abc/form/CCR');
  });

  test('Back link in templates returns to offering checklist when offeringId is provided', () => {
    const backUrl = resolveChecklistUrl('offering-abc', 'course-xyz');
    assert.strictEqual(backUrl, '/faculty/offering/offering-abc');
  });

  test('Back link in templates returns to legacy course checklist when only courseId is provided', () => {
    const backUrl = resolveChecklistUrl(null, 'course-xyz');
    assert.strictEqual(backUrl, '/faculty/course/course-xyz');
  });

  test('Back link never produces undefined or null URLs', () => {
    assert.strictEqual(resolveChecklistUrl('undefined', 'undefined'), '/faculty/dashboard');
    assert.strictEqual(resolveChecklistUrl(null, null), '/faculty/dashboard');
  });
});

describe('5. Breadcrumb Hierarchy Verification', () => {
  test('generates 3-step hierarchy: Checklist -> Forms -> Current Form', () => {
    const crumbs = buildFormBreadcrumbs('offering-001', 'course-001', 'CIS');
    assert.strictEqual(crumbs.length, 3);
    assert.strictEqual(crumbs[0].label, 'Course Checklist');
    assert.strictEqual(crumbs[0].url, '/faculty/offering/offering-001');
    assert.strictEqual(crumbs[1].label, 'Course Forms');
    assert.strictEqual(crumbs[1].url, '/faculty/offering/offering-001/templates');
    assert.strictEqual(crumbs[2].label, 'Course Information Sheet');
    assert.strictEqual(crumbs[2].isCurrent, true);
  });

  test('preserves legacy courseId across all breadcrumb destinations', () => {
    const crumbs = buildFormBreadcrumbs(null, 'course-legacy', 'TIMETABLE');
    assert.strictEqual(crumbs[0].url, '/faculty/course/course-legacy');
    assert.strictEqual(crumbs[1].url, '/faculty/course/course-legacy/templates');
    assert.strictEqual(crumbs[2].label, 'Timetable & Consulting Hours');
  });
});

describe('6. CIS Weekly Plan State & Save Payload Integrity', () => {
  // Simulates CIS handleSubmit payload structure
  const buildCISPayload = ({ courseSummary, basicInfo, objectives, contents, cloData, textbooks, obaData, weeklyPlan, grading }) => {
    return {
      courseSummary,
      basicInfo,
      objectives,
      contents,
      cloTable: cloData,
      textbooks,
      obaTable: obaData,
      weeklyPlan,
      gradingPolicy: grading,
    };
  };

  test('preserves entire CIS document structure with weeklyPlan array', () => {
    const sampleWeeklyPlan = [
      { week: '1', lectureNo: '1', topicCovered: 'Introduction to Algorithms', clo: 'CLO-1', assessmentTool: 'Quiz 1' },
      { week: '8', isSpecialRow: true, specialRowText: 'Midterm Exam' }
    ];

    const payload = buildCISPayload({
      courseSummary: { courseCode: 'CS201', courseName: 'Data Structures' },
      basicInfo: { instructor: 'Dr. Test' },
      objectives: 'Understand structures',
      contents: 'Trees, Graphs',
      cloData: [{ cloNumber: 'CLO-1' }],
      textbooks: [{ bookTitle: 'Cormen' }],
      obaData: [],
      weeklyPlan: sampleWeeklyPlan,
      grading: { quizzes: '10', midterm: '30' }
    });

    assert.strictEqual(payload.weeklyPlan.length, 2);
    assert.strictEqual(payload.weeklyPlan[0].topicCovered, 'Introduction to Algorithms');
    assert.strictEqual(payload.courseSummary.courseCode, 'CS201');
    assert.strictEqual(payload.gradingPolicy.midterm, '30');
  });
});

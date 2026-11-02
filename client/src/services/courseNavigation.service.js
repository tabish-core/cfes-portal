/**
 * courseNavigation.service.js — Shared course form navigation utilities,
 * breadcrumbs hierarchy, URL guards, and template mappings.
 */

export const FORM_TITLES = {
  CIS: 'Course Information Sheet',
  WP: 'Weekly Plan',
  CCR: 'Course Control Report',
  TIMETABLE: 'Timetable & Consulting Hours',
  AR: 'Attendance Record',
  LECTURES: 'Lectures',
  CCC: 'Course Completion Certificate',
  CRR: 'Course Review Report (Theory)',
  ASSESS_QUIZ: 'Quizzes',
  ASSESS_ASSIGN: 'Assignments',
  ASSESS_MID: 'Midterm Exam Documents',
  ASSESS_FINAL: 'Final Exam Documents',
  ASSESS_PROJECT: 'CCP / Class Project',
};

export const resolveFormTitle = (formType) => {
  return FORM_TITLES[formType] || formType || 'Course Form';
};

export const FORM_TEMPLATES = [
  {
    name: 'Course Information Sheet',
    formType: 'CIS',
    description: 'Official course outline, objectives, CLO mappings, textbooks, and grading policy.'
  },
  {
    name: 'Weekly Plan',
    formType: 'WP',
    targetFormType: 'CIS',
    hash: '#weekly-plan',
    tag: 'Part of CIS',
    description: 'Weekly lecture breakdown, topics covered, and activity schedule.'
  },
  {
    name: 'Course Control Report',
    formType: 'CCR',
    description: 'Weekly lecture delivery tracking, topics covered, and student counseling logs.'
  },
  {
    name: 'Timetable with consulting hours',
    formType: 'TIMETABLE',
    description: 'Weekly teaching schedule and designated student consultation / counseling hours.'
  },
  {
    name: 'Attendance Record',
    formType: 'AR',
    description: 'Semester attendance verification sheet and external LMS portal access.'
  },
  {
    name: 'Lectures',
    formType: 'LECTURES',
    description: 'Course lecture slides, handouts, and weekly reference materials.'
  },
  {
    name: 'Course Completion Certificate',
    formType: 'CCC',
    description: 'Faculty end-of-semester certification of syllabus completion.'
  },
  {
    name: 'Course Review Report (Theory Courses)',
    formType: 'CRR',
    description: 'Comprehensive theory course review, CLO assessment data, and CQI improvements.'
  }
];

/**
 * Returns a valid checklist URL ensuring no undefined or null route segments.
 */
export const resolveChecklistUrl = (offeringId, courseId) => {
  const validOffering = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
  if (validOffering) return `/faculty/offering/${validOffering}`;

  const validCourse = courseId && courseId !== 'undefined' && courseId !== 'null' ? courseId : null;
  if (validCourse) return `/faculty/course/${validCourse}`;

  return '/faculty/dashboard';
};

/**
 * Returns a valid templates/forms selection URL.
 */
export const resolveTemplatesUrl = (offeringId, courseId) => {
  const validOffering = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
  if (validOffering) return `/faculty/offering/${validOffering}/templates`;

  const validCourse = courseId && courseId !== 'undefined' && courseId !== 'null' ? courseId : null;
  if (validCourse) return `/faculty/course/${validCourse}/templates`;

  return '/faculty/dashboard';
};

/**
 * Resolves destination link for a template card item.
 */
export const resolveTemplateLink = (form, offeringId, courseId) => {
  const validOffering = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
  const validCourse = courseId && courseId !== 'undefined' && courseId !== 'null' ? courseId : null;
  const targetType = form.targetFormType || form.formType;
  const hash = form.hash || '';

  if (validOffering) {
    return `/offering/${validOffering}/form/${targetType}${hash}`;
  }
  if (validCourse) {
    return `/course/${validCourse}/form/${targetType}${hash}`;
  }
  return '/faculty/dashboard';
};

/**
 * Resolves redirection URL for Weekly Plan (WP) to the canonical CIS form.
 */
export const resolveWpRedirectUrl = (offeringId, courseId) => {
  const validOffering = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
  const validCourse = courseId && courseId !== 'undefined' && courseId !== 'null' ? courseId : null;

  if (validOffering) {
    return `/offering/${validOffering}/form/CIS#weekly-plan`;
  }
  if (validCourse) {
    return `/course/${validCourse}/form/CIS#weekly-plan`;
  }
  return '/faculty/dashboard';
};

/**
 * Constructs structured breadcrumb objects for Course Form navigation.
 */
export const buildFormBreadcrumbs = (offeringId, courseId, formType) => {
  const checklistUrl = resolveChecklistUrl(offeringId, courseId);
  const templatesUrl = resolveTemplatesUrl(offeringId, courseId);
  const currentTitle = resolveFormTitle(formType);

  return [
    { label: 'Course Checklist', url: checklistUrl },
    { label: 'Course Forms', url: templatesUrl },
    { label: currentTitle, isCurrent: true },
  ];
};

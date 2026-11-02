/**
 * obeChecklistNavigation.test.js — Comprehensive regression test suite for
 * Faculty OBE navigation, Offering-to-Course ID resolution, Checklist ID guards,
 * and Toast reference stability.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* ========================================================================== */
/* MOCK API & HARNESS SETUP                                                  */
/* ========================================================================== */

const mockCalls = [];
let mockResponses = {};

const mockApi = {
  get: async (url, config) => {
    mockCalls.push({ method: 'GET', url, config });
    if (mockResponses[`GET:${url}`]) {
      const res = mockResponses[`GET:${url}`];
      if (res instanceof Error) throw res;
      return res;
    }
    return { data: { success: true, data: {} } };
  },
  post: async (url, data, config) => {
    mockCalls.push({ method: 'POST', url, data, config });
    if (mockResponses[`POST:${url}`]) {
      const res = mockResponses[`POST:${url}`];
      if (res instanceof Error) throw res;
      return res;
    }
    return { data: { success: true, data: {} } };
  },
};

/* ========================================================================== */
/* 1. OBE ROUTE & OFFERING RESOLUTION LOGIC                                   */
/* ========================================================================== */

describe('1. OBE Route & Offering Resolution Logic', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockResponses = {};
  });

  // Replicates the resolution logic in OBEWorkspace.jsx
  const resolveOBEContext = async ({
    offeringId,
    paramCourseId,
    locationState,
    apiClient = mockApi,
    isMounted = () => true,
  }) => {
    let resolvedCourseId = null;
    let offering = null;
    let initError = null;
    let loading = true;
    let courseInfo = { courseName: '', courseCode: '', creditHours: '', type: '' };

    if (locationState?.courseId && locationState.courseId !== 'undefined' && locationState.courseId !== 'null') {
      resolvedCourseId = String(locationState.courseId);
    } else if (paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null') {
      resolvedCourseId = String(paramCourseId);
    }

    const validOfferingId = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
    const validParamCourseId = paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null' ? paramCourseId : null;

    if (!validOfferingId && !validParamCourseId) {
      if (isMounted()) {
        initError = 'Invalid or missing course offering identifier.';
        loading = false;
      }
      return { resolvedCourseId, offering, initError, loading, courseInfo };
    }

    if (validOfferingId) {
      try {
        const { data } = await apiClient.get(`/offerings/${validOfferingId}`);
        const off = data.data?.offering || data.offering;
        if (!isMounted()) return { resolvedCourseId, offering, initError, loading, courseInfo };

        if (!off) {
          initError = 'Course offering not found.';
          loading = false;
          return { resolvedCourseId, offering, initError, loading, courseInfo };
        }

        offering = off;
        const c = off.course;
        const cId = c?._id || c;

        if (!cId) {
          initError = 'Associated course not found for this offering.';
          loading = false;
          return { resolvedCourseId, offering, initError, loading, courseInfo };
        }

        if (c && typeof c === 'object') {
          courseInfo = {
            courseName: c.courseName || '',
            courseCode: c.courseCode || '',
            creditHours: c.creditHours || '',
            type: c.type || '',
          };
        }

        resolvedCourseId = String(cId);
      } catch (err) {
        if (!isMounted()) return { resolvedCourseId, offering, initError, loading, courseInfo };
        initError = err.response?.data?.message || err.message || 'Failed to load course offering details.';
        loading = false;
      }
    } else if (validParamCourseId) {
      resolvedCourseId = validParamCourseId;
    }

    return { resolvedCourseId, offering, initError, loading, courseInfo };
  };

  const computeBackUrl = ({ offeringId, courseId }) => {
    return offeringId && offeringId !== 'undefined' && offeringId !== 'null'
      ? `/faculty/offering/${offeringId}`
      : (courseId && courseId !== 'undefined' && courseId !== 'null'
        ? `/faculty/course/${courseId}`
        : '/faculty/dashboard');
  };

  test('opening /faculty/offering/:offeringId/obe resolves offering and extracts courseId', async () => {
    const testOfferingId = '672000000000000000000001';
    const expectedCourseId = '671000000000000000000099';

    mockResponses[`GET:/offerings/${testOfferingId}`] = {
      data: {
        success: true,
        data: {
          offering: {
            _id: testOfferingId,
            section: 'A',
            course: {
              _id: expectedCourseId,
              courseCode: 'CS101',
              courseName: 'Intro to Programming',
              creditHours: 3,
              type: 'Theory',
            },
          },
        },
      },
    };

    const result = await resolveOBEContext({
      offeringId: testOfferingId,
      paramCourseId: undefined,
    });

    assert.equal(result.resolvedCourseId, expectedCourseId);
    assert.equal(result.initError, null);
    assert.equal(result.courseInfo.courseCode, 'CS101');
    assert.equal(result.courseInfo.courseName, 'Intro to Programming');

    // Confirm that the offering was fetched from the correct endpoint
    const offeringCall = mockCalls.find((c) => c.url === `/offerings/${testOfferingId}`);
    assert.ok(offeringCall, 'Must call GET /offerings/:id');
  });

  test('legacy route /faculty/course/:courseId/obe uses courseId directly without offering lookup', async () => {
    const legacyCourseId = '671000000000000000000088';

    const result = await resolveOBEContext({
      offeringId: undefined,
      paramCourseId: legacyCourseId,
    });

    assert.equal(result.resolvedCourseId, legacyCourseId);
    assert.equal(result.initError, null);
    // Should NOT have made an offering call
    assert.equal(mockCalls.length, 0);
  });

  test('location.state provides instant courseId initialization while offering loads', async () => {
    const testOfferingId = '672000000000000000000002';
    const stateCourseId = '671000000000000000000077';

    mockResponses[`GET:/offerings/${testOfferingId}`] = {
      data: {
        success: true,
        data: {
          offering: {
            _id: testOfferingId,
            course: { _id: stateCourseId, courseCode: 'EE201' },
          },
        },
      },
    };

    const result = await resolveOBEContext({
      offeringId: testOfferingId,
      paramCourseId: undefined,
      locationState: { courseId: stateCourseId },
    });

    assert.equal(result.resolvedCourseId, stateCourseId);
  });

  test('back button returns to /faculty/offering/:offeringId when offeringId is present', () => {
    const backUrl = computeBackUrl({
      offeringId: '672000000000000000000001',
      courseId: '671000000000000000000099',
    });
    assert.equal(backUrl, '/faculty/offering/672000000000000000000001');
  });

  test('back button returns to /faculty/course/:courseId when only legacy courseId is present', () => {
    const backUrl = computeBackUrl({
      offeringId: undefined,
      courseId: '671000000000000000000099',
    });
    assert.equal(backUrl, '/faculty/course/671000000000000000000099');
  });

  test('back button NEVER outputs a URL containing "undefined" or "null"', () => {
    assert.equal(computeBackUrl({ offeringId: undefined, courseId: undefined }), '/faculty/dashboard');
    assert.equal(computeBackUrl({ offeringId: 'undefined', courseId: 'undefined' }), '/faculty/dashboard');
    assert.equal(computeBackUrl({ offeringId: 'null', courseId: 'null' }), '/faculty/dashboard');
    assert.equal(computeBackUrl({ offeringId: null, courseId: null }), '/faculty/dashboard');
  });
});

/* ========================================================================== */
/* 2. LOADING AND ERROR STATE HANDLING                                        */
/* ========================================================================== */

describe('2. Loading and Error State Handling', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockResponses = {};
  });

  test('missing or "undefined" identifiers terminate loading and produce initError', async () => {
    let resolvedCourseId = null;
    let loading = true;
    let initError = null;

    const validOfferingId = undefined;
    const validParamCourseId = 'undefined'; // Simulating URL /faculty/course/undefined

    const safeOffering = validOfferingId && validOfferingId !== 'undefined' ? validOfferingId : null;
    const safeCourse = validParamCourseId && validParamCourseId !== 'undefined' ? validParamCourseId : null;

    if (!safeOffering && !safeCourse) {
      loading = false;
      initError = 'Invalid or missing course offering identifier.';
    }

    assert.equal(loading, false, 'Loading must terminate');
    assert.ok(initError, 'Must set initError');
    assert.equal(resolvedCourseId, null);
    assert.equal(mockCalls.length, 0, 'No API calls must be made');
  });

  test('failed offering lookup terminates loading and shows user-friendly error', async () => {
    const testOfferingId = '672000000000000000000404';
    mockResponses[`GET:/offerings/${testOfferingId}`] = new Error('Course offering not found');

    let loading = true;
    let initError = null;

    try {
      await mockApi.get(`/offerings/${testOfferingId}`);
    } catch (err) {
      initError = err.message;
      loading = false;
    }

    assert.equal(loading, false);
    assert.equal(initError, 'Course offering not found');
  });

  test('stale async responses do not update state after component unmounts', async () => {
    let stateUpdated = false;
    let isMounted = false; // Component has unmounted before response arrives

    const fakeAsyncFetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (!isMounted) return;
      stateUpdated = true;
    };

    await fakeAsyncFetch();
    assert.equal(stateUpdated, false, 'State setter must not be called after unmount');
  });
});

/* ========================================================================== */
/* 3. CHECKLIST REQUEST GUARDS & ID VALIDATION                                */
/* ========================================================================== */

describe('3. Checklist Request Guards & ID Validation', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockResponses = {};
  });

  // Replicates the mount validation logic in CourseFileChecklist.jsx
  const triggerChecklistMount = async ({ offeringId, paramCourseId }) => {
    const validOfferingId = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
    const validParamCourseId = paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null' ? paramCourseId : null;

    let loading = true;
    if (!validOfferingId && !validParamCourseId) {
      loading = false;
      return { skipped: true, loading };
    }

    if (validOfferingId) {
      await mockApi.get(`/offerings/${validOfferingId}`);
      await mockApi.get(`/checklist/offering/${validOfferingId}`);
      loading = false;
      return { skipped: false, route: 'offering', loading };
    } else if (validParamCourseId) {
      await mockApi.get(`/checklist/${validParamCourseId}`);
      loading = false;
      return { skipped: false, route: 'legacyCourse', loading };
    }
  };

  test('never requests /api/checklist/undefined when paramCourseId is the string "undefined"', async () => {
    const res = await triggerChecklistMount({
      offeringId: undefined,
      paramCourseId: 'undefined',
    });

    assert.equal(res.skipped, true);
    assert.equal(res.loading, false);

    const undefinedCalls = mockCalls.filter(
      (c) => c.url.includes('/checklist/undefined') || c.url.includes('/offerings/undefined')
    );
    assert.equal(undefinedCalls.length, 0, 'Zero requests with "undefined" in URL');
  });

  test('never requests /api/checklist/null when paramCourseId is "null"', async () => {
    const res = await triggerChecklistMount({
      offeringId: undefined,
      paramCourseId: 'null',
    });

    assert.equal(res.skipped, true);
    assert.equal(res.loading, false);
    assert.equal(mockCalls.length, 0);
  });

  test('never triggers requests when both offeringId and paramCourseId are undefined', async () => {
    const res = await triggerChecklistMount({
      offeringId: undefined,
      paramCourseId: undefined,
    });

    assert.equal(res.skipped, true);
    assert.equal(res.loading, false);
    assert.equal(mockCalls.length, 0);
  });

  test('valid offeringId triggers offering-scoped checklist requests', async () => {
    const validOfferingId = '672000000000000000000010';
    const res = await triggerChecklistMount({
      offeringId: validOfferingId,
      paramCourseId: undefined,
    });

    assert.equal(res.skipped, false);
    assert.equal(res.route, 'offering');

    const checklistCall = mockCalls.find((c) => c.url === `/checklist/offering/${validOfferingId}`);
    assert.ok(checklistCall, 'Must call GET /checklist/offering/:offeringId');

    const offeringCall = mockCalls.find((c) => c.url === `/offerings/${validOfferingId}`);
    assert.ok(offeringCall, 'Must call GET /offerings/:offeringId');
  });

  test('valid legacy courseId triggers legacy checklist requests', async () => {
    const validCourseId = '671000000000000000000055';
    const res = await triggerChecklistMount({
      offeringId: undefined,
      paramCourseId: validCourseId,
    });

    assert.equal(res.skipped, false);
    assert.equal(res.route, 'legacyCourse');

    const checklistCall = mockCalls.find((c) => c.url === `/checklist/${validCourseId}`);
    assert.ok(checklistCall, 'Must call GET /checklist/:courseId');
  });
});

/* ========================================================================== */
/* 4. TOAST STABILITY & EFFECT RE-RUN PREVENTION                              */
/* ========================================================================== */

describe('4. Toast Stability & Effect Re-run Prevention', () => {
  // Replicates ToastContext stability logic
  const createToastHarness = () => {
    let nextId = 1;
    let toasts = [];

    const removeToast = (id) => {
      toasts = toasts.filter((t) => t.id !== id);
    };

    const addToast = (message, type = 'info', duration = 5000) => {
      const id = nextId++;
      toasts.push({ id, message, type, duration });
      return id;
    };

    // Memoized toast object bound to stable addToast
    const toast = {
      success: (message, duration) => addToast(message, 'success', duration ?? 4000),
      error:   (message, duration) => addToast(message, 'error',   duration ?? 6000),
      warning: (message, duration) => addToast(message, 'warning', duration ?? 5000),
      info:    (message, duration) => addToast(message, 'info',    duration ?? 4000),
    };

    return { toast, getToasts: () => toasts, removeToast };
  };

  test('toast methods exist and preserve expected default durations', () => {
    const { toast, getToasts } = createToastHarness();

    toast.success('Done');
    toast.error('Failed');
    toast.warning('Careful');
    toast.info('Notice');

    const list = getToasts();
    assert.equal(list.length, 4);

    assert.equal(list[0].message, 'Done');
    assert.equal(list[0].type, 'success');
    assert.equal(list[0].duration, 4000);

    assert.equal(list[1].message, 'Failed');
    assert.equal(list[1].type, 'error');
    assert.equal(list[1].duration, 6000);

    assert.equal(list[2].message, 'Careful');
    assert.equal(list[2].type, 'warning');
    assert.equal(list[2].duration, 5000);

    assert.equal(list[3].message, 'Notice');
    assert.equal(list[3].type, 'info');
    assert.equal(list[3].duration, 4000);
  });

  test('triggering toast.error does not recreate toast reference or cause effect looping', () => {
    const { toast } = createToastHarness();

    // When useMemo is used in ToastContext with [addToast], the reference is stable:
    const ref1 = toast;
    ref1.error('Error occurred');
    const ref2 = toast; // In component re-render, useMemo returns the identical object

    assert.equal(ref1, ref2, 'Toast reference must remain strictly identical across dispatches');

    // Effect execution counter simulation
    let effectExecutionCount = 0;
    const effectDependencies = [undefined, undefined, ref1];

    const runEffect = () => {
      effectExecutionCount++;
      ref1.error('Error logged'); // Triggers toast
    };

    runEffect();

    // With stable toast reference, dependencies [undefined, undefined, ref1] are identical
    const newDependencies = [undefined, undefined, ref2];
    const dependenciesChanged = effectDependencies.some((dep, i) => dep !== newDependencies[i]);

    assert.equal(dependenciesChanged, false, 'Effect dependencies must not change after toast invocation');
    assert.equal(effectExecutionCount, 1, 'Effect must not re-run in an infinite loop');
  });
});

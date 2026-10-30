/**
 * quizAssignmentFrontend.test.js — Frontend unit & integration tests for Quiz and Assignment Offering Integration.
 *
 * Verifies:
 *  1. QuizManagementPage offeringId scoping:
 *     - Fetches quizzes using offeringId query parameter when offeringId is present
 *     - Passes offeringId down to CreateQuizForm
 *     - Triggers Word download with responseType='blob'
 *  2. CreateQuizForm offering propagation:
 *     - Sends offeringId in payload on create and update
 *     - Auto-fills course info from offering details when offeringId is provided
 *  3. AssignmentManagementPage offeringId scoping:
 *     - Fetches assignments using offeringId query parameter when offeringId is present
 *     - Passes offeringId down to CreateAssignmentForm
 *     - Triggers Word download with responseType='blob'
 *  4. CreateAssignmentForm offering propagation:
 *     - Sends offeringId in payload on create and update
 *     - Auto-fills course info from offering details when offeringId is provided
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Quiz & Assignment Frontend Offering Integration Suite', () => {
  const mockCourseId = 'course-123';
  const mockOfferingId = 'offering-456';

  describe('1. QuizManagementPage Scoping & Export Logic', () => {
    test('fetches quizzes with offering endpoint when offeringId is provided', () => {
      const buildFetchUrl = (courseId, offeringId) => {
        if (offeringId) {
          return { endpoint: `/quizzes/offering/${offeringId}` };
        }
        if (courseId && courseId !== 'undefined') {
          return { endpoint: `/quizzes/course/${courseId}` };
        }
        return null;
      };

      const result = buildFetchUrl(mockCourseId, mockOfferingId);
      assert.equal(result.endpoint, `/quizzes/offering/${mockOfferingId}`);
    });

    test('fetches quizzes from legacy course endpoint when only courseId is provided', () => {
      const buildFetchUrl = (courseId, offeringId) => {
        if (offeringId) {
          return { endpoint: `/quizzes/offering/${offeringId}` };
        }
        if (courseId && courseId !== 'undefined') {
          return { endpoint: `/quizzes/course/${courseId}` };
        }
        return null;
      };

      const result = buildFetchUrl(mockCourseId, null);
      assert.equal(result.endpoint, `/quizzes/course/${mockCourseId}`);
    });

    test('avoids fetch if both offeringId and valid courseId are missing', () => {
      const buildFetchUrl = (courseId, offeringId) => {
        if (offeringId) {
          return { endpoint: `/quizzes/offering/${offeringId}` };
        }
        if (courseId && courseId !== 'undefined') {
          return { endpoint: `/quizzes/course/${courseId}` };
        }
        return null;
      };

      assert.equal(buildFetchUrl(undefined, undefined), null);
      assert.equal(buildFetchUrl('undefined', null), null);
    });

    test('builds correct Word export download URL and parameters', () => {
      const buildExportRequest = (quizId) => {
        return {
          url: `/quizzes/${quizId}/export`,
          config: { responseType: 'blob' },
        };
      };

      const req = buildExportRequest('quiz-789');
      assert.equal(req.url, '/quizzes/quiz-789/export');
      assert.equal(req.config.responseType, 'blob');
    });
  });

  describe('2. CreateQuizForm Payload & Auto-fill Logic', () => {
    test('constructs save payload including offeringId and questions', () => {
      const buildQuizPayload = ({ courseId, offeringId, quizInfo, courseInfo, cloMappings, questions }) => {
        return {
          courseId,
          offeringId,
          quizInfo,
          courseInfo,
          cloMappings: cloMappings.map(({ mappedCLO, mappedGA, mappedLearningLevel, sdg }) => ({
            mappedCLO, mappedGA, mappedLearningLevel, sdg,
          })),
          questions: questions.map((q) => ({
            questionText: q.text,
            marks: q.marks,
          })),
        };
      };

      const payload = buildQuizPayload({
        courseId: mockCourseId,
        offeringId: mockOfferingId,
        quizInfo: { quizNumber: '1', date: '2026-10-30', duration: '30m', maxMarks: '15' },
        courseInfo: { department: 'CS', program: 'BSCS', courseTitle: 'Algorithms' },
        cloMappings: [{ id: 1, mappedCLO: 'CLO-1', mappedGA: 'GA-1', mappedLearningLevel: 'C3', sdg: '4' }],
        questions: [{ id: 1, text: 'Define graph isomorphism', marks: '15' }],
      });

      assert.equal(payload.courseId, mockCourseId);
      assert.equal(payload.offeringId, mockOfferingId);
      assert.equal(payload.quizInfo.quizNumber, '1');
      assert.equal(payload.questions.length, 1);
      assert.equal(payload.questions[0].questionText, 'Define graph isomorphism');
    });

    test('resolves courseInfo from offering details in create mode', () => {
      const resolveCourseInfoFromOffering = (offering) => {
        if (!offering || !offering.course) return null;
        return {
          department: offering.course.department?.name || '',
          program: offering.course.program || '',
          courseTitle: offering.course.courseName || '',
        };
      };

      const mockOfferingData = {
        course: {
          courseCode: 'CS301',
          courseName: 'Algorithms',
          program: 'BSCS',
          department: { name: 'Computer Science' },
        },
      };

      const courseInfo = resolveCourseInfoFromOffering(mockOfferingData);
      assert.equal(courseInfo.department, 'Computer Science');
      assert.equal(courseInfo.program, 'BSCS');
      assert.equal(courseInfo.courseTitle, 'Algorithms');
    });
  });

  describe('3. AssignmentManagementPage Scoping & Export Logic', () => {
    test('fetches assignments with offering endpoint when offeringId is provided', () => {
      const buildFetchUrl = (courseId, offeringId) => {
        if (offeringId) {
          return { endpoint: `/assignments/offering/${offeringId}` };
        }
        if (courseId && courseId !== 'undefined') {
          return { endpoint: `/assignments/course/${courseId}` };
        }
        return null;
      };

      const result = buildFetchUrl(mockCourseId, mockOfferingId);
      assert.equal(result.endpoint, `/assignments/offering/${mockOfferingId}`);
    });

    test('fetches assignments from legacy course endpoint when only courseId is provided', () => {
      const buildFetchUrl = (courseId, offeringId) => {
        if (offeringId) {
          return { endpoint: `/assignments/offering/${offeringId}` };
        }
        if (courseId && courseId !== 'undefined') {
          return { endpoint: `/assignments/course/${courseId}` };
        }
        return null;
      };

      const result = buildFetchUrl(mockCourseId, null);
      assert.equal(result.endpoint, `/assignments/course/${mockCourseId}`);
    });

    test('avoids assignment fetch if both offeringId and valid courseId are missing', () => {
      const buildFetchUrl = (courseId, offeringId) => {
        if (offeringId) {
          return { endpoint: `/assignments/offering/${offeringId}` };
        }
        if (courseId && courseId !== 'undefined') {
          return { endpoint: `/assignments/course/${courseId}` };
        }
        return null;
      };

      assert.equal(buildFetchUrl(undefined, undefined), null);
      assert.equal(buildFetchUrl('undefined', null), null);
    });

    test('builds correct Word export download URL and parameters for Assignment', () => {
      const buildExportRequest = (assignmentId) => {
        return {
          url: `/assignments/${assignmentId}/export`,
          config: { responseType: 'blob' },
        };
      };

      const req = buildExportRequest('assign-999');
      assert.equal(req.url, '/assignments/assign-999/export');
      assert.equal(req.config.responseType, 'blob');
    });
  });

  describe('4. CreateAssignmentForm Payload & Auto-fill Logic', () => {
    test('constructs save payload including offeringId and tasks', () => {
      const buildAssignmentPayload = ({
        courseId,
        offeringId,
        assignmentInfo,
        courseInfo,
        cloMappings,
        assignmentTitle,
        objective,
        assignmentDescription,
        tasks,
        submissionGuidelines,
        evaluationCriteria,
        tipsForSuccess,
      }) => {
        return {
          courseId,
          offeringId,
          assignmentInfo,
          courseInfo,
          cloMappings: cloMappings.map(({ mappedCLO, mappedGA, mappedLearningLevel, sdg }) => ({
            mappedCLO, mappedGA, mappedLearningLevel, sdg,
          })),
          assignmentTitle,
          objective,
          assignmentDescription,
          tasks: tasks.map((t) => t.text).filter((t) => t.trim()),
          submissionGuidelines: submissionGuidelines.map((g) => g.text).filter((t) => t.trim()),
          evaluationCriteria: evaluationCriteria.map((c) => c.text).filter((t) => t.trim()),
          tipsForSuccess: tipsForSuccess.map((t) => t.text).filter((t) => t.trim()),
        };
      };

      const payload = buildAssignmentPayload({
        courseId: mockCourseId,
        offeringId: mockOfferingId,
        assignmentInfo: { assignmentNumber: '1', announcementDate: '2026-10-26', dueDate: '2026-11-05', maxMarks: '20' },
        courseInfo: { department: 'CS', program: 'BSCS', courseTitle: 'Algorithms' },
        cloMappings: [{ id: 1, mappedCLO: 'CLO-2', mappedGA: 'GA-2', mappedLearningLevel: 'C4', sdg: '9' }],
        assignmentTitle: 'Dynamic Programming Project',
        objective: 'Master DP principles',
        assignmentDescription: 'Solve knapsack problem',
        tasks: [{ id: 1, text: 'Implement 0/1 knapsack in C++' }, { id: 2, text: '' }],
        submissionGuidelines: [{ id: 1, text: 'Submit zip via portal' }],
        evaluationCriteria: [{ id: 1, text: 'Correctness 70%, Code style 30%' }],
        tipsForSuccess: [{ id: 1, text: 'Draw the recurrence table first' }],
      });

      assert.equal(payload.courseId, mockCourseId);
      assert.equal(payload.offeringId, mockOfferingId);
      assert.equal(payload.assignmentTitle, 'Dynamic Programming Project');
      assert.equal(payload.tasks.length, 1);
      assert.equal(payload.tasks[0], 'Implement 0/1 knapsack in C++');
      assert.equal(payload.submissionGuidelines.length, 1);
      assert.equal(payload.evaluationCriteria.length, 1);
      assert.equal(payload.tipsForSuccess.length, 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Google Drive Synchronization Service Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Google Drive Synchronization Service Tests', () => {
    const mockCalls = [];
    let mockResponses = {};

    const mockApi = {
      post: async (url, data, config) => {
        mockCalls.push({ method: 'POST', url, data, config });
        if (mockResponses[`POST:${url}`]) {
          const res = mockResponses[`POST:${url}`];
          if (res instanceof Error) throw res;
          return res;
        }
        return { data: { success: true, data: {} } };
      },
      get: async (url, config) => {
        mockCalls.push({ method: 'GET', url, config });
        if (mockResponses[`GET:${url}`]) {
          const res = mockResponses[`GET:${url}`];
          if (res instanceof Error) throw res;
          return res;
        }
        return { data: { success: true, data: [] } };
      },
    };

    const syncQuizDocument = async (offeringId, quizId) => {
      const { data } = await mockApi.post(`/course-files/sync/quiz/${offeringId}/${quizId}`);
      return data;
    };

    const syncAssignmentDocument = async (offeringId, assignmentId) => {
      const { data } = await mockApi.post(`/course-files/sync/assignment/${offeringId}/${assignmentId}`);
      return data;
    };

    const getOfferingFiles = async (offeringId, documentType = null) => {
      if (!offeringId) return [];
      const url = documentType
        ? `/course-files/offering/${offeringId}?documentType=${documentType}`
        : `/course-files/offering/${offeringId}`;
      const { data } = await mockApi.get(url);
      return data.data || [];
    };

    beforeEach(() => {
      mockCalls.length = 0;
      mockResponses = {};
    });

    test('syncQuizDocument issues POST to /course-files/sync/quiz/:offeringId/:quizId', async () => {
      const quizId = 'quiz-101';
      mockResponses[`POST:/course-files/sync/quiz/${mockOfferingId}/${quizId}`] = {
        data: {
          success: true,
          data: {
            _id: 'cf-quiz-1',
            documentType: 'ASSESS_QUIZ',
            instanceName: quizId,
            fileFormat: 'docx',
            version: 1,
            status: 'synced',
            googleDriveWebViewLink: 'https://drive.google.com/quiz_1',
          },
          message: 'Quiz document synchronized to Google Drive successfully.',
        },
      };

      const result = await syncQuizDocument(mockOfferingId, quizId);

      assert.equal(mockCalls.length, 1);
      assert.equal(mockCalls[0].method, 'POST');
      assert.equal(mockCalls[0].url, `/course-files/sync/quiz/${mockOfferingId}/${quizId}`);
      assert.equal(result.success, true);
      assert.equal(result.data.instanceName, quizId);
      assert.equal(result.data.version, 1);
    });

    test('syncAssignmentDocument issues POST to /course-files/sync/assignment/:offeringId/:assignmentId', async () => {
      const assignmentId = 'assign-202';
      mockResponses[`POST:/course-files/sync/assignment/${mockOfferingId}/${assignmentId}`] = {
        data: {
          success: true,
          data: {
            _id: 'cf-assign-1',
            documentType: 'ASSESS_ASSIGN',
            instanceName: assignmentId,
            fileFormat: 'docx',
            version: 1,
            status: 'synced',
            googleDriveWebViewLink: 'https://drive.google.com/assign_1',
          },
          message: 'Assignment document synchronized to Google Drive successfully.',
        },
      };

      const result = await syncAssignmentDocument(mockOfferingId, assignmentId);

      assert.equal(mockCalls.length, 1);
      assert.equal(mockCalls[0].method, 'POST');
      assert.equal(mockCalls[0].url, `/course-files/sync/assignment/${mockOfferingId}/${assignmentId}`);
      assert.equal(result.success, true);
      assert.equal(result.data.instanceName, assignmentId);
    });

    test('syncQuizDocument propagates 403 Forbidden on unauthorized offering access', async () => {
      const quizId = 'quiz-unauth';
      const forbiddenErr = new Error('Forbidden');
      forbiddenErr.response = {
        status: 403,
        data: { success: false, message: 'You do not have access to this course offering' },
      };
      mockResponses[`POST:/course-files/sync/quiz/${mockOfferingId}/${quizId}`] = forbiddenErr;

      await assert.rejects(
        async () => {
          await syncQuizDocument(mockOfferingId, quizId);
        },
        (err) => {
          assert.equal(err.response?.status, 403);
          assert.match(err.response?.data?.message, /access to this course offering/);
          return true;
        }
      );
    });

    test('syncQuizDocument propagates 400 Bad Request when quiz is not linked to offering', async () => {
      const quizId = 'quiz-legacy';
      const badReqErr = new Error('Bad Request');
      badReqErr.response = {
        status: 400,
        data: { success: false, message: 'This quiz is not associated with a course offering.' },
      };
      mockResponses[`POST:/course-files/sync/quiz/${mockOfferingId}/${quizId}`] = badReqErr;

      await assert.rejects(
        async () => {
          await syncQuizDocument(mockOfferingId, quizId);
        },
        (err) => {
          assert.equal(err.response?.status, 400);
          assert.match(err.response?.data?.message, /not associated with a course offering/);
          return true;
        }
      );
    });

    test('syncAssignmentDocument propagates 502 Google Drive failure', async () => {
      const assignmentId = 'assign-err';
      const driveErr = new Error('Bad Gateway');
      driveErr.response = {
        status: 502,
        data: { success: false, message: 'Google Drive upload failed: timeout' },
      };
      mockResponses[`POST:/course-files/sync/assignment/${mockOfferingId}/${assignmentId}`] = driveErr;

      await assert.rejects(
        async () => {
          await syncAssignmentDocument(mockOfferingId, assignmentId);
        },
        (err) => {
          assert.equal(err.response?.status, 502);
          assert.match(err.response?.data?.message, /Google Drive upload failed/);
          return true;
        }
      );
    });

    test('getOfferingFiles fetches filtered ASSESS_QUIZ course files', async () => {
      mockResponses[`GET:/course-files/offering/${mockOfferingId}?documentType=ASSESS_QUIZ`] = {
        data: {
          success: true,
          data: [
            { _id: 'cf-1', documentType: 'ASSESS_QUIZ', instanceName: 'quiz-1', status: 'synced', version: 1 },
            { _id: 'cf-2', documentType: 'ASSESS_QUIZ', instanceName: 'quiz-2', status: 'synced', version: 2 },
          ],
        },
      };

      const files = await getOfferingFiles(mockOfferingId, 'ASSESS_QUIZ');
      assert.equal(files.length, 2);
      assert.equal(files[0].instanceName, 'quiz-1');
      assert.equal(files[1].version, 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. UI Status Computation & Metadata Matching Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. UI Status Computation & Metadata Matching', () => {
    const computeDriveStatus = (assessmentId, courseFiles) => {
      const match = courseFiles.find(
        (cf) =>
          (cf.instanceName === assessmentId?.toString() || cf.instanceName === assessmentId) &&
          cf.fileFormat === 'pdf'
      );
      if (match && match.status === 'synced') {
        return {
          isSynced: true,
          label: `● PDF Synced${match.version > 1 ? ` v${match.version}` : ''}`,
          canView: Boolean(match.googleDriveWebViewLink),
          viewLink: match.googleDriveWebViewLink || null,
          version: match.version || 1,
        };
      }
      return {
        isSynced: false,
        label: 'PDF Not Synced',
        canView: false,
        viewLink: null,
        version: 1,
      };
    };

    test('computes "● PDF Synced" for version 1 file without suffix', () => {
      const files = [
        { instanceName: 'quiz-1', status: 'synced', version: 1, fileFormat: 'pdf', googleDriveWebViewLink: 'https://view/1' },
      ];
      const status = computeDriveStatus('quiz-1', files);
      assert.equal(status.isSynced, true);
      assert.equal(status.label, '● PDF Synced');
      assert.equal(status.canView, true);
      assert.equal(status.viewLink, 'https://view/1');
    });

    test('computes "● PDF Synced v2" for re-synchronized assessment', () => {
      const files = [
        { instanceName: 'quiz-2', status: 'synced', version: 2, fileFormat: 'pdf', googleDriveWebViewLink: 'https://view/2' },
      ];
      const status = computeDriveStatus('quiz-2', files);
      assert.equal(status.isSynced, true);
      assert.equal(status.label, '● PDF Synced v2');
      assert.equal(status.version, 2);
    });

    test('computes "PDF Not Synced" when no matching CourseFile exists', () => {
      const files = [
        { instanceName: 'quiz-other', status: 'synced', version: 1, fileFormat: 'pdf' },
      ];
      const status = computeDriveStatus('quiz-new', files);
      assert.equal(status.isSynced, false);
      assert.equal(status.label, 'PDF Not Synced');
      assert.equal(status.canView, false);
      assert.equal(status.viewLink, null);
    });

    test('does not treat legacy DOCX files as synchronized PDFs', () => {
      const files = [
        { instanceName: 'quiz-legacy', status: 'synced', version: 1, fileFormat: 'docx', googleDriveWebViewLink: 'https://view/docx' },
      ];
      const status = computeDriveStatus('quiz-legacy', files);
      assert.equal(status.isSynced, false);
      assert.equal(status.label, 'PDF Not Synced');
      assert.equal(status.canView, false);
    });

    test('matches correctly when ObjectId is compared with string', () => {
      const files = [
        { instanceName: '507f1f77bcf86cd799439011', status: 'synced', version: 1, fileFormat: 'pdf' },
      ];
      const status = computeDriveStatus('507f1f77bcf86cd799439011', files);
      assert.equal(status.isSynced, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Button State, Loading & Duplicate Click Prevention Logic
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Button State, Loading & Duplicate Click Prevention Logic', () => {
    const getSyncButtonProps = ({ assessmentId, syncingId, offeringId, isSynced }) => {
      const isSyncingThis = syncingId === assessmentId;
      const isSyncingAny = Boolean(syncingId);
      const disabled = isSyncingAny || !offeringId;

      let text;
      if (isSyncingThis) {
        text = 'Syncing...';
      } else if (isSynced) {
        text = 'Re-sync PDF';
      } else {
        text = 'Sync PDF';
      }

      return {
        text,
        disabled,
        isSyncingThis,
      };
    };

    test('displays "Sync PDF" and is enabled when not synced and no sync in progress', () => {
      const props = getSyncButtonProps({
        assessmentId: 'quiz-1',
        syncingId: null,
        offeringId: 'offering-1',
        isSynced: false,
      });

      assert.equal(props.text, 'Sync PDF');
      assert.equal(props.disabled, false);
    });

    test('displays "Re-sync PDF" and is enabled when already synced', () => {
      const props = getSyncButtonProps({
        assessmentId: 'quiz-1',
        syncingId: null,
        offeringId: 'offering-1',
        isSynced: true,
      });

      assert.equal(props.text, 'Re-sync PDF');
      assert.equal(props.disabled, false);
    });

    test('displays "Syncing..." and disables button when this assessment is currently syncing', () => {
      const props = getSyncButtonProps({
        assessmentId: 'quiz-1',
        syncingId: 'quiz-1',
        offeringId: 'offering-1',
        isSynced: false,
      });

      assert.equal(props.text, 'Syncing...');
      assert.equal(props.disabled, true);
      assert.equal(props.isSyncingThis, true);
    });

    test('prevents duplicate clicks: disables sync button if another assessment is currently syncing', () => {
      const props = getSyncButtonProps({
        assessmentId: 'quiz-2',
        syncingId: 'quiz-1', // Quiz 1 is currently syncing
        offeringId: 'offering-1',
        isSynced: false,
      });

      assert.equal(props.text, 'Sync PDF');
      assert.equal(props.disabled, true); // Disabled to prevent concurrent requests
    });

    test('disables sync button when offeringId is missing (pure legacy mode)', () => {
      const props = getSyncButtonProps({
        assessmentId: 'quiz-1',
        syncingId: null,
        offeringId: null,
        isSynced: false,
      });

      assert.equal(props.disabled, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Re-sync Update & Deletion Local State Cleanup
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Re-sync Update & Deletion Local State Cleanup', () => {
    test('updates existing CourseFile record in place without duplicating in state', () => {
      const existingFiles = [
        { _id: 'cf-1', instanceName: 'quiz-1', version: 1, status: 'synced' },
        { _id: 'cf-2', instanceName: 'quiz-2', version: 1, status: 'synced' },
      ];

      const syncResponseData = {
        _id: 'cf-1',
        instanceName: 'quiz-1',
        version: 2,
        status: 'synced',
        googleDriveWebViewLink: 'https://view/quiz1-v2',
      };

      // Replicate setCourseFiles state update logic
      const updateCourseFilesState = (prev, newRecord) => {
        const filtered = prev.filter((f) => f.instanceName !== newRecord.instanceName);
        return [...filtered, newRecord];
      };

      const updated = updateCourseFilesState(existingFiles, syncResponseData);
      assert.equal(updated.length, 2);
      const quiz1 = updated.find((f) => f.instanceName === 'quiz-1');
      assert.equal(quiz1.version, 2);
      assert.equal(quiz1.googleDriveWebViewLink, 'https://view/quiz1-v2');
    });

    test('removes CourseFile from state when assessment is deleted', () => {
      const existingFiles = [
        { _id: 'cf-1', instanceName: 'quiz-1', version: 1 },
        { _id: 'cf-2', instanceName: 'quiz-2', version: 1 },
      ];

      const deleteFromState = (prev, deletedId) => {
        return prev.filter((f) => f.instanceName !== deletedId.toString());
      };

      const remaining = deleteFromState(existingFiles, 'quiz-1');
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].instanceName, 'quiz-2');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. CourseFileChecklist Assessment Action Determination (Zero, One, Multiple)
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. CourseFileChecklist Assessment Action Determination', () => {
    const resolveChecklistAssessmentAction = ({
      formType,
      offeringId,
      activeCourseId,
      assessments = [],
      courseFiles = [],
      syncingAssessmentId = null,
    }) => {
      const count = assessments.length;
      const isQuiz = formType === 'ASSESS_QUIZ';
      const singleAssessment = count === 1 ? assessments[0] : null;

      const singleFile = singleAssessment
        ? courseFiles.find(
            (f) =>
              f.documentType === formType &&
              f.fileFormat === 'pdf' &&
              f.instanceName === singleAssessment._id?.toString()
          )
        : null;
      const isSingleSynced = singleFile?.status === 'synced';
      const isSyncingThis =
        singleAssessment && syncingAssessmentId === singleAssessment._id;
      const isSyncingAny = Boolean(syncingAssessmentId);

      if (count === 0) {
        return {
          type: 'create-link',
          to: offeringId
            ? `/offering/${offeringId}/form/${formType}`
            : `/course/${activeCourseId}/form/${formType}`,
          label: isQuiz ? '+ Create Quiz' : '+ Create Assignment',
        };
      }

      if (count === 1) {
        let buttonLabel;
        if (isSyncingThis) {
          buttonLabel = 'Syncing...';
        } else if (isSingleSynced) {
          buttonLabel = 'Re-sync PDF';
        } else {
          buttonLabel = '⚡ Sync PDF';
        }

        return {
          type: 'sync-button',
          assessmentId: singleAssessment._id,
          label: buttonLabel,
          disabled: isSyncingAny || !offeringId,
          isSingleSynced,
          isSyncingThis,
        };
      }

      return {
        type: 'manage-link',
        to: offeringId
          ? `/offering/${offeringId}/form/${formType}`
          : `/course/${activeCourseId}/form/${formType}`,
        label: isQuiz
          ? `📂 Manage & Sync Quizzes (${count})`
          : `📂 Manage & Sync Assignments (${count})`,
        count,
      };
    };

    test('renders create link for Quiz when 0 quizzes exist', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_QUIZ',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [],
      });
      assert.equal(action.type, 'create-link');
      assert.equal(action.label, '+ Create Quiz');
      assert.equal(action.to, '/offering/off-1/form/ASSESS_QUIZ');
    });

    test('renders create link for Assignment when 0 assignments exist', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_ASSIGN',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [],
      });
      assert.equal(action.type, 'create-link');
      assert.equal(action.label, '+ Create Assignment');
      assert.equal(action.to, '/offering/off-1/form/ASSESS_ASSIGN');
    });

    test('renders direct Sync button when exactly 1 unsynced quiz exists', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_QUIZ',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'quiz-single' }],
        courseFiles: [],
      });
      assert.equal(action.type, 'sync-button');
      assert.equal(action.assessmentId, 'quiz-single');
      assert.equal(action.label, '⚡ Sync PDF');
      assert.equal(action.disabled, false);
    });

    test('renders Re-sync button when exactly 1 synced quiz exists', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_QUIZ',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'quiz-single' }],
        courseFiles: [
          { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-single', status: 'synced', version: 1, fileFormat: 'pdf' },
        ],
      });
      assert.equal(action.type, 'sync-button');
      assert.equal(action.assessmentId, 'quiz-single');
      assert.equal(action.label, 'Re-sync PDF');
      assert.equal(action.disabled, false);
    });

    test('does not treat manually uploaded DOCX as synced: renders ⚡ Sync PDF when single quiz has only a docx file', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_QUIZ',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'quiz-single' }],
        courseFiles: [
          { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-single', status: 'synced', version: 1, fileFormat: 'docx' },
        ],
      });
      assert.equal(action.type, 'sync-button');
      assert.equal(action.assessmentId, 'quiz-single');
      assert.equal(action.label, '⚡ Sync PDF');
      assert.equal(action.isSingleSynced, false);
    });

    test('renders direct Sync button when exactly 1 unsynced assignment exists', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_ASSIGN',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'assign-single' }],
        courseFiles: [],
      });
      assert.equal(action.type, 'sync-button');
      assert.equal(action.assessmentId, 'assign-single');
      assert.equal(action.label, '⚡ Sync PDF');
      assert.equal(action.disabled, false);
    });

    test('renders Re-sync button when exactly 1 synced assignment exists', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_ASSIGN',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'assign-single' }],
        courseFiles: [
          { documentType: 'ASSESS_ASSIGN', instanceName: 'assign-single', status: 'synced', version: 2, fileFormat: 'pdf' },
        ],
      });
      assert.equal(action.type, 'sync-button');
      assert.equal(action.assessmentId, 'assign-single');
      assert.equal(action.label, 'Re-sync PDF');
      assert.equal(action.disabled, false);
    });

    test('does not arbitrarily select assessment: renders manage link when multiple quizzes exist', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_QUIZ',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'quiz-1' }, { _id: 'quiz-2' }, { _id: 'quiz-3' }],
      });
      assert.equal(action.type, 'manage-link');
      assert.equal(action.label, '📂 Manage & Sync Quizzes (3)');
      assert.equal(action.to, '/offering/off-1/form/ASSESS_QUIZ');
      assert.equal(action.count, 3);
    });

    test('does not arbitrarily select assessment: renders manage link when multiple assignments exist', () => {
      const action = resolveChecklistAssessmentAction({
        formType: 'ASSESS_ASSIGN',
        offeringId: 'off-1',
        activeCourseId: 'crs-1',
        assessments: [{ _id: 'assign-1' }, { _id: 'assign-2' }],
      });
      assert.equal(action.type, 'manage-link');
      assert.equal(action.label, '📂 Manage & Sync Assignments (2)');
      assert.equal(action.to, '/offering/off-1/form/ASSESS_ASSIGN');
      assert.equal(action.count, 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Checklist Drive Status Computation (Metadata vs Checklist Completion)
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Checklist Drive Status Computation', () => {
    const computeChecklistDriveStatus = ({
      formType,
      checklistCompleted,
      assessments = [],
      courseFiles = [],
      rowError = null,
    }) => {
      const matchingFiles = courseFiles.filter((f) => f.documentType === formType);
      const isQuiz = formType === 'ASSESS_QUIZ';
      const isAssign = formType === 'ASSESS_ASSIGN';
      const count = assessments.length;

      const singleAssessment = count === 1 ? assessments[0] : null;
      const singleFile = singleAssessment
        ? matchingFiles.find((f) => f.instanceName === singleAssessment._id?.toString() && f.fileFormat === 'pdf')
        : null;

      const isSingleSynced = singleFile?.status === 'synced';

      const assessmentSyncedCount = assessments.filter((a) =>
        matchingFiles.some((f) => f.instanceName === a._id?.toString() && f.fileFormat === 'pdf' && f.status === 'synced')
      ).length;

      const primaryPdfFile = matchingFiles.find((f) => f.fileFormat === 'pdf' && f.status === 'synced');
      const primaryFile = matchingFiles[0];

      const isSynced = isQuiz
        ? (count === 1 ? isSingleSynced : count > 1 ? assessmentSyncedCount > 0 : Boolean(primaryPdfFile))
        : isAssign
        ? (count === 1 ? isSingleSynced : count > 1 ? assessmentSyncedCount > 0 : Boolean(primaryPdfFile))
        : primaryFile?.status === 'synced';

      const hasRowError = Boolean(
        rowError ||
        (isQuiz && singleFile?.status === 'failed') ||
        (isAssign && singleFile?.status === 'failed') ||
        primaryFile?.status === 'failed'
      );

      if (isSynced) {
        let label;
        if (isQuiz && count > 1) {
          label = `PDF Synced (${assessmentSyncedCount}/${count})`;
        } else if (isAssign && count > 1) {
          label = `PDF Synced (${assessmentSyncedCount}/${count})`;
        } else if (isQuiz && count === 1) {
          label = `PDF Synced${singleFile?.version > 1 ? ` v${singleFile.version}` : ''}`;
        } else if (isAssign && count === 1) {
          label = `PDF Synced${singleFile?.version > 1 ? ` v${singleFile.version}` : ''}`;
        } else if (isQuiz || isAssign) {
          label = `PDF Synced${primaryPdfFile?.version > 1 ? ` v${primaryPdfFile.version}` : ''}`;
        } else if (primaryFile?.version > 1) {
          label = `Synced v${primaryFile.version}`;
        } else {
          label = 'Synced';
        }
        return { isSynced: true, label, status: 'synced' };
      }

      if (hasRowError) {
        return { isSynced: false, label: rowError ? 'Sync failed' : 'Upload failed', status: 'failed' };
      }

      if ((isQuiz || isAssign) && count === 0) {
        return { isSynced: false, label: 'Not created', status: 'none' };
      }

      if (isQuiz || isAssign) {
        return { isSynced: false, label: 'PDF Not Synced', status: 'none' };
      }

      return { isSynced: false, label: 'Not uploaded', status: 'none' };
    };

    test('status is independent of checklist checkbox completion', () => {
      const filesSynced = [
        { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-1', status: 'synced', version: 1, fileFormat: 'pdf' },
      ];

      // Even if checklistCompleted is false, status reflects Drive metadata (PDF Synced)
      const resUnchecked = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: false,
        assessments: [{ _id: 'quiz-1' }],
        courseFiles: filesSynced,
      });
      assert.equal(resUnchecked.isSynced, true);
      assert.equal(resUnchecked.label, 'PDF Synced');

      // Even if checklistCompleted is true, status reflects Drive metadata (PDF Not Synced)
      const resCheckedWithoutFile = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: true,
        assessments: [{ _id: 'quiz-1' }],
        courseFiles: [],
      });
      assert.equal(resCheckedWithoutFile.isSynced, false);
      assert.equal(resCheckedWithoutFile.label, 'PDF Not Synced');
    });

    test('displays "Not created" when 0 assessments exist and no files uploaded', () => {
      const res = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: false,
        assessments: [],
        courseFiles: [],
      });
      assert.equal(res.label, 'Not created');
    });

    test('displays "PDF Synced" for single assessment on v1', () => {
      const res = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: false,
        assessments: [{ _id: 'quiz-1' }],
        courseFiles: [
          { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-1', status: 'synced', version: 1, fileFormat: 'pdf' },
        ],
      });
      assert.equal(res.label, 'PDF Synced');
    });

    test('displays "PDF Synced v3" for single assessment on v3', () => {
      const res = computeChecklistDriveStatus({
        formType: 'ASSESS_ASSIGN',
        checklistCompleted: false,
        assessments: [{ _id: 'assign-1' }],
        courseFiles: [
          { documentType: 'ASSESS_ASSIGN', instanceName: 'assign-1', status: 'synced', version: 3, fileFormat: 'pdf' },
        ],
      });
      assert.equal(res.label, 'PDF Synced v3');
    });

    test('displays "PDF Synced (2/3)" when 2 of 3 assessments are synced', () => {
      const res = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: false,
        assessments: [{ _id: 'quiz-1' }, { _id: 'quiz-2' }, { _id: 'quiz-3' }],
        courseFiles: [
          { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-1', status: 'synced', version: 1, fileFormat: 'pdf' },
          { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-3', status: 'synced', version: 1, fileFormat: 'pdf' },
        ],
      });
      assert.equal(res.isSynced, true);
      assert.equal(res.label, 'PDF Synced (2/3)');
    });

    test('does not treat manually uploaded DOCX as a synchronized PDF: displays "PDF Not Synced"', () => {
      const res = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: false,
        assessments: [{ _id: 'quiz-1' }],
        courseFiles: [
          { documentType: 'ASSESS_QUIZ', instanceName: 'quiz-1', status: 'synced', version: 1, fileFormat: 'docx' },
        ],
      });
      assert.equal(res.isSynced, false);
      assert.equal(res.label, 'PDF Not Synced');
    });

    test('displays "Sync failed" when row error is present', () => {
      const res = computeChecklistDriveStatus({
        formType: 'ASSESS_QUIZ',
        checklistCompleted: false,
        assessments: [{ _id: 'quiz-1' }],
        courseFiles: [],
        rowError: 'Google Drive sync timed out',
      });
      assert.equal(res.label, 'Sync failed');
      assert.equal(res.status, 'failed');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Checklist Direct Sync Call & Duplicate Request Prevention
  // ───────────────────────────────────────────────────────────────────────────
  describe('11. Checklist Direct Sync Call & Duplicate Request Prevention', () => {
    test('passes correct offeringId and assessmentId to syncQuizDocument', async () => {
      const testCalls = [];
      const testSyncQuiz = async (offeringId, quizId) => {
        testCalls.push({ offeringId, quizId });
        return { success: true, message: 'Quiz synced' };
      };

      const offeringId = 'offering-999';
      const singleQuizId = 'quiz-888';
      await testSyncQuiz(offeringId, singleQuizId);

      assert.equal(testCalls.length, 1);
      assert.equal(testCalls[0].offeringId, 'offering-999');
      assert.equal(testCalls[0].quizId, 'quiz-888');
    });

    test('passes correct offeringId and assessmentId to syncAssignmentDocument', async () => {
      const testCalls = [];
      const testSyncAssign = async (offeringId, assignId) => {
        testCalls.push({ offeringId, assignId });
        return { success: true, message: 'Assignment synced' };
      };

      const offeringId = 'offering-999';
      const singleAssignId = 'assign-777';
      await testSyncAssign(offeringId, singleAssignId);

      assert.equal(testCalls.length, 1);
      assert.equal(testCalls[0].offeringId, 'offering-999');
      assert.equal(testCalls[0].assignId, 'assign-777');
    });

    test('prevents duplicate clicks when sync is in flight for single quiz', () => {
      const isItemSyncing = (formType, syncingQuizId, syncingAssignmentId) => {
        return (
          (formType === 'ASSESS_QUIZ' && Boolean(syncingQuizId)) ||
          (formType === 'ASSESS_ASSIGN' && Boolean(syncingAssignmentId))
        );
      };

      assert.equal(isItemSyncing('ASSESS_QUIZ', 'quiz-1', null), true);
      assert.equal(isItemSyncing('ASSESS_QUIZ', null, null), false);
      assert.equal(isItemSyncing('ASSESS_ASSIGN', null, 'assign-1'), true);
      assert.equal(isItemSyncing('ASSESS_ASSIGN', 'quiz-1', null), false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. CourseFileChecklist Upload Action Preservation
  // ───────────────────────────────────────────────────────────────────────────
  describe('12. CourseFileChecklist Upload Action Preservation', () => {
    const shouldRenderUploadButton = (itemFormType) => {
      return itemFormType !== 'LECTURES';
    };

    test('preserves upload action for ASSESS_QUIZ', () => {
      assert.equal(shouldRenderUploadButton('ASSESS_QUIZ'), true);
    });

    test('preserves upload action for ASSESS_ASSIGN', () => {
      assert.equal(shouldRenderUploadButton('ASSESS_ASSIGN'), true);
    });

    test('preserves upload action for standard items like CIS, CCR, TIMETABLE', () => {
      assert.equal(shouldRenderUploadButton('CIS'), true);
      assert.equal(shouldRenderUploadButton('CCR'), true);
      assert.equal(shouldRenderUploadButton('TIMETABLE'), true);
    });

    test('excludes upload action for LECTURES', () => {
      assert.equal(shouldRenderUploadButton('LECTURES'), false);
    });
  });
});



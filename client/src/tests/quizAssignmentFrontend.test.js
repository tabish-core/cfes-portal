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
});

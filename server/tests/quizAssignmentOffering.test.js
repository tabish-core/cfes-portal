/**
 * quizAssignmentOffering.test.js — Test suite for CourseOffering integration of Quizzes and Assignments.
 *
 * Verifies:
 *  1. Creating Quiz and Assignment records associated with a CourseOffering
 *  2. Listing records correctly scoped to the requested CourseOffering
 *  3. Preventing access across different offerings and mismatched course/offering validation
 *  4. Update, delete, and export authorization enforcement
 *  5. CourseChecklist completion update on creation and recalculation on deletion
 *  6. Legacy unlinked data safety (ambiguous multi-offering isolation vs single-offering fallback)
 *  7. Word (.docx) export generation and attachment response preservation
 */

const mongoose = require('mongoose');
const Quiz = require('../models/Quiz.model');
const Assignment = require('../models/Assignment.model');
const CourseOffering = require('../models/CourseOffering.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const courseOfferingService = require('../services/courseOffering.service');
const quizController = require('../controllers/quiz.controller');
const assignmentController = require('../controllers/assignment.controller');
const quizWordService = require('../services/documentService/generateQuizWord');
const assignmentWordService = require('../services/documentService/generateAssignmentWord');

describe('ASSESS_QUIZ & ASSESS_ASSIGN CourseOffering Integration Suite', () => {
  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();
  const anotherOfferingId = new mongoose.Types.ObjectId().toString();

  const mockUser = {
    _id: new mongoose.Types.ObjectId(mockFacultyId),
    name: 'Dr. John Doe',
    email: 'johndoe@iu.edu.pk',
    designation: 'faculty',
  };

  const otherUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dr. Other Faculty',
    email: 'other@iu.edu.pk',
    designation: 'faculty',
  };

  const mockOffering = {
    _id: new mongoose.Types.ObjectId(mockOfferingId),
    course: {
      _id: new mongoose.Types.ObjectId(mockCourseId),
      courseCode: 'CS301',
      courseName: 'Algorithms',
      department: new mongoose.Types.ObjectId(),
    },
    faculty: {
      _id: new mongoose.Types.ObjectId(mockFacultyId),
      name: 'Dr. John Doe',
    },
    semester: {
      _id: new mongoose.Types.ObjectId(mockSemesterId),
      name: 'Fall 2026',
    },
    section: 'A',
  };

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.body = payload;
        return this;
      },
      send: function (payload) {
        this.body = payload;
        return this;
      },
      setHeader: function (key, value) {
        this.headers[key] = value;
        return this;
      },
    };
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Creating records associated with an offering', () => {
    it('creates a Quiz associated with CourseOffering and marks checklist complete', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockSavedQuiz = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        course: mockOffering.course._id,
        faculty: mockOffering.faculty._id,
        semester: mockOffering.semester._id,
        quizInfo: { quizNumber: '1', date: '2026-10-30', duration: '30m', maxMarks: '15' },
        questions: [{ questionNumber: 1, questionText: 'Explain Dijkstra algorithm', marks: '15' }],
        status: 'draft',
      };
      jest.spyOn(Quiz, 'create').mockResolvedValue(mockSavedQuiz);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_QUIZ', completed: false, name: 'Quizzes' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const req = {
        user: mockUser,
        body: {
          courseId: mockCourseId,
          offeringId: mockOfferingId,
          quizInfo: { quizNumber: '1', date: '2026-10-30', duration: '30m', maxMarks: '15' },
          questions: [{ questionText: 'Explain Dijkstra algorithm', marks: '15' }],
        },
      };
      const res = createMockRes();

      await quizController.createQuiz(req, res, () => {});

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(Quiz.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseOffering: mockOffering._id,
          course: mockOffering.course._id.toString(),
          faculty: mockOffering.faculty._id,
          semester: mockOffering.semester._id,
        })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('creates an Assignment associated with CourseOffering and marks checklist complete', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockSavedAssignment = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        course: mockOffering.course._id,
        faculty: mockOffering.faculty._id,
        semester: mockOffering.semester._id,
        assignmentInfo: { assignmentNumber: '1', announcementDate: '2026-10-26', dueDate: '2026-11-05', maxMarks: '20' },
        tasks: ['Implement merge sort'],
        status: 'draft',
      };
      jest.spyOn(Assignment, 'create').mockResolvedValue(mockSavedAssignment);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_ASSIGN', completed: false, name: 'Assignments' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const req = {
        user: mockUser,
        body: {
          courseId: mockCourseId,
          offeringId: mockOfferingId,
          assignmentInfo: { assignmentNumber: '1', announcementDate: '2026-10-26', dueDate: '2026-11-05', maxMarks: '20' },
          tasks: ['Implement merge sort'],
        },
      };
      const res = createMockRes();

      await assignmentController.createAssignment(req, res, () => {});

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(Assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseOffering: mockOffering._id,
          course: mockOffering.course._id.toString(),
          faculty: mockOffering.faculty._id,
          semester: mockOffering.semester._id,
        })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects creation if offering course does not match request course', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const differentCourseId = new mongoose.Types.ObjectId().toString();
      const req = {
        user: mockUser,
        body: {
          courseId: differentCourseId,
          offeringId: mockOfferingId,
          quizInfo: { quizNumber: '1' },
        },
      };
      const res = createMockRes();

      await quizController.createQuiz(req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Offering does not match the specified course/);
    });
  });

  describe('2. Listing records for the correct offering', () => {
    it('returns quizzes scoped to courseOffering', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockQuizzes = [
        { _id: new mongoose.Types.ObjectId(), courseOffering: mockOffering._id, quizInfo: { quizNumber: '1' } },
        { _id: new mongoose.Types.ObjectId(), courseOffering: mockOffering._id, quizInfo: { quizNumber: '2' } },
      ];

      jest.spyOn(Quiz, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockQuizzes),
        }),
      });

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await quizController.getQuizzesForCourse(req, res, () => {});

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(Quiz.find).toHaveBeenCalledWith({ courseOffering: mockOffering._id });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.quizzes).toHaveLength(2);
    });

    it('returns assignments scoped to courseOffering', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockAssignments = [
        { _id: new mongoose.Types.ObjectId(), courseOffering: mockOffering._id, assignmentInfo: { assignmentNumber: '1' } },
      ];

      jest.spyOn(Assignment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAssignments),
        }),
      });

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await assignmentController.getAssignmentsForCourse(req, res, () => {});

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(Assignment.find).toHaveBeenCalledWith({ courseOffering: mockOffering._id });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.assignments).toHaveLength(1);
    });

    it('supports direct offering route GET /api/quizzes/offering/:offeringId', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      jest.spyOn(Quiz, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ quizInfo: { quizNumber: '1' } }]),
        }),
      });

      const req = {
        user: mockUser,
        params: { offeringId: mockOfferingId },
        query: {},
      };
      const res = createMockRes();

      await quizController.getQuizzesForOffering(req, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(res.body.data.quizzes).toHaveLength(1);
    });
  });

  describe('3. Preventing access across different offerings and unauthorized users', () => {
    it('rejects listing quizzes when unauthorized user attempts access', async () => {
      const err = new Error('You are not authorized to access this course offering.');
      err.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(err);

      const req = {
        user: otherUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await quizController.getQuizzesForCourse(req, res, () => {});

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/not authorized/);
    });

    it('rejects getting quiz if user is unauthorized for its offering', async () => {
      const quizDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: new mongoose.Types.ObjectId(anotherOfferingId),
      };
      jest.spyOn(Quiz, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(quizDoc),
      });

      const err = new Error('You are not authorized to access this course offering.');
      err.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(err);

      const req = {
        user: mockUser,
        params: { quizId: quizDoc._id.toString() },
      };
      const res = createMockRes();

      await quizController.getQuiz(req, res, () => {});

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/not authorized/);
    });

    it('rejects updating assignment if user is unauthorized for its offering', async () => {
      const assignDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: new mongoose.Types.ObjectId(anotherOfferingId),
        save: jest.fn(),
      };
      jest.spyOn(Assignment, 'findById').mockResolvedValue(assignDoc);

      const err = new Error('You are not authorized to access this course offering.');
      err.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(err);

      const req = {
        user: mockUser,
        params: { assignmentId: assignDoc._id.toString() },
        body: { assignmentInfo: { assignmentNumber: '2' } },
      };
      const res = createMockRes();

      await assignmentController.updateAssignment(req, res, () => {});

      expect(res.statusCode).toBe(403);
      expect(assignDoc.save).not.toHaveBeenCalled();
    });

    it('rejects deleting quiz if user is unauthorized for its offering', async () => {
      const quizDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: new mongoose.Types.ObjectId(anotherOfferingId),
        deleteOne: jest.fn(),
      };
      jest.spyOn(Quiz, 'findById').mockResolvedValue(quizDoc);

      const err = new Error('You are not authorized to access this course offering.');
      err.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(err);

      const req = {
        user: mockUser,
        params: { quizId: quizDoc._id.toString() },
      };
      const res = createMockRes();

      await quizController.deleteQuiz(req, res, () => {});

      expect(res.statusCode).toBe(403);
      expect(quizDoc.deleteOne).not.toHaveBeenCalled();
    });

    it('rejects exporting assignment if user is unauthorized for its offering', async () => {
      const assignDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: new mongoose.Types.ObjectId(anotherOfferingId),
      };
      jest.spyOn(Assignment, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(assignDoc),
      });

      const err = new Error('You are not authorized to access this course offering.');
      err.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(err);

      const req = {
        user: mockUser,
        params: { assignmentId: assignDoc._id.toString() },
      };
      const res = createMockRes();

      await assignmentController.exportAssignmentWord(req, res, () => {});

      expect(res.statusCode).toBe(403);
    });
  });

  describe('4. Checklist completion and recalculation on deletion', () => {
    it('unmarks checklist completion when the last remaining quiz is deleted', async () => {
      const quizDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Quiz, 'findById').mockResolvedValue(quizDoc);
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // Remaining count after deletion is 0
      jest.spyOn(Quiz, 'countDocuments').mockResolvedValue(0);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_QUIZ', completed: true, name: 'Quizzes' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const req = {
        user: mockUser,
        params: { quizId: quizDoc._id.toString() },
      };
      const res = createMockRes();

      await quizController.deleteQuiz(req, res, () => {});

      expect(quizDoc.deleteOne).toHaveBeenCalled();
      expect(mockChecklist.checklistItems[0].completed).toBe(false);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('retains checklist completed=true when other quizzes still remain after deletion', async () => {
      const quizDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Quiz, 'findById').mockResolvedValue(quizDoc);
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // Remaining count after deletion is 1
      jest.spyOn(Quiz, 'countDocuments').mockResolvedValue(1);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_QUIZ', completed: true, name: 'Quizzes' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const req = {
        user: mockUser,
        params: { quizId: quizDoc._id.toString() },
      };
      const res = createMockRes();

      await quizController.deleteQuiz(req, res, () => {});

      expect(quizDoc.deleteOne).toHaveBeenCalled();
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('unmarks checklist completion when the last remaining assignment is deleted', async () => {
      const assignDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Assignment, 'findById').mockResolvedValue(assignDoc);
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // Remaining count after deletion is 0
      jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(0);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_ASSIGN', completed: true, name: 'Assignments' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const req = {
        user: mockUser,
        params: { assignmentId: assignDoc._id.toString() },
      };
      const res = createMockRes();

      await assignmentController.deleteAssignment(req, res, () => {});

      expect(assignDoc.deleteOne).toHaveBeenCalled();
      expect(mockChecklist.checklistItems[0].completed).toBe(false);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  describe('5. Legacy data safety', () => {
    it('does NOT expose unassociated records across multiple offerings (ambiguous case)', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // No offering-scoped records
      jest.spyOn(Quiz, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      // 2 offerings exist for this (course, faculty) -> Ambiguous!
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(2);

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await quizController.getQuizzesForCourse(req, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(res.body.data.quizzes).toEqual([]);
    });

    it('does NOT expose unassociated assignments across multiple offerings (ambiguous case)', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      jest.spyOn(Assignment, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(2);

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await assignmentController.getAssignmentsForCourse(req, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(res.body.data.assignments).toEqual([]);
    });

    it('safely falls back to legacy unassociated records when exactly 1 offering exists', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockLegacyQuiz = {
        _id: new mongoose.Types.ObjectId(),
        course: mockOffering.course._id,
        faculty: mockOffering.faculty._id,
        courseOffering: null,
        quizInfo: { quizNumber: 'Legacy Quiz' },
      };

      // First query (by courseOffering) returns empty; second query (legacy fallback) returns mockLegacyQuiz
      jest.spyOn(Quiz, 'find')
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockLegacyQuiz]),
          }),
        });

      // Exactly 1 offering exists for this (course, faculty) -> Safe!
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(1);

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await quizController.getQuizzesForCourse(req, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(res.body.data.quizzes).toHaveLength(1);
      expect(res.body.data.quizzes[0].quizInfo.quizNumber).toBe('Legacy Quiz');
    });

    it('pure legacy call without offeringId returns empty array with warning if multiple offerings exist', async () => {
      jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(2);

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: {},
      };
      const res = createMockRes();

      await quizController.getQuizzesForCourse(req, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(res.body.data.quizzes).toEqual([]);
      expect(res.body.message).toMatch(/Multiple offerings exist/);
    });

    it('prevents associating a legacy quiz to an offering of a different course', async () => {
      const legacyQuiz = {
        _id: new mongoose.Types.ObjectId(),
        course: new mongoose.Types.ObjectId(), // Different course
        faculty: mockUser._id,
        courseOffering: null,
        save: jest.fn(),
      };
      jest.spyOn(Quiz, 'findById').mockResolvedValue(legacyQuiz);

      // offering matches mockCourseId, which is different from legacyQuiz.course
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const req = {
        user: mockUser,
        params: { quizId: legacyQuiz._id.toString() },
        body: {
          offeringId: mockOfferingId,
        },
      };
      const res = createMockRes();

      await quizController.updateQuiz(req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Offering does not match the course of this quiz/);
      expect(legacyQuiz.save).not.toHaveBeenCalled();
    });

    it('ensures legacy listing fallback does not invoke checklist updates', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'find')
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ quizInfo: { quizNumber: '1' } }]) }),
        });
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(1);
      const checklistFindSpy = jest.spyOn(CourseChecklist, 'findOne');

      const req = {
        user: mockUser,
        params: { courseId: mockCourseId },
        query: { offeringId: mockOfferingId },
      };
      const res = createMockRes();

      await quizController.getQuizzesForCourse(req, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(checklistFindSpy).not.toHaveBeenCalled();
    });

    it('resiliently completes assessment creation even if checklist update encounters an error', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      const mockSavedQuiz = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        course: mockOffering.course._id,
        faculty: mockOffering.faculty._id,
        quizInfo: { quizNumber: '1' },
      };
      jest.spyOn(Quiz, 'create').mockResolvedValue(mockSavedQuiz);
      // Force CourseChecklist to reject
      jest.spyOn(CourseChecklist, 'findOne').mockRejectedValue(new Error('Checklist DB write error'));

      const req = {
        user: mockUser,
        body: {
          courseId: mockCourseId,
          offeringId: mockOfferingId,
          quizInfo: { quizNumber: '1' },
        },
      };
      const res = createMockRes();

      await quizController.createQuiz(req, res, () => {});

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quiz).toBeDefined();
    });
  });

  describe('6. Word document exports continuing to work', () => {
    it('generates and streams Word document for authorized Quiz', async () => {
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        courseInfo: { courseTitle: 'Data Structures' },
        quizInfo: { quizNumber: 'Quiz 1' },
      };
      jest.spyOn(Quiz, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockQuiz),
      });
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockBuffer = Buffer.from('FAKE_DOCX_BUFFER');
      jest.spyOn(quizWordService, 'generateQuizWord').mockResolvedValue(mockBuffer);

      const req = {
        user: mockUser,
        params: { quizId: mockQuiz._id.toString() },
      };
      const res = createMockRes();

      await quizController.exportQuizWord(req, res, () => {});

      expect(quizWordService.generateQuizWord).toHaveBeenCalledWith(mockQuiz);
      expect(res.headers['Content-Disposition']).toBe('attachment; filename="Data_Structures_Quiz_1.docx"');
      expect(res.headers['Content-Type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(res.body).toEqual(mockBuffer);
    });

    it('generates and streams Word document for authorized Assignment', async () => {
      const mockAssign = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        courseInfo: { courseTitle: 'Operating Systems' },
        assignmentInfo: { assignmentNumber: 'Assignment 2' },
      };
      jest.spyOn(Assignment, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAssign),
      });
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockBuffer = Buffer.from('FAKE_DOCX_ASSIGN_BUFFER');
      jest.spyOn(assignmentWordService, 'generateAssignmentWord').mockResolvedValue(mockBuffer);

      const req = {
        user: mockUser,
        params: { assignmentId: mockAssign._id.toString() },
      };
      const res = createMockRes();

      await assignmentController.exportAssignmentWord(req, res, () => {});

      expect(assignmentWordService.generateAssignmentWord).toHaveBeenCalledWith(mockAssign);
      expect(res.headers['Content-Disposition']).toBe(
        'attachment; filename="Operating_Systems_Assignment_2.docx"'
      );
      expect(res.headers['Content-Type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(res.body).toEqual(mockBuffer);
    });
  });
});

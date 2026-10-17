const { importStudents } = require('../controllers/obe.controller');
const CourseOffering = require('../models/CourseOffering.model');
const OBEStudent = require('../models/OBEStudent.model');
const OBEMark = require('../models/OBEMark.model');
const ErrorResponse = require('../utils/errorResponse');

jest.mock('../models/CourseOffering.model');
jest.mock('../models/OBEStudent.model');
jest.mock('../models/OBEMark.model');

describe('OBE Student Import Controller', () => {
  let req, res, next;
  const courseId = 'course_abc_123';
  const facultyId = 'faculty_xyz_789';

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { courseId },
      user: { _id: facultyId, role: 'faculty' },
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    // Default course auth to true for faculty
    CourseOffering.exists.mockResolvedValue(true);
  });

  test('rejects unauthorized faculty with 403', async () => {
    CourseOffering.exists.mockResolvedValue(false);
    req.body = { students: [{ registrationNo: '001234', studentName: 'Test Student' }] };

    await importStudents(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ErrorResponse));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.message).toMatch(/Not authorized/i);
    expect(OBEStudent.find).not.toHaveBeenCalled();
    expect(OBEStudent.insertMany).not.toHaveBeenCalled();
  });

  test('rejects non-array students payload with 400', async () => {
    req.body = { students: 'invalid' };

    await importStudents(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ErrorResponse));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/students array is required/i);
  });

  test('handles empty students array gracefully', async () => {
    req.body = { students: [] };

    await importStudents(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        totalProcessed: 0,
        importedCount: 0,
        skippedCount: 0,
        invalidCount: 0,
        imported: [],
        skipped: [],
        invalid: []
      }
    });
    expect(OBEStudent.find).not.toHaveBeenCalled();
  });

  test('imports valid students and preserves leading zeros as text', async () => {
    req.body = {
      students: [
        { registrationNo: '001234', studentName: 'Alice Smith' },
        { registrationNo: '000567', studentName: 'Bob Jones' },
        { registrationNo: 'FA21-BCS-089', studentName: 'Charlie Brown' }
      ]
    };

    OBEStudent.find.mockResolvedValue([]);
    OBEStudent.insertMany.mockImplementation(async (docs) => {
      return docs.map((doc, idx) => ({ ...doc, _id: `id_${idx + 1}` }));
    });

    await importStudents(req, res, next);

    expect(OBEStudent.find).toHaveBeenCalledWith({ course: courseId, faculty: facultyId });
    expect(OBEStudent.insertMany).toHaveBeenCalledWith([
      { course: courseId, faculty: facultyId, registrationNo: '001234', studentName: 'Alice Smith', active: true },
      { course: courseId, faculty: facultyId, registrationNo: '000567', studentName: 'Bob Jones', active: true },
      { course: courseId, faculty: facultyId, registrationNo: 'FA21-BCS-089', studentName: 'Charlie Brown', active: true }
    ]);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data.totalProcessed).toBe(3);
    expect(result.data.importedCount).toBe(3);
    expect(result.data.skippedCount).toBe(0);
    expect(result.data.invalidCount).toBe(0);
    expect(result.data.imported[0].registrationNo).toBe('001234');
    expect(result.data.imported[1].registrationNo).toBe('000567');
  });

  test('skips existing active students and prevents duplicates without overwriting', async () => {
    req.body = {
      students: [
        { registrationNo: '001234', studentName: 'Modified Name Alice' },
        { registrationNo: '009999', studentName: 'New Student' }
      ]
    };

    // Existing active student in DB
    const existingAlice = {
      _id: 'alice_123',
      course: courseId,
      faculty: facultyId,
      registrationNo: '001234',
      studentName: 'Original Alice',
      active: true,
      save: jest.fn()
    };
    OBEStudent.find.mockResolvedValue([existingAlice]);

    OBEStudent.insertMany.mockImplementation(async (docs) => {
      return docs.map((doc, idx) => ({ ...doc, _id: `new_id_${idx + 1}` }));
    });

    await importStudents(req, res, next);

    // Existing Alice should NOT be updated or saved
    expect(existingAlice.save).not.toHaveBeenCalled();
    // Only New Student inserted
    expect(OBEStudent.insertMany).toHaveBeenCalledWith([
      { course: courseId, faculty: facultyId, registrationNo: '009999', studentName: 'New Student', active: true }
    ]);

    const result = res.json.mock.calls[0][0];
    expect(result.data.totalProcessed).toBe(2);
    expect(result.data.importedCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
    expect(result.data.skipped[0].registrationNo).toBe('001234');
    expect(result.data.skipped[0].reason).toBe('Already exists in course');
  });

  test('reactivates previously soft-deleted (inactive) student', async () => {
    req.body = {
      students: [
        { registrationNo: '001234', studentName: 'Alice Inactive' }
      ]
    };

    const inactiveStudent = {
      _id: 'inactive_alice',
      course: courseId,
      faculty: facultyId,
      registrationNo: '001234',
      studentName: 'Alice Inactive Old',
      active: false,
      save: jest.fn().mockResolvedValue(true)
    };
    OBEStudent.find.mockResolvedValue([inactiveStudent]);

    await importStudents(req, res, next);

    expect(inactiveStudent.save).toHaveBeenCalled();
    expect(inactiveStudent.active).toBe(true);
    expect(inactiveStudent.studentName).toBe('Alice Inactive');
    expect(OBEStudent.insertMany).not.toHaveBeenCalled();

    const result = res.json.mock.calls[0][0];
    expect(result.data.importedCount).toBe(1);
    expect(result.data.imported[0].reactivated).toBe(true);
  });

  test('detects duplicate registration numbers in spreadsheet batch', async () => {
    req.body = {
      students: [
        { registrationNo: '001234', studentName: 'Student One' },
        { registrationNo: '001234', studentName: 'Duplicate Student One' },
        { registrationNo: '005678', studentName: 'Student Two' }
      ]
    };

    OBEStudent.find.mockResolvedValue([]);
    OBEStudent.insertMany.mockImplementation(async (docs) => docs);

    await importStudents(req, res, next);

    const result = res.json.mock.calls[0][0];
    expect(result.data.totalProcessed).toBe(3);
    expect(result.data.importedCount).toBe(2);
    expect(result.data.invalidCount).toBe(1);
    expect(result.data.invalid[0].reason).toMatch(/Duplicate registration number in upload file/i);
    expect(result.data.invalid[0].row).toBe(2);
  });

  test('flags missing registration numbers or names as invalid with row details', async () => {
    req.body = {
      students: [
        { registrationNo: '', studentName: 'No Reg' },
        { registrationNo: '001234', studentName: '   ' },
        { registrationNo: null, studentName: undefined },
        { registrationNo: '  005555  ', studentName: '  Valid Student  ' }
      ]
    };

    OBEStudent.find.mockResolvedValue([]);
    OBEStudent.insertMany.mockImplementation(async (docs) => docs);

    await importStudents(req, res, next);

    const result = res.json.mock.calls[0][0];
    expect(result.data.totalProcessed).toBe(4);
    expect(result.data.invalidCount).toBe(3);
    expect(result.data.importedCount).toBe(1);
    expect(result.data.invalid[0].reason).toBe('Missing registration number');
    expect(result.data.invalid[1].reason).toBe('Missing student name');
    expect(result.data.invalid[2].reason).toBe('Missing registration number and student name');
    expect(OBEStudent.insertMany).toHaveBeenCalledWith([
      { course: courseId, faculty: facultyId, registrationNo: '005555', studentName: 'Valid Student', active: true }
    ]);
  });

  test('guarantees OBEMark is never touched during student import', async () => {
    req.body = {
      students: [{ registrationNo: '001234', studentName: 'Student' }]
    };
    OBEStudent.find.mockResolvedValue([]);
    OBEStudent.insertMany.mockResolvedValue([{ _id: 's1', registrationNo: '001234', studentName: 'Student' }]);

    await importStudents(req, res, next);

    expect(OBEMark.find).not.toHaveBeenCalled();
    expect(OBEMark.create).not.toHaveBeenCalled();
    expect(OBEMark.updateMany).not.toHaveBeenCalled();
    expect(OBEMark.deleteMany).not.toHaveBeenCalled();
  });

  describe('Replace Student List Mode', () => {
    test('rejects replace mode when spreadsheet contains invalid rows', async () => {
      req.body = {
        mode: 'replace',
        students: [
          { registrationNo: '001234', studentName: 'Valid Student' },
          { registrationNo: '', studentName: 'Invalid Student' }
        ]
      };

      await importStudents(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ErrorResponse));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/Cannot proceed with Replace mode/i);
      expect(OBEStudent.insertMany).not.toHaveBeenCalled();
    });

    test('rejects replace mode when spreadsheet contains duplicate registration numbers', async () => {
      req.body = {
        mode: 'replace',
        students: [
          { registrationNo: '001234', studentName: 'First One' },
          { registrationNo: '001234', studentName: 'Duplicate One' }
        ]
      };

      await importStudents(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ErrorResponse));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/duplicate registration number/i);
      expect(OBEStudent.insertMany).not.toHaveBeenCalled();
    });

    test('correctly adds new, retains matching, and soft-deletes missing students without deleting marks', async () => {
      req.body = {
        mode: 'replace',
        students: [
          { registrationNo: '001001', studentName: 'Alice Retained' }, // In DB, should be retained
          { registrationNo: '003003', studentName: 'Charlie New' }     // Not in DB, should be added
        ]
      };

      const alice = {
        _id: 'alice_id',
        course: courseId,
        faculty: facultyId,
        registrationNo: '001001',
        studentName: 'Alice Original Name',
        active: true,
        save: jest.fn().mockResolvedValue(true)
      };

      const bob = {
        _id: 'bob_id',
        course: courseId,
        faculty: facultyId,
        registrationNo: '002002',
        studentName: 'Bob Missing From File',
        active: true,
        save: jest.fn().mockResolvedValue(true)
      };

      OBEStudent.find.mockResolvedValue([alice, bob]);
      OBEStudent.insertMany.mockImplementation(async (docs) => {
        return docs.map((doc, idx) => ({ ...doc, _id: `created_${idx + 1}` }));
      });

      await importStudents(req, res, next);

      // Alice should be retained without overwriting her name silently
      expect(alice.save).not.toHaveBeenCalled();

      // Bob should be soft-deleted (active = false), NOT deleted from DB
      expect(bob.active).toBe(false);
      expect(bob.save).toHaveBeenCalled();
      expect(OBEStudent.deleteMany).not.toHaveBeenCalled();

      // Charlie should be inserted
      expect(OBEStudent.insertMany).toHaveBeenCalledWith([
        { course: courseId, faculty: facultyId, registrationNo: '003003', studentName: 'Charlie New', active: true }
      ]);

      // OBEMark must NEVER be touched
      expect(OBEMark.deleteMany).not.toHaveBeenCalled();

      const result = res.json.mock.calls[0][0];
      expect(result.success).toBe(true);
      expect(result.data.mode).toBe('replace');
      expect(result.data.addedCount).toBe(1);
      expect(result.data.retainedCount).toBe(1);
      expect(result.data.removedCount).toBe(1);
      expect(result.data.retained[0].registrationNo).toBe('001001');
      expect(result.data.added[0].registrationNo).toBe('003003');
      expect(result.data.removed[0].registrationNo).toBe('002002');
    });

    test('reactivates previously soft-deleted student if included in Replace mode file', async () => {
      req.body = {
        mode: 'replace',
        students: [
          { registrationNo: '001001', studentName: 'Alice Reactivated' }
        ]
      };

      const inactiveAlice = {
        _id: 'alice_id',
        course: courseId,
        faculty: facultyId,
        registrationNo: '001001',
        studentName: 'Alice Old',
        active: false,
        save: jest.fn().mockResolvedValue(true)
      };

      OBEStudent.find.mockResolvedValue([inactiveAlice]);
      OBEStudent.insertMany.mockResolvedValue([]);

      await importStudents(req, res, next);

      expect(inactiveAlice.active).toBe(true);
      expect(inactiveAlice.studentName).toBe('Alice Reactivated');
      expect(inactiveAlice.save).toHaveBeenCalled();

      const result = res.json.mock.calls[0][0];
      expect(result.data.addedCount).toBe(1);
      expect(result.data.added[0].reactivated).toBe(true);
      expect(result.data.retainedCount).toBe(0);
      expect(result.data.removedCount).toBe(0);
    });
  });
});

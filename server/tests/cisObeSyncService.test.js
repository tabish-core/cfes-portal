const { syncCISData } = require('../services/obe/cisObeSyncService');
const CIS = require('../models/CIS.model');
const OBEConfiguration = require('../models/OBEConfiguration.model');
const OBEAssessment = require('../models/OBEAssessment.model');
const ErrorResponse = require('../utils/errorResponse');

jest.mock('../models/CIS.model');
jest.mock('../models/OBEConfiguration.model');
jest.mock('../models/OBEAssessment.model');

describe('CIS to OBE Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const courseId = 'course123';
  const facultyId = 'faculty123';

  it('throws 404 if no CIS is found', async () => {
    CIS.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null)
    });

    await expect(syncCISData(courseId, facultyId)).rejects.toThrow(ErrorResponse);
  });

  it('syncs CLOs, grading policy, and creates new assessments (First Sync)', async () => {
    // Mock CIS data
    const cisData = {
      cloTable: [
        { cloNumber: 'CLO 1', cloStatement: 'Learn math' },
        { cloNumber: 'CLO 2', cloStatement: 'Learn physics' }
      ],
      gradingPolicy: {
        quizzes: 10, assignments: 20, midterm: 30, finalExam: 40
      },
      obaTable: [
        { category: 'Quiz', assessmentTool: 'Quiz 1', totalMarks: 10, cloMapped: 'CLO 1' },
        { category: 'Quiz', assessmentTool: 'Quiz 2', totalMarks: 15, cloMapped: 'CLO 2' },
        { category: 'Midterm', assessmentTool: 'Mid Term', totalMarks: 30, cloMapped: 'CLO 1, CLO 2' }, // multi-clo
        { category: 'Project', assessmentTool: 'Project 1', totalMarks: 100 } // unsupported
      ]
    };

    CIS.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(cisData)
    });

    const mockConfigSave = jest.fn();
    const configData = {
      clos: [],
      assessments: { quizzes: 0, assignments: 0, midTerm: 0, finalExam: 0 },
      save: mockConfigSave
    };
    OBEConfiguration.findOne.mockResolvedValue(configData);

    const mockAssessmentSave = jest.fn();
    OBEAssessment.findOne.mockResolvedValue(null);

    // Mock constructor for OBEAssessment
    OBEAssessment.mockImplementation((data) => {
      return {
        ...data,
        save: mockAssessmentSave
      };
    });

    const result = await syncCISData(courseId, facultyId);

    // Verifications
    expect(result.closSynced).toBe(2);
    expect(result.ignoredCategories).toBe(1); // Project
    expect(result.assessmentsCreated).toBe(2); // quizzes, midTerm
    expect(result.componentsCreated).toBe(3); // Q1, Q2, M1

    expect(configData.clos).toHaveLength(2);
    expect(configData.clos[0].description).toBe('Learn math');
    expect(configData.assessments.quizzes).toBe(10);
    expect(configData.assessments.midTerm).toBe(30);

    expect(mockConfigSave).toHaveBeenCalledTimes(1);
    expect(mockAssessmentSave).toHaveBeenCalledTimes(2); // one for quizzes, one for midTerm
  });

  it('updates existing components and preserves student marks isolation (Max marks changed)', async () => {
    // CIS data has an updated Quiz 1 (15 marks instead of 10)
    const cisData = {
      obaTable: [
        { category: 'Quiz', assessmentTool: 'Quiz 1', totalMarks: 15, cloMapped: 'CLO 1' },
      ]
    };
    CIS.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(cisData) });
    OBEConfiguration.findOne.mockResolvedValue({ clos: [], save: jest.fn() });

    // Existing OBE assessment for quizzes
    const mockAssessmentSave = jest.fn();
    const existingAssessment = {
      category: 'quizzes',
      components: [
        { title: 'Quiz 1', maxMarks: 10, componentNumber: 'Q1', cloNumber: 'CLO 1' }, // Exists
        { title: 'Quiz 2', maxMarks: 10, componentNumber: 'Q2', cloNumber: 'CLO 2' }  // Removed in CIS, but should be preserved
      ],
      save: mockAssessmentSave
    };

    OBEAssessment.findOne.mockResolvedValue(existingAssessment);

    const result = await syncCISData(courseId, facultyId);

    expect(result.componentsUpdated).toBe(1);
    expect(result.componentsCreated).toBe(0);

    // Max marks should be updated
    expect(existingAssessment.components[0].maxMarks).toBe(15);
    // Quiz 2 should still exist
    expect(existingAssessment.components.length).toBe(2);

    expect(mockAssessmentSave).toHaveBeenCalledTimes(1);
  });
});

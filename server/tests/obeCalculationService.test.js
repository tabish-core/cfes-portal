const { generateCourseResults, calculateGrade, ATTAINMENT_THRESHOLD } = require('../services/obe/obeCalculationService');

describe('OBE Calculation Service', () => {
  
  describe('calculateGrade', () => {
    const grades = { A: 88, BPlus: 81, B: 74, CPlus: 67, C: 60, F: 59 };

    it('returns A for >= 88', () => expect(calculateGrade(90, grades)).toBe('A'));
    it('returns B+ for >= 81', () => expect(calculateGrade(81, grades)).toBe('B+'));
    it('returns F for < 60', () => expect(calculateGrade(59, grades)).toBe('F'));
    it('returns - for null', () => expect(calculateGrade(null, grades)).toBe('-'));
  });

  describe('generateCourseResults', () => {
    const config = {
      assessments: { quizzes: 10, assignments: 25, midTerm: 25, finalExam: 40 },
      grades: { A: 88, BPlus: 81, B: 74, CPlus: 67, C: 60, F: 59 },
      clos: [
        { cloNumber: 'CLO 1', active: true },
        { cloNumber: 'CLO 2', active: true },
        { cloNumber: 'CLO 3', active: true }
      ],
      gas: [
        { gaNumber: 'GA 1', active: true },
        { gaNumber: 'GA 2', active: true }
      ],
      cloGaMapping: [
        { cloNumber: 'CLO 1', mappedGAs: ['GA 1'] },
        { cloNumber: 'CLO 2', mappedGAs: ['GA 1', 'GA 2'] }
      ]
    };

    const students = [
      { _id: 's1', registrationNo: '101', studentName: 'Alice' },
      { _id: 's2', registrationNo: '102', studentName: 'Bob' }
    ];

    const assessments = [
      {
        category: 'quizzes',
        active: true,
        components: [
          { _id: 'q1', componentNumber: 'Q1', maxMarks: 5, cloNumber: 'CLO 1', active: true },
          { _id: 'q2', componentNumber: 'Q2', maxMarks: 5, cloNumber: 'CLO 2', active: true }
        ]
      },
      {
        category: 'assignments',
        active: true,
        components: [
          { _id: 'a1', componentNumber: 'A1', maxMarks: 10, cloNumber: 'CLO 1', active: true }
        ]
      },
      {
        category: 'midTerm',
        active: true,
        components: [
          { _id: 'm1', componentNumber: 'M1', maxMarks: 20, cloNumber: 'CLO 2', active: true }
        ]
      },
      {
        category: 'finalExam',
        active: true,
        components: [
          { _id: 'f1', componentNumber: 'F1', maxMarks: 40, cloNumber: 'CLO 1', active: true }
        ]
      }
    ];

    it('calculates results properly for complete data', () => {
      const marks = [
        // Alice
        { student: 's1', componentId: 'q1', marks: 4 },
        { student: 's1', componentId: 'q2', marks: 3 }, // Quiz Total: 7/10 -> 70% of 10% = 7
        { student: 's1', componentId: 'a1', marks: 8 }, // Ass Total: 8/10 -> 80% of 25% = 20
        { student: 's1', componentId: 'm1', marks: 15 }, // Mid Total: 15/20 -> 75% of 25% = 18.75
        { student: 's1', componentId: 'f1', marks: 35 }, // Fin Total: 35/40 -> 87.5% of 40% = 35

        // Bob
        { student: 's2', componentId: 'q1', marks: 5 },
        { student: 's2', componentId: 'q2', marks: 5 },
        { student: 's2', componentId: 'a1', marks: 10 },
        { student: 's2', componentId: 'm1', marks: 20 },
        { student: 's2', componentId: 'f1', marks: 40 }
      ];

      const results = generateCourseResults(config, students, assessments, marks);
      
      const alice = results.students.find(s => s.studentId === 's1');
      expect(alice.categories.quizzes.achieved).toBe(7);
      expect(alice.categories.quizzes.max).toBe(10);
      expect(alice.categories.quizzes.contribution).toBe(7);

      expect(alice.sessionals).toBe(27); // 7 + 20
      expect(alice.overallPercentage).toBe(80.75); // 7 + 20 + 18.75 + 35
      expect(alice.grade).toBe('B');

      // CLO 1: Q1(5), A1(10), F1(40) -> Max 55. Alice achieved 4+8+35 = 47. 47/55 = 85.45%
      const clo1 = alice.clos.find(c => c.cloNumber === 'CLO 1');
      expect(clo1.percentage).toBe(85.45);
      expect(clo1.status).toBe('complete');
      expect(clo1.attained).toBe(true);

      // CLO 3 is active but has no components mapped
      const clo3 = alice.clos.find(c => c.cloNumber === 'CLO 3');
      expect(clo3.status).toBe('not-configured');
      expect(clo3.percentage).toBe(null);

      // GA 1: maps to CLO 1, CLO 2
      // CLO 2: Q2(5), M1(20) -> Max 25. Alice achieved 3+15 = 18. 18/25 = 72%
      const clo2 = alice.clos.find(c => c.cloNumber === 'CLO 2');
      expect(clo2.percentage).toBe(72);
      
      // GA 1 avg = (85.45 + 72) / 2 = 78.725 -> 78.73
      const ga1 = alice.gas.find(g => g.gaNumber === 'GA 1');
      expect(ga1.percentage).toBe(78.73);

      // Course Passing
      // Bob passed CLO 1 and CLO 2. Alice passed CLO 1 and CLO 2.
      // Denominator is now total active students (2)
      const clo1Pass = results.courseCLOPassing.find(c => c.cloNumber === 'CLO 1');
      expect(clo1Pass.percentage).toBe(100);
      
      const clo2Pass = results.courseCLOPassing.find(c => c.cloNumber === 'CLO 2');
      expect(clo2Pass.percentage).toBe(100);
    });

    it('calculates course-level passing percentages using COUNT over all students (workbook denominator)', () => {
      const marks = [
        // Alice has CLO 1 incomplete (blank Q1)
        { student: 's1', componentId: 'q2', marks: 3 }, 
        { student: 's1', componentId: 'a1', marks: 8 },
        { student: 's1', componentId: 'm1', marks: 15 },
        { student: 's1', componentId: 'f1', marks: 35 },
        // Bob has CLO 1 complete and passed (100%)
        { student: 's2', componentId: 'q1', marks: 5 },
        { student: 's2', componentId: 'q2', marks: 5 },
        { student: 's2', componentId: 'a1', marks: 10 },
        { student: 's2', componentId: 'm1', marks: 20 },
        { student: 's2', componentId: 'f1', marks: 40 }
      ];
      
      // We have 2 total students in the `students` array.
      // Alice is incomplete for CLO 1.
      // Bob passed CLO 1.
      // Valid denominator must be 2 (registration range), passing count is 1.
      // Percentage = 1/2 * 100 = 50%
      const results = generateCourseResults(config, students, assessments, marks);
      const clo1Pass = results.courseCLOPassing.find(c => c.cloNumber === 'CLO 1');
      expect(clo1Pass.percentage).toBe(50);
    });

    it('handles blank/missing marks correctly without assuming zero', () => {
      const marks = [
        // Alice has Q1 missing (blank), but has Q2
        { student: 's1', componentId: 'q2', marks: 3 }, 
        { student: 's1', componentId: 'a1', marks: 8 },
        { student: 's1', componentId: 'm1', marks: 15 },
        { student: 's1', componentId: 'f1', marks: 35 },
      ];

      const results = generateCourseResults(config, [students[0]], assessments, marks);
      const alice = results.students[0];

      // CLO 1 requires Q1, A1, F1. Since Q1 is missing, it should be incomplete
      const clo1 = alice.clos.find(c => c.cloNumber === 'CLO 1');
      expect(clo1.status).toBe('incomplete');
      expect(clo1.percentage).toBe(null);
      expect(clo1.attained).toBe(null);

      // CLO 2 requires Q2, M1. Both are present, should be complete
      const clo2 = alice.clos.find(c => c.cloNumber === 'CLO 2');
      expect(clo2.status).toBe('complete');
      expect(clo2.percentage).toBe(72);

      // GA 1 requires CLO 1 and CLO 2. Since CLO 1 is incomplete, GA 1 is incomplete.
      const ga1 = alice.gas.find(g => g.gaNumber === 'GA 1');
      expect(ga1.status).toBe('incomplete');
      expect(ga1.percentage).toBe(null);

      // Category total for quizzes: missing Q1 does NOT mean 0 for category Max. The Max is still 10.
      expect(alice.categories.quizzes.max).toBe(10);
      expect(alice.categories.quizzes.achieved).toBe(3); // Q2=3, Q1 is blank so it's not summed
      expect(alice.categories.quizzes.contribution).toBe(3); // 3/10 * 10%
    });

    it('treats explicit zero as a valid entered mark', () => {
      const marks = [
        // Alice has Q1 explicitly zero
        { student: 's1', componentId: 'q1', marks: 0 }, 
        { student: 's1', componentId: 'q2', marks: 3 }, 
        { student: 's1', componentId: 'a1', marks: 8 },
        { student: 's1', componentId: 'm1', marks: 15 },
        { student: 's1', componentId: 'f1', marks: 35 },
      ];

      const results = generateCourseResults(config, [students[0]], assessments, marks);
      const alice = results.students[0];

      // CLO 1 requires Q1, A1, F1. Q1 is 0, so it's complete.
      const clo1 = alice.clos.find(c => c.cloNumber === 'CLO 1');
      expect(clo1.status).toBe('complete');
      // Achieved: 0 + 8 + 35 = 43. Max: 55. 43/55 = 78.18%
      expect(clo1.percentage).toBe(78.18);
    });

    it('handles custom KPI thresholds and counts valid students properly', () => {
      const customConfig = { ...config, kpiThreshold: 70 };
      const marks = [
        { student: 's1', componentId: 'q1', marks: 5 }, { student: 's1', componentId: 'a1', marks: 10 }, { student: 's1', componentId: 'f1', marks: 40 },
        { student: 's1', componentId: 'q2', marks: 5 }, { student: 's1', componentId: 'm1', marks: 25 },
        { student: 's2', componentId: 'q1', marks: 2 }, { student: 's2', componentId: 'a1', marks: 5 }, { student: 's2', componentId: 'f1', marks: 20 },
        { student: 's2', componentId: 'q2', marks: 5 }, { student: 's2', componentId: 'm1', marks: 25 },
        // s3 is active but incomplete
      ];
      
      const results = generateCourseResults(customConfig, [...students, { _id: 's3', registrationNo: '12347', studentName: 'Test Student 3' }], assessments, marks);
      
      // Total students is 3
      expect(results.totalStudents).toBe(3);
      
      // s1 CLO1 % = (5+10+40)/55 = 100% -> >=70% -> attained
      // s2 CLO1 % = (2+5+20)/55 = 49% -> <70% -> not attained
      // s3 is incomplete
      const clo1Result = results.courseCLOPassing.find(c => c.cloNumber === 'CLO 1');
      expect(clo1Result.validCount).toBe(3); // Incomplete student remains in denominator
      expect(clo1Result.passCount).toBe(1); // Only s1 attained it
      expect(clo1Result.percentage).toBe(33.33); // 1/3
      expect(clo1Result.kpiAttained).toBe(false); // 33.33 < 70
      
      // Grade distribution should count all 3 students
      // s1: overall 100% -> A
      // s2: overall 67% -> C+
      // s3: overall 0% -> F
      expect(results.gradeDistribution).toEqual({
        'A': 1, 'B+': 0, 'B': 0, 'C+': 1, 'C': 0, 'F': 1
      });
    });

    it('handles zero students safely without division errors', () => {
      const results = generateCourseResults(config, [], assessments, []);
      expect(results.totalStudents).toBe(0);
      const clo1 = results.courseCLOPassing.find(c => c.cloNumber === 'CLO 1');
      expect(clo1.validCount).toBe(0);
      expect(clo1.passCount).toBe(0);
      expect(clo1.percentage).toBeNull();
      expect(clo1.kpiAttained).toBe(false);
      expect(results.gradeDistribution).toEqual({
        'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'F': 0
      });
    });

  });
});

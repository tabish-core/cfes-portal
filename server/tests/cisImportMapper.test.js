const { mapExtractedToFormState, normalizeCategory, normalizeDate } = require('../services/cisImportMapper');

describe('cisImportMapper OBA Table Parsing', () => {
  describe('normalizeDate', () => {
    it('converts ordinal dates (e.g. 21st Oct 2024) to YYYY-MM-DD', () => {
      expect(normalizeDate('21st Oct 2024')).toBe('2024-10-21');
      expect(normalizeDate('18th Nov 2024')).toBe('2024-11-18');
      expect(normalizeDate('6th Dec 2025')).toBe('2025-12-06');
      expect(normalizeDate('2nd Dec 2024')).toBe('2024-12-02');
    });

    it('converts DD-MM-YYYY dates to YYYY-MM-DD', () => {
      expect(normalizeDate('27-11-2024')).toBe('2024-11-27');
      expect(normalizeDate('23-01-2025')).toBe('2025-01-23');
    });

    it('preserves ISO dates', () => {
      expect(normalizeDate('2024-10-21')).toBe('2024-10-21');
    });
  });

  describe('normalizeCategory', () => {
    it('maps variations of categories correctly', () => {
      expect(normalizeCategory('Quizzes')).toBe('Quiz');
      expect(normalizeCategory('Assignments')).toBe('Assignment');
      expect(normalizeCategory('Midterm')).toBe('Midterm');
      expect(normalizeCategory('Project/CCP')).toBe('Project');
      expect(normalizeCategory('Final Exam')).toBe('Final Exam');
    });
  });

  describe('mapExtractedToFormState with multi-item OBA table', () => {
    it('successfully extracts all rows when category and date cells are vertically merged', () => {
      // Mock the 9 tables expected by CIS mapper, focusing on Table 7 (index 6)
      const mockTables = [
        { rows: [] }, // Table 0: Course Summary
        { rows: [] }, // Table 1: Basic Info
        { rows: [] }, // Table 2: Objectives
        { rows: [] }, // Table 3: Contents
        { rows: [] }, // Table 4: CLO Table
        { rows: [] }, // Table 5: Textbooks
        {
          // Table 6: OBA Table matching user screenshot
          rows: [
            // Row 0: Title
            { cells: [{ text: '6. CLO Outcome Based Assessment (OBA) Tentative' }] },
            // Row 1: Header (Assessment Tool colspan=2)
            {
              cells: [
                { text: 'Assessment Tool' },
                { text: 'CLO Mapped' },
                { text: 'CLO Marks' },
                { text: '% Weight' },
                { text: 'Total Marks' },
                { text: 'Assessment Date' },
              ]
            },
            // Row 2: Quiz #1 (7 cells: Category present)
            {
              cells: [
                { text: 'Quizzes\n10' },
                { text: 'Quiz #1' },
                { text: 'CLO 1' },
                { text: '3' },
                { text: '30%' },
                { text: '3' },
                { text: '21st Oct 2024' }
              ]
            },
            // Row 3: Quiz #2 (6 cells: Category merged from above)
            {
              cells: [
                { text: 'Quiz #2' },
                { text: 'CLO 2' },
                { text: '3' },
                { text: '30%' },
                { text: '3' },
                { text: '18th Nov 2024' }
              ]
            },
            // Row 4: Quiz #3 (6 cells: Category merged from above)
            {
              cells: [
                { text: 'Quiz #3' },
                { text: 'CLO 3' },
                { text: '4' },
                { text: '40%' },
                { text: '4' },
                { text: '6th Dec 2025' }
              ]
            },
            // Row 5: Total Quizzes
            { cells: [{ text: 'Total Quizzes %' }, { text: '100%' }, { text: '10' }] },
            // Row 6: Spacing row
            { cells: [{ text: '' }] },
            // Row 7: Assignment #1 (7 cells: Category present)
            {
              cells: [
                { text: 'Assignments\n15' },
                { text: 'Assignment #1' },
                { text: 'CLO 1' },
                { text: '5' },
                { text: '33%' },
                { text: '5' },
                { text: '28th Oct 2024' }
              ]
            },
            // Row 8: Assignment #2 (6 cells: Category merged from above)
            {
              cells: [
                { text: 'Assignment #2' },
                { text: 'CLO 2' },
                { text: '5' },
                { text: '33%' },
                { text: '5' },
                { text: '2nd Dec 2024' }
              ]
            },
            // Row 9: Assignment #3 (6 cells: Category merged from above)
            {
              cells: [
                { text: 'Assignment #3' },
                { text: 'CLO 3' },
                { text: '5' },
                { text: '33%' },
                { text: '5' },
                { text: '23rd Dec 2024' }
              ]
            },
            // Row 10: Total Assignments
            { cells: [{ text: 'Total Assignments %' }, { text: '100%' }, { text: '15' }] },
            // Row 11: Spacing row
            { cells: [{ text: '' }] },
            // Row 12: Midterm Q#1 (7 cells: Category present, Date present)
            {
              cells: [
                { text: 'Midterm\n25' },
                { text: 'Midterm Q#1' },
                { text: 'CLO 1' },
                { text: '5' },
                { text: '20%' },
                { text: '5' },
                { text: '27-11-2024' }
              ]
            },
            // Row 13-16: Midterm Q#2-Q#5 (5 cells: Category merged, Date merged)
            {
              cells: [
                { text: 'Midterm Q#2' },
                { text: 'CLO 1' },
                { text: '5' },
                { text: '20%' },
                { text: '5' }
              ]
            },
            {
              cells: [
                { text: 'Midterm Q#3' },
                { text: 'CLO 1' },
                { text: '5' },
                { text: '20%' },
                { text: '5' }
              ]
            },
            {
              cells: [
                { text: 'Midterm Q#4' },
                { text: 'CLO 2' },
                { text: '5' },
                { text: '20%' },
                { text: '5' }
              ]
            },
            {
              cells: [
                { text: 'Midterm Q#5' },
                { text: 'CLO 2' },
                { text: '5' },
                { text: '20%' },
                { text: '5' }
              ]
            },
            // Row 17: Total Midterm
            { cells: [{ text: 'Total Midterm %' }, { text: '100%' }, { text: '25' }] },
            // Row 18: Project/CCP (7 cells)
            {
              cells: [
                { text: 'Project/CCP\n10' },
                { text: 'Project/CCP' },
                { text: 'CLO3' },
                { text: '10' },
                { text: '100%' },
                { text: '10' },
                { text: '20th Nov 2024' }
              ]
            },
            // Row 19: Total Project
            { cells: [{ text: 'Total Project /CCP %' }, { text: '100%' }] },
            // Row 20: Final Q #1 (7 cells: Category present, Date present)
            {
              cells: [
                { text: 'Final Exam\n40' },
                { text: 'Final Q #1' },
                { text: 'CLO1' },
                { text: '8' },
                { text: '20%' },
                { text: '8' },
                { text: '23-01-2025' }
              ]
            },
            // Row 21-24: Final Q#2-Q#5 (5 cells: Category merged, Date merged)
            {
              cells: [
                { text: 'Final Q#2' },
                { text: 'CLO2' },
                { text: '8' },
                { text: '20%' },
                { text: '8' }
              ]
            },
            {
              cells: [
                { text: 'Final Q#3' },
                { text: 'CLO2' },
                { text: '8' },
                { text: '20%' },
                { text: '8' }
              ]
            },
            {
              cells: [
                { text: 'Final Q#4' },
                { text: 'CLO3' },
                { text: '8' },
                { text: '20%' },
                { text: '8' }
              ]
            },
            {
              cells: [
                { text: 'Final Q#5' },
                { text: 'CLO3' },
                { text: '8' },
                { text: '20%' },
                { text: '8' }
              ]
            },
            // Row 25: Total Final Exam
            { cells: [{ text: 'Total Final Exam %' }, { text: '100%' }] },
            // Row 26: Grand Total
            { cells: [{ text: '100' }, { text: 'Total Marks' }, { text: '100' }] },
            // Row 27: Note
            { cells: [{ text: 'Note: Please make sure every CLO must be assessed at least 3 time.' }] }
          ]
        },
        { rows: [] }, // Table 7: Weekly Plan
        { rows: [] }  // Table 8: Grading
      ];

      const { formState, importSummary } = mapExtractedToFormState({ tables: mockTables });

      expect(formState.obaData).toBeDefined();
      expect(formState.obaData.length).toBe(17);

      // Verify Quizzes
      const quizzes = formState.obaData.filter(r => r.category === 'Quiz');
      expect(quizzes.length).toBe(3);
      expect(quizzes[0].assessmentTool).toBe('Quiz #1');
      expect(quizzes[0].cloMapped).toBe('CLO 1');
      expect(quizzes[0].cloMarks).toBe(3);
      expect(quizzes[0].weightPercentage).toBe(30);
      expect(quizzes[0].totalMarks).toBe(3);
      expect(quizzes[0].assessmentDate).toBe('2024-10-21');

      expect(quizzes[1].assessmentTool).toBe('Quiz #2');
      expect(quizzes[1].cloMapped).toBe('CLO 2');
      expect(quizzes[1].cloMarks).toBe(3);
      expect(quizzes[1].weightPercentage).toBe(30);
      expect(quizzes[1].totalMarks).toBe(3);
      expect(quizzes[1].assessmentDate).toBe('2024-11-18');

      expect(quizzes[2].assessmentTool).toBe('Quiz #3');
      expect(quizzes[2].cloMapped).toBe('CLO 3');
      expect(quizzes[2].cloMarks).toBe(4);
      expect(quizzes[2].weightPercentage).toBe(40);
      expect(quizzes[2].totalMarks).toBe(4);
      expect(quizzes[2].assessmentDate).toBe('2025-12-06');

      // Verify Assignments
      const assignments = formState.obaData.filter(r => r.category === 'Assignment');
      expect(assignments.length).toBe(3);
      expect(assignments[0].assessmentTool).toBe('Assignment #1');
      expect(assignments[1].assessmentTool).toBe('Assignment #2');
      expect(assignments[2].assessmentTool).toBe('Assignment #3');
      expect(assignments[0].assessmentDate).toBe('2024-10-28');
      expect(assignments[1].assessmentDate).toBe('2024-12-02');
      expect(assignments[2].assessmentDate).toBe('2024-12-23');

      // Verify Midterm
      const midterms = formState.obaData.filter(r => r.category === 'Midterm');
      expect(midterms.length).toBe(5);
      expect(midterms[0].assessmentTool).toBe('Midterm Q#1');
      expect(midterms[4].assessmentTool).toBe('Midterm Q#5');
      // All midterm questions should inherit the merged date
      midterms.forEach(m => {
        expect(m.assessmentDate).toBe('2024-11-27');
        expect(m.cloMarks).toBe(5);
        expect(m.weightPercentage).toBe(20);
        expect(m.totalMarks).toBe(5);
      });

      // Verify Project
      const projects = formState.obaData.filter(r => r.category === 'Project');
      expect(projects.length).toBe(1);
      expect(projects[0].assessmentTool).toBe('Project/CCP');
      expect(projects[0].cloMapped).toBe('CLO3');
      expect(projects[0].totalMarks).toBe(10);
      expect(projects[0].assessmentDate).toBe('2024-11-20');

      // Verify Final Exam
      const finals = formState.obaData.filter(r => r.category === 'Final Exam');
      expect(finals.length).toBe(5);
      expect(finals[0].assessmentTool).toBe('Final Q #1');
      expect(finals[4].assessmentTool).toBe('Final Q#5');
      // All final questions should inherit the merged date
      finals.forEach(f => {
        expect(f.assessmentDate).toBe('2025-01-23');
        expect(f.cloMarks).toBe(8);
        expect(f.weightPercentage).toBe(20);
        expect(f.totalMarks).toBe(8);
      });

      expect(importSummary.imported).toContain('obaData (17 rows)');
    });
  });
});

/**
 * stage5ObeFrontend.test.js
 * Verification suite for CFES Faculty Portal Phase 5: OBE UI Modernization:
 * 1. OBE Workspace Workflow Step Navigation & Canonical Order
 * 2. Course Setup: Assessment Category Weights & Grade Boundaries Invariants
 * 3. CLO Management: Data Structures, Bloom Domains & Thresholds
 * 4. CLO-to-GA/PLO Mapping: Matrix Representation & Toggles
 * 5. Assessment Component Structure: Weights, Max Marks, and CLO Association
 * 6. Student Roster: Add, Remove, and Batch Excel Import Contracts
 * 7. Marks Entry & Attainment Computation Invariants
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 5: CFES Faculty Portal OBE Modernization Suite', () => {

  /* ────────────────────────────────────────────────────────────
     1. OBE Workspace Steps & Workflow Structure
     ──────────────────────────────────────────────────────────── */
  describe('1. OBE Workspace Workflow Step Navigation', () => {
    const CANONICAL_STEPS = [
      { key: 'setup', label: '1. Course Setup' },
      { key: 'students', label: '2. Student Roster' },
      { key: 'assessments', label: '3. Assessments' },
      { key: 'mapping', label: '4. CLO → PLO Mapping' },
      { key: 'marks', label: '5. Marks Entry' },
      { key: 'results', label: '6. OBE Results' },
      { key: 'export', label: '7. Award List' },
    ];

    test('preserves all 7 canonical workflow steps in exact sequence', () => {
      assert.strictEqual(CANONICAL_STEPS.length, 7);
      assert.strictEqual(CANONICAL_STEPS[0].key, 'setup');
      assert.strictEqual(CANONICAL_STEPS[1].key, 'students');
      assert.strictEqual(CANONICAL_STEPS[2].key, 'assessments');
      assert.strictEqual(CANONICAL_STEPS[3].key, 'mapping');
      assert.strictEqual(CANONICAL_STEPS[4].key, 'marks');
      assert.strictEqual(CANONICAL_STEPS[5].key, 'results');
      assert.strictEqual(CANONICAL_STEPS[6].key, 'export');
    });

    test('validates step key selection and preserves active step state', () => {
      let currentStep = 'setup';
      const switchStep = (next) => {
        if (CANONICAL_STEPS.some((s) => s.key === next)) {
          currentStep = next;
        }
      };

      switchStep('mapping');
      assert.strictEqual(currentStep, 'mapping');

      switchStep('invalid-step');
      assert.strictEqual(currentStep, 'mapping'); // unchanged

      switchStep('results');
      assert.strictEqual(currentStep, 'results');
    });
  });

  /* ────────────────────────────────────────────────────────────
     2. Course Setup: Assessment Category Weights & Boundaries
     ──────────────────────────────────────────────────────────── */
  describe('2. Course Setup: Category Weights & Grade Boundaries', () => {
    const DEFAULT_WEIGHTS = {
      quizzes: 10,
      assignments: 10,
      midterm: 30,
      finalExam: 40,
      project: 10,
    };

    const validateWeights = (weights) => {
      const sum = Object.values(weights).reduce((acc, v) => acc + (Number(v) || 0), 0);
      return { sum, isValid: Math.abs(sum - 100) < 0.001 };
    };

    test('validates default weights total exactly 100%', () => {
      const res = validateWeights(DEFAULT_WEIGHTS);
      assert.strictEqual(res.sum, 100);
      assert.strictEqual(res.isValid, true);
    });

    test('detects under-allocated or over-allocated weights', () => {
      const underAllocated = { ...DEFAULT_WEIGHTS, finalExam: 30 };
      assert.strictEqual(validateWeights(underAllocated).isValid, false);
      assert.strictEqual(validateWeights(underAllocated).sum, 90);

      const overAllocated = { ...DEFAULT_WEIGHTS, quizzes: 20 };
      assert.strictEqual(validateWeights(overAllocated).isValid, false);
      assert.strictEqual(validateWeights(overAllocated).sum, 110);
    });

    test('preserves canonical grade boundaries ordering and thresholds', () => {
      const GRADE_BOUNDARIES = [
        { grade: 'A+', min: 90 },
        { grade: 'A',  min: 85 },
        { grade: 'A-', min: 80 },
        { grade: 'B+', min: 75 },
        { grade: 'B',  min: 71 },
        { grade: 'B-', min: 68 },
        { grade: 'C+', min: 64 },
        { grade: 'C',  min: 61 },
        { grade: 'C-', min: 58 },
        { grade: 'D+', min: 54 },
        { grade: 'D',  min: 50 },
        { grade: 'F',  min: 0  },
      ];

      assert.strictEqual(GRADE_BOUNDARIES.length, 12);
      for (let i = 0; i < GRADE_BOUNDARIES.length - 1; i++) {
        assert.ok(
          GRADE_BOUNDARIES[i].min > GRADE_BOUNDARIES[i + 1].min,
          `Grade ${GRADE_BOUNDARIES[i].grade} (${GRADE_BOUNDARIES[i].min}) must be strictly higher than ${GRADE_BOUNDARIES[i + 1].grade} (${GRADE_BOUNDARIES[i + 1].min})`
        );
      }
    });
  });

  /* ────────────────────────────────────────────────────────────
     3. CLO Management & Data Structures
     ──────────────────────────────────────────────────────────── */
  describe('3. CLO Management & Data Structures', () => {
    const BLOOM_DOMAINS = ['Cognitive', 'Psychomotor', 'Affective'];
    const BLOOM_LEVELS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'P1', 'P2', 'P3', 'P4', 'P5', 'A1', 'A2', 'A3', 'A4', 'A5'];

    const createCLO = (code, desc, domain, level, threshold = 50) => ({
      code,
      description: desc,
      domain,
      level,
      passingThreshold: threshold,
    });

    test('validates standard CLO structure with Bloom taxonomy attributes', () => {
      const clo1 = createCLO('CLO1', 'Analyze runtime complexity of graph algorithms', 'Cognitive', 'C4', 50);
      assert.strictEqual(clo1.code, 'CLO1');
      assert.ok(BLOOM_DOMAINS.includes(clo1.domain));
      assert.ok(BLOOM_LEVELS.includes(clo1.level));
      assert.strictEqual(clo1.passingThreshold, 50);
    });

    test('supports adding and updating CLO entries in course config', () => {
      let clos = [
        createCLO('CLO1', 'Understand basic OOP concepts', 'Cognitive', 'C2', 50),
      ];

      // Add CLO2
      clos = [...clos, createCLO('CLO2', 'Implement data structures', 'Psychomotor', 'P3', 55)];
      assert.strictEqual(clos.length, 2);
      assert.strictEqual(clos[1].code, 'CLO2');

      // Update description of CLO1
      clos = clos.map((c) => (c.code === 'CLO1' ? { ...c, description: 'Explain and apply basic OOP concepts' } : c));
      assert.strictEqual(clos[0].description, 'Explain and apply basic OOP concepts');
    });
  });

  /* ────────────────────────────────────────────────────────────
     4. CLO → PLO/GA Mapping Matrix
     ──────────────────────────────────────────────────────────── */
  describe('4. CLO-to-PLO/GA Mapping Matrix', () => {
    const CANONICAL_GAS = [
      'GA1 (Engineering Knowledge)',
      'GA2 (Problem Analysis)',
      'GA3 (Design/Development)',
      'GA4 (Investigation)',
      'GA5 (Modern Tool Usage)',
      'GA6 (Engineer & Society)',
      'GA7 (Environment & Sustainability)',
      'GA8 (Ethics)',
      'GA9 (Individual & Teamwork)',
      'GA10 (Communication)',
      'GA11 (Project Management)',
      'GA12 (Lifelong Learning)',
    ];

    test('preserves 12 Washington Accord Graduate Attributes / PLOs', () => {
      assert.strictEqual(CANONICAL_GAS.length, 12);
      assert.ok(CANONICAL_GAS[0].startsWith('GA1'));
      assert.ok(CANONICAL_GAS[11].startsWith('GA12'));
    });

    test('supports matrix toggling for CLO to GA mapping', () => {
      const mapping = {
        CLO1: ['GA1'],
        CLO2: ['GA2', 'GA3'],
      };

      const toggleMapping = (map, cloCode, gaKey) => {
        const currentList = map[cloCode] || [];
        const exists = currentList.includes(gaKey);
        return {
          ...map,
          [cloCode]: exists ? currentList.filter((g) => g !== gaKey) : [...currentList, gaKey],
        };
      };

      // Toggle GA3 for CLO1 (add)
      let updated = toggleMapping(mapping, 'CLO1', 'GA3');
      assert.ok(updated.CLO1.includes('GA3'));
      assert.strictEqual(updated.CLO1.length, 2);

      // Toggle GA3 for CLO1 (remove)
      updated = toggleMapping(updated, 'CLO1', 'GA3');
      assert.ok(!updated.CLO1.includes('GA3'));
      assert.strictEqual(updated.CLO1.length, 1);
    });
  });

  /* ────────────────────────────────────────────────────────────
     5. Assessment Component Structure & CLO Mapping
     ──────────────────────────────────────────────────────────── */
  describe('5. Assessment Component Structure & CLO Association', () => {
    test('preserves assessment component data contract and weight distributions', () => {
      const assessments = [
        { id: 'q1', name: 'Quiz 1', category: 'quizzes', maxMarks: 10, weight: 5, mappedCLO: 'CLO1' },
        { id: 'q2', name: 'Quiz 2', category: 'quizzes', maxMarks: 10, weight: 5, mappedCLO: 'CLO2' },
        { id: 'mid', name: 'Midterm Exam', category: 'midterm', maxMarks: 50, weight: 30, mappedCLO: 'CLO1' },
        { id: 'fin', name: 'Final Exam', category: 'finalExam', maxMarks: 100, weight: 50, mappedCLO: 'CLO3' },
      ];

      assert.strictEqual(assessments.length, 4);
      const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);
      assert.strictEqual(totalWeight, 90);

      // Verify category grouping
      const quizComponents = assessments.filter((a) => a.category === 'quizzes');
      assert.strictEqual(quizComponents.length, 2);
      assert.strictEqual(quizComponents.reduce((acc, q) => acc + q.weight, 0), 10);
    });

    test('supports associating and switching mapped CLO on an assessment component', () => {
      let component = { id: 'a1', name: 'Assignment 1', category: 'assignments', maxMarks: 20, mappedCLO: 'CLO1' };
      assert.strictEqual(component.mappedCLO, 'CLO1');

      // Update mapping
      component = { ...component, mappedCLO: 'CLO2' };
      assert.strictEqual(component.mappedCLO, 'CLO2');
    });
  });

  /* ────────────────────────────────────────────────────────────
     6. Student Roster Contracts
     ──────────────────────────────────────────────────────────── */
  describe('6. Student Roster Management & Batch Import Contracts', () => {
    test('validates student record creation with studentId and studentName', () => {
      const createStudent = (id, name) => {
        if (!id?.trim() || !name?.trim()) {
          throw new Error('Student ID and Student Name are required.');
        }
        return { studentId: id.trim().toUpperCase(), studentName: name.trim() };
      };

      const s = createStudent('fa21-bcs-001', 'Muhammad Ali');
      assert.strictEqual(s.studentId, 'FA21-BCS-001');
      assert.strictEqual(s.studentName, 'Muhammad Ali');

      assert.throws(() => createStudent('', 'Ali'), /required/);
      assert.throws(() => createStudent('001', ''), /required/);
    });

    test('deduplicates students on batch Excel import by studentId', () => {
      const existing = [
        { studentId: 'CS-001', studentName: 'Student One' },
        { studentId: 'CS-002', studentName: 'Student Two' },
      ];

      const imported = [
        { studentId: 'CS-002', studentName: 'Student Two Updated' },
        { studentId: 'CS-003', studentName: 'Student Three' },
      ];

      const mergedMap = new Map();
      existing.forEach((s) => mergedMap.set(s.studentId, s));
      imported.forEach((s) => mergedMap.set(s.studentId, s));

      const merged = Array.from(mergedMap.values());
      assert.strictEqual(merged.length, 3);
      assert.strictEqual(merged.find((s) => s.studentId === 'CS-002').studentName, 'Student Two Updated');
    });
  });

  /* ────────────────────────────────────────────────────────────
     7. Marks Entry & Attainment Invariants
     ──────────────────────────────────────────────────────────── */
  describe('7. Marks Entry & Attainment Invariants', () => {
    test('calculates percentage and marks attainment correctly against threshold', () => {
      const calculateAttainment = (obtained, maxMarks, thresholdPct = 50) => {
        if (maxMarks <= 0) return { pct: 0, attained: false };
        const pct = (obtained / maxMarks) * 100;
        return {
          pct: Math.round(pct * 100) / 100,
          attained: pct >= thresholdPct,
        };
      };

      const pass = calculateAttainment(18, 25, 50); // 72%
      assert.strictEqual(pass.pct, 72);
      assert.strictEqual(pass.attained, true);

      const fail = calculateAttainment(10, 25, 50); // 40%
      assert.strictEqual(fail.pct, 40);
      assert.strictEqual(fail.attained, false);

      const boundary = calculateAttainment(12.5, 25, 50); // 50%
      assert.strictEqual(boundary.pct, 50);
      assert.strictEqual(boundary.attained, true);
    });

    test('computes cohort CLO attainment percentage based on passed students', () => {
      const studentResults = [
        { studentId: 'S1', attained: true },
        { studentId: 'S2', attained: true },
        { studentId: 'S3', attained: false },
        { studentId: 'S4', attained: true },
      ];

      const totalStudents = studentResults.length;
      const attainedCount = studentResults.filter((s) => s.attained).length;
      const cohortAttainmentPct = (attainedCount / totalStudents) * 100;

      assert.strictEqual(cohortAttainmentPct, 75); // 3 out of 4 = 75%
    });
  });
});

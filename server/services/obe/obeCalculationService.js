/**
 * OBE Calculation Service
 * 
 * Implements pure functions for calculating Outcome Based Education metrics
 * strictly following the official workbook logic.
 */

const ATTAINMENT_THRESHOLD = 50;

/**
 * Rounds a number to a specific number of decimal places for final output
 */
const round = (value, decimals = 2) => {
  if (value === null || value === undefined) return null;
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
};

/**
 * Determines the grade based on overall percentage
 */
const calculateGrade = (percentage, gradeBoundaries) => {
  if (percentage === null || percentage === undefined) return '-';
  if (percentage >= gradeBoundaries.A) return 'A';
  if (percentage >= gradeBoundaries.BPlus) return 'B+';
  if (percentage >= gradeBoundaries.B) return 'B';
  if (percentage >= gradeBoundaries.CPlus) return 'C+';
  if (percentage >= gradeBoundaries.C) return 'C';
  return 'F';
};

/**
 * Main function to generate full course results
 */
exports.generateCourseResults = (config, students, assessments, marks) => {
  // 1. Build lookup maps
  const marksMap = new Map(); // studentId_componentId -> numeric mark
  marks.forEach(m => {
    const studentId = m.student?.toString();
    const componentId = (m.componentId || m.component)?.toString();
    if (studentId && componentId) {
      marksMap.set(`${studentId}_${componentId}`, m.marks);
    }
  });

  const activeComponents = [];
  const componentsByClo = new Map(); // cloNumber -> array of components

  assessments.forEach(assessment => {
    if (assessment.active && assessment.components) {
      assessment.components.forEach(comp => {
        if (comp.active) {
          const c = {
            id: comp._id.toString(),
            assessmentCategory: assessment.category,
            maxMarks: comp.maxMarks,
            cloNumber: comp.cloNumber
          };
          activeComponents.push(c);
          
          if (!componentsByClo.has(comp.cloNumber)) {
            componentsByClo.set(comp.cloNumber, []);
          }
          componentsByClo.get(comp.cloNumber).push(c);
        }
      });
    }
  });

  const activeClos = (config.clos || []).filter(c => c.active);
  const activeGas = (config.gas || []).filter(g => g.active);
  const cloGaMapping = config.cloGaMapping || [];

  // Map GA -> active mapped CLO strings
  const gasToClos = new Map();
  activeGas.forEach(ga => {
    gasToClos.set(ga.gaNumber, []);
  });
  cloGaMapping.forEach(mapping => {
    if (activeClos.some(c => c.cloNumber === mapping.cloNumber)) {
      mapping.mappedGAs.forEach(mappedGaNumber => {
        if (gasToClos.has(mappedGaNumber)) {
          gasToClos.get(mappedGaNumber).push(mapping.cloNumber);
        }
      });
    }
  });

  // 2. Process each student
  const studentResults = students.map(student => {
    const studentId = student._id.toString();

    // A. Category Calculations
    const categories = {
      quizzes: { achieved: 0, max: 0, contribution: 0 },
      assignments: { achieved: 0, max: 0, contribution: 0 },
      midTerm: { achieved: 0, max: 0, contribution: 0 },
      finalExam: { achieved: 0, max: 0, contribution: 0 }
    };

    activeComponents.forEach(comp => {
      categories[comp.assessmentCategory].max += comp.maxMarks;
      const markKey = `${studentId}_${comp.id}`;
      if (marksMap.has(markKey)) {
        categories[comp.assessmentCategory].achieved += marksMap.get(markKey);
      }
    });

    ['quizzes', 'assignments', 'midTerm', 'finalExam'].forEach(cat => {
      const weight = config.assessments[cat] || 0;
      if (categories[cat].max > 0) {
        categories[cat].contribution = (categories[cat].achieved / categories[cat].max) * weight;
      }
    });

    // B. Sessionals & Overall
    const sessionals = categories.quizzes.contribution + categories.assignments.contribution;
    const overallPercentage = sessionals + categories.midTerm.contribution + categories.finalExam.contribution;
    const grade = calculateGrade(overallPercentage, config.grades);

    // C. CLO Attainment
    const cloResults = [];
    const cloResultMap = new Map();

    activeClos.forEach(clo => {
      const mappedComps = componentsByClo.get(clo.cloNumber) || [];
      
      let result = { cloNumber: clo.cloNumber, percentage: null, attained: null, status: '' };

      if (mappedComps.length === 0) {
        result.status = 'not-configured';
      } else {
        let allEntered = true;
        let achieved = 0;
        let max = 0;

        for (const comp of mappedComps) {
          const markKey = `${studentId}_${comp.id}`;
          if (!marksMap.has(markKey)) {
            allEntered = false;
            break;
          }
          achieved += marksMap.get(markKey);
          max += comp.maxMarks;
        }

        if (!allEntered) {
          result.status = 'incomplete';
        } else {
          result.status = 'complete';
          result.percentage = max > 0 ? (achieved / max) * 100 : 0;
          result.attained = result.percentage >= ATTAINMENT_THRESHOLD;
        }
      }

      cloResults.push(result);
      cloResultMap.set(clo.cloNumber, result);
    });

    // D. GA Attainment
    const gaResults = [];
    activeGas.forEach(ga => {
      const mappedCloNumbers = gasToClos.get(ga.gaNumber) || [];
      
      let result = { gaNumber: ga.gaNumber, percentage: null, attained: null, status: '' };

      if (mappedCloNumbers.length === 0) {
        result.status = 'not-configured';
      } else {
        let allComplete = true;
        let totalPercentage = 0;

        for (const cloNum of mappedCloNumbers) {
          const cloRes = cloResultMap.get(cloNum);
          if (!cloRes || cloRes.status !== 'complete') {
            allComplete = false;
            break;
          }
          totalPercentage += cloRes.percentage;
        }

        if (!allComplete) {
          result.status = 'incomplete';
        } else {
          result.status = 'complete';
          result.percentage = totalPercentage / mappedCloNumbers.length;
          result.attained = result.percentage >= ATTAINMENT_THRESHOLD;
        }
      }
      
      gaResults.push(result);
    });

    return {
      studentId: student._id,
      registrationNo: student.registrationNo,
      studentName: student.studentName,
      categories: {
        quizzes: {
          achieved: round(categories.quizzes.achieved),
          max: round(categories.quizzes.max),
          contribution: round(categories.quizzes.contribution)
        },
        assignments: {
          achieved: round(categories.assignments.achieved),
          max: round(categories.assignments.max),
          contribution: round(categories.assignments.contribution)
        },
        midTerm: {
          achieved: round(categories.midTerm.achieved),
          max: round(categories.midTerm.max),
          contribution: round(categories.midTerm.contribution)
        },
        finalExam: {
          achieved: round(categories.finalExam.achieved),
          max: round(categories.finalExam.max),
          contribution: round(categories.finalExam.contribution)
        }
      },
      sessionals: round(sessionals),
      overallPercentage: round(overallPercentage),
      grade,
      clos: cloResults.map(c => ({
        ...c,
        percentage: round(c.percentage)
      })),
      gas: gaResults.map(g => ({
        ...g,
        percentage: round(g.percentage)
      }))
    };
  });

  // 3. Course-level Passing Percentages
  const courseCLOPassing = [];
  const kpiThreshold = config.kpiThreshold != null ? config.kpiThreshold : 60;
  const validCount = studentResults.length; // Denominator is COUNT over student registration range

  activeClos.forEach(clo => {
    let passCount = 0;

    studentResults.forEach(sr => {
      const cloRes = sr.clos.find(c => c.cloNumber === clo.cloNumber);
      if (cloRes && cloRes.status === 'complete' && cloRes.attained) {
        passCount++;
      }
    });

    const percentage = validCount > 0 ? round((passCount / validCount) * 100) : null;
    
    courseCLOPassing.push({
      cloNumber: clo.cloNumber,
      percentage,
      passCount,
      validCount,
      kpiAttained: percentage != null ? percentage >= kpiThreshold : false
    });
  });

  const courseGAPassing = [];
  activeGas.forEach(ga => {
    let passCount = 0;

    studentResults.forEach(sr => {
      const gaRes = sr.gas.find(g => g.gaNumber === ga.gaNumber);
      if (gaRes && gaRes.status === 'complete' && gaRes.attained) {
        passCount++;
      }
    });

    const percentage = validCount > 0 ? round((passCount / validCount) * 100) : null;
    
    courseGAPassing.push({
      gaNumber: ga.gaNumber,
      percentage,
      passCount,
      validCount,
      kpiAttained: percentage != null ? percentage >= kpiThreshold : false
    });
  });
  
  // 4. Grade Distribution & Summary
  const gradeDistribution = {
    'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'F': 0
  };
  
  studentResults.forEach(sr => {
    if (sr.grade && gradeDistribution[sr.grade] !== undefined) {
      gradeDistribution[sr.grade]++;
    } else if (sr.grade && Object.keys(gradeDistribution).includes(sr.grade)) {
      gradeDistribution[sr.grade]++;
    }
  });

  return {
    students: studentResults,
    courseCLOPassing,
    courseGAPassing,
    gradeDistribution,
    totalStudents: validCount
  };
};

// Exported for testing purposes
exports.calculateGrade = calculateGrade;
exports.ATTAINMENT_THRESHOLD = ATTAINMENT_THRESHOLD;

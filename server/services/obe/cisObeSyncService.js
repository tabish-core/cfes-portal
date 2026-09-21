const ErrorResponse = require('../../utils/errorResponse');
const CIS = require('../../models/CIS.model');
const OBEConfiguration = require('../../models/OBEConfiguration.model');
const OBEAssessment = require('../../models/OBEAssessment.model');

// Map CIS categories to OBE categories
const CATEGORY_MAP = {
  'Quiz': 'quizzes',
  'Assignment': 'assignments',
  'Midterm': 'midTerm',
  'Final Exam': 'finalExam'
};

const generateNextComponentNumber = (assessment, category) => {
  const prefixMap = { quizzes: 'Q', assignments: 'A', midTerm: 'M', finalExam: 'F' };
  const prefix = prefixMap[category];
  
  if (!assessment.components || assessment.components.length === 0) {
    return `${prefix}1`;
  }
  
  // Find highest number
  let maxNum = 0;
  for (const comp of assessment.components) {
    const numPart = comp.componentNumber.replace(prefix, '');
    const num = parseInt(numPart, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  
  return `${prefix}${maxNum + 1}`;
};

/**
 * Synchronizes CIS data (CLOs, grading policy, assessments) into OBE workspace.
 * Uses existing OBE architecture, ensures idempotency, and preserves student marks.
 */
exports.syncCISData = async (courseId, facultyId) => {
  // 1. Fetch CIS document
  // Sort by createdAt desc just in case there's multiple (though schema has unique index)
  const cisDoc = await CIS.findOne({ course: courseId, faculty: facultyId }).sort({ createdAt: -1 });
  if (!cisDoc) {
    throw new ErrorResponse('No Course Information Sheet (CIS) found for this course in your workspace.', 404);
  }

  const resultSummary = {
    closSynced: 0,
    assessmentsCreated: 0,
    componentsCreated: 0,
    componentsUpdated: 0,
    ignoredCategories: 0
  };

  // 2. Load or Create OBEConfiguration
  let config = await OBEConfiguration.findOne({ course: courseId, faculty: facultyId });
  if (!config) {
    config = new OBEConfiguration({
      course: courseId,
      faculty: facultyId,
      clos: [],
      gas: [],
      cloGaMapping: [],
      assessments: { quizzes: 10, assignments: 25, midTerm: 25, finalExam: 40 }
    });
  }

  // 3. Sync CLOs
  if (cisDoc.cloTable && cisDoc.cloTable.length > 0) {
    cisDoc.cloTable.forEach(cisClo => {
      if (!cisClo.cloNumber) return; // Skip empty rows

      const existingClo = config.clos.find(c => c.cloNumber === cisClo.cloNumber);
      if (existingClo) {
        // Update description, keep active status
        existingClo.description = cisClo.cloStatement || existingClo.description;
      } else {
        // Create new
        config.clos.push({
          cloNumber: cisClo.cloNumber,
          description: cisClo.cloStatement || '',
          active: true
        });
      }
    });
    resultSummary.closSynced = cisDoc.cloTable.filter(c => c.cloNumber).length;
  }

  // 4. Sync Grading Policy
  if (cisDoc.gradingPolicy) {
    const gp = cisDoc.gradingPolicy;
    const quizzes = Number(gp.quizzes || 0);
    const assignments = Number(gp.assignments || 0);
    const midTerm = Number(gp.midterm || 0);
    const finalExam = Number(gp.finalExam || 0);

    const total = quizzes + assignments + midTerm + finalExam;
    
    // Only apply if it equals 100%, otherwise OBE config validation will fail
    // We ignore the project component from CIS if it causes it to not equal 100, 
    // or if the faculty hasn't filled it properly.
    if (total === 100) {
      config.assessments = { quizzes, assignments, midTerm, finalExam };
    }
  }

  await config.save();

  // 5. Sync Assessments
  if (cisDoc.obaTable && cisDoc.obaTable.length > 0) {
    // Group CIS OBA rows by mapped OBE category
    const componentsByCategory = {
      quizzes: [],
      assignments: [],
      midTerm: [],
      finalExam: []
    };

    cisDoc.obaTable.forEach(obaRow => {
      const obeCategory = CATEGORY_MAP[obaRow.category];
      if (obeCategory) {
        componentsByCategory[obeCategory].push(obaRow);
      } else {
        // Ignore unsupported categories (Project, Lab, etc)
        resultSummary.ignoredCategories++;
      }
    });

    // Process each supported category
    for (const [obeCategory, rows] of Object.entries(componentsByCategory)) {
      if (rows.length === 0) continue;

      // Ensure the assessment bucket exists
      let assessment = await OBEAssessment.findOne({ course: courseId, faculty: facultyId, category: obeCategory });
      if (!assessment) {
        // Default titles based on category
        const defaultTitles = {
          quizzes: 'Quizzes',
          assignments: 'Assignments',
          midTerm: 'Mid Term',
          finalExam: 'Final Exam'
        };
        const orderMap = { quizzes: 0, assignments: 1, midTerm: 100, finalExam: 200 };

        assessment = new OBEAssessment({
          course: courseId,
          faculty: facultyId,
          category: obeCategory,
          title: defaultTitles[obeCategory],
          order: orderMap[obeCategory],
          active: true,
          components: []
        });
        resultSummary.assessmentsCreated++;
      }

      // Sync components
      for (const row of rows) {
        if (!row.assessmentTool) continue; // Must have a title to sync

        // Match by title
        const existingComponent = assessment.components.find(
          c => c.title && c.title.toLowerCase() === row.assessmentTool.toLowerCase()
        );

        const cloNum = row.cloMapped || (config.clos.length > 0 ? config.clos[0].cloNumber : '1');
        const maxMarks = Number(row.totalMarks) || 0;

        if (existingComponent) {
          // Update existing
          if (maxMarks > 0) existingComponent.maxMarks = maxMarks;
          existingComponent.cloNumber = cloNum;
          existingComponent.active = true;
          resultSummary.componentsUpdated++;
        } else {
          // Create new
          const compNum = generateNextComponentNumber(assessment, obeCategory);
          assessment.components.push({
            componentNumber: compNum,
            title: row.assessmentTool,
            maxMarks: maxMarks > 0 ? maxMarks : 1, // Need at least > 0 for validation
            cloNumber: cloNum,
            active: true
          });
          resultSummary.componentsCreated++;
        }
      }

      await assessment.save();
    }
  }

  return resultSummary;
};

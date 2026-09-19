const express = require('express');
const { 
  getConfig, updateConfig, 
  getStudents, createStudent, updateStudent, deleteStudent,
  getAssessments, createAssessment, updateAssessment, deleteAssessment,
  addComponent, updateComponent, deleteComponent,
  getMarks, saveMarksBulk, getResults, exportOBEExcel
} = require('../controllers/obe.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// All OBE routes are protected
router.use(verifyToken);

// Config routes
router.route('/:courseId/config')
  .get(getConfig)
  .post(updateConfig)
  .put(updateConfig);

// Student routes
router.route('/:courseId/students')
  .get(getStudents)
  .post(createStudent);

router.route('/:courseId/students/:studentId')
  .put(updateStudent)
  .delete(deleteStudent);

// Assessment routes
router.route('/:courseId/assessments')
  .get(getAssessments)
  .post(createAssessment);

router.route('/:courseId/assessments/:assessmentId')
  .put(updateAssessment)
  .delete(deleteAssessment);

// Assessment Component routes
router.route('/:courseId/assessments/:assessmentId/components')
  .post(addComponent);

router.route('/:courseId/assessments/:assessmentId/components/:componentId')
  .put(updateComponent)
  .delete(deleteComponent);

// Student Marks routes
router.route('/:courseId/marks')
  .get(getMarks);

router.route('/:courseId/marks/bulk')
  .put(saveMarksBulk);

// OBE Results route
router.route('/:courseId/results')
  .get(getResults);

// Export route
router.route('/:courseId/export/excel')
  .get(exportOBEExcel);

module.exports = router;

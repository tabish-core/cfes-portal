const express = require('express');
const assignmentController = require('../controllers/assignment.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// All assignment routes require authentication
router.get('/course/:courseId', verifyToken, assignmentController.getAssignmentsForCourse);
router.get('/:assignmentId', verifyToken, assignmentController.getAssignment);
router.post('/', verifyToken, assignmentController.createAssignment);
router.put('/:assignmentId', verifyToken, assignmentController.updateAssignment);
router.delete('/:assignmentId', verifyToken, assignmentController.deleteAssignment);
router.get('/:assignmentId/export', verifyToken, assignmentController.exportAssignmentWord);

module.exports = router;

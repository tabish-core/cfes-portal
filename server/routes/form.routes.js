const express = require('express');
const formController = require('../controllers/form.controller');
const timetableController = require('../controllers/timetable.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply verifyToken middleware so req.user is dynamically populated
router.get('/ccr/:courseId', verifyToken, formController.getCCRForm);
router.post('/ccr', verifyToken, formController.saveCCRForm);
router.get('/ccr/:courseId/export', verifyToken, formController.exportCCRForm);

router.get('/cis/:courseId', verifyToken, formController.getCISForm);
router.post('/cis', verifyToken, formController.saveCISForm);
router.get('/cis/:courseId/export', verifyToken, formController.exportCISForm);

router.get('/ccc/:courseId', verifyToken, formController.getCCCForm);
router.post('/ccc', verifyToken, formController.saveCCCForm);
router.get('/ccc/:courseId/export', verifyToken, formController.exportCCCForm);

router.get('/course-review/:courseId', verifyToken, formController.getCourseReviewForm);
router.post('/course-review', verifyToken, formController.saveCourseReviewForm);
router.get('/course-review/:courseId/export', verifyToken, formController.exportCourseReviewForm);

// Timetable with Consulting Hours
router.get('/timetable/export', verifyToken, timetableController.exportTimetable);
router.get('/timetable/:courseId/export', verifyToken, timetableController.exportTimetable);
router.get('/timetable/:courseId', verifyToken, timetableController.getTimetable);
router.get('/timetable', verifyToken, timetableController.getTimetable);
router.post('/timetable', verifyToken, timetableController.saveTimetable);
router.put('/timetable', verifyToken, timetableController.saveTimetable);

module.exports = router;


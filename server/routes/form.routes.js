const express = require('express');
const formController = require('../controllers/form.controller');
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

module.exports = router;

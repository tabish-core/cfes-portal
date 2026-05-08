const express = require('express');
const formController = require('../controllers/form.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply verifyToken middleware so req.user is dynamically populated
router.get('/ccr/:courseId', verifyToken, formController.getCCRForm);
router.post('/ccr', verifyToken, formController.saveCCRForm);

router.get('/cis/:courseId', verifyToken, formController.getCISForm);
router.post('/cis', verifyToken, formController.saveCISForm);

module.exports = router;

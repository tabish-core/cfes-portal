const express = require('express');
const checklistController = require('../controllers/checklist.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/offering/:offeringId', verifyToken, checklistController.getChecklistByOffering);
router.get('/:courseId', verifyToken, checklistController.getChecklist);
router.post('/', verifyToken, checklistController.saveChecklist);


module.exports = router;

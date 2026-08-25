const express = require('express');
const quizController = require('../controllers/quiz.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// All quiz routes require authentication
router.get('/course/:courseId', verifyToken, quizController.getQuizzesForCourse);
router.get('/:quizId', verifyToken, quizController.getQuiz);
router.post('/', verifyToken, quizController.createQuiz);
router.put('/:quizId', verifyToken, quizController.updateQuiz);
router.delete('/:quizId', verifyToken, quizController.deleteQuiz);
router.get('/:quizId/export', verifyToken, quizController.exportQuizWord);

module.exports = router;

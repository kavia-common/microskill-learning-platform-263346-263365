const express = require('express');
const healthController = require('../controllers/health');
const lessonsController = require('../controllers/lessons');
const quizController = require('../controllers/quiz');
const progressController = require('../controllers/progress');

const router = express.Router();

// Health
router.get('/', healthController.check.bind(healthController));

// Lessons
router.get('/api/lessons', lessonsController.list);
router.get('/api/lessons/:id', lessonsController.getById);

// Quiz
router.get('/api/lessons/:id/quiz', quizController.getForLesson);
router.post('/api/lessons/:id/quiz', quizController.submitForLesson);

// Progress
router.get('/api/progress', progressController.get);
router.post('/api/progress', progressController.update);

module.exports = router;

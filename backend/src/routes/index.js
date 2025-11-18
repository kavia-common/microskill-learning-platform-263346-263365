const express = require('express');
const healthController = require('../controllers/health');
const lessonsController = require('../controllers/lessons');
const microLessonsController = require('../controllers/microLessons');
const quizController = require('../controllers/quiz');
const progressController = require('../controllers/progress');

const router = express.Router();

// Health
router.get('/', healthController.check.bind(healthController));

/**
 * Built-in Micro Lessons (video-first fields)
 * - GET /api/lessons           -> [{id,title}]
 * - GET /api/lessons/:id       -> full lesson payload
 */
router.get('/api/lessons', microLessonsController.list);
router.get('/api/lessons/:id', microLessonsController.getById);

/**
 * Legacy/DB-backed Lessons (kept for compatibility)
 * Moved under /api/content/*
 */
router.get('/api/content/lessons', lessonsController.list);
router.get('/api/content/lessons/:id', lessonsController.getById);

// Quiz
router.get('/api/lessons/:id/quiz', quizController.getForLesson);
router.post('/api/lessons/:id/quiz', quizController.submitForLesson);

// Progress
router.get('/api/progress', progressController.get);
router.post('/api/progress', progressController.update);

module.exports = router;

'use strict';

const { getState, validateQuiz } = require('../utils/db');

module.exports = {
  // PUBLIC_INTERFACE
  async getQuizByLessonId(lessonId) {
    /** Returns quiz for a lessonId; null if not found. */
    const db = await getState();
    const quiz = db.quizzes.find((q) => q.lessonId === String(lessonId));
    return quiz && validateQuiz(quiz) ? quiz : null;
  }
};

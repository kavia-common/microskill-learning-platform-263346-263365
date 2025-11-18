'use strict';

const { getState, validateLesson } = require('../utils/db');

/**
 * Lesson Model: read helpers around in-memory state.
 */
module.exports = {
  // PUBLIC_INTERFACE
  async getLessons() {
    /** Returns all lessons with basic fields. */
    const db = await getState();
    return db.lessons.slice();
  },

  // PUBLIC_INTERFACE
  async getLessonById(id) {
    /** Returns a single lesson by id. */
    const db = await getState();
    const lesson = db.lessons.find((l) => l.id === String(id));
    return lesson && validateLesson(lesson) ? lesson : null;
  }
};

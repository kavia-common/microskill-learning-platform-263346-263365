const lessonModel = require('../models/lessonModel');

module.exports = {
  // PUBLIC_INTERFACE
  async list(req, res) {
    /** Return all lessons. */
    const lessons = await lessonModel.getLessons();
    res.json(lessons);
  },

  // PUBLIC_INTERFACE
  async getById(req, res) {
    /** Return a single lesson by id. */
    const lesson = await lessonModel.getLessonById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  }
};

const { loadDB } = require('../utils/db');

module.exports = {
  // PUBLIC_INTERFACE
  list(req, res) {
    /** Return all lessons. */
    const db = loadDB();
    res.json(db.lessons);
  },

  // PUBLIC_INTERFACE
  getById(req, res) {
    /** Return a single lesson by id. */
    const db = loadDB();
    const lesson = db.lessons.find(l => l.id === req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  }
};

const microLessons = require('../data/microLessons');

/**
 * Micro Lessons Controller
 * Serves built-in 7 micro-lessons from in-memory module.
 */
module.exports = {
  // PUBLIC_INTERFACE
  list(req, res) {
    /**
     * List micro lessons
     * Returns: [{ id, title }]
     */
    const items = microLessons.map((l) => ({ id: l.id, title: l.title }));
    res.json(items);
  },

  // PUBLIC_INTERFACE
  getById(req, res) {
    /**
     * Get micro lesson by id
     * Params: id (path)
     * Returns full lesson: { id, title, narrationScript, captions[], ssml, kaviyaVideoPrompt, media }
     */
    const id = String(req.params.id || '').trim();
    const lesson = microLessons.find((l) => l.id === id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  }
};

const { getState } = require('../utils/db');
const progressModel = require('../models/progressModel');

function computeStats(progress, lessons) {
  const watched = progress.filter(p => p.watched).length;
  const completed = progress.filter(p => p.completed).length;
  const overall = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  return { watched, completed, overall, totalLessons: lessons.length };
}

module.exports = {
  // PUBLIC_INTERFACE
  async get(req, res) {
    /** Get user progress stats and detail. Requires userId query. */
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId query required' });
    const db = await getState();
    const items = db.progress.filter(p => p.userId === userId);
    const stats = computeStats(items, db.lessons);
    res.json({ stats, items });
  },

  // PUBLIC_INTERFACE
  async update(req, res) {
    /** Update or create a progress record. */
    const body = req.body || {};
    if (!body.userId || !body.lessonId) return res.status(400).json({ error: 'userId and lessonId required' });
    try {
      const record = await progressModel.updateProgress(body.userId, body.lessonId, {
        watched: body.watched,
        score: body.score,
        completed: body.completed
      });
      res.json({ ok: true, record });
    } catch (e) {
      res.status(400).json({ error: 'Invalid progress payload' });
    }
  }
};

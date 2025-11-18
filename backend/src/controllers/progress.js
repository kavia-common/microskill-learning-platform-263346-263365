const { loadDB, saveDB } = require('../utils/db');

function computeStats(progress, lessons) {
  const watched = progress.filter(p => p.watched).length;
  const completed = progress.filter(p => p.completed).length;
  const overall = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  return { watched, completed, overall, totalLessons: lessons.length };
}

module.exports = {
  // PUBLIC_INTERFACE
  get(req, res) {
    /** Get user progress stats and detail. Requires userId query. */
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId query required' });
    const db = loadDB();
    const items = db.progress.filter(p => p.userId === userId);
    const stats = computeStats(items, db.lessons);
    res.json({ stats, items });
  },

  // PUBLIC_INTERFACE
  update(req, res) {
    /** Update or create a progress record. */
    const body = req.body || {};
    if (!body.userId || !body.lessonId) return res.status(400).json({ error: 'userId and lessonId required' });
    const db = loadDB();
    const idx = db.progress.findIndex(p => p.userId === body.userId && p.lessonId === body.lessonId);
    const record = {
      userId: body.userId,
      lessonId: body.lessonId,
      watched: Boolean(body.watched),
      score: typeof body.score === 'number' ? body.score : null,
      completed: Boolean(body.completed)
    };
    if (idx >= 0) db.progress[idx] = { ...db.progress[idx], ...record };
    else db.progress.push(record);
    saveDB(db);
    res.json({ ok: true, record });
  }
};

'use strict';

const { getState, upsertProgress } = require('../utils/db');

module.exports = {
  // PUBLIC_INTERFACE
  async getProgress(userId, lessonId) {
    /**
     * Get progress for userId and optional lessonId.
     * Returns array when lessonId not provided, single record when provided (or null).
     */
    const db = await getState();
    const uid = userId || 'anon';
    const items = db.progress.filter((p) => p.userId === uid && (!lessonId || p.lessonId === lessonId));
    if (!lessonId) return items;
    return items.length ? items[0] : null;
  },

  // PUBLIC_INTERFACE
  async updateProgress(userId, lessonId, patch = {}) {
    /**
     * Patch progress fields and persist.
     * patch: { watched?: boolean, score?: number|null, completed?: boolean }
     */
    const record = {
      userId: userId || 'anon',
      lessonId,
      watched: typeof patch.watched === 'boolean' ? patch.watched : false,
      score: (patch.score == null || typeof patch.score === 'number') ? patch.score ?? null : null,
      completed: typeof patch.completed === 'boolean' ? patch.completed : false
    };
    const saved = await upsertProgress(record);
    return saved;
  }
};

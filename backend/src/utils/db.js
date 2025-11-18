/**
 * File/in-memory data layer with:
 * - Async JSON read/write with atomic writes (temp file + rename) and queued writes
 * - Seed hydration on first run
 * - In-memory cache populated at startup and kept in sync on updates
 * - Basic shape validation utilities
 *
 * Exposes:
 *  - initStore(): hydrate cache from db.json or seed.json
 *  - getState(): returns in-memory state reference (read-only usage)
 *  - read/write helpers: readDB(), writeDB()
 *  - PUBLIC_INTERFACE functions consumed by models/controllers: see exports at end
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');

let _cache = { lessons: [], quizzes: [], progress: [], enrollments: [] };
let _initialized = false;

// Simple FIFO write queue to avoid concurrent file corruption
let _writeQueue = Promise.resolve();

// Utilities
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function readJsonSafe(filePath) {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

async function writeJsonAtomic(filePath, data) {
  ensureDirSync(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const json = JSON.stringify(data, null, 2);
  await fsp.writeFile(tmpPath, json, 'utf8');
  await fsp.rename(tmpPath, filePath);
}

function defaultState() {
  return { lessons: [], quizzes: [], progress: [], enrollments: [] };
}

function validateLesson(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (typeof obj.title !== 'string' || obj.title.trim() === '') return false;
  if (obj.videoUrl != null && typeof obj.videoUrl !== 'string') return false;
  if (obj.summary != null && typeof obj.summary !== 'string') return false;
  if (obj.durationSeconds != null && typeof obj.durationSeconds !== 'number') return false;
  return true;
}

function validateQuiz(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.lessonId !== 'string' || obj.lessonId.trim() === '') return false;
  if (!Array.isArray(obj.questions)) return false;
  for (const q of obj.questions) {
    if (!q || typeof q !== 'object') return false;
    if (typeof q.id !== 'string' || typeof q.text !== 'string') return false;
    if (!Array.isArray(q.options) || q.options.some((o) => typeof o !== 'string')) return false;
    if (typeof q.answerIndex !== 'number') return false;
  }
  return true;
}

function validateProgress(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.userId !== 'string' || obj.userId.trim() === '') return false;
  if (typeof obj.lessonId !== 'string' || obj.lessonId.trim() === '') return false;
  if (typeof obj.watched !== 'boolean') return false;
  if (!(obj.score == null || typeof obj.score === 'number')) return false;
  if (typeof obj.completed !== 'boolean') return false;
  return true;
}

function validateEnrollment(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.userId !== 'string' || obj.userId.trim() === '') return false;
  if (typeof obj.lessonId !== 'string' || obj.lessonId.trim() === '') return false;
  const allowed = ['active', 'completed', 'dropped'];
  if (obj.status != null && !allowed.includes(obj.status)) return false;
  return true;
}

function sanitizeDBShape(db) {
  const base = defaultState();
  const out = {
    lessons: Array.isArray(db?.lessons) ? db.lessons.filter(validateLesson) : [],
    quizzes: Array.isArray(db?.quizzes) ? db.quizzes.filter(validateQuiz) : [],
    progress: Array.isArray(db?.progress) ? db.progress.filter(validateProgress) : [],
    enrollments: Array.isArray(db?.enrollments) ? db.enrollments.filter(validateEnrollment) : [],
  };
  // Ensure enrollments exists even if missing in seed
  if (!Array.isArray(db?.enrollments)) out.enrollments = [];
  return { ...base, ...out };
}

/**
 * Hydrate in-memory cache:
 * - If db.json exists -> load and sanitize
 * - Else if seed.json exists -> write to db.json and hydrate
 * - Else initialize empty db.json and hydrate
 */
async function initStore() {
  ensureDirSync(DATA_DIR);

  let state = await readJsonSafe(DB_FILE);
  if (!state) {
    const seed = await readJsonSafe(SEED_FILE);
    if (seed) {
      const sanitized = sanitizeDBShape(seed);
      await writeJsonAtomic(DB_FILE, sanitized);
      state = sanitized;
    } else {
      const empty = defaultState();
      await writeJsonAtomic(DB_FILE, empty);
      state = empty;
    }
  } else {
    state = sanitizeDBShape(state);
    // If db lacked enrollments previously, write back upgraded shape
    await writeQueued(state);
  }

  _cache = state;
  _initialized = true;
}

async function readDB() {
  // Prefer in-memory cache; fallback to disk if uninitialized
  if (!_initialized) await initStore();
  return _cache;
}

async function writeQueued(newState) {
  // Enqueue writes to guarantee ordering and atomicity
  _writeQueue = _writeQueue.then(async () => {
    await writeJsonAtomic(DB_FILE, newState);
  }).catch(() => {}).then(() => {}); // swallow to keep queue alive
  return _writeQueue;
}

async function writeDB(newState) {
  const sanitized = sanitizeDBShape(newState);
  _cache = sanitized; // update in-memory first
  await writeQueued(sanitized); // then persist
  return _cache;
}

// PUBLIC_INTERFACE
async function getState() {
  /** Returns a snapshot of current in-memory state. */
  const db = await readDB();
  return db;
}

// PUBLIC_INTERFACE
async function upsertProgress(record) {
  /** Upsert a progress record with validation. */
  const db = await readDB();
  const base = {
    userId: typeof record?.userId === 'string' && record.userId ? record.userId : 'anon',
    lessonId: String(record?.lessonId || '').trim(),
    watched: Boolean(record?.watched),
    score: typeof record?.score === 'number' ? record.score : null,
    completed: Boolean(record?.completed),
  };
  if (!validateProgress(base)) {
    throw new Error('Invalid progress shape');
  }
  const idx = db.progress.findIndex(p => p.userId === base.userId && p.lessonId === base.lessonId);
  if (idx >= 0) db.progress[idx] = { ...db.progress[idx], ...base };
  else db.progress.push(base);
  await writeDB(db);
  return base;
}

// PUBLIC_INTERFACE
async function enrollUser(userId, lessonId, status = 'active') {
  /** Enroll user into a lesson. */
  const db = await readDB();
  const rec = { userId: userId || 'anon', lessonId: String(lessonId || '').trim(), status };
  if (!validateEnrollment(rec)) throw new Error('Invalid enrollment shape');
  const exists = db.enrollments.find(e => e.userId === rec.userId && e.lessonId === rec.lessonId);
  if (!exists) {
    db.enrollments.push(rec);
    await writeDB(db);
  }
  return exists || rec;
}

// PUBLIC_INTERFACE
async function getEnrollmentsByUser(userId) {
  /** Get enrollments by userId. */
  const db = await readDB();
  const uid = userId || 'anon';
  return db.enrollments.filter(e => e.userId === uid);
}

module.exports = {
  // lifecycle
  initStore,
  getState,
  readDB,
  writeDB,

  // validation (internal but exported if needed)
  validateLesson,
  validateQuiz,
  validateProgress,
  validateEnrollment,

  // domain helpers
  upsertProgress,
  enrollUser,
  getEnrollmentsByUser,
};

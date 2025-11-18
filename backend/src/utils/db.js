const fs = require('fs');
const path = require('path');

/**
 * Simple JSON file-backed DB utility.
 * Data shape:
 * {
 *  lessons: [{id,title,videoUrl,summary,durationSeconds}],
 *  quizzes: [{lessonId, questions:[{id, text, options:[...], answerIndex}]}],
 *  progress: [{userId, lessonId, watched, score, completed}]
 * }
 */
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '../../data/db.json');
const SEED_FILE = path.join(__dirname, '../../data/seed.json');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function writeJSON(file, data) {
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function seedIfNeeded() {
  ensureDir(DB_FILE);
  if (!fs.existsSync(DB_FILE)) {
    const seed = readJSON(SEED_FILE);
    if (seed) {
      writeJSON(DB_FILE, seed);
    } else {
      writeJSON(DB_FILE, { lessons: [], quizzes: [], progress: [] });
    }
  }
}

function loadDB() {
  seedIfNeeded();
  const data = readJSON(DB_FILE);
  if (!data) {
    writeJSON(DB_FILE, { lessons: [], quizzes: [], progress: [] });
    return { lessons: [], quizzes: [], progress: [] };
  }
  return data;
}

function saveDB(data) {
  writeJSON(DB_FILE, data);
}

module.exports = {
  loadDB,
  saveDB
};

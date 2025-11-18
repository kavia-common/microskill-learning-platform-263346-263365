const { loadDB, saveDB } = require('../utils/db');

function validateSubmission(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('Invalid body');
  if (!body.userId || typeof body.userId !== 'string') errors.push('userId required');
  if (!Array.isArray(body.answers)) errors.push('answers must be array');
  return errors;
}

module.exports = {
  // PUBLIC_INTERFACE
  getForLesson(req, res) {
    /** Get quiz for a lesson id. */
    const db = loadDB();
    const quiz = db.quizzes.find(q => q.lessonId === req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    // Hide answers
    const sanitized = {
      lessonId: quiz.lessonId,
      questions: quiz.questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options
      }))
    };
    res.json(sanitized);
  },

  // PUBLIC_INTERFACE
  submitForLesson(req, res) {
    /** Grade quiz submission and persist progress. */
    const errors = validateSubmission(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { userId, answers } = req.body;
    const db = loadDB();
    const quiz = db.quizzes.find(q => q.lessonId === req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    let correct = 0;
    const results = quiz.questions.map((q, idx) => {
      const isCorrect = Number(answers[idx]) === Number(q.answerIndex);
      if (isCorrect) correct += 1;
      return { questionId: q.id, correct: isCorrect, correctIndex: q.answerIndex, userIndex: answers[idx] };
    });
    const score = Math.round((correct / quiz.questions.length) * 100);

    // upsert progress
    const existingIdx = db.progress.findIndex(p => p.userId === userId && p.lessonId === req.params.id);
    const record = {
      userId,
      lessonId: req.params.id,
      watched: true, // assume watched if submitting quiz
      score,
      completed: true
    };
    if (existingIdx >= 0) db.progress[existingIdx] = { ...db.progress[existingIdx], ...record };
    else db.progress.push(record);

    saveDB(db);
    res.json({ score, results });
  }
};

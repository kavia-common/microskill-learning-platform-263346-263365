# Micro-skill LMS Backend

Express API with JSON persistence.

## Endpoints
- GET /api/lessons
- GET /api/lessons/:id
- GET /api/lessons/:id/quiz
- POST /api/lessons/:id/quiz
- GET /api/progress?userId=anon_xxx
- POST /api/progress

## Env
- PORT (default 3001)
- HOST (default 0.0.0.0)
- DB_FILE (default ./data/db.json)

## Run
npm install
npm start

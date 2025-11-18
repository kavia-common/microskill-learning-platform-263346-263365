# MicroSkills Backend

Express API for AI-based lesson generation and local media rendering.

Security and middleware
- Security headers via helmet
- CORS using FRONTEND_ORIGIN env
- gzip compression and request logging (morgan)
- Rate limiting on /api (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)
- Centralized error handler
- Static assets served at /assets

Static assets
- Generated media is written under public/assets and served at /assets by this server.
- Ensure FRONTEND_ORIGIN in .env is set to your frontend origin (e.g., http://localhost:3000) to allow browser calls.

Endpoints
- POST /api/generate-lesson: Generate a micro-lesson and quiz via a JSON-only template (no external model calls). Validates, moderates, normalizes, and optionally saves to Supabase.
- POST /api/generate-media: Render a local kinetic-text MP4 (muted with short beep) and WebVTT captions for a given lesson title. Outputs to public/assets paths for the frontend to auto-detect.
- GET /: Health check
- GET /api/lessons: Built-in micro-lessons list -> [{ id, title }]
- GET /api/lessons/:id: Built-in micro-lesson detail -> { id, title, narrationScript, captions[], ssml, kaviyaVideoPrompt, media }
- Progress endpoints remain the same: GET/POST /api/progress

## Setup

1) Install dependencies
   npm install

2) Configure environment
   Copy .env.example to .env and set:
   - PORT (default 3001)
   - FRONTEND_ORIGIN (default http://localhost:3000)
   - RATE_LIMIT_WINDOW_MS (default 900000)
   - RATE_LIMIT_MAX (default 200)
   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) if you want persistence

3) Start server
   npm start
   Open API docs at http://localhost:3001/docs

Notes on module format:
- This project uses "type": "module" in package.json so src/server.js uses ESM imports.
- Some internal utilities (e.g., src/app.js, swagger.js) use CommonJS and are not part of the runtime entrypoint.
- Scripts:
  - start: node src/server.js
  - dev: NODE_ENV=development node --watch src/server.js

## Moderation & Retries
- Simple moderation rejects empty/unsafe topics.
- Basic retry loops around generation and rendering to improve resilience.

## Frontend Integration
The frontend resolves video/captions by slug. Assets written under public/assets are served at /assets in this backend and are compatible with the React app's mapping.

- Generated MP4 path: public/assets/video/mp4/{slug}.mp4 -> served at /assets/video/mp4/{slug}.mp4
- Generated WebVTT path: public/assets/captions/{slug}.vtt -> served at /assets/captions/{slug}.vtt
- The React DiagnosticsPanel probes:
  - GET {API_BASE}/ for health
  - OPTIONS/GET {API_BASE}/api/generate-lesson and /api/generate-media
  - HEAD /assets/video/mp4/quick-inbox-zero.mp4 and /assets/captions/quick-inbox-zero.vtt

Ensure CORS FRONTEND_ORIGIN is set (see .env.example) so probes succeed from the frontend.

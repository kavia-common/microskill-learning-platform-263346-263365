# MicroSkills Backend

Express API for AI-based lesson generation and local media rendering.

Static assets
- Generated media is written under public/assets and served at /assets by this server.
- Ensure FRONTEND_ORIGIN in .env is set to your frontend origin (e.g., http://localhost:3000) to allow browser calls.

- POST /api/generate-lesson: Generate a micro-lesson and quiz via a JSON-only template (no external model calls). Validates, moderates, normalizes, and optionally saves to Supabase.
- POST /api/generate-media: Render a local kinetic-text MP4 (muted with short beep) and WebVTT captions for a given lesson title. Outputs to public/assets paths for the frontend to auto-detect.

## Setup

1) Install dependencies
   npm install

2) Configure environment
   Copy .env.example to .env and set:
   - PORT (default 3001)
   - FRONTEND_ORIGIN (default http://localhost:3000)
   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) if you want persistence

3) Start server
   npm start
   Open API docs at http://localhost:3001/docs

## Endpoints

### POST /api/generate-lesson
Body:
{
  "topic": "Inbox Zero",
  "audience": "busy professionals",
  "tone": "practical",
  "dryRun": false
}

Responses:
- 200: { lesson, quiz }
- 400: validation/moderation error
- 500: server error

Supabase (optional):
- lessons(id, title, summary, description, tags[], takeaways[], slug, duration_seconds)
- quizzes(lesson_id)
- quiz_questions(quiz_id, question_text, options[], correct_index)

### POST /api/generate-media
Body:
{
  "title": "Inbox Zero — Micro Lesson",
  "summary": "Learn Inbox Zero quickly...",
  "takeaways": ["Triage fast", "Batch replies", "Reduce switching"]
}

Outputs:
- MP4: public/assets/video/mp4/{slug}.mp4
- WebVTT: public/assets/captions/{slug}.vtt

Response:
{
  "slug": "inbox-zero-micro-lesson",
  "videoUrl": "/assets/video/mp4/inbox-zero-micro-lesson.mp4",
  "captionsUrl": "/assets/captions/inbox-zero-micro-lesson.vtt"
}

Notes:
- No external video service used.
- Audio track is muted with a very short low-volume beep at start to ensure compatibility.
- Captions are generated from takeaways/summary/title.

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

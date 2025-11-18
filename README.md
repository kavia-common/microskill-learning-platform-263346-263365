# microskill-learning-platform-263346-263365

This workspace contains the backend for the micro-skill learning platform.

Quickstart
- cd backend
- cp .env.example .env  # FRONTEND_ORIGIN must be http://localhost:3000 for local CRA
- npm install
- npm start  # runs on http://localhost:3001

Frontend pairing
- Set the frontend `REACT_APP_API_BASE=http://localhost:3001` in microskill-learning-platform-263346-263364/frontend_react/.env
- Start frontend on http://localhost:3000

Diagnostics
- From the frontend Diagnostics panel:
  - API health (GET /)
  - Generator endpoints (OPTIONS/POST /api/generate-lesson, /api/generate-media)
  - Assets (HEAD/GET /assets/video/mp4/{slug}.mp4, /assets/captions/{slug}.vtt)

Troubleshooting
- CORS failures: Ensure FRONTEND_ORIGIN matches frontend origin exactly.
- Port conflicts: Update backend PORT and frontend REACT_APP_API_BASE accordingly.
- Asset 404: Generate media from Diagnostics to create sample files under public/assets.
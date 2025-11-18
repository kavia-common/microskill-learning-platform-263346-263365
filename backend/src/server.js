import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import canvasPkg from 'node-canvas';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import swaggerUi from 'swagger-ui-express';

dotenv.config();

const { createCanvas, registerFont } = canvasPkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

// Basic OpenAPI spec
const openapi = {
  openapi: '3.0.0',
  info: {
    title: 'MicroSkills Backend',
    version: '1.0.0',
    description:
      'API for AI-based content generation and local media rendering (silent/beep).'
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  tags: [
    { name: 'generation', description: 'AI generation endpoints' },
    { name: 'media', description: 'Local media rendering endpoints' }
  ],
  paths: {
    '/api/generate-lesson': {
      post: {
        tags: ['generation'],
        summary: 'Generate a micro-lesson via AI prompt',
        description:
          'Validates inputs, applies moderation, calls model (stubbed JSON-only), normalizes and saves to Supabase tables (lessons, quizzes).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  topic: { type: 'string', description: 'Lesson topic' },
                  audience: { type: 'string', description: 'Target audience' },
                  tone: { type: 'string', description: 'Tone/voice' },
                  dryRun: { type: 'boolean', description: 'Skip DB save' }
                },
                required: ['topic']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Lesson generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    lesson: { type: 'object' },
                    quiz: { type: 'object' }
                  }
                }
              }
            }
          },
          400: { description: 'Validation or moderation error' },
          500: { description: 'Server error' }
        }
      }
    },
    '/api/generate-media': {
      post: {
        tags: ['media'],
        summary: 'Render local kinetic-text video and captions',
        description:
          'Creates MP4 and WebVTT captions for given lesson title. Skips TTS; creates silent or short beep stub. Saves under public/assets.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Lesson title' },
                  summary: { type: 'string', description: 'Lesson summary' },
                  takeaways: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Bullet points for captions'
                  }
                },
                required: ['title']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Media rendered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    slug: { type: 'string' },
                    videoUrl: { type: 'string' },
                    captionsUrl: { type: 'string' }
                  }
                }
              }
            }
          },
          400: { description: 'Validation error' },
          500: { description: 'Server error' }
        }
      }
    }
  }
};

app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Serve generated static assets relative to repo root
app.use('/assets', express.static(path.resolve(__dirname, '../../public/assets')));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

/**
 * Utility: normalize and create a canonical slug.
 */
// PUBLIC_INTERFACE
function toSlug(str) {
  /** Create a canonical slug from a free-form string. */
  if (!str) return '';
  const s = String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return slugify(s, { lower: true, strict: true, trim: true });
}

/**
 * Simple moderation: reject obviously unsafe or empty prompts.
 */
function moderate(text) {
  const t = (text || '').toLowerCase();
  const banned = ['violence', 'hate', 'self-harm', 'nsfw', 'illegal'];
  if (!t || t.trim().length < 3) {
    return { ok: false, reason: 'Empty or too short topic' };
  }
  if (banned.some((b) => t.includes(b))) {
    return { ok: false, reason: 'Topic flagged by moderation' };
  }
  return { ok: true };
}

/**
 * Simulated "model" call: deterministically constructs lesson JSON without external calls.
 * Includes basic retries around generation logic to satisfy requirement.
 */
async function callModelWithTemplate({ topic, audience, tone }) {
  // JSON-only prompt template (implicit)
  const titleBase = `${topic}`.trim();
  const title =
    titleBase.charAt(0).toUpperCase() + titleBase.slice(1) + ' — Micro Lesson';
  const summary =
    `Learn ${topic} quickly. Tailored for ${audience || 'general learners'} with a ${tone || 'practical'} tone.`;
  const description =
    `This bite-sized lesson covers the essentials of ${topic}. It includes practical steps and a quick quiz to check understanding.`;
  const takeaways = [
    `Understand the core idea of ${topic}`,
    `Apply ${topic} with a simple checklist`,
    `Avoid common pitfalls when practicing ${topic}`
  ];
  const quiz = {
    questions: [
      {
        id: 'q1',
        text: `What is a key benefit of ${topic}?`,
        options: ['Speed', 'Complexity', 'Confusion', 'None'],
        answer: 0
      },
      {
        id: 'q2',
        text: `Which approach best applies ${topic}?`,
        options: ['Ignore it', 'Overcomplicate it', 'A simple 3-step plan', 'Panic'],
        answer: 2
      }
    ]
  };
  return { title, summary, description, takeaways, quiz };
}

/**
 * Supabase client (optional in dryRun). Requires env vars.
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Ensure directories exist.
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Render a kinetic-text video using node-canvas + ffmpeg. Produces a silent (or short beep) MP4.
 * Also writes a simple WebVTT captions file based on provided lines.
 */
async function renderKineticVideoAndCaptions({ slug, title, lines }) {
  const publicDir = path.resolve(__dirname, '../../public');
  const videoDir = path.join(publicDir, 'assets/video/mp4');
  const captionsDir = path.join(publicDir, 'assets/captions');

  ensureDir(videoDir);
  ensureDir(captionsDir);

  const width = 720;
  const height = 1280;
  const fps = 30;

  // Register a fallback font for better rendering if available. Ignore errors.
  try {
    const fontPath = path.resolve(__dirname, '../fonts/Inter-Bold.ttf');
    if (fs.existsSync(fontPath)) {
      registerFont(fontPath, { family: 'Inter' });
    }
  } catch {}

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const segmentSeconds = 2.5;
  const framesPerSegment = Math.floor(segmentSeconds * fps);
  const totalSegments = Math.max(1, lines.length);
  const totalFrames = framesPerSegment * totalSegments;

  const pngFramesDir = path.join(publicDir, 'tmp', slug, 'frames');
  ensureDir(pngFramesDir);

  // Draw frames: dark background, title header, and kinetic-text (fade/slide)
  for (let i = 0; i < totalFrames; i++) {
    const segIndex = Math.floor(i / framesPerSegment);
    const progressInSeg = (i % framesPerSegment) / framesPerSegment;
    const text = lines[segIndex] || '';

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Header title
    ctx.fillStyle = '#F97316'; // primary
    ctx.font = 'bold 36px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 100);

    // Kinetic text animation
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 54px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';

    // Slide up and fade in
    const baseY = height / 2;
    const slide = (1 - Math.cos(progressInSeg * Math.PI)) * 40; // ease
    const alpha = Math.min(1, progressInSeg * 2);
    ctx.globalAlpha = alpha;

    wrapText(ctx, text, width / 2, baseY - slide, width * 0.8, 64);

    ctx.globalAlpha = 1.0;

    const framePath = path.join(pngFramesDir, `${String(i).padStart(6, '0')}.png`);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(framePath, buf);
  }

  // Use ffmpeg to combine frames into mp4 with a silent audio or a 440Hz beep at start
  const outVideo = path.join(videoDir, `${slug}.mp4`);
  const pattern = path.join(pngFramesDir, '%06d.png');

  ffmpeg.setFfmpegPath(ffmpegStatic);

  await new Promise((resolve, reject) => {
    // Build complex filter for beep of 0.25s mixed into silent audio duration
    ffmpeg()
      .input(pattern)
      .inputOptions([`-framerate ${fps}`])
      .loop(0)
      .videoCodec('libx264')
      .outputOptions([
        '-pix_fmt yuv420p',
        `-r ${fps}`,
        '-shortest'
      ])
      // generate 0.25s sine beep + silence for the rest using anullsrc
      .input('anullsrc=r=44100:cl=mono')
      .inputOptions([])
      .complexFilter([
        // aevalsrc for beep -> 0.25s duration
        {
          filter: 'aevalsrc',
          options: 'sin(2*PI*440*t):s=44100',
          outputs: 'beep'
        },
        { filter: 'atrim', options: '0:0.25', inputs: 'beep', outputs: 'beep_trim' },
        // mix beep with silence (beep at start, then silence continues)
        { filter: 'amix', options: 'inputs=2:duration=longest:dropout_transition=0', inputs: ['beep_trim', '0:a'], outputs: 'audio_mix' }
      ])
      .audioFilters('volume=0.3')
      .audioCodec('aac')
      .output(outVideo)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // Write WebVTT
  const outVtt = path.join(captionsDir, `${slug}.vtt`);
  const vtt = buildVttFromLines(lines, segmentSeconds);
  fs.writeFileSync(outVtt, vtt, 'utf8');

  // Cleanup frames to save space (best effort)
  try {
    fs.rmSync(path.join(publicDir, 'tmp', slug), { recursive: true, force: true });
  } catch {}

  return {
    videoUrl: `/assets/video/mp4/${slug}.mp4`,
    captionsUrl: `/assets/captions/${slug}.vtt`
  };
}

/**
 * Draw multi-line centered text with wrapping.
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  const totalHeight = lines.length * lineHeight;
  let yy = y - totalHeight / 2 + lineHeight;
  lines.forEach((l) => {
    ctx.fillText(l, x, yy);
    yy += lineHeight;
  });
}

/**
 * Build a minimal WebVTT file splitting lines into equal segments.
 */
function buildVttFromLines(lines, segmentSeconds) {
  const toTimestamp = (sec) => {
    const s = Math.max(0, sec);
    const hh = Math.floor(s / 3600)
      .toString()
      .padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, '0');
    const ms = Math.floor((s - Math.floor(s)) * 1000)
      .toString()
      .padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };

  let cur = 0;
  let idx = 1;
  let text = 'WEBVTT\n\n';
  for (const l of lines) {
    const start = toTimestamp(cur);
    const end = toTimestamp(cur + segmentSeconds - 0.2);
    text += `${idx}\n${start} --> ${end}\n${l}\n\n`;
    cur += segmentSeconds;
    idx++;
  }
  return text;
}

/**
 * POST /api/generate-lesson
 * PUBLIC_INTERFACE
 * Generates lesson using a JSON-only template, validates and saves to Supabase.
 */
app.post('/api/generate-lesson', async (req, res) => {
  /**
   * Generate a lesson and quiz from topic/audience/tone.
   * Body: { topic: string, audience?: string, tone?: string, dryRun?: boolean }
   * Returns: { lesson, quiz }
   */
  try {
    const { topic, audience, tone, dryRun } = req.body || {};
    const mod = moderate(topic);
    if (!mod.ok) {
      return res.status(400).json({ error: { message: mod.reason } });
    }

    // Retries for "model" generation (simulate transient failures handling)
    let generated = null;
    let lastErr = null;
    for (let i = 0; i < 2; i++) {
      try {
        generated = await callModelWithTemplate({ topic, audience, tone });
        if (generated) break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!generated) {
      return res.status(500).json({ error: { message: 'Failed to generate content', details: String(lastErr || '') } });
    }

    const id = nanoid(10);
    const slug = toSlug(generated.title);
    const lesson = {
      id,
      title: generated.title,
      summary: generated.summary,
      description: generated.description,
      takeaways: generated.takeaways || [],
      tags: [toSlug(topic)],
      durationSeconds: 60,
      cta: 'Start Lesson',
      slug
    };

    const quiz = {
      lessonId: id,
      questions: (generated.quiz?.questions || []).map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        answer: q.answer
      }))
    };

    if (!dryRun) {
      const supabase = getSupabase();
      if (supabase) {
        // Insert into lessons table
        await supabase.from('lessons').insert({
          id,
          title: lesson.title,
          summary: lesson.summary,
          description: lesson.description,
          tags: lesson.tags,
          takeaways: lesson.takeaways,
          slug: lesson.slug,
          duration_seconds: lesson.durationSeconds
        });
        // Insert quiz and questions (assuming simple schema quizzes and quiz_questions)
        const { data: quizRow } = await supabase.from('quizzes').insert({
          lesson_id: id
        }).select().single();

        for (const q of quiz.questions) {
          await supabase.from('quiz_questions').insert({
            quiz_id: quizRow?.id,
            question_text: q.text,
            options: q.options,
            correct_index: q.answer
          });
        }
      }
    }

    return res.json({ lesson, quiz });
  } catch (e) {
    // hide internals
    return res.status(500).json({ error: { message: 'Server error', details: process.env.NODE_ENV === 'development' ? String(e) : undefined } });
  }
});

/**
 * POST /api/generate-media
 * PUBLIC_INTERFACE
 * Renders MP4 + VTT locally for a given lesson title. Skips TTS; silent/beep audio.
 */
app.post('/api/generate-media', async (req, res) => {
  /**
   * Body: { title: string, summary?: string, takeaways?: string[] }
   * Returns: { slug, videoUrl, captionsUrl }
   */
  try {
    const { title, summary, takeaways } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: { message: 'title is required' } });
    }
    const slug = toSlug(title);

    // Create caption lines: prefer takeaways -> summary sentences -> title
    let lines = Array.isArray(takeaways) ? takeaways.filter(Boolean) : [];
    if (lines.length === 0 && summary) {
      lines = String(summary)
        .split(/[.?!]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    if (lines.length === 0) {
      lines = [title];
    }

    // Retries around render in case ffmpeg hiccups
    let out = null;
    let lastErr = null;
    for (let i = 0; i < 2; i++) {
      try {
        out = await renderKineticVideoAndCaptions({ slug, title, lines });
        if (out) break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!out) {
      return res.status(500).json({ error: { message: 'Failed to render media', details: String(lastErr || '') } });
    }

    return res.json({ slug, ...out });
  } catch (e) {
    return res.status(500).json({ error: { message: 'Server error', details: process.env.NODE_ENV === 'development' ? String(e) : undefined } });
  }
});

// Health
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Service is healthy', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${PORT}`);
});

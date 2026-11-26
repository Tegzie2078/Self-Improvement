require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { PLAN, FAST_PLAN, FAST_FROM, STRENGTH, BENCHMARKS, DEFAULT_HABITS } = require('./plan');

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const PASSWORD = process.env.APP_PASSWORD || (PROD ? null : 'changeme');
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

if (!PASSWORD) {
  console.error('APP_PASSWORD must be set in production.');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET not set: you will be logged out whenever the server restarts.');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser(SECRET));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

// ---------- auth ----------
const attempts = new Map(); // ip -> { n, until }
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  if (!sameSecret(req.body?.password || '', PASSWORD)) {
    a.n += 1;
    if (a.n >= 5) { a.until = Date.now() + 5 * 60 * 1000; a.n = 0; }
    attempts.set(ip, a);
    return res.status(401).json({ error: 'Wrong password' });
  }
  attempts.delete(ip);
  res.cookie('ot', 'ok', { signed: true, httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 180 * 864e5 });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('ot');
  res.json({ ok: true });
});

app.use('/api', (req, res, next) => {
  if (req.signedCookies.ot === 'ok') return next();
  res.status(401).json({ error: 'Not logged in' });
});

// ---------- validation helpers ----------
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};
const int = (v, min, max) => { const n = num(v, min, max); return n === null ? null : Math.round(n); };
const text = (v, max = 1000) => (v === null || v === undefined ? null : String(v).slice(0, max));
const bool = (v) => (v === null || v === undefined ? null : Boolean(v));
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: e.message });
});

// ---------- API ----------
app.get('/api/all', wrap(async (req, res) => {
  let [settings, checkins, sessions, strength, benchmarks, cravings, habits, habitLogs, vapes] = await Promise.all([
    db.all('settings'), db.all('checkins'), db.all('session_logs'),
    db.all('strength_logs'), db.all('benchmarks'), db.all('cravings'),
    db.all('habits'), db.all('habit_logs'), db.all('vape_logs'),
  ]);
  if (!habits.length) {
    // first run: seed the starter list (switched-off ones show as suggestions)
    habits = [];
    for (const [i, h] of DEFAULT_HABITS.entries()) habits.push(await db.upsert('habits', { ...h, sort: i }));
  }
  res.json({
    plan: PLAN, fastPlan: FAST_PLAN, fastFrom: FAST_FROM, strengthPlan: STRENGTH, benchmarkDefs: BENCHMARKS,
    settings: settings.find((s) => Number(s.id) === 1) || null,
    checkins, sessions, strength, benchmarks, cravings,
    habits: [...habits].sort((a, b) => a.sort - b.sort), habitLogs,
    vapes: [...vapes].sort((a, b) => (a.at < b.at ? -1 : 1)),
  });
}));

app.put('/api/settings', wrap(async (req, res) => {
  // only the keys sent are changed
  const b = req.body || {};
  const row = { id: 1 };
  if ('quit_at' in b) {
    const quitAt = b.quit_at ? new Date(b.quit_at) : null;
    if (quitAt && isNaN(quitAt)) return res.status(400).json({ error: 'Bad quit date' });
    row.quit_at = quitAt ? quitAt.toISOString() : null;
  }
  if ('daily_spend' in b) row.daily_spend = num(b.daily_spend, 0, 1000);
  if ('track' in b) row.track = b.track === 'fast' ? 'fast' : 'standard';
  if ('mode' in b) row.mode = b.mode === 'quit' ? 'quit' : 'cutdown';
  if ('daily_limit' in b) row.daily_limit = int(b.daily_limit, 0, 200);
  if ('gap_goal_min' in b) row.gap_goal_min = int(b.gap_goal_min, 0, 1440);
  if ('start_mg' in b) row.start_mg = num(b.start_mg, 0, 50);
  if ('current_mg' in b) row.current_mg = num(b.current_mg, 0, 50);
  if ('zones' in b) {
    row.zones = Array.isArray(b.zones)
      ? b.zones.slice(0, 30).map((z) => ({ name: text(z?.name, 40)?.trim(), allowed: Boolean(z?.allowed) })).filter((z) => z.name)
      : null;
  }
  res.json(await db.upsert('settings', row));
}));

app.put('/api/checkins/:date', wrap(async (req, res) => {
  // morning and evening check-ins save separately, so only the fields sent are changed
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'Bad date' });
  const b = req.body || {};
  const fields = {
    nicotine_free: () => bool(b.nicotine_free),
    shower_hr: () => int(b.shower_hr, 25, 220),
    sleep_hr: () => int(b.sleep_hr, 25, 220),
    sleep_h: () => num(b.sleep_h, 0, 24),
    cravings: () => num(b.cravings, 0, 10),
    energy: () => num(b.energy, 0, 10),
    dizzy: () => bool(b.dizzy),
    water_l: () => num(b.water_l, 0, 10),
    screen_min: () => int(b.screen_min, 0, 1440),
    notes: () => text(b.notes),
  };
  const row = { date };
  for (const [k, fn] of Object.entries(fields)) if (k in b) row[k] = fn();
  res.json(await db.upsert('checkins', row));
}));

app.put('/api/sessions/:date', wrap(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'Bad date' });
  const b = req.body || {};
  res.json(await db.upsert('session_logs', {
    date,
    done: bool(b.done),
    actual: text(b.actual, 500),
    rpe: num(b.rpe, 0, 10),
    avg_hr: int(b.avg_hr, 25, 230),
    max_hr: int(b.max_hr, 25, 240),
    duration_min: num(b.duration_min, 0, 600),
    distance_m: num(b.distance_m, 0, 200000),
    avg_split_s: num(b.avg_split_s, 60, 400),
    avg_rate: num(b.avg_rate, 10, 60),
    avg_watts: num(b.avg_watts, 0, 2000),
    avg_cadence: num(b.avg_cadence, 0, 200),
    avg_speed: num(b.avg_speed, 0, 30),
    pieces: Array.isArray(b.pieces)
      ? b.pieces.slice(0, 30).map((x) => ({
        split_s: num(x?.split_s, 60, 400), watts: num(x?.watts, 0, 2000),
        speed: num(x?.speed, 0, 30), hr: int(x?.hr, 25, 240),
      })).filter((x) => Object.values(x).some((v) => v !== null))
      : null,
    notes: text(b.notes),
  }));
}));

app.put('/api/strength', wrap(async (req, res) => {
  const b = req.body || {};
  const week = num(b.week, 0, 52);
  if (!b.exercise || week === null) return res.status(400).json({ error: 'exercise and week required' });
  res.json(await db.upsert('strength_logs', {
    exercise: text(b.exercise, 100), week, weight: num(b.weight, 0, 500),
  }));
}));

app.put('/api/benchmarks/:key', wrap(async (req, res) => {
  const { key } = req.params;
  if (!BENCHMARKS.some((d) => d.key === key)) return res.status(400).json({ error: 'Unknown benchmark' });
  const b = req.body || {};
  res.json(await db.upsert('benchmarks', { key, baseline: num(b.baseline, 0, 100000), retest: num(b.retest, 0, 100000) }));
}));

app.post('/api/cravings', wrap(async (req, res) => {
  const b = req.body || {};
  const at = b.at ? new Date(b.at) : new Date();
  if (isNaN(at)) return res.status(400).json({ error: 'Bad time' });
  res.json(await db.insert('cravings', {
    at: at.toISOString(), intensity: num(b.intensity, 1, 10), beaten: bool(b.beaten),
  }));
}));

app.delete('/api/cravings/:id', wrap(async (req, res) => {
  await db.remove('cravings', req.params.id);
  res.json({ ok: true });
}));

app.put('/api/vapes/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!/^[\w-]{1,64}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
  const b = req.body || {};
  const at = b.at ? new Date(b.at) : new Date();
  if (isNaN(at)) return res.status(400).json({ error: 'Bad time' });
  res.json(await db.upsert('vape_logs', {
    id, at: at.toISOString(), kind: b.kind === 'cigarette' ? 'cigarette' : 'vape',
    place: text(b.place, 40), reason: text(b.reason, 40),
  }));
}));

app.delete('/api/vapes/:id', wrap(async (req, res) => {
  await db.remove('vape_logs', req.params.id);
  res.json({ ok: true });
}));

const SLOTS = ['morning', 'day', 'evening'];
const isId = (s) => typeof s === 'string' && /^[\w-]{1,64}$/.test(s);

app.put('/api/habits/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'Bad id' });
  const b = req.body || {};
  const name = text(b.name, 80)?.trim();
  if (!name) return res.status(400).json({ error: 'Task needs a name' });
  res.json(await db.upsert('habits', {
    id, name, slot: SLOTS.includes(b.slot) ? b.slot : 'day',
    sort: int(b.sort, 0, 10000) ?? 0, active: b.active !== false,
  }));
}));

app.put('/api/habit-logs/:date/:id', wrap(async (req, res) => {
  const { date, id } = req.params;
  if (!isDate(date) || !isId(id)) return res.status(400).json({ error: 'Bad date or id' });
  res.json(await db.upsert('habit_logs', { date, habit_id: id, done: Boolean(req.body?.done) }));
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- static PWA ----------
app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`On Track running on http://localhost:${PORT} (storage: ${db.name})`));

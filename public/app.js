'use strict';

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// A day runs from DAY_START_HOUR to DAY_START_HOUR, so late nights still count as the day before.
const DAY_START_HOUR = 7;
const logicalDate = (d) => ymd(new Date(new Date(d).getTime() - DAY_START_HOUR * 3600e3));
const today = () => logicalDate(Date.now());
// clock hour on a 7→31 scale, so 1am reads as 25 (late on the same day)
const dayHour = (d = new Date()) => { const h = d.getHours() + d.getMinutes() / 60; return h < DAY_START_HOUR ? h + 24 : h; };
const parseYmd = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (s) => parseYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const gbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const has = (v) => v !== null && v !== undefined && v !== '';
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
// "2:31.5" -> 151.5 ; also accepts plain seconds "151.5"
function parseSplit(s) {
  if (!has(s)) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{1,2}(?:\.\d)?)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmtSplit(sec) {
  if (!has(sec)) return '';
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${(Math.round(s * 10) / 10).toFixed(1)}`;
}

// Cardio log fields per machine. scale converts what you type into what is stored.
const CARDIO = {
  erg: {
    fields: [
      { name: 'duration_min', label: 'Time (min)' },
      { name: 'distance_m', label: 'Distance (m)' },
      { name: 'avg_split_s', label: 'Avg split /500m', split: true, ph: '2:30.0' },
      { name: 'avg_rate', label: 'Avg rate (spm)' },
    ],
    piece: { name: 'split_s', label: 'Split /500m', split: true, ph: '2:28.0' },
  },
  bike: {
    fields: [
      { name: 'duration_min', label: 'Time (min)' },
      { name: 'avg_watts', label: 'Avg watts' },
      { name: 'avg_cadence', label: 'Avg cadence (rpm)' },
      { name: 'distance_m', label: 'Distance (km)', scale: 1000 },
    ],
    piece: { name: 'watts', label: 'Watts', ph: '150' },
  },
  treadmill: {
    fields: [
      { name: 'duration_min', label: 'Time (min)' },
      { name: 'distance_m', label: 'Distance (km)', scale: 1000 },
      { name: 'avg_speed', label: 'Avg speed (km/h)' },
    ],
    piece: { name: 'speed', label: 'Speed (km/h)', ph: '8.0' },
  },
};
const kindOf = (p) => (CARDIO[p.type] ? p.type : null);
const pieceCount = (p) => { const m = p.prescription.match(/(\d+)\s*×\s*(?:\(|\d+\s*min)/); return m ? Number(m[1]) : 0; };
function cardioSummary(p, l) {
  if (!l) return '';
  const k = kindOf(p);
  const bits = [];
  if (k === 'erg' && has(l.avg_split_s)) bits.push(`${fmtSplit(l.avg_split_s)}/500m`);
  if (k === 'bike' && has(l.avg_watts)) bits.push(`${l.avg_watts} W`);
  if (k === 'treadmill' && has(l.avg_speed)) bits.push(`${l.avg_speed} km/h`);
  if (has(l.distance_m) && k === 'erg') bits.push(`${l.distance_m} m`);
  if (has(l.avg_hr)) bits.push(`${l.avg_hr} bpm`);
  return bits.join(' · ');
}

const MILESTONES = [
  { t: 20 * MIN, title: 'Pulse settling', body: 'Heart rate and blood pressure start returning to normal.' },
  { t: 8 * HOUR, title: 'Carbon monoxide halved', body: 'Oxygen levels in your blood are recovering.' },
  { t: DAY, title: 'Day one done', body: 'Cravings build over the next two days. Keep water and snacks to hand.' },
  { t: 2 * DAY, title: 'Nicotine-free body', body: 'Nicotine has cleared. Taste and smell start to improve.' },
  { t: 3 * DAY, title: 'Breathing easier', body: 'Withdrawal usually peaks around now. It gets easier from here.' },
  { t: 7 * DAY, title: 'One week', body: 'Sleep usually starts to settle.' },
  { t: 14 * DAY, title: 'Two weeks', body: 'The worst physical withdrawal is typically over. Circulation is improving.' },
  { t: 28 * DAY, title: '28 days', body: 'The NHS says you are now 5 times more likely to quit for good.' },
  { t: 90 * DAY, title: 'Three months', body: 'Lung function up to about 10% better. Brain reward chemistry largely rebalanced.' },
  { t: 365 * DAY, title: 'One year', body: 'Heart attack risk about half that of a smoker.' },
  { t: 3650 * DAY, title: 'Ten years', body: 'Lung cancer risk about half that of a smoker.' },
  { t: 5475 * DAY, title: 'Fifteen years', body: 'Heart attack risk similar to someone who never smoked.' },
];

const CARDIO_TARGETS = [
  ['Erg', 'Easy / steady', '2:25–2:35/500m, rate 18–20', '2:20–2:28/500m, rate 20', 'Full sentences. Damper 3–5 (drag factor 110–130).'],
  ['Bike', 'Zone 2', '90–110 W, 80–90 rpm', '100–130 W, 85–90 rpm', 'Could breathe through your nose. Fan on.'],
  ['Bike', 'Hard intervals', '—', '140–170 W, 90–100 rpm', 'RPE 7: short phrases only.'],
  ['Treadmill', 'Walk', '5.5–6 km/h, 2–4% incline', '6 km/h, 3–5% incline', 'Brisk, slightly out of breath.'],
  ['Treadmill', 'Jog intervals', '—', '8–8.5 km/h, 1% incline', 'Easy jog. Walk if light-headed.'],
  ['Heart rate', 'Zone 2 guide', '~120–140 bpm', '~120–140 bpm', 'Go by RPE first: dysautonomia can push HR up.'],
];

const SAFETY = [
  ['Check first', 'Get your GP or specialist’s OK, especially before the Week 3 intervals and the retests.'],
  ['Warm up, cool down', '5–10 min each. Never stop dead: keep pedalling or paddling easily.'],
  ['Fluids', '2–3 L of water a day, and drink before sessions. Ask your doctor about salt.'],
  ['Breathing', 'Breathe out on the effort. Don’t hold your breath on lifts.'],
  ['Standing up', 'Get up slowly from the bench, rower or floor.'],
  ['Stop if', 'Chest pain, fainting or nearly fainting, palpitations that don’t settle, or unusual breathlessness. Stop, sit or lie down, and get checked.'],
  ['RPE', '1 nothing · 4 comfortable, can chat · 6 working, ~4 reps left · 8 hard, ~2 reps left · 10 all-out.'],
  ['Bad day?', 'Swap for an easy 15 min bike or rest. Pushing through dizziness isn’t worth it.'],
];

let S = null;
let tab = 'today';
let trainSub = 'plan';
let strengthWeek = null;

// ---------- data + offline outbox ----------
const OUTBOX = 'ot-outbox', CACHE = 'ot-cache';
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (r.status === 401) { showLogin(); const e = new Error('Not logged in'); e.auth = true; throw e; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || r.statusText); e.http = r.status; throw e; }
  return data;
}

function index(d) {
  return {
    plan: d.plan, fastPlan: d.fastPlan || [], fastFrom: d.fastFrom, strengthPlan: d.strengthPlan, benchmarkDefs: d.benchmarkDefs,
    settings: d.settings || {},
    checkins: Object.fromEntries((d.checkins || []).map((c) => [String(c.date).slice(0, 10), c])),
    sessions: Object.fromEntries((d.sessions || []).map((c) => [String(c.date).slice(0, 10), c])),
    strength: Object.fromEntries((d.strength || []).map((s) => [`${s.exercise}|${s.week}`, s.weight])),
    benchmarks: Object.fromEntries((d.benchmarks || []).map((b) => [b.key, b])),
    cravings: d.cravings || [],
    habits: d.habits || [],
    vapes: d.vapes || [],
    habitLogs: Object.fromEntries((d.habitLogs || []).map((l) => [`${String(l.date).slice(0, 10)}|${l.habit_id}`, l.done])),
  };
}

function applyLocal({ method, url, body }) {
  if (!S) return;
  const parts = url.split('/');
  if (url === '/api/settings') S.settings = { ...S.settings, ...body };
  else if (url.startsWith('/api/checkins/')) S.checkins[parts[3]] = { ...(S.checkins[parts[3]] || {}), ...body, date: parts[3] };
  else if (url.startsWith('/api/sessions/')) S.sessions[parts[3]] = { ...body, date: parts[3] };
  else if (url === '/api/strength') S.strength[`${body.exercise}|${body.week}`] = body.weight;
  else if (url.startsWith('/api/benchmarks/')) S.benchmarks[parts[3]] = { ...body, key: parts[3] };
  else if (url.startsWith('/api/habits/')) {
    const i = S.habits.findIndex((h) => h.id === parts[3]);
    const h = { ...(i >= 0 ? S.habits[i] : {}), ...body, id: parts[3] };
    if (i >= 0) S.habits[i] = h; else S.habits.push(h);
  } else if (url.startsWith('/api/vapes/')) {
    S.vapes = S.vapes.filter((v) => v.id !== parts[3]);
    if (method === 'PUT') S.vapes.push({ ...body, id: parts[3] });
  } else if (url.startsWith('/api/habit-logs/')) S.habitLogs[`${parts[3]}|${parts[4]}`] = body.done;
  else if (url === '/api/cravings' && method === 'POST') S.cravings.push({ ...body, id: 'local-' + Date.now() });
}

async function write(method, url, body) {
  applyLocal({ method, url, body });
  render();
  try {
    await api(method, url, body);
  } catch (e) {
    if (e.http && e.http < 500) { toast(e.message); return; }
    const q = store.get(OUTBOX, []);
    q.push({ method, url, body });
    store.set(OUTBOX, q);
    toast('Saved on your phone. It will sync when you’re back online.');
  }
  updateSync();
}

async function flush() {
  const q = store.get(OUTBOX, []);
  while (q.length) {
    try { await api(q[0].method, q[0].url, q[0].body); q.shift(); store.set(OUTBOX, q); }
    catch (e) { if (e.http && e.http < 500) { q.shift(); store.set(OUTBOX, q); continue; } break; }
  }
  updateSync();
}

async function load() {
  try {
    await flush();
    const d = await api('GET', '/api/all');
    store.set(CACHE, d);
    S = index(d);
  } catch (e) {
    if (e.auth) return;
    const c = store.get(CACHE, null);
    if (!c) {
      const msg = e.http
        ? `The server hit an error: <code>${esc(e.message).slice(0, 300)}</code><br><span class="sub">Check the Render logs and your environment variables.</span>`
        : 'Can’t reach the server. Check your connection and try again.';
      $('#view').innerHTML = `<div class="card">${msg}<div style="height:10px"></div><button class="btn block" onclick="location.reload()">Try again</button></div>`;
      return;
    }
    S = index(c);
  }
  store.get(OUTBOX, []).forEach(applyLocal);
  hideLogin();
  render();
  updateSync();
}

function updateSync() {
  const n = store.get(OUTBOX, []).length;
  const el = $('#sync');
  if (!navigator.onLine || n) { el.textContent = `Offline${n ? ` · ${n} to sync` : ''}`; el.classList.add('offline'); }
  else { el.textContent = 'Synced'; el.classList.remove('offline'); }
}

// ---------- derived values ----------
const isFast = () => S.settings.track === 'fast';
function plan() {
  return isFast() ? [...S.plan.filter((p) => p.date < S.fastFrom), ...S.fastPlan] : S.plan;
}
const quitAt = () => (S.settings.quit_at ? new Date(S.settings.quit_at) : null);
const sinceQuit = () => { const q = quitAt(); return q ? Math.max(0, Date.now() - q) : 0; };
function fmtSince(ms) {
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / MIN);
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
const moneySaved = () => (sinceQuit() / DAY) * Number(S.settings.daily_spend || 0);
const planFor = (date) => plan().find((p) => p.date === date);
const currentWeek = () => {
  const t = today();
  const p = planFor(t) || (t < plan()[0].date ? plan()[0] : plan()[plan().length - 1]);
  return p.wk;
};
const nicFreeDays = () => Object.values(S.checkins).filter((c) => c.nicotine_free).length;
const weightFor = (ex, wk) => S.strength[`${ex}|${wk}`];
const lastWeight = (ex, beforeWk) => {
  for (let w = beforeWk - 1; w >= 0; w--) { const v = weightFor(ex, w); if (has(v)) return { w, v }; }
  return null;
};

// ---------- daily tasks ----------
const SLOT_NAMES = { morning: 'Morning', day: 'Daytime', evening: 'Evening' };
let dailySub = 'tasks';
let tasksDate = null;
let editTasks = false;
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const activeHabits = () => S.habits.filter((h) => h.active).sort((a, b) => a.sort - b.sort);
const isDone = (date, id) => Boolean(S.habitLogs[`${date}|${id}`]);
function streak(id) {
  let d = today();
  if (!isDone(d, id)) d = addDays(d, -1);
  let n = 0;
  while (isDone(d, id) && n < 3650) { n++; d = addDays(d, -1); }
  return n;
}
function last7(id) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (isDone(addDays(today(), -i), id)) n++;
  return n;
}
function taskRow(h, date) {
  const on = isDone(date, h.id);
  const s = streak(h.id);
  return `<li class="task ${on ? 'on' : ''}" data-action="toggle-task" data-id="${esc(h.id)}" data-date="${date}">
    <span class="box">${on ? '✓' : ''}</span><span class="name">${esc(h.name)}</span>${s >= 2 ? `<span class="streak">🔥${s}</span>` : ''}</li>`;
}
function tasksProgress(date) {
  const hs = activeHabits();
  const done = hs.filter((h) => isDone(date, h.id)).length;
  return { hs, done, pct: hs.length ? Math.round((done / hs.length) * 100) : 0 };
}

function viewTasks() {
  const date = tasksDate || today();
  const { hs, done, pct } = tasksProgress(date);
  const isToday = date === today();
  const head = `<div class="card"><div class="row between">
      <button class="btn small" data-action="task-day" data-shift="-1" aria-label="Previous day">‹</button>
      <b>${isToday ? 'Today' : fmtDay(date)}</b>
      <button class="btn small" data-action="task-day" data-shift="1" ${isToday ? 'disabled' : ''} aria-label="Next day">›</button></div>
      <div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>
      <p class="sub" style="margin-bottom:0">${done} of ${hs.length} done${done === hs.length && hs.length ? ' · all done 🎉' : ''}</p></div>`;
  const lists = Object.keys(SLOT_NAMES).map((slot) => {
    const items = hs.filter((h) => h.slot === slot);
    return items.length ? `<div class="card"><h2>${SLOT_NAMES[slot]}</h2><ul class="list">${items.map((h) => taskRow(h, date)).join('')}</ul></div>` : '';
  }).join('');
  return head + (editTasks ? viewEditTasks() : lists + '<button class="btn block" data-action="edit-tasks">Edit list</button>');
}

function viewEditTasks() {
  const hs = activeHabits();
  const off = S.habits.filter((h) => !h.active);
  const slotSel = (h) => `<select data-habit-slot="${esc(h.id)}">${Object.entries(SLOT_NAMES).map(([k, v]) => `<option value="${k}" ${h.slot === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  const rows = Object.keys(SLOT_NAMES).flatMap((slot) => hs.filter((h) => h.slot === slot)).map((h) => `
    <li class="edit-row"><input data-habit-name="${esc(h.id)}" value="${esc(h.name)}" maxlength="80">
      <div class="row">${slotSel(h)}
        <button type="button" class="btn small" data-action="move-task" data-id="${esc(h.id)}" data-dir="-1" aria-label="Move up">↑</button>
        <button type="button" class="btn small" data-action="move-task" data-id="${esc(h.id)}" data-dir="1" aria-label="Move down">↓</button>
        <button type="button" class="btn small" data-action="task-active" data-id="${esc(h.id)}" data-on="0">Remove</button></div></li>`).join('');
  return `<div class="card"><h2>Your tasks</h2><ul class="list">${rows || '<li class="sub">No tasks yet.</li>'}</ul></div>
    <form id="new-task" class="card"><h2>Add a task</h2>
      <label>Task<input name="name" maxlength="80" required placeholder="e.g. Stretch for 10 min"></label>
      <label>When<select name="slot">${Object.entries(SLOT_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <button class="btn primary block">Add</button></form>
    ${off.length ? `<div class="card"><h2>Suggestions and removed tasks</h2><ul class="list">${off.map((h) => `<li class="row between"><span>${esc(h.name)} <span class="sub">· ${SLOT_NAMES[h.slot]}</span></span>
      <button type="button" class="btn small" data-action="task-active" data-id="${esc(h.id)}" data-on="1">+ Add</button></li>`).join('')}</ul></div>` : ''}
    <p class="sub">Removing a task hides it but keeps its history.</p>
    <button class="btn primary block" data-action="edit-tasks">Done editing</button>`;
}

function saveHabit(h, changes) {
  const next = { ...h, ...changes };
  write('PUT', `/api/habits/${h.id}`, { name: next.name, slot: next.slot, sort: next.sort, active: next.active });
}

function moveTask(id, dir) {
  const hs = activeHabits();
  const h = hs.find((x) => x.id === id);
  const same = hs.filter((x) => x.slot === h.slot);
  const i = same.indexOf(h), j = i + dir;
  if (j < 0 || j >= same.length) return;
  const o = same[j];
  const [a, b] = [h.sort, o.sort === h.sort ? h.sort + dir : o.sort];
  saveHabit(h, { sort: b });
  saveHabit(o, { sort: a });
}

// ---------- cutting down ----------
const DEFAULT_ZONES = [
  { name: 'Garden', allowed: true },
  { name: 'Outside front door', allowed: true },
  { name: 'Out and about', allowed: true },
  { name: 'Desk / where I work', allowed: false },
  { name: 'Bedroom', allowed: false },
  { name: 'Living room', allowed: false },
  { name: 'Kitchen', allowed: false },
  { name: 'Car', allowed: false },
];
const REASONS = ['Work break', 'After food', 'Bored', 'Stressed', 'With friends', 'On autopilot', 'Strong craving'];
const mode = () => S.settings.mode || 'cutdown';
const zones = () => (Array.isArray(S.settings.zones) && S.settings.zones.length ? S.settings.zones : DEFAULT_ZONES);
const zoneAllowed = (place) => { const z = zones().find((x) => x.name === place); return z ? z.allowed : true; };
const dayOf = (at) => logicalDate(at);
const vapes = () => [...S.vapes].sort((a, b) => (a.at < b.at ? -1 : 1));
function vapesBy() {
  const m = {};
  for (const v of vapes()) (m[dayOf(v.at)] ||= []).push(v);
  return m;
}
const firstDay = () => (S.vapes.length ? dayOf(vapes()[0].at) : null);
function daysFrom(start, end = today()) {
  const out = [];
  if (!start) return out;
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function baseline() {
  // average per day over your first 7 days of logging (or so far, if fewer)
  const f = firstDay();
  if (!f) return null;
  const by = vapesBy();
  const days = daysFrom(f, addDays(f, 6)).filter((d) => d < today() || d === f);
  const full = days.filter((d) => d < today());
  const use = full.length ? full : days;
  return Math.round((use.reduce((n, d) => n + (by[d]?.length || 0), 0) / use.length) * 10) / 10;
}
const baselineDone = () => firstDay() && addDays(firstDay(), 7) <= today();
function gapsOn(list, includeNow) {
  const ts = list.map((v) => new Date(v.at).getTime());
  const g = [];
  for (let i = 1; i < ts.length; i++) g.push(ts[i] - ts[i - 1]);
  if (includeNow && ts.length) g.push(Date.now() - ts[ts.length - 1]);
  return g;
}
function longestGap(date) {
  const by = vapesBy();
  const g = gapsOn(by[date] || [], date === today());
  return g.length ? Math.max(...g) : 0;
}
const longestGapEver = () => Math.max(0, ...Object.keys(vapesBy()).map(longestGap));
const sinceLast = () => (S.vapes.length ? Date.now() - new Date(vapes()[S.vapes.length - 1].at).getTime() : null);
function fmtDur(ms) {
  const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / MIN);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function firstVapeHour(date) {
  const l = vapesBy()[date];
  if (!l?.length) return date === today() && firstDay() && firstDay() < today() ? dayHour() : null;
  return dayHour(new Date(l[0].at));
}
function streakOf(test) {
  let n = 0, d = today();
  if (!test(d)) d = addDays(d, -1);
  while (d >= (firstDay() || d) && test(d) && n < 3650) { n++; d = addDays(d, -1); }
  return n;
}
const keptZones = (d) => { const l = vapesBy()[d]; return Boolean(l?.length) && l.every((v) => zoneAllowed(v.place)); };
const underLimit = (d) => has(S.settings.daily_limit) && d >= (firstDay() || '9') && (vapesBy()[d]?.length || 0) <= S.settings.daily_limit;
const workBreaks = (d) => (vapesBy()[d] || []).filter((v) => v.reason === 'Work break').length;

function cutdownMilestones() {
  const by = vapesBy();
  const f = firstDay();
  const tracked = f ? daysFrom(f).length : 0;
  const past = daysFrom(f, addDays(today(), -1));
  const base = baseline();
  const afterBase = past.filter((d) => baselineDone() && d >= addDays(f, 7));
  const minCount = afterBase.length ? Math.min(...afterBase.map((d) => by[d]?.length || 0)) : null;
  const gap = longestGapEver();
  const latestFirst = Math.max(0, ...daysFrom(f).map((d) => firstVapeHour(d) ?? 0));
  const zoneBest = (() => { let best = 0, run = 0; for (const d of daysFrom(f)) { run = keptZones(d) ? run + 1 : 0; best = Math.max(best, run); } return best; })();
  const limitBest = (() => { let best = 0, run = 0; for (const d of daysFrom(f)) { run = underLimit(d) ? run + 1 : 0; best = Math.max(best, run); } return best; })();
  const baseWork = f ? Math.round(daysFrom(f, addDays(f, 6)).filter((d) => d < today()).reduce((n, d) => n + workBreaks(d), 0) / Math.max(1, daysFrom(f, addDays(f, 6)).filter((d) => d < today()).length) * 10) / 10 : 0;
  const fewerWork = afterBase.some((d) => workBreaks(d) < baseWork);
  const vapeFreeDay = Object.values(S.checkins).some((c) => c.nicotine_free && !(by[String(c.date).slice(0, 10)]?.length) && f && String(c.date).slice(0, 10) >= f);
  const sMg = Number(S.settings.start_mg), cMg = Number(S.settings.current_mg);
  const hasMg = has(S.settings.start_mg) && has(S.settings.current_mg) && sMg > 0;
  const M = [];
  const add = (id, title, body, done, prog) => M.push({ id, title, body, done: Boolean(done), prog });
  const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / b) * 100)));
  add('track1', 'Started tracking', 'Logging every vape is step one. Most people are surprised by their real number.', S.vapes.length > 0);
  add('track3', '3 days logged', 'Patterns start to show: which times and places pull you.', tracked >= 3, [pct(tracked, 3), `${tracked}/3 days`]);
  add('track7', 'Baseline week complete', base !== null ? `Your baseline is ${base} a day. Everything is measured against this.` : 'Seven days gives you an honest baseline.', baselineDone(), [pct(tracked, 8), `${Math.min(tracked, 7)}/7 days`]);
  for (const [mins, label] of [[45, '45 min'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours'], [360, '6 hours'], [480, '8 hours']]) {
    add(`gap${mins}`, `${label} between vapes`, 'Same-day gap. Stretching gaps is one of the NHS’s main tips for cutting down.', gap >= mins * MIN, [pct(gap, mins * MIN), `best ${fmtDur(gap)}`]);
  }
  for (const [h, label] of [[10, '10am'], [12, 'midday'], [15, '3pm']]) {
    add(`morning${h}`, `No vape before ${label}`, 'The first vape of the day is usually the hardest one to push back.', latestFirst >= h, [pct(latestFirst, h), latestFirst ? `latest first vape ${String(Math.floor(latestFirst) % 24).padStart(2, '0')}:${String(Math.round((latestFirst % 1) * 60) % 60).padStart(2, '0')}` : '']);
  }
  add('zones1', 'A day keeping to your zones', 'Every vape in an allowed place, none in a vape-free one.', zoneBest >= 1);
  add('zones3', 'Zones kept 3 days running', 'The habit is breaking its link with those rooms.', zoneBest >= 3, [pct(zoneBest, 3), `best run ${zoneBest}`]);
  add('zones7', 'Zones kept for a week', 'Time to make another place vape-free. The NHS suggests widening these areas gradually.', zoneBest >= 7, [pct(zoneBest, 7), `best run ${zoneBest}`]);
  if (has(S.settings.daily_limit)) {
    add('limit1', `A day at or under ${S.settings.daily_limit}`, 'Hitting your own limit.', limitBest >= 1);
    add('limit3', 'Under your limit 3 days running', '', limitBest >= 3, [pct(limitBest, 3), `best run ${limitBest}`]);
    add('limit7', 'Under your limit for a week', 'Ready to lower the limit by one or two.', limitBest >= 7, [pct(limitBest, 7), `best run ${limitBest}`]);
  }
  if (base) {
    add('below', 'A day below your baseline', 'Any full day under your baseline average.', minCount !== null && minCount < base, minCount !== null ? [minCount < base ? 100 : 0, `best day ${minCount}`] : null);
    add('work', 'Fewer work-break vapes than your baseline', 'Breaks without the vape: walk, water, stretch.', fewerWork);
    for (const [f2, label] of [[0.75, '25% fewer'], [0.5, 'Half'], [0.25, '75% fewer']]) {
      const target = Math.floor(base * f2);
      add(`cut${f2}`, `${label} than your baseline in a day`, `${target} or fewer in a day.`, minCount !== null && minCount <= target, minCount !== null ? [pct(base - minCount, base - target), `best day ${minCount}`] : null);
    }
  }
  if (hasMg) {
    add('mg1', 'First step down in nicotine strength', `From ${sMg} mg/ml. The NHS suggests lowering strength gradually, and watching that you don’t start vaping more.`, cMg < sMg);
    add('mgHalf', 'Half your starting strength', `${sMg / 2} mg/ml or lower.`, cMg <= sMg / 2, [pct(sMg - cMg, sMg / 2), `now ${cMg} mg/ml`]);
    add('mg0', 'Nicotine-free liquid', '0 mg/ml. The hand-to-mouth habit is all that’s left.', cMg === 0, [pct(sMg - cMg, sMg), `now ${cMg} mg/ml`]);
  }
  add('free1', 'First nicotine-free day', 'Tick “nicotine-free” in your check-in on a day with nothing logged.', vapeFreeDay);
  return M;
}

function viewCutdown() {
  const t = today();
  const by = vapesBy();
  const todayList = by[t] || [];
  const base = baseline();
  const last7 = daysFrom(addDays(t, -6)).map((d) => by[d]?.length || 0);
  const avg7 = S.vapes.length ? Math.round((last7.reduce((a, b) => a + b, 0) / Math.min(7, daysFrom(firstDay()).length)) * 10) / 10 : null;
  const lim = S.settings.daily_limit;
  const goal = Number(S.settings.gap_goal_min || 0);
  const since = sinceLast();
  const ms = cutdownMilestones();
  const done = ms.filter((m) => m.done);
  const next = ms.filter((m) => !m.done).slice(0, 4);

  const top = `<div class="card"><h2>Today</h2>
    <div class="row between"><div class="big">${todayList.length}${has(lim) ? `<span class="sub" style="font-size:20px"> / ${lim}</span>` : ''}</div>
    <div style="text-align:right"><div class="sub">since last</div><b data-since-last>${since === null ? '–' : fmtDur(since)}</b></div></div>
    ${has(lim) ? `<div class="bar"><i style="width:${Math.min(100, Math.round((todayList.length / Math.max(1, lim)) * 100))}%;${todayList.length > lim ? 'background:var(--bad)' : ''}"></i></div>` : ''}
    <div class="grid2" style="margin-top:12px">
      <div class="stat"><b>${workBreaks(t)}</b><span>work-break vapes today</span></div>
      <div class="stat"><b>${fmtDur(longestGap(t))}</b><span>longest gap today</span></div>
      <div class="stat"><b>${avg7 ?? '–'}</b><span>7-day average</span></div>
      <div class="stat"><b>${base ?? '–'}</b><span>baseline${baselineDone() ? '' : ' (so far)'}</span></div>
    </div>
    <div style="height:12px"></div>
    <button class="btn primary block" data-action="log-vape">+ Log a vape</button></div>`;

  const gapCard = goal ? (() => {
    const cur = since ?? 0;
    const pct = Math.min(100, Math.round((cur / (goal * MIN)) * 100));
    return `<div class="card"><h2>Gap goal · ${goal} min</h2><div class="bar"><i style="width:${pct}%"></i></div>
      <p class="sub" style="margin-bottom:0">${cur >= goal * MIN ? 'Goal reached. Every extra minute is a bonus.' : `${fmtDur(goal * MIN - cur)} to go. Try a walk, water or 20 press-ups first.`}</p></div>`;
  })() : '';

  const todayLog = `<div class="card"><h2>Today’s log</h2>${todayList.length ? `<ul class="list">${[...todayList].reverse().map((v) => {
    const d = new Date(v.at);
    return `<li class="row between"><span><b>${pad(d.getHours())}:${pad(d.getMinutes())}</b> ${v.kind === 'cigarette' ? '🚬' : ''} ${esc(v.place || '')}${v.place && !zoneAllowed(v.place) ? ' <span class="down">· vape-free zone</span>' : ''}<span class="sub">${v.reason ? ' · ' + esc(v.reason) : ''}</span></span>
      <button class="btn small" data-action="del-vape" data-id="${esc(v.id)}" aria-label="Delete">×</button></li>`;
  }).join('')}</ul>` : '<p class="sub">Nothing logged yet today.</p>'}</div>`;

  const milestones = `<div class="card"><h2>Milestones · ${done.length}/${ms.length}</h2>
    ${next.map((m) => `<div class="milestone"><div class="m-icon">⏳</div><div style="flex:1"><b>${esc(m.title)}</b>${m.body ? `<div class="sub">${esc(m.body)}</div>` : ''}
      ${m.prog ? `<div class="bar"><i style="width:${m.prog[0]}%"></i></div><div class="sub">${esc(m.prog[1])}</div>` : ''}</div></div>`).join('')}
    ${done.length ? `<details style="margin-top:8px"><summary class="sub">Unlocked (${done.length})</summary>${[...done].reverse().map((m) => `<div class="milestone"><div class="m-icon">✅</div><div><b>${esc(m.title)}</b></div></div>`).join('')}</details>` : ''}
    <p class="sub" style="margin-bottom:0">Milestones never reset. A heavy day doesn’t take any away.</p></div>`;

  const zoneCard = `<div class="card"><h2>Vape-free zones</h2>
    <p class="sub" style="margin-top:0">Tap a place to switch it. Once you’ve kept your zones for a week, make one more place vape-free.</p>
    <ul class="list">${zones().map((z, i) => `<li class="row between" data-action="toggle-zone" data-i="${i}" style="cursor:pointer"><span>${esc(z.name)}</span><span class="pill" style="${z.allowed ? '' : 'background:var(--bad);color:#fff'}">${z.allowed ? 'Allowed' : 'Vape-free'}</span></li>`).join('')}</ul>
    <form id="zone-form" class="row" style="margin-top:8px"><input name="name" maxlength="40" placeholder="Add a place" style="margin:0"><button class="btn small">Add</button></form>
    <p class="sub" style="margin-bottom:0">Kept your zones ${streakOf(keptZones)} day(s) in a row.</p></div>`;

  const settings = `<details class="card"><summary><b>Targets and strength</b></summary>
    <form id="cut-form" style="margin-top:12px">
      <div class="grid2">
        <label>Daily limit (optional)<input type="number" name="daily_limit" min="0" inputmode="numeric" value="${esc(S.settings.daily_limit ?? '')}" placeholder="${base ? Math.max(0, Math.floor(base) - 1) : ''}"></label>
        <label>Gap goal (min)<input type="number" name="gap_goal_min" min="0" inputmode="numeric" value="${esc(S.settings.gap_goal_min ?? '')}" placeholder="45"></label>
        <label>Starting strength (mg/ml)<input type="number" name="start_mg" step="0.5" min="0" inputmode="decimal" value="${esc(S.settings.start_mg ?? '')}" placeholder="20"></label>
        <label>Current strength (mg/ml)<input type="number" name="current_mg" step="0.5" min="0" inputmode="decimal" value="${esc(S.settings.current_mg ?? '')}"></label>
      </div>
      <p class="sub">Leave the limit blank during your baseline week so the number is honest. Then set it 1–2 below your baseline and lower it a step each week you hit it.</p>
      <button class="btn primary block">Save</button></form>
    <button class="btn block" style="margin-top:10px" data-action="set-mode" data-mode="quit">I’m ready to stop completely</button></details>`;

  return top + sosButton() + '<div style="height:12px"></div>' + gapCard + todayLog + milestones + zoneCard + settings;
}

function openVapeLog(preset = {}) {
  const lastV = vapes()[S.vapes.length - 1] || {};
  const place = preset.place ?? lastV.place ?? zones().find((z) => z.allowed)?.name;
  const reason = preset.reason ?? '';
  const now = new Date();
  openModal(`<h3>Log a vape</h3>
    <form id="vape-form">
      <div class="seg" style="margin-bottom:12px"><button type="button" data-kind="vape" class="on">Vape</button><button type="button" data-kind="cigarette">Cigarette</button></div>
      <input type="hidden" name="kind" value="vape">
      <label>When<input type="time" name="time" value="${pad(now.getHours())}:${pad(now.getMinutes())}"></label>
      <div class="section-label">Where</div>
      <div class="chips">${zones().map((z) => `<button type="button" class="chip ${z.name === place ? 'on' : ''} ${z.allowed ? '' : 'no'}" data-chip="place" data-v="${esc(z.name)}">${esc(z.name)}</button>`).join('')}</div>
      <div class="section-label">Why</div>
      <div class="chips">${REASONS.map((r) => `<button type="button" class="chip ${r === reason ? 'on' : ''}" data-chip="reason" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <p id="zone-warn" class="sub" style="color:var(--warn)">${place && !zoneAllowed(place) ? 'That’s one of your vape-free zones. Log it anyway (honest data matters) and try stepping outside next time.' : ''}</p>
      <div class="row"><button type="button" class="btn" data-close style="flex:1">Cancel</button><button class="btn primary" style="flex:2">Log it</button></div>
    </form>`);
  const f = $('#vape-form');
  const sel = { place, reason };
  f.addEventListener('click', (e) => {
    const k = e.target.closest('[data-kind]');
    if (k) { $$('[data-kind]', f).forEach((b) => b.classList.toggle('on', b === k)); f.elements.kind.value = k.dataset.kind; return; }
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    const key = c.dataset.chip;
    sel[key] = sel[key] === c.dataset.v ? '' : c.dataset.v;
    $$(`[data-chip="${key}"]`, f).forEach((b) => b.classList.toggle('on', b.dataset.v === sel[key]));
    if (key === 'place') $('#zone-warn').textContent = sel.place && !zoneAllowed(sel.place) ? 'That’s one of your vape-free zones. Log it anyway (honest data matters) and try stepping outside next time.' : '';
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const [hh, mm] = (f.elements.time.value || '').split(':').map(Number);
    const at = new Date();
    if (Number.isFinite(hh)) { at.setHours(hh, mm || 0, 0, 0); if (at > new Date()) at.setDate(at.getDate() - 1); }
    const id = 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    write('PUT', `/api/vapes/${id}`, { at: at.toISOString(), kind: f.elements.kind.value, place: sel.place || null, reason: sel.reason || null });
    closeModal();
    const n = (vapesBy()[today()] || []).length;
    const lim = S.settings.daily_limit;
    toast(has(lim) ? `Logged · ${n}/${lim} today` : `Logged · ${n} today`);
  };
}

// ---------- views ----------
const TITLES = { today: 'Today', quit: 'Quit', train: 'Train', checkin: 'Daily', graphs: 'Graphs' };
let graphRange = 'all';

function render() {
  if (!S) return;
  $('#title').textContent = tab === 'quit' ? (mode() === 'quit' ? 'Quit' : 'Cutting down') : TITLES[tab];
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const v = $('#view');
  v.innerHTML = ({ today: viewToday, quit: viewQuit, train: viewTrain, checkin: viewDaily, graphs: viewGraphs })[tab]();
  if (tab === 'graphs') drawCharts();
}

function sosButton() {
  return '<button class="btn sos" data-action="sos">I’m craving right now</button>';
}

function viewToday() {
  const t = today();
  const p = planFor(t);
  const log = S.sessions[t];
  const ci = S.checkins[t];
  const tomorrow = planFor(addDays(t, 1));
  const q = quitAt();

  const sl = sinceLast();
  const nToday = (vapesBy()[t] || []).length;
  const quitCard = mode() !== 'quit'
    ? `<div class="card"><h2>Cutting down</h2>
        <div class="row between"><div><div class="big">${nToday}${has(S.settings.daily_limit) ? `<span class="sub" style="font-size:20px"> / ${S.settings.daily_limit}</span>` : ''}</div><div class="sub">today · ${workBreaks(t)} at work</div></div>
        <div style="text-align:right"><div class="sub">since last</div><b data-since-last>${sl === null ? '–' : fmtDur(sl)}</b></div></div>
        <div style="height:10px"></div><button class="btn primary block" data-action="log-vape">+ Log a vape</button></div>`
    : q
    ? `<div class="card"><h2>Nicotine-free</h2>
        <div class="big" data-since>${fmtSince(sinceQuit())}</div>
        <div class="sub">${S.settings.daily_spend ? `${gbp(moneySaved())} saved · ` : ''}${nextMilestoneText()}</div></div>`
    : `<div class="card"><h2>Quit tracker</h2><p>Set your quit date to start the clock.</p>
        <button class="btn primary" data-goto="quit">Set quit date</button></div>`;

  const sessionCard = p
    ? `<div class="card"><h2>Today’s session · Week ${p.wk}</h2>
        <div class="row between"><h3>${esc(p.session)}</h3>${log?.done ? '<span class="done">✓ Done</span>' : ''}</div>
        ${cardioSummary(p, log) ? `<p class="done">${esc(cardioSummary(p, log))}</p>` : ''}
        <p>${esc(p.prescription)}</p>
        ${p.target !== '—' ? `<p class="sub"><b>Target:</b> ${esc(p.target)}</p>` : ''}
        ${p.type !== 'rest' ? `<button class="btn primary block" data-action="log" data-date="${t}">${log ? 'Edit log' : 'Log session'}</button>` : ''}</div>`
    : `<div class="card"><h2>Training</h2><p>${t > plan()[plan().length - 1].date ? 'The December plan is finished. Check your Progress tab, then we’ll plan January.' : 'The plan starts on ' + fmtDay(plan()[0].date) + '.'}</p></div>`;

  const hr = dayHour();
  const mDone = morningDone(ci), eDone = eveningDone(ci);
  const checkCard = `<div class="card"><h2>Check-ins</h2>
    <div class="row between"><span>☀️ Morning: HR + sleep</span>${mDone ? '<span class="done">✓</span>' : '<button class="btn small" data-goto="checkin" data-daily-sub="morning">Do it</button>'}</div>
    ${mDone ? `<p class="sub" style="margin:4px 0 8px">${[has(ci.sleep_hr) && `sleep HR ${ci.sleep_hr}`, has(ci.shower_hr) && `shower HR ${ci.shower_hr}`, has(ci.sleep_h) && `${ci.sleep_h} h`].filter(Boolean).join(' · ')}</p>` : '<div style="height:10px"></div>'}
    <div class="row between"><span>🌙 Evening: water, screen time, cravings</span>${eDone ? '<span class="done">✓</span>' : `<button class="btn small ${hr >= 18 ? 'primary' : ''}" data-goto="checkin" data-daily-sub="evening">${hr >= 18 ? 'Do it' : 'Later'}</button>`}</div></div>`;

  const next = tomorrow ? `<div class="card"><h2>Tomorrow</h2><h3>${esc(tomorrow.session)}</h3><p class="sub">${esc(tomorrow.target)}</p></div>` : '';
  const tp = tasksProgress(t);
  const left = tp.hs.filter((h) => !isDone(t, h.id));
  const tasksCard = `<div class="card"><div class="row between"><h2 style="margin:0">Daily tasks</h2><b>${tp.done}/${tp.hs.length}</b></div>
    <div class="bar"><i style="width:${tp.pct}%"></i></div>
    ${left.length ? `<ul class="list" style="margin-top:6px">${left.map((h) => taskRow(h, t)).join('')}</ul>` : `<p class="done" style="margin-bottom:0">All done today 🎉</p>`}</div>`;
  return quitCard + sosButton() + '<div style="height:12px"></div>' + tasksCard + sessionCard + checkCard + next;
}

function checkinSummary(c) {
  return [
    has(c.shower_hr) && `shower HR ${c.shower_hr}`, has(c.sleep_hr) && `sleep HR ${c.sleep_hr}`,
    has(c.sleep_h) && `${c.sleep_h} h sleep`, has(c.cravings) && `cravings ${c.cravings}/10`,
    has(c.energy) && `energy ${c.energy}/10`, has(c.water_l) && `${c.water_l} L`, has(c.screen_min) && `📱 ${fmtScreen(c.screen_min)}`, c.dizzy && 'dizzy',
  ].filter(Boolean).join(' · ');
}

function nextMilestoneText() {
  const ms = sinceQuit();
  const n = MILESTONES.find((m) => m.t > ms);
  return n ? `Next: ${n.title} in ${fmtSince(n.t - ms)}` : 'Every milestone unlocked';
}

function toLocalInput(d) {
  return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function viewQuit() { return mode() === 'quit' ? viewQuitFull() : viewCutdown(); }

function viewQuitFull() {
  const q = quitAt();
  const ms = sinceQuit();
  const weekAgo = Date.now() - 7 * DAY;
  const cr = S.cravings;
  const beaten = cr.filter((c) => c.beaten).length;
  const thisWeek = cr.filter((c) => new Date(c.at) > weekAgo).length;

  const settings = `<details class="card" ${q ? '' : 'open'}><summary><b>${q ? 'Quit settings' : 'Set your quit date'}</b></summary>
    <form id="quit-form" style="margin-top:12px">
      <label>Quit date and time<input type="datetime-local" name="quit_at" required value="${q ? toLocalInput(q) : toLocalInput(new Date())}"></label>
      <label>What you spent per day on cigarettes / vapes (£)<input type="number" name="daily_spend" min="0" step="0.01" inputmode="decimal" value="${esc(S.settings.daily_spend ?? '')}"></label>
      <button class="btn primary block">Save</button>
    </form>
    ${q ? '<button class="btn block" style="margin-top:10px" data-action="reset-quit">I slipped: restart the clock</button>' : ''}
    <button class="btn block" style="margin-top:10px" data-action="set-mode" data-mode="cutdown">Switch back to cutting down</button>
  </details>`;

  if (!q) return settings;

  const milestones = MILESTONES.map((m, i) => {
    const done = ms >= m.t;
    const prev = i ? MILESTONES[i - 1].t : 0;
    const isNext = !done && ms >= prev;
    const pct = isNext ? Math.round(((ms - prev) / (m.t - prev)) * 100) : 0;
    return `<div class="milestone ${done || isNext ? '' : 'locked'}">
      <div class="m-icon">${done ? '✅' : isNext ? '⏳' : '🔒'}</div>
      <div style="flex:1"><b>${esc(m.title)}</b><div class="sub">${esc(m.body)}</div>
      ${isNext ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="sub">${fmtSince(m.t - ms)} to go</div>` : ''}</div></div>`;
  }).join('');

  return `<div class="card"><h2>Nicotine-free for</h2><div class="big" data-since>${fmtSince(ms)}</div>
      <div class="sub">since ${q.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      <div class="grid2" style="margin-top:12px">
        <div class="stat"><b data-money>${gbp(moneySaved())}</b><span>saved</span></div>
        <div class="stat"><b>${beaten}/${cr.length}</b><span>cravings beaten</span></div>
        <div class="stat"><b>${thisWeek}</b><span>cravings this week</span></div>
        <div class="stat"><b>${nicFreeDays()}</b><span>nicotine-free check-ins</span></div>
      </div></div>
    ${sosButton()}<div style="height:12px"></div>
    <div class="card"><h2>Milestones</h2>${milestones}</div>
    ${settings}`;
}

function viewTrain() {
  const seg = `<div class="seg">${['plan', 'strength', 'tests', 'targets'].map((s) => `<button data-sub="${s}" class="${trainSub === s ? 'on' : ''}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>`;
  if (trainSub === 'strength') return seg + viewStrength();
  if (trainSub === 'tests') return seg + viewTests();
  if (trainSub === 'targets') return seg + viewTargets();
  const t = today();
  const weeks = [...new Set(plan().map((p) => p.wk))];
  const trackCard = `<div class="card"><h2>Plan</h2>
    <div class="seg" style="margin-bottom:8px"><button data-action="set-track" data-track="standard" class="${isFast() ? '' : 'on'}">Standard</button><button data-action="set-track" data-track="fast" class="${isFast() ? 'on' : ''}">Faster track</button></div>
    <p class="sub" style="margin:0">${isFast()
    ? `Faster track from ${fmtDay(S.fastFrom)}: ~4½ h, then ~6 h, then a lighter Christmas week. Drop back to Standard for a few days if you get dizzy, feel wiped out the next day, or your morning HR is 5+ bpm above normal.`
    : `Switch to the faster track on ${fmtDay(S.fastFrom)} only if, for all of week 1, sessions felt easier than target, you had no dizziness (including standing up afterwards) and your morning HR didn’t rise.`}</p></div>`;
  return seg + trackCard + weeks.map((w) => {
    const days = plan().filter((p) => p.wk === w);
    const fastTag = isFast() && w >= 2 && w <= 4 ? ' · faster track' : '';
    const label = (w === 0 ? 'Week 0 · intro' : w === 4 ? 'Week 4 · lighter (Christmas)' : w === 5 ? 'Week 5 · retest' : `Week ${w}`) + fastTag;
    return `<div class="card"><h2>${label}</h2><ul class="list">${days.map((p) => {
      const log = S.sessions[p.date];
      return `<li class="day ${p.date === t ? 'today' : ''}" data-action="log" data-date="${p.date}">
        <div class="d">${fmtDay(p.date)}</div>
        <div class="t"><b>${esc(p.session)}</b><div class="sub">${esc(p.target)}</div>${cardioSummary(p, log) ? `<div class="sub done">${esc(cardioSummary(p, log))}</div>` : ''}</div>
        <div class="tick">${log?.done ? '<span class="done">✓</span>' : p.type === 'rest' ? '' : '○'}</div></li>`;
    }).join('')}</ul></div>`;
  }).join('');
}

function strengthRows(key, wk) {
  return S.strengthPlan[key].map((ex) => {
    const v = weightFor(ex.name, wk);
    const prev = lastWeight(ex.name, wk);
    return `<tr><td><b>${esc(ex.name)}</b><div class="sub">${esc(ex.sets)} · ${esc(ex.cue)}</div>
      <div class="sub">${prev ? `Wk ${prev.w}: ${prev.v} kg` : `Start: ${ex.start} kg`}</div></td>
      <td><input type="number" inputmode="decimal" step="0.5" min="0" data-weight="${esc(ex.name)}" data-week="${wk}" value="${has(v) ? esc(v) : ''}" placeholder="${prev ? prev.v : ex.start}"></td></tr>`;
  }).join('');
}

function viewStrength() {
  if (strengthWeek === null) strengthWeek = currentWeek();
  const wk = strengthWeek;
  const weeks = [0, 1, 2, 3, 4, 5];
  return `<div class="card"><label>Week<select id="wk-select">${weeks.map((w) => `<option value="${w}" ${w === wk ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></label>
    <p class="sub">Total kg including the Smith bar. When every set hits the top reps at RPE 7 or less, add 2.5 kg (upper body/cable) or 5 kg (squat, RDL, hip thrust). Weights save as you type.</p></div>
    <div class="card"><h2>Strength A</h2><table><tbody>${strengthRows('A', wk)}</tbody></table></div>
    <div class="card"><h2>Strength B</h2><table><tbody>${strengthRows('B', wk)}</tbody></table></div>`;
}

function viewTargets() {
  return `<div class="card"><h2>Cardio targets</h2><ul class="list">${CARDIO_TARGETS.map(([kit, type, a, b, feel]) =>
    `<li><b>${esc(kit)} · ${esc(type)}</b><div class="sub">Wk 0–1: ${esc(a)}<br>Wk 2–3: ${esc(b)}<br>${esc(feel)}</div></li>`).join('')}</ul></div>
    <div class="card"><h2>Safety</h2><ul class="list">${SAFETY.map(([k, v]) => `<li><b>${esc(k)}</b><div class="sub">${esc(v)}</div></li>`).join('')}</ul></div>`;
}

function rangeField(name, label, value) {
  const set = has(value);
  return `<label>${label}<div class="range-row"><input type="range" name="${name}" min="0" max="10" step="1" value="${set ? value : 5}" ${set ? 'data-touched="1"' : ''}><output>${set ? value : '–'}</output></div></label>`;
}

function viewDaily() {
  if (dailySub === 'checkin') dailySub = dayHour() < 15 ? 'morning' : 'evening';
  const seg = `<div class="seg">${[['tasks', 'Tasks'], ['morning', 'Morning'], ['evening', 'Evening']].map(([k, l]) => `<button data-daily="${k}" class="${dailySub === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return seg + (dailySub === 'tasks' ? viewTasks() : dailySub === 'evening' ? viewEvening() : viewMorning());
}

const fmtScreen = (m) => (has(m) ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : '');
const morningDone = (c) => Boolean(c) && (has(c.shower_hr) || has(c.sleep_hr) || has(c.sleep_h));
const eveningDone = (c) => Boolean(c) && (has(c.nicotine_free) || has(c.water_l) || has(c.screen_min) || has(c.cravings) || has(c.energy));

function checkinDateField(date) {
  const prev = addDays(date, -1), next = addDays(date, 1);
  return `<div class="row between" style="margin-bottom:10px">
    <button type="button" class="btn small" data-action="ci-day" data-date="${prev}" aria-label="Previous day">‹</button>
    <input type="date" name="date" value="${date}" max="${today()}" style="margin:0;max-width:200px;text-align:center">
    <button type="button" class="btn small" data-action="ci-day" data-date="${next}" ${date >= today() ? 'disabled' : ''} aria-label="Next day">›</button></div>`;
}

function recentCheckins() {
  const recent = Object.values(S.checkins).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);
  return `<div class="card"><h2>Recent</h2>${recent.length ? `<ul class="list">${recent.map((r) => `<li class="day" data-action="edit-checkin" data-date="${r.date}">
    <div class="d">${fmtDay(r.date)}</div><div class="t">${r.nicotine_free ? '🚭 ' : ''}${checkinSummary(r) || '—'}</div>
    <div class="sub">${morningDone(r) ? '☀️' : ''}${eveningDone(r) ? '🌙' : ''}</div></li>`).join('')}</ul>` : '<p class="sub">No check-ins yet.</p>'}</div>`;
}

function viewMorning() {
  const date = viewCheckin.date || today();
  const c = S.checkins[date] || {};
  return `<form id="morning-form" class="card"><h2>☀️ Morning check-in</h2>
      ${checkinDateField(date)}
      <div class="grid2">
        <label>Avg HR overnight (bpm)<input type="number" name="sleep_hr" inputmode="numeric" min="25" max="220" value="${esc(c.sleep_hr ?? '')}"></label>
        <label>HR after shower (bpm)<input type="number" name="shower_hr" inputmode="numeric" min="25" max="220" value="${esc(c.shower_hr ?? '')}"></label>
      </div>
      <label>Sleep last night (hours)<input type="number" name="sleep_h" inputmode="decimal" step="0.25" min="0" max="24" value="${esc(c.sleep_h ?? '')}"></label>
      <p class="sub" style="margin:-4px 0 12px">Take the shower HR at the same point each day, e.g. sitting down 2 min after getting out. Overnight HR and sleep are for the night before this date.</p>
      <button class="btn primary block">${morningDone(c) ? 'Update' : 'Save'} morning check-in</button>
    </form>${recentCheckins()}`;
}

function viewEvening() {
  const date = viewCheckin.date || today();
  const c = S.checkins[date] || {};
  const sm = c.screen_min;
  return `<form id="evening-form" class="card"><h2>🌙 Evening check-in</h2>
      ${checkinDateField(date)}
      <label class="check"><input type="checkbox" name="nicotine_free" ${c.nicotine_free ? 'checked' : ''}> Nicotine-free today</label>
      ${rangeField('cravings', 'Cravings (0 none – 10 intense)', c.cravings)}
      ${rangeField('energy', 'Energy (0 flat – 10 great)', c.energy)}
      <label>Water (litres)<input type="number" name="water_l" inputmode="decimal" step="0.25" min="0" max="10" value="${esc(c.water_l ?? '')}"></label>
      <label>Phone screen time<div class="grid2" style="margin-top:4px">
        <input type="number" name="screen_h" inputmode="numeric" min="0" max="24" placeholder="hours" value="${has(sm) ? Math.floor(sm / 60) : ''}" style="margin:0">
        <input type="number" name="screen_m" inputmode="numeric" min="0" max="59" placeholder="minutes" value="${has(sm) ? sm % 60 : ''}" style="margin:0"></div></label>
      <p class="sub" style="margin:-4px 0 12px">iPhone: Settings → Screen Time → See All App &amp; Website Activity → Day.</p>
      <label class="check"><input type="checkbox" name="dizzy" ${c.dizzy ? 'checked' : ''}> Dizzy or light-headed today</label>
      <label>Notes<textarea name="notes">${esc(c.notes ?? '')}</textarea></label>
      <button class="btn primary block">${eveningDone(c) ? 'Update' : 'Save'} evening check-in</button>
    </form>${recentCheckins()}`;
}

function viewCheckin() { return dailySub === 'evening' ? viewEvening() : viewMorning(); }

function viewTests() {
  const bench = S.benchmarkDefs.map((d) => {
    const b = S.benchmarks[d.key] || {};
    const fromLog = (date) => (d.from ? S.sessions[date]?.[d.from] : null);
    const base = has(b.baseline) ? b.baseline : fromLog(d.baselineDate);
    const re = has(b.retest) ? b.retest : fromLog(d.retestDate);
    let change = '';
    if (has(base) && has(re)) {
      const diff = Math.round((re - base) * 10) / 10;
      const good = d.better === 'higher' ? diff > 0 : diff < 0;
      change = `<span class="${diff === 0 ? '' : good ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff}</span>`;
    }
    const inp = (field, manual, auto) => `<input type="number" inputmode="decimal" step="any" data-bench="${d.key}" data-field="${field}" value="${esc(manual ?? '')}" placeholder="${has(auto) ? esc(auto) : esc(d.unit)}">`;
    return `<tr><td>${esc(d.label)}<div class="sub">${fmtDay(d.baselineDate)} → ${fmtDay(d.retestDate)} · ${d.better} is better${d.from ? ' · fills from your session log' : ''}</div></td>
      <td>${inp('baseline', b.baseline, fromLog(d.baselineDate))}</td>
      <td>${inp('retest', b.retest, fromLog(d.retestDate))}</td>
      <td>${change}</td></tr>`;
  }).join('');
  return `<div class="card"><h2>Benchmarks</h2><table><thead><tr><th>Test</th><th>Base</th><th>Retest</th><th>Δ</th></tr></thead><tbody>${bench}</tbody></table>
    <p class="sub">Bike and erg tests fill in automatically when you log those sessions with watts, distance and HR. Type a number to override.</p></div>`;
}

function viewGraphs() {
  const t = today();
  const due = plan().filter((p) => p.type !== 'rest' && p.date <= t);
  const done = due.filter((p) => S.sessions[p.date]?.done).length;
  const cr = S.cravings;
  const pctBeaten = cr.length ? Math.round((cr.filter((c) => c.beaten).length / cr.length) * 100) : null;
  const seg = `<div class="seg">${[['14', '14 days'], ['30', '30 days'], ['all', 'All']].map(([k, l]) => `<button data-range="${k}" class="${graphRange === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const card = (title, ids, note) => `<div class="card"><h2>${title}</h2>${ids.map((id) => `<canvas id="${id}"></canvas>`).join('<div style="height:10px"></div>')}${note ? `<p class="sub">${note}</p>` : ''}</div>`;
  return `<div class="grid2">
      <div class="stat"><b>${done}/${due.length}</b><span>sessions done so far</span></div>
      <div class="stat"><b>${nicFreeDays()}</b><span>nicotine-free days</span></div>
      <div class="stat"><b>${pctBeaten === null ? '–' : pctBeaten + '%'}</b><span>cravings beaten</span></div>
      <div class="stat"><b>${Object.keys(S.checkins).length}</b><span>check-ins</span></div>
    </div><div style="height:12px"></div>${seg}
    ${S.vapes.length ? card('Vaping', ['g-vapes', 'g-vgap'], 'Dashed line = your daily limit. Work-break vapes are shown in orange.') : ''}
    ${card('Daily tasks', ['g-tasks'])}
    ${habitStats()}
    ${card('Morning heart rate', ['g-morning'], 'Both should drift down as fitness improves and nicotine clears. A sudden jump of 5+ bpm can mean you’re run down. Take it easy that day.')}
    ${card('Sleep', ['g-sleep'])}
    ${card('Phone screen time', ['g-screen'], 'From your evening check-in. Compare with your sleep and overnight HR.')}
    ${card('Erg', ['g-erg-split', 'g-erg-hr'], 'Split is plotted upside down, so up means faster.')}
    ${card('Bike', ['g-bike-w', 'g-bike-eff'], 'Efficiency = watts per heartbeat. Rising means more power for the same effort on your heart.')}
    ${card('Treadmill', ['g-tread'])}
    ${card('Strength (kg)', ['g-strength'])}
    ${card('Cravings', ['g-crav'], 'Daily score from your check-in.')}
    <button class="btn block" data-action="export">Download my data (CSV)</button>
    <div style="height:10px"></div>
    <button class="btn block" data-action="logout">Log out</button>`;
}

function habitStats() {
  const hs = activeHabits();
  if (!hs.length) return '';
  return `<div class="card"><h2>Task streaks</h2><table><thead><tr><th>Task</th><th>Last 7 days</th><th>Streak</th></tr></thead><tbody>
    ${hs.map((h) => `<tr><td>${esc(h.name)}</td><td>${last7(h.id)}/7</td><td>${streak(h.id) ? '🔥' + streak(h.id) : '–'}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- charts ----------
function inRange(date) {
  if (graphRange === 'all') return true;
  return date >= addDays(today(), -Number(graphRange));
}
function series(rows, field, map = Number) {
  return rows.filter((r) => has(r[field]) && inRange(r.date)).map((r) => ({ x: r.date, y: map(r[field]) }));
}

function drawCharts() {
  const ci = Object.values(S.checkins).sort((a, b) => (a.date > b.date ? 1 : -1));
  const sessOf = (kind) => plan().filter((p) => p.type === kind && S.sessions[p.date]).map((p) => S.sessions[p.date]);
  const erg = sessOf('erg'), bike = sessOf('bike'), tread = sessOf('treadmill');
  const C = '--accent', C2 = '--series2';

  lineChart($('#g-morning'), [
    { name: 'After shower', color: C, pts: series(ci, 'shower_hr') },
    { name: 'Overnight avg', color: C2, pts: series(ci, 'sleep_hr') },
  ], { unit: 'bpm' });
  lineChart($('#g-screen'), [{ name: 'Screen time', color: '--series3', pts: series(ci, 'screen_min', (v) => Math.round((v / 60) * 10) / 10) }], { min: 0, unit: 'h', fmt: (v) => fmtScreen(Math.round(v * 60)) });
  lineChart($('#g-sleep'), [{ name: 'Hours slept', color: C, pts: series(ci, 'sleep_h') }], { min: 0, unit: 'h' });
  lineChart($('#g-erg-split'), [{ name: 'Avg split /500m', color: C, pts: series(erg, 'avg_split_s') }], { invert: true, fmt: fmtSplit });
  lineChart($('#g-erg-hr'), [{ name: 'Erg avg HR', color: C2, pts: series(erg, 'avg_hr') }], { unit: 'bpm' });
  lineChart($('#g-bike-w'), [
    { name: 'Avg watts', color: C, pts: series(bike, 'avg_watts') },
  ], { unit: 'W' });
  lineChart($('#g-bike-eff'), [{
    name: 'Watts per bpm', color: C2,
    pts: bike.filter((r) => has(r.avg_watts) && has(r.avg_hr) && inRange(r.date)).map((r) => ({ x: r.date, y: Math.round((r.avg_watts / r.avg_hr) * 100) / 100 })),
  }], { fmt: (v) => v.toFixed(2) });
  lineChart($('#g-tread'), [
    { name: 'Avg speed km/h', color: C, pts: series(tread, 'avg_speed') },
  ], { unit: 'km/h' });
  const lifts = [['Smith machine squat', 'Squat'], ['Smith machine bench press', 'Bench'], ['Cable lat pulldown', 'Pulldown'], ['Smith Romanian deadlift', 'RDL']];
  const colors = ['--accent', '--series2', '--series3', '--series4'];
  lineChart($('#g-strength'), lifts.map(([ex, name], i) => ({
    name, color: colors[i],
    pts: [0, 1, 2, 3, 4, 5].filter((w) => has(weightFor(ex, w))).map((w) => ({ x: w, y: Number(weightFor(ex, w)) })),
  })), { xFmt: (w) => `Wk ${w}`, unit: 'kg' });
  if (S.vapes.length) {
    const by = vapesBy();
    const days = daysFrom(firstDay()).filter(inRange);
    const lim = S.settings.daily_limit;
    lineChart($('#g-vapes'), [
      { name: 'Vapes per day', color: C, pts: days.map((d) => ({ x: d, y: by[d]?.length || 0 })) },
      { name: 'Work breaks', color: C2, pts: days.map((d) => ({ x: d, y: workBreaks(d) })) },
      ...(has(lim) ? [{ name: 'Limit', color: '--muted', dash: true, pts: days.map((d) => ({ x: d, y: Number(lim) })) }] : []),
    ], { min: 0, fmt: (v) => String(Math.round(v)) });
    lineChart($('#g-vgap'), [{ name: 'Longest same-day gap', color: '--series3', pts: days.map((d) => ({ x: d, y: Math.round((longestGap(d) / HOUR) * 10) / 10 })) }], { min: 0, unit: 'h' });
  }
  const logDates = Object.keys(S.habitLogs).map((k) => k.slice(0, 10)).sort();
  const taskPts = [];
  if (logDates.length) {
    for (let d = logDates[0]; d <= today(); d = addDays(d, 1)) if (inRange(d)) taskPts.push({ x: d, y: tasksProgress(d).pct });
  }
  lineChart($('#g-tasks'), [{ name: 'Tasks done (%)', color: C, pts: taskPts }], { min: 0, max: 100 });
  lineChart($('#g-crav'), [{ name: 'Craving score', color: C, pts: series(ci, 'cravings') }], { min: 0, max: 10 });
}

function lineChart(canvas, list, opts = {}) {
  if (!canvas) return;
  const css = getComputedStyle(document.documentElement);
  const col = (n) => css.getPropertyValue(n).trim() || n;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = '12px -apple-system, sans-serif';
  const fmt = opts.fmt || ((v) => String(Math.round(v * 10) / 10));
  const xFmt = opts.xFmt || fmtDay;
  const all = list.flatMap((s) => s.pts);
  const multi = list.length > 1;
  // legend
  let lx = 0;
  const legendH = 16;
  list.forEach((s) => {
    const label = multi ? s.name : `${s.name}${opts.unit ? ` (${opts.unit})` : ''}`;
    ctx.fillStyle = col(s.color); ctx.fillRect(lx, 4, 10, 10);
    ctx.fillStyle = col('--muted'); ctx.fillText(label, lx + 14, 13);
    lx += ctx.measureText(label).width + 28;
  });
  if (all.length === 0) { ctx.fillText('No data yet. Log some sessions.', 8, h / 2); return; }
  const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  const xi = new Map(xs.map((x, i) => [x, i]));
  const ys = all.map((p) => p.y);
  const ypad = (Math.max(...ys) - Math.min(...ys)) * 0.15 || 2;
  let min = opts.min ?? Math.min(...ys) - ypad, max = opts.max ?? Math.max(...ys) + ypad;
  if (max === min) max = min + 1;
  const L = 40, R = 10, T = legendH + 8, B = 22;
  const X = (x) => (xs.length === 1 ? (L + w - R) / 2 : L + (xi.get(x) / (xs.length - 1)) * (w - L - R));
  const Y = (v) => { let f = (v - min) / (max - min); if (opts.invert) f = 1 - f; return T + (1 - f) * (h - T - B); };
  ctx.strokeStyle = col('--line'); ctx.lineWidth = 1; ctx.fillStyle = col('--muted');
  [min, (min + max) / 2, max].forEach((v) => {
    ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke();
    ctx.fillText(fmt(v), 0, Y(v) + 4);
  });
  const first = xFmt(xs[0]);
  ctx.fillText(first, L, h - 4);
  if (xs.length > 1) { const last = xFmt(xs[xs.length - 1]); ctx.fillText(last, w - R - ctx.measureText(last).width, h - 4); }
  list.forEach((s) => {
    if (!s.pts.length) return;
    const pts = [...s.pts].sort((a, b) => xi.get(a.x) - xi.get(b.x));
    ctx.strokeStyle = col(s.color); ctx.fillStyle = col(s.color); ctx.lineWidth = s.dash ? 1.5 : 2.5; ctx.lineJoin = 'round';
    ctx.setLineDash(s.dash ? [6, 4] : []);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.stroke();
    ctx.setLineDash([]);
    if (s.dash) return;
    pts.forEach((p) => { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.5, 0, 7); ctx.fill(); });
    // label latest value
    const lp = pts[pts.length - 1];
    const txt = fmt(lp.y);
    const tx = Math.min(X(lp.x) + 6, w - ctx.measureText(txt).width - 2);
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.fillText(txt, tx, Y(lp.y) - 7);
    ctx.font = '12px -apple-system, sans-serif';
  });
}

// ---------- modals ----------
const modal = $('#modal');
let modalTimer = null;
function openModal(html) {
  $('#modal-body').innerHTML = html;
  if (!modal.open) modal.showModal();
}
function closeModal() {
  clearInterval(modalTimer); modalTimer = null;
  if (modal.open) modal.close();
}
modal.addEventListener('close', () => { clearInterval(modalTimer); modalTimer = null; });
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function pieceRow(def, x = {}, i = 0) {
  const v = def.split ? fmtSplit(x[def.name]) : (x[def.name] ?? '');
  return `<div class="piece-row"><span class="n">${i + 1}</span>
    <input data-piece="${def.name}" ${def.split ? 'inputmode="decimal"' : 'type="number" step="any" inputmode="decimal"'} placeholder="${def.ph}" value="${esc(v)}">
    <input data-piece="hr" type="number" inputmode="numeric" placeholder="HR" value="${esc(x.hr ?? '')}">
    <button type="button" data-action="del-piece" aria-label="Remove">×</button></div>`;
}

function renumberPieces() {
  $$('#pieces .piece-row .n').forEach((n, i) => { n.textContent = i + 1; });
}

function openSessionModal(date) {
  const p = planFor(date);
  if (!p) return;
  const l = S.sessions[date] || {};
  const strengthKey = p.type === 'strengthA' ? 'A' : p.type === 'strengthB' ? 'B' : null;
  const kind = kindOf(p);
  const cfg = kind && CARDIO[kind];
  const fieldVal = (f) => {
    const v = l[f.name];
    if (!has(v)) return '';
    if (f.split) return fmtSplit(v);
    return f.scale ? v / f.scale : v;
  };
  let pieces = l.pieces || [];
  if (cfg && !pieces.length) pieces = Array.from({ length: pieceCount(p) }, () => ({}));

  const cardioHtml = cfg ? `
      <div class="section-label">Session totals</div>
      <div class="grid2">${cfg.fields.map((f) => `<label>${f.label}<input name="${f.name}" ${f.split ? 'inputmode="decimal"' : 'type="number" step="any" inputmode="decimal"'} placeholder="${f.ph || ''}" value="${esc(fieldVal(f))}"></label>`).join('')}</div>
      <div class="grid2">
        <label>Avg HR (bpm)<input type="number" name="avg_hr" inputmode="numeric" value="${esc(l.avg_hr ?? '')}"></label>
        <label>Max HR (bpm)<input type="number" name="max_hr" inputmode="numeric" value="${esc(l.max_hr ?? '')}"></label>
      </div>
      <div class="section-label">Splits / intervals</div>
      <p class="sub" style="margin-top:-4px">One row per piece or interval: ${esc(cfg.piece.label.toLowerCase())} and the heart rate at the end of it.</p>
      <div id="pieces" data-kind="${kind}">${pieces.map((x, i) => pieceRow(cfg.piece, x, i)).join('')}</div>
      <button type="button" class="btn small" data-action="add-piece">+ Add split</button>` : '';

  openModal(`<h3>${esc(p.session)}</h3><p class="sub">${fmtDay(date)} · Week ${p.wk}</p>
    <p>${esc(p.prescription)}</p>${p.target !== '—' ? `<p class="sub"><b>Target:</b> ${esc(p.target)}</p>` : ''}
    ${p.type === 'rest' ? '<button class="btn block" data-close>Close</button>' : `
    <form id="session-form">
      <label class="check"><input type="checkbox" name="done" ${l.done || !S.sessions[date] ? 'checked' : ''}> Done</label>
      ${cardioHtml}
      ${cfg ? '' : `<label>What you did<input name="actual" value="${esc(l.actual ?? '')}" placeholder="e.g. all sets done, last set hard"></label>`}
      <div class="grid2">
        <label>RPE (1–10)<input type="number" name="rpe" min="1" max="10" inputmode="numeric" value="${esc(l.rpe ?? '')}"></label>
        ${cfg ? '' : `<label>Avg HR<input type="number" name="avg_hr" inputmode="numeric" value="${esc(l.avg_hr ?? '')}"></label>`}
      </div>
      ${strengthKey ? `<div class="section-label">Weights (kg) · week ${p.wk}</div><table><tbody>${strengthRows(strengthKey, p.wk)}</tbody></table>` : ''}
      ${p.type === 'strengthTest' ? '<p class="sub">Enter your 1 × 8 weights in Train → Tests.</p>' : ''}
      <label>Notes / symptoms<textarea name="notes">${esc(l.notes ?? '')}</textarea></label>
      <p id="session-err" class="err"></p>
      <div class="row"><button type="button" class="btn" data-close style="flex:1">Cancel</button><button class="btn primary" style="flex:2">Save</button></div>
    </form>`}`);

  const f = $('#session-form');
  if (!f) return;
  f.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const numOrNull = (v) => (has(v) ? Number(v) : null);
    const body = {
      done: fd.get('done') === 'on', actual: fd.get('actual') || l.actual || null,
      rpe: numOrNull(fd.get('rpe')), avg_hr: numOrNull(fd.get('avg_hr')), max_hr: numOrNull(fd.get('max_hr')),
      notes: fd.get('notes') || null,
    };
    if (cfg) {
      for (const fdef of cfg.fields) {
        const raw = fd.get(fdef.name);
        if (fdef.split) {
          const v = parseSplit(raw);
          if (has(raw) && v === null) { $('#session-err').textContent = 'Write splits as m:ss, e.g. 2:28.5'; return; }
          body[fdef.name] = v;
        } else body[fdef.name] = has(raw) ? Number(raw) * (fdef.scale || 1) : null;
      }
      const rows = $$('#pieces .piece-row').map((r) => {
        const vIn = $(`[data-piece="${cfg.piece.name}"]`, r).value;
        const hrIn = $('[data-piece="hr"]', r).value;
        return { [cfg.piece.name]: cfg.piece.split ? parseSplit(vIn) : numOrNull(vIn), hr: numOrNull(hrIn), _bad: cfg.piece.split && has(vIn) && parseSplit(vIn) === null };
      });
      if (rows.some((r) => r._bad)) { $('#session-err').textContent = 'Write splits as m:ss, e.g. 2:28.5'; return; }
      body.pieces = rows.map(({ _bad, ...r }) => r).filter((r) => Object.values(r).some(has));
      // fill averages from the splits if left blank
      const avg = (k) => { const v = body.pieces.map((r) => r[k]).filter(has); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
      if (!has(body.avg_hr)) body.avg_hr = avg('hr') === null ? null : Math.round(avg('hr'));
      const main = { erg: 'avg_split_s', bike: 'avg_watts', treadmill: 'avg_speed' }[kind];
      if (!has(body[main])) body[main] = avg(cfg.piece.name);
    }
    write('PUT', `/api/sessions/${date}`, body);
    closeModal();
    toast('Session saved');
  };
}

function openSos() {
  let left = 5 * 60;
  const tick = () => {
    const el = $('#sos-timer');
    if (!el) return;
    el.textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
    if (left <= 0) { clearInterval(modalTimer); el.textContent = 'Done'; $('#sos-msg').textContent = 'Five minutes up. How did it go?'; }
    left--;
  };
  openModal(`<h3>Ride it out</h3><p class="sub" id="sos-msg">Most cravings pass within about 5 minutes. Pick one and start:</p>
    <div class="timer" id="sos-timer">5:00</div>
    <ul class="list"><li>🚴 5–10 min easy spin on the Peloton</li><li>🚶 Walk round the block</li><li>💪 20 press-ups or squats</li><li>💧 Big glass of cold water</li><li>📱 Message someone</li></ul>
    <label>How strong is it?<div class="range-row"><input type="range" id="sos-int" min="1" max="10" value="6"><output id="sos-out">6</output></div></label>
    <div class="row"><button class="btn" style="flex:1" data-action="sos-done" data-beaten="0">Gave in</button>
    <button class="btn primary" style="flex:2" data-action="sos-done" data-beaten="1">Beat it 💪</button></div>`);
  $('#sos-int').oninput = (e) => { $('#sos-out').textContent = e.target.value; };
  modalTimer = setInterval(tick, 1000);
  tick();
}

function sosDone(beaten) {
  const intensity = Number($('#sos-int')?.value || 5);
  write('POST', '/api/cravings', { at: new Date().toISOString(), intensity, beaten });
  if (beaten) { closeModal(); toast('Logged. That’s one more craving beaten.'); return; }
  if (mode() !== 'quit') { openVapeLog({ reason: 'Strong craving' }); return; }
  openModal(`<h3>That’s OK</h3><p>Slip-ups are common and don’t undo your progress. The craving has been logged so you can spot the triggers.</p>
    <p>Do you want to restart the clock from now, or count it as a one-off and keep going?</p>
    <div class="row"><button class="btn" style="flex:1" data-close>Keep going</button>
    <button class="btn primary" style="flex:1" data-action="reset-quit">Restart clock</button></div>`);
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('#tabs button');
  if (tabBtn) { tab = tabBtn.dataset.tab; viewCheckin.date = null; tasksDate = null; editTasks = false; render(); window.scrollTo(0, 0); return; }
  const go = e.target.closest('[data-goto]');
  if (go) { tab = go.dataset.goto; if (go.dataset.dailySub) dailySub = go.dataset.dailySub; render(); window.scrollTo(0, 0); return; }
  const ds = e.target.closest('[data-daily]');
  if (ds) { dailySub = ds.dataset.daily; render(); return; }
  const sub = e.target.closest('[data-sub]');
  if (sub) { trainSub = sub.dataset.sub; render(); return; }
  const rng = e.target.closest('[data-range]');
  if (rng) { graphRange = rng.dataset.range; render(); return; }
  if (e.target.closest('[data-close]')) { closeModal(); return; }
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  if (act === 'log') openSessionModal(a.dataset.date);
  else if (act === 'sos') openSos();
  else if (act === 'sos-done') sosDone(a.dataset.beaten === '1');
  else if (act === 'edit-checkin') { viewCheckin.date = a.dataset.date; render(); window.scrollTo(0, 0); }
  else if (act === 'ci-day') { viewCheckin.date = a.dataset.date > today() ? today() : a.dataset.date; render(); }
  else if (act === 'reset-quit') {
    if (confirm('Restart the nicotine-free clock from now?')) {
      write('PUT', '/api/settings', { quit_at: new Date().toISOString(), daily_spend: S.settings.daily_spend ?? null });
      closeModal();
      toast('Clock restarted. You’ve got this.');
    }
  } else if (act === 'log-vape') openVapeLog();
  else if (act === 'del-vape') { write('DELETE', `/api/vapes/${a.dataset.id}`); toast('Deleted'); }
  else if (act === 'toggle-zone') {
    const z = zones().map((x) => ({ ...x }));
    const i = Number(a.dataset.i);
    z[i].allowed = !z[i].allowed;
    write('PUT', '/api/settings', { zones: z });
  } else if (act === 'set-mode') {
    const m = a.dataset.mode;
    if (m === 'quit') {
      if (!confirm('Switch to quitting completely? This starts the nicotine-free clock from now. Your cutting-down history is kept.')) return;
      write('PUT', '/api/settings', { mode: 'quit', quit_at: new Date().toISOString() });
    } else write('PUT', '/api/settings', { mode: 'cutdown' });
    closeModal();
  } else if (act === 'set-track') {
    const track = a.dataset.track;
    if (track === (isFast() ? 'fast' : 'standard')) return;
    if (track === 'fast' && today() < S.fastFrom && !confirm(`The faster track starts on ${fmtDay(S.fastFrom)}. Switch now anyway? Only do it if week 1 went well.`)) return;
    write('PUT', '/api/settings', { track });
    toast(track === 'fast' ? 'Faster track on' : 'Back to the standard plan');
  } else if (act === 'toggle-task') {
    const { id, date } = a.dataset;
    write('PUT', `/api/habit-logs/${date}/${id}`, { done: !isDone(date, id) });
  } else if (act === 'task-day') {
    const next = addDays(tasksDate || today(), Number(a.dataset.shift));
    tasksDate = next > today() ? today() : next; render();
  } else if (act === 'edit-tasks') { editTasks = !editTasks; render(); }
  else if (act === 'move-task') moveTask(a.dataset.id, Number(a.dataset.dir));
  else if (act === 'task-active') {
    const h = S.habits.find((x) => x.id === a.dataset.id);
    const on = a.dataset.on === '1';
    saveHabit(h, { active: on, sort: on ? Math.max(0, ...S.habits.map((x) => x.sort)) + 1 : h.sort });
  } else if (act === 'add-piece') {
    const box = $('#pieces');
    box.insertAdjacentHTML('beforeend', pieceRow(CARDIO[box.dataset.kind].piece, {}, box.children.length));
    box.lastElementChild.querySelector('input').focus();
  } else if (act === 'del-piece') { a.closest('.piece-row').remove(); renumberPieces(); }
  else if (act === 'export') exportCsv();
  else if (act === 'logout') api('POST', '/api/logout').finally(showLogin);
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'new-task') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    write('PUT', `/api/habits/${id}`, { name, slot: fd.get('slot'), sort: Math.max(0, ...S.habits.map((x) => x.sort)) + 1, active: true });
    toast('Task added');
    return;
  }
  if (e.target.id === 'zone-form') {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name') || '').trim();
    if (!name) return;
    if (zones().some((z) => z.name.toLowerCase() === name.toLowerCase())) return toast('Already in the list');
    write('PUT', '/api/settings', { zones: [...zones(), { name, allowed: false }] });
    toast(`${name} added as vape-free`);
    return;
  }
  if (e.target.id === 'cut-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const v = (k) => (has(fd.get(k)) ? Number(fd.get(k)) : null);
    write('PUT', '/api/settings', { daily_limit: v('daily_limit'), gap_goal_min: v('gap_goal_min'), start_mg: v('start_mg'), current_mg: v('current_mg') });
    toast('Saved');
    return;
  }
  if (e.target.id === 'quit-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    write('PUT', '/api/settings', { quit_at: new Date(fd.get('quit_at')).toISOString(), daily_spend: fd.get('daily_spend') || null });
    toast('Saved');
  } else if (e.target.id === 'morning-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const date = fd.get('date');
    write('PUT', `/api/checkins/${date}`, {
      sleep_hr: fd.get('sleep_hr') || null, shower_hr: fd.get('shower_hr') || null, sleep_h: fd.get('sleep_h') || null,
    });
    viewCheckin.date = date;
    toast('Morning check-in saved');
  } else if (e.target.id === 'evening-form') {
    e.preventDefault();
    const f = e.target, fd = new FormData(f);
    const date = fd.get('date');
    const rng = (n) => (f.elements[n].dataset.touched ? Number(f.elements[n].value) : null);
    const h = fd.get('screen_h'), m = fd.get('screen_m');
    write('PUT', `/api/checkins/${date}`, {
      nicotine_free: fd.get('nicotine_free') === 'on', cravings: rng('cravings'), energy: rng('energy'),
      water_l: fd.get('water_l') || null,
      screen_min: has(h) || has(m) ? Number(h || 0) * 60 + Number(m || 0) : null,
      dizzy: fd.get('dizzy') === 'on', notes: fd.get('notes') || null,
    });
    viewCheckin.date = date;
    toast('Evening check-in saved');
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.type === 'range' && t.closest('#evening-form')) { t.dataset.touched = '1'; t.nextElementSibling.textContent = t.value; }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'wk-select') { strengthWeek = Number(t.value); render(); }
  else if (t.name === 'date' && t.closest('#morning-form, #evening-form')) { viewCheckin.date = t.value > today() ? today() : t.value; render(); }
  else if (t.dataset.habitName) {
    const h = S.habits.find((x) => x.id === t.dataset.habitName);
    if (t.value.trim()) saveHabit(h, { name: t.value.trim() }); else t.value = h.name;
  } else if (t.dataset.habitSlot) {
    const h = S.habits.find((x) => x.id === t.dataset.habitSlot);
    saveHabit(h, { slot: t.value });
  } else if (t.dataset.weight) {
    // save without re-rendering so a modal or focus isn't disturbed
    const body = { exercise: t.dataset.weight, week: Number(t.dataset.week), weight: t.value === '' ? null : Number(t.value) };
    applyLocal({ method: 'PUT', url: '/api/strength', body });
    api('PUT', '/api/strength', body).catch((err) => {
      if (err.http && err.http < 500) return toast(err.message);
      const q = store.get(OUTBOX, []); q.push({ method: 'PUT', url: '/api/strength', body }); store.set(OUTBOX, q); updateSync();
    });
    toast('Weight saved');
  } else if (t.dataset.bench) {
    const key = t.dataset.bench;
    const cur = S.benchmarks[key] || {};
    write('PUT', `/api/benchmarks/${key}`, { baseline: cur.baseline ?? null, retest: cur.retest ?? null, [t.dataset.field]: t.value === '' ? null : Number(t.value) });
  }
});

function exportCsv() {
  const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s; };
  const lines = ['date,vapes,work_break_vapes,session,done,duration_min,distance_m,avg_split,avg_rate,avg_watts,avg_cadence,avg_speed_kmh,avg_hr,max_hr,intervals,actual,rpe,session_notes,nicotine_free,shower_hr,sleep_hr,sleep_h,cravings,energy,dizzy,water_l,screen_min,checkin_notes'];
  const pieceTxt = (ps) => (ps || []).map((x, i) => `${i + 1}: ${[has(x.split_s) && fmtSplit(x.split_s), has(x.watts) && x.watts + 'W', has(x.speed) && x.speed + 'km/h', has(x.hr) && x.hr + 'bpm'].filter(Boolean).join(' ')}`).join(' | ');
  const dates = [...new Set([...plan().map((p) => p.date), ...Object.keys(S.checkins), ...S.vapes.map((v) => dayOf(v.at))])].sort();
  for (const d of dates) {
    const p = planFor(d) || {}, s = S.sessions[d] || {}, c = S.checkins[d] || {};
    lines.push([d, (S.vapes.length ? (vapesBy()[d]?.length || 0) : ''), (S.vapes.length ? workBreaks(d) : ''), p.session, s.done, s.duration_min, s.distance_m, fmtSplit(s.avg_split_s), s.avg_rate, s.avg_watts, s.avg_cadence, s.avg_speed, s.avg_hr, s.max_hr, pieceTxt(s.pieces), s.actual, s.rpe, s.notes,
      c.nicotine_free, c.shower_hr, c.sleep_hr, c.sleep_h, c.cravings, c.energy, c.dizzy, c.water_l, c.screen_min, c.notes].map(csvCell).join(','));
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `on-track-${today()}.csv` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- login ----------
function showLogin() { $('#login').classList.remove('hidden'); setTimeout(() => $('#login-pw')?.focus(), 50); }
function hideLogin() { $('#login').classList.add('hidden'); }
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-err').textContent = '';
  try {
    await api('POST', '/api/login', { password: $('#login-pw').value });
    $('#login-pw').value = '';
    hideLogin();
    load();
  } catch (err) { $('#login-err').textContent = err.auth ? 'Wrong password' : err.message; }
});

// ---------- toast + timers ----------
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

setInterval(() => {
  if (!S) return;
  const sl = S.vapes?.length ? sinceLast() : null;
  if (sl !== null) $$('[data-since-last]').forEach((el) => { el.textContent = fmtDur(sl); });
  if (!quitAt()) return;
  $$('[data-since]').forEach((el) => { el.textContent = fmtSince(sinceQuit()); });
  $$('[data-money]').forEach((el) => { el.textContent = gbp(moneySaved()); });
}, 15000);

window.addEventListener('online', () => { updateSync(); load(); });
window.addEventListener('offline', updateSync);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S && !modal.open) load(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
load();

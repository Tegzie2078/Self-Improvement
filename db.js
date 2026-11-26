// Storage layer. Uses Supabase when SUPABASE_URL + SUPABASE_SERVICE_KEY are set,
// otherwise a local JSON file (handy for trying it out on your laptop).

const fs = require('fs');
const path = require('path');

// table -> primary key columns
const KEYS = {
  settings: ['id'],
  checkins: ['date'],
  session_logs: ['date'],
  strength_logs: ['exercise', 'week'],
  benchmarks: ['key'],
  cravings: ['id'],
  habits: ['id'],
  habit_logs: ['date', 'habit_id'],
  vape_logs: ['id'],
};

function supabaseBackend() {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    name: 'supabase',
    async all(table) {
      const q = sb.from(table).select('*');
      if (table === 'cravings') q.order('at', { ascending: true });
      if (table === 'habits') q.order('sort', { ascending: true });
      if (table === 'vape_logs') q.order('at', { ascending: true });
      return check(await q);
    },
    async upsert(table, row) {
      return check(await sb.from(table).upsert(row, { onConflict: KEYS[table].join(',') }).select().single());
    },
    async insert(table, row) {
      return check(await sb.from(table).insert(row).select().single());
    },
    async remove(table, id) {
      return check(await sb.from(table).delete().eq('id', id));
    },
  };
}

function fileBackend() {
  const file = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = {}; }
  for (const t of Object.keys(KEYS)) data[t] = data[t] || [];
  data._seq = data._seq || 1;
  const save = () => fs.writeFileSync(file, JSON.stringify(data, null, 2));
  const same = (table, a, b) => KEYS[table].every((k) => String(a[k]) === String(b[k]));
  return {
    name: 'file',
    async all(table) { return data[table]; },
    async upsert(table, row) {
      const i = data[table].findIndex((r) => same(table, r, row));
      const merged = { ...(i >= 0 ? data[table][i] : {}), ...row, updated_at: new Date().toISOString() };
      if (i >= 0) data[table][i] = merged; else data[table].push(merged);
      save();
      return merged;
    },
    async insert(table, row) {
      const r = { id: data._seq++, ...row };
      data[table].push(r);
      save();
      return r;
    },
    async remove(table, id) {
      data[table] = data[table].filter((r) => String(r.id) !== String(id));
      save();
    },
  };
}

const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
module.exports = useSupabase ? supabaseBackend() : fileBackend();

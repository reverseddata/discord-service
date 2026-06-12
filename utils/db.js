const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = '/app/data/godlyo.db';

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Ensure data dir exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS creators (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      channel_link TEXT,
      avg_views TEXT,
      content_type TEXT,
      follower_count INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'tier3',
      private_channel_id TEXT,
      accepted_at TIMESTAMP,
      status TEXT DEFAULT 'pending',
      weekly_cap INTEGER DEFAULT 15000,
      custom_rate INTEGER DEFAULT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      video_url TEXT,
      platform TEXT,
      submitted_at TIMESTAMP,
      video_published_at TIMESTAMP,
      views_at_submission INTEGER,
      follower_count_at_submission INTEGER,
      robux_owed REAL,
      proof_image_url TEXT,
      status TEXT DEFAULT 'pending_proof',
      reviewed_at TIMESTAMP,
      paid_at TIMESTAMP
    )
  `);

  // Migrations — safely add new columns to existing DBs
  try { db.run(`ALTER TABLE creators ADD COLUMN weekly_cap INTEGER DEFAULT 15000`); } catch(e) {}
  try { db.run(`ALTER TABLE creators ADD COLUMN custom_rate INTEGER DEFAULT NULL`); } catch(e) {}

  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run a query and save
function run(sql, params = []) {
  db.run(sql, params);
  save();
}

// Helper: get one row
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Helper: get all rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

const TIER_RATES = { tier1: 1500, tier2: 1200, tier3: 1000 };
const TIER_LABELS = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' };

function getTier(tierKey) {
  const key = (tierKey || 'tier3').toLowerCase();
  return { name: TIER_LABELS[key] || 'Tier 3', rate: TIER_RATES[key] || 1000 };
}

function calcRobux(views, tierKey) {
  const { rate } = getTier(tierKey);
  return Math.floor((views / 10000) * rate);
}

function getWeeklyRobux(userId) {
  // Monday 00:00 of current week
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const rows = all(
    `SELECT robux_owed FROM submissions
     WHERE user_id = ? AND status IN ('verified','paid') AND submitted_at >= ?`,
    [userId, monday.toISOString()]
  );
  return rows.reduce((sum, r) => sum + (r.robux_owed || 0), 0);
}

module.exports = { getDb, run, get, all, save, getTier, calcRobux, getWeeklyRobux };

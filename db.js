const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'godlyo.db');

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
      tier TEXT DEFAULT 'nano',
      private_channel_id TEXT,
      accepted_at TIMESTAMP,
      status TEXT DEFAULT 'pending'
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

module.exports = { getDb, run, get, all, save, getTier, calcRobux };

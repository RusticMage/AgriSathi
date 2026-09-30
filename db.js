import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const root = path.dirname(fileURLToPath(import.meta.url));

export const postgresSchema = `
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, farmer_type TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS farms(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, district TEXT NOT NULL DEFAULT 'Nashik', lat DOUBLE PRECISION NOT NULL DEFAULT 19.9975, lon DOUBLE PRECISION NOT NULL DEFAULT 73.7898, crop TEXT NOT NULL DEFAULT 'Tomato', area DOUBLE PRECISION, water_source TEXT, created_at TEXT NOT NULL, location_name TEXT NOT NULL DEFAULT 'Nashik');
CREATE TABLE IF NOT EXISTS soil_tests(id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE, tested_at TEXT NOT NULL, source TEXT NOT NULL, ph DOUBLE PRECISION, ec DOUBLE PRECISION, organic_carbon DOUBLE PRECISION, nitrogen DOUBLE PRECISION, phosphorus DOUBLE PRECISION, potassium DOUBLE PRECISION, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crop_seasons(id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE, crop TEXT NOT NULL, variety TEXT, season TEXT, sowing_date TEXT, harvest_date TEXT, outcome TEXT, notes TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE, crop_season_id TEXT, observed_at TEXT NOT NULL, stage TEXT, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS advisories(id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE, created_at TEXT NOT NULL, language TEXT NOT NULL, summary TEXT NOT NULL, actions_json TEXT NOT NULL, confidence TEXT NOT NULL, inputs_json TEXT NOT NULL, source_name TEXT NOT NULL, source_url TEXT NOT NULL, source_issued_at TEXT, valid_until TEXT);
CREATE TABLE IF NOT EXISTS disease_checks(id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE, created_at TEXT NOT NULL, crop TEXT NOT NULL, label TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL, model_id TEXT NOT NULL, uncertain INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS community_reports(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, region_code TEXT NOT NULL, crop TEXT NOT NULL, variety TEXT NOT NULL, season TEXT NOT NULL, sowing_month INTEGER, outcome TEXT NOT NULL, conditions TEXT, created_at TEXT NOT NULL);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_name TEXT NOT NULL DEFAULT 'Nashik';
CREATE INDEX IF NOT EXISTS farms_user_idx ON farms(user_id);
CREATE INDEX IF NOT EXISTS reports_region_crop_idx ON community_reports(region_code,crop,season);
CREATE INDEX IF NOT EXISTS advisories_farm_idx ON advisories(farm_id,created_at);
`;

function pgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

class PostgresDatabase {
  constructor(pool) { this.pool = pool; }
  async exec(sql) { await this.pool.query(sql); }
  prepare(sql) {
    const query = pgSql(sql);
    return {
      get: async (...params) => (await this.pool.query(query, params)).rows[0],
      all: async (...params) => (await this.pool.query(query, params)).rows,
      run: async (...params) => this.pool.query(query, params),
    };
  }
  close() { return this.pool.end(); }
}

class SqliteDatabase {
  constructor(db) { this.db = db; }
  async exec(sql) { this.db.exec(sql); }
  prepare(sql) {
    const statement = this.db.prepare(sql);
    return {
      get: async (...params) => statement.get(...params),
      all: async (...params) => statement.all(...params),
      run: async (...params) => statement.run(...params),
    };
  }
  close() { this.db.close(); }
}

export async function openDatabase() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX) || (process.env.VERCEL ? 1 : 5),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    try {
      await pool.query('SELECT 1');
      const db = new PostgresDatabase(pool);
      await db.exec(postgresSchema);
      console.log('Database: PostgreSQL');
      return db;
    } catch (error) {
      await pool.end();
      throw new Error(`PostgreSQL connection/schema initialization failed: ${error.message}`);
    }
  }

  const dataDir = path.join(root, 'data');
  await mkdir(dataDir, { recursive: true });
  const sqlite = new DatabaseSync(path.join(dataDir, 'agrisathi.sqlite'));
  sqlite.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`);
  const db = new SqliteDatabase(sqlite);
  await db.exec(postgresSchema.replace('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_name TEXT NOT NULL DEFAULT \'Nashik\';', ''));
  try { sqlite.exec("ALTER TABLE farms ADD COLUMN location_name TEXT NOT NULL DEFAULT 'Nashik'"); } catch {}
  console.log('Database: local SQLite (set DATABASE_URL to use PostgreSQL)');
  return db;
}

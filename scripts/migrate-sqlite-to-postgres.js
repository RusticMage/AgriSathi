import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { postgresSchema } from '../db.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try { process.loadEnvFile(path.join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const source = path.join(root, 'data', 'agrisathi.sqlite');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env before importing SQLite data.');
if (!existsSync(source) || statSync(source).size === 0) throw new Error(`SQLite source database is missing or empty: ${source}`);

const sqlite = new DatabaseSync(source, { readOnly: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
const tables = [
  ['users', 'id'],
  ['sessions', 'token_hash'],
  ['farms', 'id'],
  ['soil_tests', 'id'],
  ['crop_seasons', 'id'],
  ['observations', 'id'],
  ['advisories', 'id'],
  ['disease_checks', 'id'],
  ['community_reports', 'id'],
];

try {
  await pool.query(postgresSchema);
  const client = await pool.connect();
  const summary = [];
  try {
    await client.query('BEGIN');
    for (const [table, primaryKey] of tables) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (!rows.length) { summary.push(`${table}: 0 rows`); continue; }
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
        const names = columns.map(name => `"${name}"`).join(',');
        await client.query(
          `INSERT INTO "${table}" (${names}) VALUES (${placeholders}) ON CONFLICT ("${primaryKey}") DO NOTHING`,
          columns.map(name => row[name]),
        );
      }
      summary.push(`${table}: ${rows.length} source rows checked`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log('SQLite import completed (existing PostgreSQL primary keys were left unchanged).');
  console.log(summary.join('\n'));
} finally {
  sqlite.close();
  await pool.end();
}

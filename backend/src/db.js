import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL is required. Copy it from Railway → your Postgres service → Variables.'
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? undefined
    : { rejectUnauthorized: false },
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initDb() {
  const migrationPath = path.join(__dirname, '..', 'migrations', '001_queue_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('✅ Postgres queue schema ready (restaurants + queue_entries)');
}

export default pool;

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. In Railway: service → Variables → add DATABASE_URL from Postgres.'
    );
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
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
  await getPool().query(sql);
  console.log('✅ Postgres queue schema ready (restaurants + queue_entries)');
}

export async function pingDb() {
  await getPool().query('SELECT 1');
}

export default { getPool };

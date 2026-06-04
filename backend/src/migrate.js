import 'dotenv/config';
import { initDb } from './db.js';

await initDb();
console.log('Migration complete.');
process.exit(0);

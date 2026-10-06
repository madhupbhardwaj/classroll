import { readFile } from 'node:fs/promises';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running db:migrate');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
 await client.connect();
 const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
 await client.query('BEGIN');
 await client.query(sql);
 await client.query('COMMIT');
 console.log('Classroll tables are ready.');
} catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
finally { await client.end(); }

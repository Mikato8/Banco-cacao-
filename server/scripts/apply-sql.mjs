import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const sql = Buffer.concat(chunks).toString('utf8').trim();
if (!sql) {
  console.error('No SQL on stdin');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log('Schema applied via node-pg');
} catch (e) {
  // Idempotent-ish: report and exit non-zero only if not "already exists"
  const msg = e instanceof Error ? e.message : String(e);
  if (/already exists/i.test(msg)) {
    console.log('Schema objects already present:', msg.split('\n')[0]);
  } else {
    console.error(msg);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}

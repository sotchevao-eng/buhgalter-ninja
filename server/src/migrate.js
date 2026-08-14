'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function migrate() {
  await db.query('SELECT pg_advisory_lock(87251101)');
  try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const applied = await db.query('SELECT id FROM schema_migrations');
  const done = new Set(applied.rows.map((row) => row.id));

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
    });
    console.log('applied migration', file);
  }
  } finally {
    await db.query('SELECT pg_advisory_unlock(87251101)');
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('migrations ok');
      return db.close();
    })
    .catch((err) => {
      console.error('migration failed', err.message);
      process.exit(1);
    });
}

module.exports = { migrate };

const fs = require('node:fs/promises');
const path = require('node:path');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

async function migrate() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const appliedRows = await sequelize.query('SELECT name FROM schema_migrations', { type: QueryTypes.SELECT });
  const applied = new Set(appliedRows.map((row) => row.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(sql, { transaction });
      await sequelize.query('INSERT INTO schema_migrations (name) VALUES (:name)', {
        replacements: { name: file },
        transaction,
      });
    });
    console.log(`Applied migration ${file}`);
  }
}

module.exports = migrate;

// D1 Mock on top of node:sqlite for lightning-fast local testing
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createMockD1(options = { loadSeed: true }) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  // Apply schema
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schemaSql);

  // Apply seed if requested
  if (options.loadSeed) {
    const seedPath = path.join(__dirname, '..', 'd1_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    sqlite.exec(seedSql);
  }

  // D1 statement wrapper
  class Statement {
    constructor(sql, params = []) {
      this.sql = sql;
      this.params = params;
    }

    bind(...params) {
      return new Statement(this.sql, params);
    }

    async first(col) {
      const stmt = sqlite.prepare(this.sql);
      const row = stmt.get(...this.params);
      if (!row) return null;
      if (col) return row[col];
      return row;
    }

    async all() {
      const stmt = sqlite.prepare(this.sql);
      const rows = stmt.all(...this.params);
      return {
        results: rows || [],
        success: true,
        meta: { rows_read: rows.length, rows_written: 0 }
      };
    }

    async run() {
      const stmt = sqlite.prepare(this.sql);
      const res = stmt.run(...this.params);
      return {
        success: true,
        meta: { changes: res.changes, last_row_id: res.lastInsertRowid }
      };
    }
  }

  return {
    prepare(sql) {
      return new Statement(sql);
    },
    async batch(statements) {
      sqlite.exec('BEGIN TRANSACTION;');
      try {
        const results = [];
        for (const st of statements) {
          const res = await st.run();
          results.push(res);
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK;');
        throw err;
      }
    },
    _rawDb: sqlite
  };
}

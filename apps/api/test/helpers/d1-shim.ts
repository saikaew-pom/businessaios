/**
 * Minimal shim over node:sqlite that mimics the small slice of the
 * Cloudflare D1 API this codebase's `src/lib/*.ts` modules actually use:
 * `env.DB.prepare(sql).bind(...args).first<T>() / .all() / .run()`.
 *
 * Not a general-purpose D1 mock — just enough to unit-test lib/credit.ts
 * (and anything similar) against a real, in-memory SQLite database instead
 * of hand-mocking query results.
 */
import { DatabaseSync } from 'node:sqlite';

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string
  ) {}

  bind(...args: any[]) {
    const sql = this.sql;
    return {
      first: <T = any>(): T | null => {
        const row = this.db.prepare(sql).get(...args);
        return (row as T) ?? null;
      },
      all: <T = any>(): { results: T[] } => {
        const rows = this.db.prepare(sql).all(...args);
        return { results: rows as T[] };
      },
      run: (): { meta: { changes: number; last_row_id: number } } => {
        const result = this.db.prepare(sql).run(...args);
        return {
          meta: {
            changes: Number(result.changes),
            last_row_id: Number(result.lastInsertRowid),
          },
        };
      },
    };
  }
}

export function makeD1Shim(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return new Statement(db, sql);
    },
  };
}

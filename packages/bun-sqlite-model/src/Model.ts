import type { Database } from "bun:sqlite";

declare global {
  var db: Database;
}

export abstract class Model {
  protected static db: Database;
  protected static tableName: string;

  static setDatabase(database: Database) {
    this.db = database;
  }

  public static resolveDb(): Database {
    if (this.db) return this.db;
    if (globalThis.db) {
      this.db = globalThis.db;
      return this.db;
    }
    throw new Error("Database connection is not set.");
  }

  protected static query(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  protected static run(sql: string, params: any[] = []): { lastInsertRowid: number, changes: number } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params) as { lastInsertRowid: number, changes: number };
  }

  protected static queryOne(sql: string, params: any[] = []): any | null {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  protected static execute(sql: string, params: any[] = []): { lastInsertRowid: number, changes: number } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params) as { lastInsertRowid: number, changes: number };
  }

  protected static exists(whereSql: string, whereParams: any[] = []): boolean {
    const sql = `SELECT 1 FROM ${this.tableName} ${whereSql} LIMIT 1`;
    const result = this.queryOne(sql, whereParams);
    return !!result;
  }

  protected static transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }
}
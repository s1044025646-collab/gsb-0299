import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ReportRow {
  id: number;
  created_at: string;
  algo_version: string;
  query_type: string;
  n: number;
  params_json: string;
  result_json: string;
}

let dbInstance: DatabaseSync | null = null;

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbInstance) return dbInstance;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      algo_version TEXT NOT NULL,
      query_type TEXT NOT NULL,
      n INTEGER NOT NULL,
      params_json TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
  `);
  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function insertReport(input: {
  algoVersion: string;
  queryType: string;
  n: number;
  params: unknown;
  result: unknown;
}): number {
  const db = dbInstance;
  if (!db) throw new Error('数据库尚未初始化');
  const stmt = db.prepare(`
    INSERT INTO reports (created_at, algo_version, query_type, n, params_json, result_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    new Date().toISOString(),
    input.algoVersion,
    input.queryType,
    input.n,
    JSON.stringify(input.params),
    JSON.stringify(input.result),
  );
  return Number(info.lastInsertRowid);
}

export function getReport(id: number): ReportRow | null {
  const db = dbInstance;
  if (!db) throw new Error('数据库尚未初始化');
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  return row ?? null;
}

export interface ListOptions {
  queryType?: string;
  limit?: number;
}

export function listReports(options: ListOptions = {}): ReportRow[] {
  const db = dbInstance;
  if (!db) throw new Error('数据库尚未初始化');
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 1000);
  if (options.queryType) {
    return db
      .prepare('SELECT * FROM reports WHERE query_type = ? ORDER BY id DESC LIMIT ?')
      .all(options.queryType, limit) as unknown as ReportRow[];
  }
  return db
    .prepare('SELECT * FROM reports ORDER BY id DESC LIMIT ?')
    .all(limit) as unknown as ReportRow[];
}

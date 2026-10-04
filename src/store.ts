import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { ALGO_VERSION } from "./core";

export interface ReportRow {
  id: number;
  created_at: string;
  algo_version: string;
  query_type: string;
  params: string;
  result: string;
}

export class ReportStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        algo_version TEXT NOT NULL,
        query_type TEXT NOT NULL,
        params TEXT NOT NULL,
        result TEXT NOT NULL
      );
    `);
  }

  save(queryType: string, params: unknown, result: unknown): ReportRow {
    const stmt = this.db.prepare(
      "INSERT INTO reports (created_at, algo_version, query_type, params, result) VALUES (?, ?, ?, ?, ?)"
    );
    const createdAt = new Date().toISOString();
    const info = stmt.run(
      createdAt,
      ALGO_VERSION,
      queryType,
      JSON.stringify(params),
      JSON.stringify(result)
    );
    return this.get(Number(info.lastInsertRowid))!;
  }

  get(id: number): ReportRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM reports WHERE id = ?");
    return stmt.get(id) as unknown as ReportRow | undefined;
  }

  list(limit = 50): ReportRow[] {
    const stmt = this.db.prepare("SELECT * FROM reports ORDER BY id DESC LIMIT ?");
    return stmt.all(limit) as unknown as ReportRow[];
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbPath(): string {
  return path.join(process.cwd(), "data", "reports.db");
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dbPath = join(tmpdir(), `parens-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;

const db = await import('../src/db.ts');
const service = await import('../src/service.ts');

test('报告写入并可读取', () => {
  db.openDatabase(dbPath);
  const env = service.rankQuery(3, '(()())');
  const row = db.getReport(env.reportId);
  assert.ok(row);
  assert.equal(row!.query_type, 'rank');
  assert.equal(row!.algo_version, service.ALGO_VERSION);
  const result = JSON.parse(row!.result_json);
  assert.equal(result.rank, '1');
});

test('修改条件生成新报告，不覆盖旧结果', () => {
  const before = db.listReports({}).length;
  service.rankQuery(3, '(())()');
  service.countQuery(5);
  const after = db.listReports({});
  assert.equal(after.length, before + 2);
  assert.equal(after[0].query_type, 'count');
});

test('重启后旧报告仍可读取', () => {
  const env = service.unrankQuery(3, '0002');
  const id = env.reportId;
  db.closeDatabase();
  db.openDatabase(dbPath);
  const row = db.getReport(id);
  assert.ok(row);
  const params = JSON.parse(row!.params_json);
  assert.equal(params.rankOriginal, '0002');
  assert.equal(params.rankCanonical, '2');
  db.closeDatabase();
  rmSync(dbPath, { force: true });
  rmSync(dbPath + '-wal', { force: true });
  rmSync(dbPath + '-shm', { force: true });
});

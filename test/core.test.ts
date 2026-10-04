import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  ApiError,
  countSequences,
  MAX_PAGE_LIMIT,
  pageSequences,
  parseN,
  parseRank,
  prefixInfo,
  rankSequence,
  unrankSequence,
} from "../src/core";
import { ReportStore } from "../src/store";

function bruteForce(n: number): string[] {
  const out: string[] = [];
  const total = 2 * n;
  for (let mask = 0; mask < 1 << total; mask++) {
    let seq = "";
    let depth = 0;
    let ok = true;
    for (let i = 0; i < total; i++) {
      const ch = (mask >> (total - 1 - i)) & 1 ? ")" : "(";
      seq += ch;
      depth += ch === "(" ? 1 : -1;
      if (depth < 0) {
        ok = false;
        break;
      }
    }
    if (ok && depth === 0) out.push(seq);
  }
  return out;
}

test("小 n 与穷举一致：总数、顺序、排名、反排名", () => {
  for (let n = 0; n <= 4; n++) {
    const expected = bruteForce(n);
    assert.equal(countSequences(n), BigInt(expected.length), `n=${n} 总数`);
    expected.forEach((seq, i) => {
      assert.equal(rankSequence(n, seq).rank, String(i), `n=${n} rank(${seq})`);
      assert.equal(unrankSequence(n, BigInt(i)).sequence, seq, `n=${n} unrank(${i})`);
    });
  }
});

test("n=0,1,2 手工核对", () => {
  assert.equal(countSequences(0), 1n);
  assert.equal(unrankSequence(0, 0n).sequence, "");
  assert.equal(rankSequence(0, "").rank, "0");
  assert.equal(countSequences(1), 1n);
  assert.equal(unrankSequence(1, 0n).sequence, "()");
  assert.deepEqual(
    [0, 1].map((i) => unrankSequence(2, BigInt(i)).sequence),
    ["(())", "()()"]
  );
});

test("n=3 顺序为 ((())) (()()) (())() ()(()) ()()()", () => {
  const expected = ["((()))", "(()())", "(())()", "()(())", "()()()"];
  expected.forEach((seq, i) => {
    assert.equal(unrankSequence(3, BigInt(i)).sequence, seq);
    assert.equal(rankSequence(3, seq).rank, String(i));
  });
});

test("n=50 大整数与靠后排名往返", () => {
  const total = countSequences(50);
  assert.equal(total, 1978261657756160653623774456n);
  const r = total - 12345n;
  const seq = unrankSequence(50, r).sequence;
  assert.equal(rankSequence(50, seq).rank, r.toString());
});

test("前缀区间与穷举一致", () => {
  for (let n = 0; n <= 4; n++) {
    const all = bruteForce(n);
    const prefixes = new Set<string>([""]);
    for (const s of all) for (let i = 1; i <= s.length; i++) prefixes.add(s.slice(0, i));
    for (const p of prefixes) {
      const info = prefixInfo(n, p);
      const expected = all.map((s, i) => (s.startsWith(p) ? i : -1)).filter((i) => i >= 0);
      assert.equal(info.completable, true);
      assert.equal(info.remaining, String(expected.length), `n=${n} prefix=${p}`);
      assert.equal(info.interval!.start, String(expected[0] ?? 0));
      assert.equal(BigInt(info.interval!.end) - BigInt(info.interval!.start), BigInt(expected.length));
      if (expected.length > 0) {
        assert.equal(BigInt(info.interval!.end) - 1n, BigInt(expected[expected.length - 1]));
      }
    }
  }
});

test("前缀错误情形区分", () => {
  assert.equal(prefixInfo(3, "(a").status, "INVALID_CHAR");
  assert.equal(prefixInfo(3, "((((").status, "EXCEEDS_N");
  assert.equal(prefixInfo(2, "())").status, "BELOW_ZERO");
  assert.equal(prefixInfo(2, "(())").status, "VALID_COMPLETE");
  assert.equal(prefixInfo(2, "((").status, "VALID_OPEN");
  assert.equal(prefixInfo(1, "(((").status, "EXCEEDS_N");
});

test("分页无重叠无遗漏且跨终点截断", () => {
  const n = 4;
  const total = Number(countSequences(n));
  const seen: string[] = [];
  let start: string | null = "0";
  while (start !== null) {
    const page = pageSequences(n, BigInt(start), 3);
    seen.push(...page.items.map((i) => i.sequence));
    start = page.next;
  }
  assert.deepEqual(seen, bruteForce(n));
  const last = pageSequences(n, BigInt(total - 1), 5);
  assert.equal(last.items.length, 1);
  assert.equal(last.next, null);
});

test("错误码：非法字符、长度、负排名、超界、超限、超大 n", () => {
  assert.throws(() => rankSequence(2, "(a)()"), (e: ApiError) => e.code === "INVALID_CHAR");
  assert.throws(() => rankSequence(2, "((("), (e: ApiError) => e.code === "LENGTH_MISMATCH");
  assert.throws(() => parseRank("-1"), (e: ApiError) => e.code === "NEGATIVE_RANK");
  assert.throws(() => unrankSequence(2, 2n), (e: ApiError) => e.code === "RANK_OUT_OF_RANGE");
  assert.throws(() => pageSequences(3, 0n, MAX_PAGE_LIMIT + 1), (e: ApiError) => e.code === "LIMIT_EXCEEDED");
  assert.throws(() => parseN("201"), (e: ApiError) => e.code === "N_OUT_OF_RANGE");
  assert.throws(() => pageSequences(3, 5n, 1), (e: ApiError) => e.code === "RANK_OUT_OF_RANGE");
});

test("规范化：空输入与前导零", () => {
  assert.deepEqual(parseN(""), { n: 0, normalized: "0" });
  assert.deepEqual(parseRank(""), { rank: 0n, normalized: "0" });
  assert.deepEqual(parseRank("0007"), { rank: 7n, normalized: "7" });
});

test("持久化：重启后旧报告可读，新查询生成新报告", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paren-test-"));
  const db = path.join(dir, "reports.db");
  let store = new ReportStore(db);
  const r1 = store.save("count", { raw: "3", normalized: "3" }, { n: 3, total: "5" });
  const r2 = store.save("count", { raw: "4", normalized: "4" }, { n: 4, total: "14" });
  store.close();
  store = new ReportStore(db);
  const loaded = store.get(r1.id);
  assert.ok(loaded);
  assert.equal(JSON.parse(loaded!.result).total, "5");
  assert.equal(store.list().length, 2);
  assert.notEqual(r1.id, r2.id);
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("步骤记录可逐步核对", () => {
  const { steps, rank } = rankSequence(3, "()(())");
  assert.equal(steps.length, 6);
  let acc = 0n;
  for (const s of steps) acc += BigInt(s.skipped);
  assert.equal(acc.toString(), rank);
  const u = unrankSequence(3, BigInt(rank));
  assert.equal(u.steps.length, 6);
  assert.equal(u.steps[u.steps.length - 1].rankRemaining, "0");
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrefix } from '../src/prefix.ts';
import { getPage } from '../src/page.ts';
import { rankSequence, unrankSequence } from '../src/rank.ts';
import { normalizeRank, parseN, totalCount, validateSequence } from '../src/dp.ts';
import { AppError } from '../src/errors.ts';

/** 独立穷举：生成所有长度 2n 的括号串，过滤出平衡序列并按字典序排序。 */
function bruteForce(n: number): string[] {
  const results: string[] = [];
  const walk = (seq: string, depth: number, remaining: number): void => {
    if (remaining === 0) {
      if (depth === 0) results.push(seq);
      return;
    }
    if (depth > 0) walk(seq + ')', depth - 1, remaining - 1);
    if (remaining > depth) walk(seq + '(', depth + 1, remaining - 1);
  };
  walk('', 0, 2 * n);
  return results.sort();
}

test('DP 总数与穷举卡特兰数一致（小 n）', () => {
  for (let n = 0; n <= 7; n++) {
    assert.equal(totalCount(n), BigInt(bruteForce(n).length));
  }
});

test('手工检查 n = 0, 1, 2', () => {
  assert.equal(totalCount(0).toString(), '1');
  assert.equal(unrankSequence(0, normalizeRank('0')).sequence, '');
  assert.equal(totalCount(1).toString(), '1');
  assert.deepEqual(bruteForce(2), ['(())', '()()']);
  assert.equal(rankSequence(2, '(())').rank, '0');
  assert.equal(rankSequence(2, '()()').rank, '1');
});

test('n=3 五个序列排名为 0..4 且反排名互逆', () => {
  const all = bruteForce(3);
  assert.deepEqual(all, ['((()))', '(()())', '(())()', '()(())', '()()()']);
  all.forEach((seq, idx) => {
    const rank = rankSequence(3, seq);
    assert.equal(rank.rank, String(idx));
    assert.equal(rank.total, '5');
    const back = unrankSequence(3, normalizeRank(String(idx)));
    assert.equal(back.sequence, seq);
  });
});

test('小 n 全量双向核对', () => {
  for (let n = 0; n <= 7; n++) {
    const all = bruteForce(n);
    all.forEach((seq, idx) => {
      assert.equal(rankSequence(n, seq).rank, String(idx), `rank n=${n} seq=${seq}`);
      assert.equal(
        unrankSequence(n, normalizeRank(String(idx))).sequence,
        seq,
        `unrank n=${n} idx=${idx}`,
      );
    });
  }
});

test('前缀区间与穷举完全吻合', () => {
  for (let n = 1; n <= 5; n++) {
    const all = bruteForce(n);
    for (let len = 0; len <= 2 * n; len++) {
      const prefixes = new Set(all.map((s) => s.slice(0, len)));
      for (const prefix of prefixes) {
        const info = analyzePrefix(n, prefix);
        assert.equal(info.completable, true);
        const matched = all.filter((s) => s.startsWith(prefix));
        assert.equal(info.remainingCompletions, String(matched.length));
        assert.equal(info.rankStart, String(all.indexOf(matched[0])));
        assert.equal(info.rankEnd, String(all.indexOf(matched[matched.length - 1])));
      }
    }
  }
});

test('非法前缀分类', () => {
  assert.equal(analyzePrefix(3, 'x').status, 'syntax-invalid');
  assert.equal(analyzePrefix(3, ')))').status, 'below-zero');
  assert.equal(analyzePrefix(2, '(((').status, 'too-many-parens');
  assert.equal(analyzePrefix(3, '((()))').status, 'complete');
  assert.equal(analyzePrefix(3, '()()').status, 'extendable');
});

test('非法序列报错', () => {
  assert.throws(() => validateSequence('()', 3), (e: unknown) => (e as AppError).code === 'LENGTH_MISMATCH');
  assert.throws(() => validateSequence('())(' , 2), (e: unknown) => (e as AppError).code === 'UNBALANCED_SEQUENCE');
  assert.throws(() => validateSequence('(a)', 2), (e: unknown) => (e as AppError).code === 'INVALID_CHARS');
});

test('排名边界与超界', () => {
  const total = totalCount(3);
  assert.equal(unrankSequence(3, normalizeRank('0')).sequence, '((()))');
  assert.equal(unrankSequence(3, normalizeRank(String(total - 1n))).sequence, '()()()');
  assert.throws(
    () => unrankSequence(3, normalizeRank(String(total))),
    (e: unknown) => (e as AppError).code === 'RANK_OUT_OF_RANGE',
  );
  assert.throws(
    () => unrankSequence(3, normalizeRank('-1')),
    (e: unknown) => (e as AppError).code === 'INVALID_RANK',
  );
  assert.throws(
    () => normalizeRank(''),
    (e: unknown) => (e as AppError).code === 'INVALID_RANK',
  );
});

test('前导零规范化并保留原值', () => {
  const norm = normalizeRank('0004');
  assert.equal(norm.original, '0004');
  assert.equal(norm.canonical, '4');
  assert.equal(unrankSequence(3, norm).sequence, '()()()');
});

test('分页窗口：无重叠无遗漏且能跨终点', () => {
  const n = 5;
  const all = bruteForce(n);
  const seen = new Set<string>();
  let start = normalizeRank('0');
  let pages = 0;
  for (;;) {
    const page = getPage(n, start, 7);
    for (const item of page.items) {
      assert.ok(!seen.has(item.sequence), '出现重复');
      seen.add(item.sequence);
    }
    pages += 1;
    if (page.reachedEnd) break;
    start = normalizeRank(page.nextStart as string);
  }
  assert.equal(seen.size, all.length);
  assert.deepEqual([...seen].sort(), all);
  assert.ok(pages > 1);
});

test('数量超限被拒绝', () => {
  assert.throws(
    () => getPage(3, normalizeRank('0'), 1001),
    (e: unknown) => (e as AppError).code === 'LIMIT_TOO_LARGE',
  );
});

test('超大 n 被拒绝', () => {
  assert.throws(() => parseN('201'), (e: unknown) => (e as AppError).code === 'N_TOO_LARGE');
  assert.throws(() => parseN('-1'), (e: unknown) => (e as AppError).code === 'INVALID_N');
});

test('n=200 大整数可用且步骤数正确', () => {
  const total = totalCount(200);
  assert.ok(total > 10n ** 100n);
  const result = unrankSequence(200, normalizeRank((total - 1n).toString()));
  assert.equal(result.sequence.length, 400);
  assert.equal(result.steps.length, 400);
  assert.equal(result.sequence, '()'.repeat(200));
});

test('排名步骤包含深度、分支数、跳过量', () => {
  const steps = rankSequence(3, '()(())').steps;
  const totalSkipped = steps.reduce((acc, s) => acc + BigInt(s.skipped), 0n);
  assert.equal(totalSkipped.toString(), '3');
  assert.ok(steps.every((s) => typeof s.depthBefore === 'number'));
  assert.ok(steps.every((s) => 'leftBranchCompletions' in s));
});

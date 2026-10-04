import { AppError, MAX_N } from './errors.ts';

/**
 * 核心动态规划：
 * ways[r][d] = 还剩 r 个位置、当前深度为 d 时，可以合法完成的后缀数量。
 *
 * 边界：
 *   ways[0][0] = 1（恰好闭合），ways[0][d>0] = 0
 * 递推：
 *   ways[r][d] = (可以放 '(' 时) ways[r-1][d+1]
 *              + (d > 0 可以放 ')' 时) ways[r-1][d-1]
 *
 * 约定 '(' < ')'（字典序）。所有计数使用 bigint，表在固定最大对数 200 下预计算一次。
 */

const MAX_POS = MAX_N * 2;

const table: bigint[][] = Array.from({ length: MAX_POS + 1 }, () =>
  Array.from({ length: MAX_N + 2 }, () => 0n),
);

table[0][0] = 1n;
for (let r = 1; r <= MAX_POS; r++) {
  for (let d = 0; d <= MAX_N; d++) {
    // 放 '('：深度上升，前提是深度不超过剩余位置允许的范围（表外项视为 0）
    if (d + 1 <= MAX_N) {
      table[r][d] += table[r - 1][d + 1];
    }
      // 放 ')'：深度下降，要求当前 d > 0
    if (d > 0) {
      table[r][d] += table[r - 1][d - 1];
    }
  }
}

/** 剩余 r 个位置、深度 d 时的合法后缀数（越界返回 0n）。 */
export function ways(remaining: number, depth: number): bigint {
  if (remaining < 0 || depth < 0 || depth > MAX_N) return 0n;
  if (remaining > MAX_POS) return 0n;
  return table[remaining][depth] ?? 0n;
}

/** 解析并校验 n：必须是 0..200 的整数（接受 number 或十进制字符串）。 */
export function parseN(raw: unknown): number {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) {
      throw new AppError('INVALID_N', 'n 必须是整数', { received: String(raw) });
    }
    return checkRange(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new AppError('INVALID_N', 'n 必须是非负整数的十进制表示', { received: raw });
    }
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) {
      throw new AppError('N_TOO_LARGE', `n 超出允许范围（0..${MAX_N}）`, { received: raw });
    }
    return checkRange(value);
  }
  throw new AppError('INVALID_N', 'n 缺失或类型错误', { received: String(raw) });
}

function checkRange(n: number): number {
  if (n < 0 || n > MAX_N) {
    throw new AppError('N_TOO_LARGE', `n 必须在 0..${MAX_N} 之间`, { received: n });
  }
  return n;
}

/** n 对括号的合法序列总数（第 n 个卡特兰数）。 */
export function totalCount(n: number): bigint {
  return ways(2 * n, 0);
}

/**
 * 规范化排名输入：空串视为无效；前导零被去除但保留原始值。
 * 仅做语法规范化，范围校验由调用方结合总数完成。
 */
export function normalizeRank(raw: unknown): { original: string; canonical: string; value: bigint } {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw)) {
      throw new AppError('INVALID_RANK', '排名无法安全表示为整数，请使用十进制字符串', {
        received: String(raw),
      });
    }
    raw = String(raw);
  }
  if (typeof raw !== 'string') {
    throw new AppError('INVALID_RANK', '排名必须是十进制字符串', { received: String(raw) });
  }
  const original = raw;
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new AppError('INVALID_RANK', '排名不能为空', { received: original });
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new AppError('INVALID_RANK', '排名必须是非负整数的十进制表示', { received: original });
  }
  let canonical = trimmed.replace(/^0+(?=\d)/, '');
  if (canonical === '') canonical = '0';
  let value: bigint;
  try {
    value = BigInt(canonical);
  } catch {
    throw new AppError('INVALID_RANK', '排名无法解析为 BigInt', { received: original });
  }
  return { original, canonical, value };
}

/** 校验括号序列：只允许 '(' 与 ')'，并检查前缀深度与最终归零。 */
export function validateSequence(seq: unknown, n: number): string {
  if (typeof seq !== 'string') {
    throw new AppError('INVALID_CHARS', '序列必须是字符串', { received: String(seq) });
  }
  if (!/^[()]*$/.test(seq)) {
    throw new AppError('INVALID_CHARS', "序列只能包含 '(' 与 ')' 两种字符", { received: seq });
  }
  if (seq.length !== 2 * n) {
    throw new AppError(
      'LENGTH_MISMATCH',
      `序列长度必须等于 2n = ${2 * n}`,
      { receivedLength: seq.length, expectedLength: 2 * n },
    );
  }
  let depth = 0;
  for (const ch of seq) {
    depth += ch === '(' ? 1 : -1;
    if (depth < 0) {
      throw new AppError('UNBALANCED_SEQUENCE', '序列中途右括号多于左括号，不是合法平衡序列', {
        sequence: seq,
      });
    }
  }
  if (depth !== 0) {
    throw new AppError('UNBALANCED_SEQUENCE', '序列结束时左右括号数量不相等', { sequence: seq });
  }
  return seq;
}

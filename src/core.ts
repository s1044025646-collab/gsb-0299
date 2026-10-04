export const ALGO_VERSION = "dp-suffix-v1";
export const MAX_N = 200;
export const MAX_PAGE_LIMIT = 100;

export type ErrorCode =
  | "N_OUT_OF_RANGE"
  | "INVALID_CHAR"
  | "LENGTH_MISMATCH"
  | "NEGATIVE_RANK"
  | "RANK_OUT_OF_RANGE"
  | "PREFIX_BELOW_ZERO"
  | "PREFIX_EXCEEDS_N"
  | "LIMIT_EXCEEDED"
  | "INVALID_PARAMS";

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

export function parseN(raw: string | undefined | null): { n: number; normalized: string } {
  const s = (raw ?? "").trim();
  if (s === "") return { n: 0, normalized: "0" };
  if (!/^\d+$/.test(s)) throw new ApiError("INVALID_PARAMS", `n 必须是非负整数，收到: "${raw}"`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n > MAX_N) {
    throw new ApiError("N_OUT_OF_RANGE", `n 超出范围 0..${MAX_N}: "${s}"`);
  }
  return { n, normalized: String(n) };
}

export function parseRank(raw: string | undefined | null): { rank: bigint; normalized: string } {
  const s = (raw ?? "").trim();
  if (s === "") return { rank: 0n, normalized: "0" };
  if (s.startsWith("-")) throw new ApiError("NEGATIVE_RANK", `排名不能为负: "${raw}"`);
  if (!/^\d+$/.test(s)) throw new ApiError("INVALID_PARAMS", `排名必须是非负整数十进制串，收到: "${raw}"`);
  const rank = BigInt(s);
  return { rank, normalized: rank.toString() };
}

const tableCache = new Map<number, bigint[][]>();

/** ways[rem][d] = 剩余 rem 个位置、当前深度 d 时可合法完成的数量 */
export function suffixTable(n: number): bigint[][] {
  const cached = tableCache.get(n);
  if (cached) return cached;
  const total = 2 * n;
  const ways: bigint[][] = [];
  for (let rem = 0; rem <= total; rem++) ways.push(new Array<bigint>(n + 1).fill(0n));
  ways[0][0] = 1n;
  for (let rem = 1; rem <= total; rem++) {
    for (let d = 0; d <= n; d++) {
      let v = d + 1 <= n ? ways[rem - 1][d + 1] : 0n;
      if (d > 0) v += ways[rem - 1][d - 1];
      ways[rem][d] = v;
    }
  }
  tableCache.set(n, ways);
  return ways;
}

export function countSequences(n: number): bigint {
  return suffixTable(n)[2 * n][0];
}

export function validateSequenceChars(seq: string): void {
  for (const ch of seq) {
    if (ch !== "(" && ch !== ")") {
      throw new ApiError("INVALID_CHAR", `序列包含非法字符 "${ch}"，只允许 "(" 和 ")"`);
    }
  }
}

export interface RankStep {
  pos: number;
  depthBefore: number;
  char: string;
  leftBranchCount: string;
  skipped: string;
  rankAfter: string;
}

export interface RankResult {
  n: number;
  sequence: string;
  rank: string;
  total: string;
  steps: RankStep[];
}

export function rankSequence(n: number, seq: string): RankResult {
  validateSequenceChars(seq);
  if (seq.length !== 2 * n) {
    throw new ApiError("LENGTH_MISMATCH", `序列长度 ${seq.length} 与 2n=${2 * n} 不匹配`);
  }
  const ways = suffixTable(n);
  let depth = 0;
  let rank = 0n;
  const steps: RankStep[] = [];
  for (let i = 0; i < seq.length; i++) {
    const rem = seq.length - i;
    const leftCount = depth + 1 <= n ? ways[rem - 1][depth + 1] : 0n;
    const ch = seq[i];
    let skipped = 0n;
    if (ch === ")") {
      if (depth === 0) throw new ApiError("PREFIX_BELOW_ZERO", `位置 ${i} 处右括号使深度变为负，序列非法`);
      skipped = leftCount;
      rank += leftCount;
      depth -= 1;
    } else {
      if (depth + 1 > n) throw new ApiError("PREFIX_EXCEEDS_N", `位置 ${i} 处左括号使深度超过 n=${n}，序列非法`);
      depth += 1;
    }
    steps.push({
      pos: i,
      depthBefore: ch === "(" ? depth - 1 : depth + 1,
      char: ch,
      leftBranchCount: leftCount.toString(),
      skipped: skipped.toString(),
      rankAfter: rank.toString(),
    });
  }
  if (depth !== 0) throw new ApiError("INVALID_PARAMS", "序列结束时深度不为 0，非法");
  return { n, sequence: seq, rank: rank.toString(), total: countSequences(n).toString(), steps };
}

export interface UnrankStep {
  pos: number;
  depthBefore: number;
  leftBranchCount: string;
  chosen: string;
  skipped: string;
  rankRemaining: string;
}

export interface UnrankResult {
  n: number;
  rank: string;
  sequence: string;
  total: string;
  steps: UnrankStep[];
}

export function unrankSequence(n: number, rank: bigint): UnrankResult {
  const total = countSequences(n);
  if (rank < 0n) throw new ApiError("NEGATIVE_RANK", "排名不能为负");
  if (rank >= total) {
    throw new ApiError("RANK_OUT_OF_RANGE", `排名 ${rank} 超出范围，n=${n} 时合法排名为 0..${total - 1n}`);
  }
  const ways = suffixTable(n);
  let depth = 0;
  let r = rank;
  let seq = "";
  const steps: UnrankStep[] = [];
  const totalLen = 2 * n;
  for (let i = 0; i < totalLen; i++) {
    const rem = totalLen - i;
    const leftCount = depth + 1 <= n ? ways[rem - 1][depth + 1] : 0n;
    let chosen: string;
    let skipped = 0n;
    if (r < leftCount) {
      chosen = "(";
      depth += 1;
    } else {
      chosen = ")";
      skipped = leftCount;
      r -= leftCount;
      depth -= 1;
    }
    steps.push({
      pos: i,
      depthBefore: chosen === "(" ? depth - 1 : depth + 1,
      leftBranchCount: leftCount.toString(),
      chosen,
      skipped: skipped.toString(),
      rankRemaining: r.toString(),
    });
    seq += chosen;
  }
  return { n, rank: rank.toString(), sequence: seq, total: total.toString(), steps };
}

export type PrefixStatus = "VALID_OPEN" | "VALID_COMPLETE" | "INVALID_CHAR" | "EXCEEDS_N" | "BELOW_ZERO";

export interface PrefixResult {
  n: number;
  prefix: string;
  status: PrefixStatus;
  completable: boolean;
  remaining: string | null;
  interval: { start: string; end: string } | null;
  detail: string;
}

export function prefixInfo(n: number, prefix: string): PrefixResult {
  for (const ch of prefix) {
    if (ch !== "(" && ch !== ")") {
      return { n, prefix, status: "INVALID_CHAR", completable: false, remaining: null, interval: null, detail: `前缀包含非法字符 "${ch}"` };
    }
  }
  if (prefix.length > 2 * n) {
    return { n, prefix, status: "EXCEEDS_N", completable: false, remaining: null, interval: null, detail: `前缀长度 ${prefix.length} 超过 2n=${2 * n}` };
  }
  const ways = suffixTable(n);
  const totalLen = 2 * n;
  let depth = 0;
  let start = 0n;
  for (let i = 0; i < prefix.length; i++) {
    const rem = totalLen - i;
    const ch = prefix[i];
    if (ch === "(") {
      if (depth + 1 > n) {
        return { n, prefix, status: "EXCEEDS_N", completable: false, remaining: null, interval: null, detail: `位置 ${i} 处左括号使左括号数量超过 n=${n}` };
      }
      depth += 1;
    } else {
      if (depth === 0) {
        return { n, prefix, status: "BELOW_ZERO", completable: false, remaining: null, interval: null, detail: `位置 ${i} 处右括号数量多于左括号，深度越零` };
      }
      start += depth + 1 <= n ? ways[rem - 1][depth + 1] : 0n;
      depth -= 1;
    }
  }
  const remaining = ways[totalLen - prefix.length][depth];
  const end = start + remaining;
  const complete = prefix.length === totalLen;
  return {
    n,
    prefix,
    status: complete ? "VALID_COMPLETE" : "VALID_OPEN",
    completable: true,
    remaining: remaining.toString(),
    interval: { start: start.toString(), end: end.toString() },
    detail: complete
      ? "前缀已是完整合法序列，区间退化为单个排名"
      : `前缀可完成，剩余 ${remaining} 种，占全局排名区间 [${start}, ${end})`,
  };
}

export interface PageResult {
  n: number;
  start: string;
  limit: number;
  total: string;
  items: { rank: string; sequence: string }[];
  next: string | null;
}

export function pageSequences(n: number, start: bigint, limit: number): PageResult {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new ApiError("INVALID_PARAMS", `limit 必须是正整数，收到: ${limit}`);
  }
  if (limit > MAX_PAGE_LIMIT) {
    throw new ApiError("LIMIT_EXCEEDED", `limit 超过上限 ${MAX_PAGE_LIMIT}: ${limit}`);
  }
  const total = countSequences(n);
  if (start < 0n) throw new ApiError("NEGATIVE_RANK", "起始排名不能为负");
  if (start >= total) {
    throw new ApiError("RANK_OUT_OF_RANGE", `起始排名 ${start} 超出范围，总数为 ${total}`);
  }
  const items: { rank: string; sequence: string }[] = [];
  let r = start;
  const end = start + BigInt(limit) < total ? start + BigInt(limit) : total;
  for (; r < end; r++) {
    items.push({ rank: r.toString(), sequence: unrankSequence(n, r).sequence });
  }
  return {
    n,
    start: start.toString(),
    limit,
    total: total.toString(),
    items,
    next: r < total ? r.toString() : null,
  };
}

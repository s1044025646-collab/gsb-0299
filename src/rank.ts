import { AppError } from './errors.ts';
import { totalCount, validateSequence, ways } from './dp.ts';

export interface RankStep {
  position: number;
  depthBefore: number;
  chosen: '(' | ')';
  leftBranchCompletions: string;
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

/**
 * 零基字典序排名：从左到右扫描。
 * 每当某位选择 '(' < ')' 中较大的 ')' 时，
 * 所有在该位放 '(' 的合法序列都排在前面，整批累加其后缀合法数。
 */
export function rankSequence(n: number, rawSeq: unknown): RankResult {
  const sequence = validateSequence(rawSeq, n);
  let depth = 0;
  let opens = 0;
  let rank = 0n;
  const steps: RankStep[] = [];

  for (let i = 0; i < sequence.length; i++) {
    const remainingAfter = 2 * n - i - 1;
    const canOpen = opens < n;
    const leftBranch = canOpen ? ways(remainingAfter, depth + 1) : 0n;
    const chosen = sequence[i] as '(' | ')';
    let skipped = 0n;

    if (chosen === ')') {
      // ')' 更大：跳过整个 '(' 分支
      skipped = leftBranch;
      rank += leftBranch;
      depth -= 1;
    } else {
      opens += 1;
      depth += 1;
    }

    steps.push({
      position: i,
      depthBefore: chosen === '(' ? depth - 1 : depth + 1,
      chosen,
      leftBranchCompletions: leftBranch.toString(),
      skipped: skipped.toString(),
      rankAfter: rank.toString(),
    });
  }

  return { n, sequence, rank: rank.toString(), total: totalCount(n).toString(), steps };
}

export interface UnrankStep {
  position: number;
  depthBefore: number;
  leftBranchCompletions: string;
  action: 'take-left' | 'skip-left';
  skipped: string;
  rankBefore: string;
  rankAfter: string;
  chosen: '(' | ')';
}

export interface UnrankResult {
  n: number;
  rankOriginal: string;
  rankCanonical: string;
  sequence: string;
  total: string;
  steps: UnrankStep[];
}

/**
 * 零基反排名：逐位比较剩余排名与 '(' 分支（更小字符）的合法后缀数。
 * 排名落在左分支内则取 '('；否则整批减去左分支计数后取 ')'。
 */
export function unrankSequence(
  n: number,
  normalized: { original: string; canonical: string; value: bigint },
): UnrankResult {
  const total = totalCount(n);
  if (normalized.value < 0n) {
    throw new AppError('NEGATIVE_RANK', '排名不能为负', { received: normalized.original });
  }
  if (normalized.value >= total) {
    throw new AppError('RANK_OUT_OF_RANGE', `排名超出范围 [0, ${total - 1n}]`, {
      received: normalized.canonical,
      total: total.toString(),
    });
  }

  let rank = normalized.value;
  let depth = 0;
  let opens = 0;
  let sequence = '';
  const steps: UnrankStep[] = [];

  for (let i = 0; i < 2 * n; i++) {
    const remainingAfter = 2 * n - i - 1;
    const canOpen = opens < n;
    const leftBranch = canOpen ? ways(remainingAfter, depth + 1) : 0n;
    const rankBefore = rank;

    if (rank < leftBranch) {
      sequence += '(';
      opens += 1;
      depth += 1;
      steps.push({
        position: i,
        depthBefore: depth - 1,
        leftBranchCompletions: leftBranch.toString(),
        action: 'take-left',
        skipped: '0',
        rankBefore: rankBefore.toString(),
        rankAfter: rankBefore.toString(),
        chosen: '(',
      });
    } else {
      rank -= leftBranch;
      sequence += ')';
      depth -= 1;
      steps.push({
        position: i,
        depthBefore: depth + 1,
        leftBranchCompletions: leftBranch.toString(),
        action: 'skip-left',
        skipped: leftBranch.toString(),
        rankBefore: rankBefore.toString(),
        rankAfter: rank.toString(),
        chosen: ')',
      });
    }
  }

  return {
    n,
    rankOriginal: normalized.original,
    rankCanonical: normalized.canonical,
    sequence,
    total: total.toString(),
    steps,
  };
}

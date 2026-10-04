import { AppError, MAX_PAGE_LIMIT } from './errors.ts';
import { totalCount, ways } from './dp.ts';

export interface PageItem {
  rank: string;
  sequence: string;
}

export interface PageResult {
  n: number;
  startOriginal: string;
  startCanonical: string;
  requestedLimit: number;
  effectiveCount: number;
  total: string;
  items: PageItem[];
  nextStart: string | null;
  reachedEnd: boolean;
}

/** 直接按排名区间逐位构造序列（与全量枚举无关），用于有限窗口浏览。 */
function buildSequence(n: number, targetRank: bigint): string {
  let rank = targetRank;
  let depth = 0;
  let opens = 0;
  let sequence = '';

  for (let i = 0; i < 2 * n; i++) {
    const remainingAfter = 2 * n - i - 1;
    const leftBranch = opens < n ? ways(remainingAfter, depth + 1) : 0n;
    if (rank < leftBranch) {
      sequence += '(';
      opens += 1;
      depth += 1;
    } else {
      rank -= leftBranch;
      sequence += ')';
      depth -= 1;
    }
  }
  return sequence;
}

export function getPage(
  n: number,
  startNorm: { original: string; canonical: string; value: bigint },
  rawLimit: unknown,
): PageResult {
  const total = totalCount(n);

  let limit: number;
  if (typeof rawLimit === 'string' && rawLimit.trim() !== '') {
    if (!/^\d+$/.test(rawLimit.trim())) {
      throw new AppError('INVALID_LIMIT', '返回数量必须是非负整数', { received: rawLimit });
    }
    limit = Number(rawLimit.trim());
  } else if (typeof rawLimit === 'number') {
    if (!Number.isInteger(rawLimit)) {
      throw new AppError('INVALID_LIMIT', '返回数量必须是整数', { received: rawLimit });
    }
    limit = rawLimit;
  } else {
    throw new AppError('INVALID_LIMIT', '缺少返回数量 limit', { received: String(rawLimit) });
  }

  if (limit < 0) {
    throw new AppError('INVALID_LIMIT', '返回数量不能为负', { received: limit });
  }
  if (limit > MAX_PAGE_LIMIT) {
    throw new AppError(
      'LIMIT_TOO_LARGE',
      `单次返回数量不能超过 ${MAX_PAGE_LIMIT}`,
      { received: limit, max: MAX_PAGE_LIMIT },
    );
  }

  if (startNorm.value < 0n) {
    throw new AppError('NEGATIVE_RANK', '起始排名不能为负', { received: startNorm.original });
  }
  if (startNorm.value >= total) {
    throw new AppError('RANK_OUT_OF_RANGE', `起始排名超出范围 [0, ${total - 1n}]`, {
      received: startNorm.canonical,
      total: total.toString(),
    });
  }

  const available = total - startNorm.value;
  const count = BigInt(limit) < available ? limit : Number(available);

  const items: PageItem[] = [];
  for (let offset = 0; offset < count; offset++) {
    const rank = startNorm.value + BigInt(offset);
    items.push({ rank: rank.toString(), sequence: buildSequence(n, rank) });
  }

  const nextRank = startNorm.value + BigInt(count);
  const reachedEnd = nextRank >= total;

  return {
    n,
    startOriginal: startNorm.original,
    startCanonical: startNorm.canonical,
    requestedLimit: limit,
    effectiveCount: count,
    total: total.toString(),
    items,
    nextStart: reachedEnd ? null : nextRank.toString(),
    reachedEnd,
  };
}

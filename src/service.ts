import { analyzePrefix } from './prefix.ts';
import type { PrefixResult } from './prefix.ts';
import { getPage } from './page.ts';
import type { PageResult } from './page.ts';
import { rankSequence, unrankSequence } from './rank.ts';
import type { RankResult, UnrankResult } from './rank.ts';
import { normalizeRank, parseN, totalCount } from './dp.ts';
import { insertReport } from './db.ts';

export const ALGO_VERSION = 'dp-ways-v1';

export type QueryType = 'count' | 'rank' | 'unrank' | 'prefix' | 'page';

export interface Envelope<T> {
  reportId: number;
  algoVersion: string;
  queryType: QueryType;
  params: Record<string, unknown>;
  result: T;
}

export function countQuery(rawN: unknown): Envelope<{ n: number; total: string }> {
  const n = parseN(rawN);
  const result = { n, total: totalCount(n).toString() };
  const reportId = insertReport({
    algoVersion: ALGO_VERSION,
    queryType: 'count',
    n,
    params: { n },
    result,
  });
  return { reportId, algoVersion: ALGO_VERSION, queryType: 'count', params: { n }, result };
}

export function rankQuery(rawN: unknown, rawSequence: unknown): Envelope<RankResult> {
  const n = parseN(rawN);
  const result = rankSequence(n, rawSequence);
  const reportId = insertReport({
    algoVersion: ALGO_VERSION,
    queryType: 'rank',
    n,
    params: { n, sequence: String(rawSequence ?? '') },
    result,
  });
  return {
    reportId,
    algoVersion: ALGO_VERSION,
    queryType: 'rank',
    params: { n, sequence: String(rawSequence ?? '') },
    result,
  };
}

export function unrankQuery(rawN: unknown, rawRank: unknown): Envelope<UnrankResult> {
  const n = parseN(rawN);
  const normalized = normalizeRank(rawRank);
  const result = unrankSequence(n, normalized);
  const reportId = insertReport({
    algoVersion: ALGO_VERSION,
    queryType: 'unrank',
    n,
    params: { n, rankOriginal: normalized.original, rankCanonical: normalized.canonical },
    result,
  });
  return {
    reportId,
    algoVersion: ALGO_VERSION,
    queryType: 'unrank',
    params: { n, rankOriginal: normalized.original, rankCanonical: normalized.canonical },
    result,
  };
}

export function prefixQuery(rawN: unknown, rawPrefix: unknown): Envelope<PrefixResult> {
  const n = parseN(rawN);
  const prefix = typeof rawPrefix === 'string' ? rawPrefix : String(rawPrefix ?? '');
  const result = analyzePrefix(n, prefix);
  const reportId = insertReport({
    algoVersion: ALGO_VERSION,
    queryType: 'prefix',
    n,
    params: { n, prefixOriginal: prefix },
    result,
  });
  return {
    reportId,
    algoVersion: ALGO_VERSION,
    queryType: 'prefix',
    params: { n, prefixOriginal: prefix },
    result,
  };
}

export function pageQuery(
  rawN: unknown,
  rawStart: unknown,
  rawLimit: unknown,
): Envelope<PageResult> {
  const n = parseN(rawN);
  const start = normalizeRank(rawStart);
  const result = getPage(n, start, rawLimit);
  const reportId = insertReport({
    algoVersion: ALGO_VERSION,
    queryType: 'page',
    n,
    params: {
      n,
      startOriginal: start.original,
      startCanonical: start.canonical,
      limit: result.requestedLimit,
    },
    result,
  });
  return {
    reportId,
    algoVersion: ALGO_VERSION,
    queryType: 'page',
    params: {
      n,
      startOriginal: start.original,
      startCanonical: start.canonical,
      limit: result.requestedLimit,
    },
    result,
  };
}

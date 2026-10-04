import { AppError } from './errors.ts';
import { totalCount, ways } from './dp.ts';

export type PrefixStatus =
  | 'syntax-invalid'
  | 'too-many-parens'
  | 'below-zero'
  | 'complete'
  | 'extendable';

export interface PrefixStep {
  position: number;
  char: '(' | ')';
  depthBefore: number;
  depthAfter: number;
}

export interface PrefixResult {
  n: number;
  prefixOriginal: string;
  prefix: string;
  status: PrefixStatus;
  completable: boolean;
  depth: number;
  opens: number;
  closes: number;
  remainingCompletions: string;
  total: string;
  rankStart: string | null;
  rankEnd: string | null;
  steps: PrefixStep[];
}

/**
 * 前缀查询：
 * 1) 字符非法 -> syntax-invalid
 * 2) 某类括号数超过 n -> too-many-parens
 * 3) 中途深度跌破 0 -> below-zero
 * 4) 深度归零且长度 = 2n -> complete（唯一完整序列，区间为单点）
 * 5) 其余合法可继续 -> extendable
 *
 * 合法前缀对应的序列在零基字典序中构成连续区间：
 *   rankStart = 扫描期间每次选 ')' 时跳过的 '(' 分支计数之和
 *   rankEnd   = rankStart + 后缀可完成数 - 1
 */
export function analyzePrefix(n: number, rawPrefix: unknown): PrefixResult {
  const prefixOriginal = typeof rawPrefix === 'string' ? rawPrefix : String(rawPrefix ?? '');
  const prefix = prefixOriginal;
  const total = totalCount(n);

  const base = {
    n,
    prefixOriginal,
    prefix,
    total: total.toString(),
  };

  if (!/^[()]*$/.test(prefix)) {
    return dead(base, 'syntax-invalid', 0, 0, 0, []);
  }

  let depth = 0;
  let opens = 0;
  let closes = 0;
  let rankStart = 0n;
  const steps: PrefixStep[] = [];

  for (let i = 0; i < prefix.length; i++) {
    const ch = prefix[i] as '(' | ')';
    const depthBefore = depth;

    if (ch === '(') {
      opens += 1;
      depth += 1;
    } else {
      // 选 ')' 前：该位放 '(' 的全部合法序列都更小
      if (opens < n) {
        rankStart += ways(2 * n - i - 1, depthBefore + 1);
      }
      closes += 1;
      depth -= 1;
    }

    steps.push({ position: i, char: ch, depthBefore, depthAfter: depth });

    if (depth < 0) {
      return dead(base, 'below-zero', depth, opens, closes, steps);
    }
    if (opens > n || closes > n) {
      return dead(base, 'too-many-parens', depth, opens, closes, steps);
    }
  }

  const remainingPositions = 2 * n - prefix.length;
  const remainingCompletions = ways(remainingPositions, depth);

  if (remainingCompletions === 0n) {
    // 理论上前面已分类，防御性处理
    return dead(base, 'too-many-parens', depth, opens, closes, steps);
  }

  if (prefix.length === 2 * n && depth === 0) {
    return {
      ...base,
      status: 'complete',
      completable: true,
      depth: 0,
      opens,
      closes,
      remainingCompletions: '1',
      rankStart: rankStart.toString(),
      rankEnd: rankStart.toString(),
      steps,
    };
  }

  const rankEnd = rankStart + remainingCompletions - 1n;
  return {
    ...base,
    status: 'extendable',
    completable: true,
    depth,
    opens,
    closes,
    remainingCompletions: remainingCompletions.toString(),
    rankStart: rankStart.toString(),
    rankEnd: rankEnd.toString(),
    steps,
  };
}

function dead(
  base: { n: number; prefixOriginal: string; prefix: string; total: string },
  status: PrefixStatus,
  depth: number,
  opens: number,
  closes: number,
  steps: PrefixStep[],
): PrefixResult {
  return {
    ...base,
    status,
    completable: false,
    depth,
    opens,
    closes,
    remainingCompletions: '0',
    rankStart: null,
    rankEnd: null,
    steps,
  };
}

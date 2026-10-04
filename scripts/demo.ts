import { totalCount } from '../src/dp.ts';
import { rankSequence, unrankSequence } from '../src/rank.ts';
import { getPage } from '../src/page.ts';
import { analyzePrefix } from '../src/prefix.ts';
import { normalizeRank } from '../src/dp.ts';

function line(title: string): void {
  console.log(`\n===== ${title} =====`);
}

line('n = 3：穷举顺序、排名与反排名互证');
const sequences = ['((()))', '(()())', '(())()', '()(())', '()()()'];
for (const seq of sequences) {
  const r = rankSequence(3, seq);
  const back = unrankSequence(3, normalizeRank(r.rank));
  console.log(`序列 ${seq} -> rank ${r.rank} ; unrank(${r.rank}) -> ${back.sequence}`);
}
console.log(`总数 C3 = ${totalCount(3)}`);

line('n = 50：大整数总数（未枚举任何序列）');
const total50 = totalCount(50);
console.log(`C50 = ${total50}`);

line('n = 50：靠后的排名（total - 2，前导零演示规范化）');
const lateRank = total50 - 2n;
const lateInput = '000' + lateRank.toString();
const norm = normalizeRank(lateInput);
console.log(`原始输入: ${lateInput}`);
console.log(`规范化后: ${norm.canonical}`);
const late = unrankSequence(50, norm);
console.log(`unrank -> ${late.sequence}`);
const rankBack = rankSequence(50, late.sequence);
console.log(`rank 回算 = ${rankBack.rank}（应等于 ${norm.canonical}）`);

line('n = 50：最后一页（跨终点窗口）');
const page = getPage(50, normalizeRank((total50 - 3n).toString()), 10);
console.log(`窗口起点 ${page.startCanonical}，实际返回 ${page.effectiveCount} 条，reachedEnd=${page.reachedEnd}`);
for (const item of page.items) console.log(`  ${item.rank}  ${item.sequence}`);

line('n = 3：前缀 "(" 的连续排名区间');
const pref = analyzePrefix(3, '(');
console.log(
  `状态=${pref.status} 剩余完成数=${pref.remainingCompletions} 区间=[${pref.rankStart}, ${pref.rankEnd}]`,
);

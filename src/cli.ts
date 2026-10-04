import {
  countSequences,
  pageSequences,
  parseN,
  parseRank,
  prefixInfo,
  rankSequence,
  unrankSequence,
} from "./core";
import { defaultDbPath, ReportStore } from "./store";

function parseArgs(argv: string[]): { cmd: string; opts: Record<string, string> } {
  const [cmd = "help", ...rest] = argv;
  const opts: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = "true";
      }
    }
  }
  return { cmd, opts };
}

function print(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

const HELP = `用法: node dist/src/cli.js <命令> [选项]
命令:
  count   --n <对数>
  rank    --n <对数> --seq <序列>          (空序列用 --seq "")
  unrank  --n <对数> --rank <排名> [--steps]
  prefix  --n <对数> --prefix <前缀>
  page    --n <对数> --start <起始排名> --limit <数量>
  history [--limit <数量>]
  report  --id <报告ID>
  demo
  serve   [--port <端口>]
`;

export function runCli(argv: string[], dbPath = defaultDbPath()): void {
  const { cmd, opts } = parseArgs(argv);
  const store = new ReportStore(dbPath);
  try {
    switch (cmd) {
      case "count": {
        const { n, normalized } = parseN(opts.n);
        const result = { n, total: countSequences(n).toString() };
        const report = store.save("count", { raw: opts.n, normalized }, result);
        print({ reportId: report.id, ...result });
        break;
      }
      case "rank": {
        const { n } = parseN(opts.n);
        const seq = opts.seq ?? "";
        const result = rankSequence(n, seq);
        const report = store.save("rank", { rawN: opts.n, rawSeq: opts.seq, seq }, result);
        print({ reportId: report.id, ...result });
        break;
      }
      case "unrank": {
        const { n } = parseN(opts.n);
        const { rank, normalized } = parseRank(opts.rank);
        const result = unrankSequence(n, rank);
        const report = store.save("unrank", { rawN: opts.n, rawRank: opts.rank, rank: normalized }, result);
        const showSteps = opts.steps === "true";
        print({ reportId: report.id, ...result, steps: showSteps ? result.steps : `[共 ${result.steps.length} 步，加 --steps 查看]` });
        break;
      }
      case "prefix": {
        const { n } = parseN(opts.n);
        const prefix = opts.prefix ?? "";
        const result = prefixInfo(n, prefix);
        const report = store.save("prefix", { rawN: opts.n, rawPrefix: opts.prefix, prefix }, result);
        print({ reportId: report.id, ...result });
        break;
      }
      case "page": {
        const { n } = parseN(opts.n);
        const { rank: start } = parseRank(opts.start);
        const limit = opts.limit === undefined ? 10 : Number(opts.limit);
        const result = pageSequences(n, start, limit);
        const report = store.save("page", { rawN: opts.n, rawStart: opts.start, limit }, result);
        print({ reportId: report.id, ...result });
        break;
      }
      case "history": {
        const limit = opts.limit === undefined ? 50 : Number(opts.limit);
        print(store.list(limit));
        break;
      }
      case "report": {
        const id = Number(opts.id);
        const report = store.get(id);
        if (!report) {
          console.error(`报告 ${opts.id} 不存在`);
          process.exitCode = 1;
          break;
        }
        print(report);
        break;
      }
      case "demo": {
        runDemo(store);
        break;
      }
      case "serve": {
        const port = opts.port === undefined ? 0 : Number(opts.port);
        store.close();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { startServer } = require("./server");
        void startServer(port, dbPath);
        return;
      }
      default:
        process.stdout.write(HELP);
    }
  } finally {
    try {
      store.close();
    } catch {
      /* serve 已关闭 */
    }
  }
}

function runDemo(store: ReportStore): void {
  console.log("== 演示 1: n=3 的 5 个序列及排名 ==");
  for (let r = 0n; r < 5n; r++) {
    const u = unrankSequence(3, r);
    console.log(`rank ${r} -> ${u.sequence}`);
  }
  console.log("\n== 演示 2: n=50 总数与靠后排名（非全量枚举）==");
  const total = countSequences(50);
  console.log(`n=50 总数: ${total}`);
  const lateRank = total - 12345n;
  const u = unrankSequence(50, lateRank);
  console.log(`rank ${lateRank} -> ${u.sequence}`);
  const rk = rankSequence(50, u.sequence);
  console.log(`回算排名: ${rk.rank} (一致: ${rk.rank === lateRank.toString()})`);
  store.save("demo", { cases: ["n=3", "n=50"] }, { total50: total.toString(), lateRank: lateRank.toString() });
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const e = err as { code: string; message: string };
      console.error(`错误 [${e.code}] ${e.message}`);
      process.exitCode = 1;
    } else {
      throw err;
    }
  }
}

import * as http from "node:http";
import {
  ALGO_VERSION,
  ApiError,
  countSequences,
  pageSequences,
  parseN,
  parseRank,
  prefixInfo,
  rankSequence,
  unrankSequence,
} from "./core";
import { defaultDbPath, ReportStore } from "./store";

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

export function createServer(store: ReportStore): http.Server {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const q = url.searchParams;
      const path = url.pathname;

      if (path === "/api/count") {
        const { n, normalized } = parseN(q.get("n"));
        const result = { n, total: countSequences(n).toString(), algoVersion: ALGO_VERSION };
        const report = store.save("count", { raw: q.get("n"), normalized }, result);
        return json(res, 200, { reportId: report.id, ...result });
      }

      if (path === "/api/rank") {
        const { n, normalized: nNorm } = parseN(q.get("n"));
        const seq = q.get("seq") ?? "";
        const result = rankSequence(n, seq);
        const report = store.save("rank", { rawN: q.get("n"), n: nNorm, rawSeq: q.get("seq"), seq }, result);
        return json(res, 200, { reportId: report.id, ...result });
      }

      if (path === "/api/unrank") {
        const { n, normalized: nNorm } = parseN(q.get("n"));
        const { rank, normalized: rNorm } = parseRank(q.get("rank"));
        const result = unrankSequence(n, rank);
        const report = store.save(
          "unrank",
          { rawN: q.get("n"), n: nNorm, rawRank: q.get("rank"), rank: rNorm },
          result
        );
        return json(res, 200, { reportId: report.id, ...result });
      }

      if (path === "/api/prefix") {
        const { n, normalized: nNorm } = parseN(q.get("n"));
        const prefix = q.get("prefix") ?? "";
        const result = prefixInfo(n, prefix);
        const report = store.save("prefix", { rawN: q.get("n"), n: nNorm, rawPrefix: q.get("prefix"), prefix }, result);
        return json(res, 200, { reportId: report.id, ...result });
      }

      if (path === "/api/page") {
        const { n, normalized: nNorm } = parseN(q.get("n"));
        const { rank: start, normalized: sNorm } = parseRank(q.get("start"));
        const limitRaw = q.get("limit");
        const limit = limitRaw === null || limitRaw === "" ? 10 : Number(limitRaw);
        const result = pageSequences(n, start, limit);
        const report = store.save(
          "page",
          { rawN: q.get("n"), n: nNorm, rawStart: q.get("start"), start: sNorm, limit },
          result
        );
        return json(res, 200, { reportId: report.id, ...result });
      }

      if (path === "/api/reports") {
        return json(res, 200, { reports: store.list() });
      }

      const m = path.match(/^\/api\/reports\/(\d+)$/);
      if (m) {
        const report = store.get(Number(m[1]));
        if (!report) return json(res, 404, { error: { code: "NOT_FOUND", message: `报告 ${m[1]} 不存在` } });
        return json(res, 200, report);
      }

      return json(res, 404, { error: { code: "NOT_FOUND", message: `未知路径 ${path}` } });
    } catch (err) {
      if (err instanceof ApiError) {
        return json(res, 400, { error: { code: err.code, message: err.message } });
      }
      return json(res, 500, { error: { code: "INTERNAL", message: String(err) } });
    }
  });
}

export function startServer(port: number, dbPath = defaultDbPath()): Promise<number> {
  const store = new ReportStore(dbPath);
  const server = createServer(store);
  return new Promise((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      console.log(`服务已启动: http://localhost:${actual} (数据库: ${dbPath})`);
      resolve(actual);
    });
  });
}

if (require.main === module) {
  const portEnv = process.env.PORT;
  const port = portEnv ? Number(portEnv) : 0;
  void startServer(port);
}

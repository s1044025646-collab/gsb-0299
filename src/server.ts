import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { AppError } from './errors.ts';
import {
  countQuery,
  pageQuery,
  prefixQuery,
  rankQuery,
  unrankQuery,
} from './service.ts';
import { getReport, listReports, openDatabase } from './db.ts';

const PORT_ENV = process.env.PORT ? Number(process.env.PORT) : undefined;
const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'data', 'reports.sqlite');

openDatabase(DB_PATH);

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {};
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString('utf8');
  if (body === '') return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new AppError('BAD_REQUEST', '请求体不是合法 JSON', { received: body.slice(0, 200) });
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof AppError) {
    sendJson(res, 400, { error: { code: error.code, message: error.message, detail: error.detail } });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  sendJson(res, 500, { error: { code: 'INTERNAL', message } });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && path === '/history') {
    const queryType = url.searchParams.get('type') ?? undefined;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;
    const rows = listReports({ queryType, limit });
    sendJson(res, 200, {
      reports: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        algoVersion: row.algo_version,
        queryType: row.query_type,
        n: row.n,
        params: JSON.parse(row.params_json),
        result: JSON.parse(row.result_json),
      })),
    });
    return;
  }

  const reportMatch = path.match(/^\/history\/(\d+)$/);
  if (req.method === 'GET' && reportMatch) {
    const row = getReport(Number(reportMatch[1]));
    if (!row) {
      sendJson(res, 404, { error: { code: 'NOT_FOUND', message: '报告不存在' } });
      return;
    }
    sendJson(res, 200, {
      id: row.id,
      createdAt: row.created_at,
      algoVersion: row.algo_version,
      queryType: row.query_type,
      n: row.n,
      params: JSON.parse(row.params_json),
      result: JSON.parse(row.result_json),
    });
    return;
  }

  const routes: Record<string, (body: Record<string, unknown>) => unknown> = {
    '/api/count': (b) => countQuery(b.n),
    '/api/rank': (b) => rankQuery(b.n, b.sequence),
    '/api/unrank': (b) => unrankQuery(b.n, b.rank),
    '/api/prefix': (b) => prefixQuery(b.n, b.prefix),
    '/api/page': (b) => pageQuery(b.n, b.start, b.limit),
  };

  const handler = routes[path];
  if (!handler || (req.method !== 'POST' && req.method !== 'GET')) {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: `未知路径 ${path}` } });
    return;
  }

  try {
    const body =
      req.method === 'GET'
        ? Object.fromEntries(url.searchParams.entries())
        : await readJson(req);
    sendJson(res, 200, handler(body));
  } catch (error) {
    sendError(res, error);
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => sendError(res, error));
});

server.listen(PORT_ENV ?? 0, '127.0.0.1', () => {
  const address = server.address() as AddressInfo;
  console.log(`平衡括号服务已启动: http://127.0.0.1:${address.port}`);
  console.log(`数据库: ${DB_PATH}`);
});

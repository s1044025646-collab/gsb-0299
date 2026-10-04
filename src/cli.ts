import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { AppError } from './errors.ts';
import { getReport, listReports, openDatabase } from './db.ts';
import {
  countQuery,
  pageQuery,
  prefixQuery,
  rankQuery,
  unrankQuery,
} from './service.ts';

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'data', 'reports.sqlite');
openDatabase(DB_PATH);

interface ParsedArgs {
  command: string;
  flags: Record<string, string>;
  positional: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = 'true';
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { command: command ?? 'help', flags, positional };
}

function print(payload: unknown, exportPath?: string): void {
  const json = JSON.stringify(payload, null, 2);
  if (exportPath) {
    writeFileSync(exportPath, json, 'utf8');
    console.log(`结果已导出到 ${exportPath}`);
  }
  console.log(json);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const f = args.flags;

  try {
    switch (args.command) {
      case 'count':
        print(countQuery(f.n));
        break;
      case 'rank':
        print(rankQuery(f.n, f.sequence));
        break;
      case 'unrank':
        print(unrankQuery(f.n, f.rank));
        break;
      case 'prefix':
        print(prefixQuery(f.n, f.prefix ?? ''));
        break;
      case 'page':
        print(pageQuery(f.n, f.start, f.limit));
        break;
      case 'history': {
        if (f.id) {
          const row = getReport(Number(f.id));
          if (!row) throw new AppError('NOT_FOUND', `报告 ${f.id} 不存在`);
          print({
            ...row,
            params_json: JSON.parse(row.params_json),
            result_json: JSON.parse(row.result_json),
          });
        } else {
          print(listReports({ queryType: f.type, limit: f.limit ? Number(f.limit) : undefined }));
        }
        break;
      }
      case 'export': {
        if (!f.id) throw new AppError('BAD_REQUEST', 'export 需要 --id');
        const row = getReport(Number(f.id));
        if (!row) throw new AppError('NOT_FOUND', `报告 ${f.id} 不存在`);
        const outPath = f.out ?? `report-${f.id}.json`;
        writeFileSync(
          outPath,
          JSON.stringify(
            {
              ...row,
              params_json: JSON.parse(row.params_json),
              result_json: JSON.parse(row.result_json),
            },
            null,
            2,
          ),
          'utf8',
        );
        console.log(`报告 ${f.id} 已导出到 ${outPath}`);
        break;
      }
      default:
        console.log(`
用法:
  npm run cli -- count  --n 3
  npm run cli -- rank   --n 3 --sequence "(()())"
  npm run cli -- unrank --n 3 --rank 0002
  npm run cli -- prefix --n 3 --prefix "("
  npm run cli -- page   --n 3 --start 0 --limit 2
  npm run cli -- history [--type rank] [--limit 20]
  npm run cli -- history --id 1
  npm run cli -- export  --id 1 [--out result.json]

排名从零开始，字典序规定 '(' < ')'。n 范围 0..200。
数据文件位于 data/reports.sqlite。
`);
    }
  } catch (error) {
    if (error instanceof AppError) {
      console.error(JSON.stringify({ error: { code: error.code, message: error.message, detail: error.detail } }, null, 2));
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

main();

# 平衡括号序列计数与排名服务

固定对数（`n` 对，`0 ≤ n ≤ 200`）的合法（平衡）圆括号序列后端，只提供 **HTTP API** 与 **CLI**，无前端、无 Docker、无外部在线服务。

- 语言 / 运行时：TypeScript + Node.js（要求 Node ≥ 22.5，开发环境为 Node 25）
- 数据库：Node 内置 `node:sqlite`（`DatabaseSync`），数据库文件在项目内 `data/reports.sqlite`
- 计数与排名全程使用 `bigint`，对外以**十进制字符串**传输，不经过 `Number`，无精度损失

## 排序规则（重要）

- 字符只有 `(` 和 `)`，字典序规定 **`(` < `)`**。
- 排名是**从零开始**的：最小序列排名 `0`，最大序列排名 `总数 - 1`。
- `n = 0` 时唯一合法序列是空串 `""`，总数为 `1`，排名为 `0`。

例如 `n = 3` 的五个序列按顺序为：

| 排名 | 序列 |
| --- | --- |
| 0 | `((()))` |
| 1 | `(()())` |
| 2 | `(())()` |
| 3 | `()(())` |
| 4 | `()()()` |

## 算法

核心是一张「剩余位置 × 当前深度」的动态规划表（`src/dp.ts`）：

```
ways[0][0] = 1
ways[r][d] = ways[r-1][d+1]            // 放 '('
           + (d>0 ? ways[r-1][d-1] : 0) // 放 ')'
```

- 总数 = `ways[2n][0]`，即第 n 个卡特兰数。
- **排名**：扫描序列；某位选 `)`（较大字符）时，把该位放 `(` 的整批合法后缀数 `ways[r][d+1]` 累加为跳过量。
- **反排名**：逐位用剩余排名与左分支（放 `(`）计数比较；排名小于该计数则取 `(`，否则整批减去计数后取 `)`。
- **前缀区间**：合法前缀覆盖的序列在字典序中连续，区间起点为扫描前缀时累计的跳过量，终点为 `起点 + 剩余完成数 - 1`。
- **分页**：直接按排名用反排名构造每个序列，窗口大小有上限（默认 `1000`），与「全量枚举」无关。

不生成、不排序全部序列，不使用任何组合排名第三方库。

## 输入规范化

- 排名接受十进制字符串：空串报错；前导零会被规范（如 `0002 → 2`），结果中同时保留 `rankOriginal`（原值）与 `rankCanonical`（规范值）。
- `n` 接受整数或十进制整数字符串，范围 `0..200`，超范围拒绝。

## 错误码

| code | 含义 |
| --- | --- |
| `INVALID_N` / `N_TOO_LARGE` | n 缺失、非整数或超出 0..200 |
| `INVALID_CHARS` | 序列含 `(` `)` 以外字符 |
| `LENGTH_MISMATCH` | 序列长度不等于 `2n` |
| `UNBALANCED_SEQUENCE` | 中途跌破零深度或最终不闭合 |
| `INVALID_RANK` / `NEGATIVE_RANK` / `RANK_OUT_OF_RANGE` | 排名语法、负数、超 `[0, total-1]` |
| `PREFIX_SYNTAX`（status=`syntax-invalid`） | 前缀含非法字符 |
| status=`too-many-parens` | 前缀中某类括号数量已超过 n |
| status=`below-zero` | 前缀已使深度跌破 0 |
| `INVALID_LIMIT` / `LIMIT_TOO_LARGE` | 分页数量非法或超过 1000 |
| `NOT_FOUND` / `BAD_REQUEST` | 报告不存在 / 请求格式错误 |

前缀合法时 status 为 `extendable`（还能继续）或 `complete`（恰好完整，区间退化为单点）。

## 安装、构建、测试

```powershell
npm install
npm run build     # tsc 编译到 dist/
npm test          # node:test，小 n 穷举交叉核对 + SQLite 持久化测试
```

## 启动 HTTP 服务

```powershell
npm start         # 默认监听 127.0.0.1 的一个空闲端口，启动时打印实际端口
```

指定端口或数据库路径：

```powershell
$env:PORT=8080; $env:DB_PATH='data/reports.sqlite'; npm start
```

### API

所有查询接口接受 `POST` JSON（`/api/count`、`/api/page` 也支持 `GET` 查询串）。响应统一为：

```json
{ "reportId": 12, "algoVersion": "dp-ways-v1", "queryType": "rank", "params": {...}, "result": {...} }
```

| 路径 | 入参 | 说明 |
| --- | --- | --- |
| `/api/count` | `n` | 合法序列总数 |
| `/api/rank` | `n`, `sequence` | 序列 → 零基排名，含逐步解释 |
| `/api/unrank` | `n`, `rank` | 排名 → 序列，含逐步解释 |
| `/api/prefix` | `n`, `prefix` | 可完成性、剩余完成数、连续排名区间 |
| `/api/page` | `n`, `start`, `limit` | 窗口浏览，返回 `nextStart` / `reachedEnd` |
| `/history` | `?type=&limit=` | 历史报告列表（倒序） |
| `/history/{id}` | — | 读取单条历史报告 |
| `/health` | — | 健康检查 |

示例：

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/count -Method Post -ContentType 'application/json' -Body '{"n":3}'
Invoke-RestMethod http://127.0.0.1:8080/api/rank  -Method Post -ContentType 'application/json' -Body '{"n":3,"sequence":"(()())"}'
Invoke-RestMethod http://127.0.0.1:8080/api/unrank -Method Post -ContentType 'application/json' -Body '{"n":50,"rank":"0001978261657756160653623774454"}'
Invoke-RestMethod http://127.0.0.1:8080/api/prefix -Method Post -ContentType 'application/json' -Body '{"n":3,"prefix":"(()"}'
Invoke-RestMethod http://127.0.0.1:8080/api/page -Method Post -ContentType 'application/json' -Body '{"n":3,"start":"0","limit":2}'
```

每次查询都会向 SQLite 写入一条新报告（参数、算法版本、查询类型、结果快照）；修改条件生成新记录，**从不覆盖旧结果**。

## CLI

```powershell
npm run cli -- count  --n 3
npm run cli -- rank   --n 3 --sequence "(()())"
npm run cli -- unrank --n 3 --rank 0002
npm run cli -- prefix --n 3 --prefix "(()"
npm run cli -- page   --n 3 --start 0 --limit 2
npm run cli -- history --type rank --limit 20
npm run cli -- history --id 1
npm run cli -- export  --id 1 --out result.json
```

## 演示

```powershell
npm run demo
```

演示内容：`n=3` 五个序列的 0..4 排名与反排名互证；`n=50` 的大整数总数
（`1978261657756160653623774456`）、靠后排名（前导零规范化）的直接反排名、跨终点最后一页，以及前缀区间。
整个过程不枚举序列。

## 目录结构

```
src/
  dp.ts       # DP 计数表、参数/序列校验、BigInt 规范化
  rank.ts     # 排名与反排名（含逐步解释）
  prefix.ts   # 前缀可完成性与连续区间
  page.ts     # 有限窗口分页
  db.ts       # SQLite 报告存取
  service.ts  # 查询编排与报告落库
  server.ts   # HTTP API
  cli.ts      # 命令行
scripts/demo.ts
test/         # node:test：穷举互证、边界、错误、分页、持久化重启
data/         # SQLite 数据目录（运行后生成）
```

## 限制与假设

- 仅圆括号 `(` `)`；`n` 最大 200（C₂₀₀ 约 118 位十进制数，BigInt 直接承载）。
- 单页最多 `1000` 条，防止天文数量枚举；需要更长列表时用 `nextStart` 翻页。
- `node:sqlite` 在当前 Node 版本仍标记为 experimental，启动时会有一条实验性警告，功能不受影响。
- 历史中的 `prefix` 非法情形不抛 HTTP 错误，而是返回 `completable:false` 与分类 `status`，便于区分情形。

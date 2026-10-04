# 平衡括号序列计数与排名/反排名后端

TypeScript + Node.js + SQLite（`node:sqlite`，无原生依赖、无 Docker），只做 API 与 CLI。

## 规则

- 只含 `(` 与 `)`，字典序 **`(` < `)`**，排名**从零开始**。
- `n` 为括号对数，范围 `0..200`；`n=0` 时空序列是唯一合法结果（排名 0）。
- 计数与排名一律使用 BigInt，以十进制字符串传输，不经过 Number，无精度丢失。
- 核心算法：在（剩余位置， 当前深度）上做 DP 后缀计数 `ways[rem][d]`；排名时累计字典序更小分支（左分支）的合法后缀数，反排名时按分支计数整批跳过。不生成全部序列，也不逐个跳过。

## 构建 / 测试 / 启动 / 演示

```powershell
npm install
npm run build     # 编译到 dist/
npm test          # 构建并运行全部自动化测试
npm start         # 启动 API（默认端口 0 = 自动选空闲端口，PORT 环境变量可指定）
npm run demo      # n=3 五个序列排名 + n=50 大整数演示
```

数据目录为项目内 `data/`，SQLite 文件 `data/reports.db`，保存每次查询的参数（含原始输入与规范化值）、算法版本、查询类型与结果快照（JSON），修改条件会生成新报告，不覆盖旧报告，重启后仍可读取。

## CLI

```powershell
node dist/src/cli.js count  --n 50
node dist/src/cli.js rank   --n 3 --seq "()(())"
node dist/src/cli.js unrank --n 3 --rank 0003 --steps
node dist/src/cli.js prefix --n 3 --prefix "()"
node dist/src/cli.js page   --n 3 --start 3 --limit 4
node dist/src/cli.js history --limit 10
node dist/src/cli.js report  --id 1
node dist/src/cli.js serve   --port 8080
```

规范化规则：空输入视为 `0`；排名前导零去掉（`"0003"` → `"3"`），报告中同时保留原始输入与规范值。

## API

均返回 JSON；出错时为 `{"error":{"code","message"}}`，HTTP 400。

- `GET /api/count?n=50` → 合法序列总数
- `GET /api/rank?n=3&seq=()(())` → 零基排名 + 每步解释（选择字符前深度、左分支可完成数、跳过数、累计排名）
- `GET /api/unrank?n=3&rank=3` → 还原序列 + 每步解释（深度、左分支数、所选字符、跳过数、剩余排名）
- `GET /api/prefix?n=3&prefix=()` → 前缀是否可完成、剩余完成数、全局排名连续区间 `[start, end)`
- `GET /api/page?n=3&start=0&limit=10` → 有限窗口浏览（`limit` 上限 100），返回 `next` 作为下一页起点，末尾为 `null`
- `GET /api/reports` / `GET /api/reports/:id` → 历史报告列表 / 单条导出（结果为 JSON 快照）

前缀状态：`VALID_OPEN`（可继续）、`VALID_COMPLETE`（已完整）、`INVALID_CHAR`、`EXCEEDS_N`（数量超出 n）、`BELOW_ZERO`（右括号多于左括号）。

错误码：`N_OUT_OF_RANGE`、`INVALID_CHAR`、`LENGTH_MISMATCH`、`NEGATIVE_RANK`、`RANK_OUT_OF_RANGE`、`PREFIX_BELOW_ZERO`、`PREFIX_EXCEEDS_N`、`LIMIT_EXCEEDED`、`INVALID_PARAMS`。

## 演示结果

n=3 共 5 个序列，排名 0..4：

```
0 ((()))
1 (()())
2 (())()
3 ()(())
4 ()()()
```

n=50 总数 `1978261657756160653623774456`（第 50 个 Catalan 数），对靠后排名 `…762111` 直接反排名再回算排名一致，全程 DP 整批跳过，非全量枚举。

## 测试

`test/core.test.ts`：小 n（0..4）与独立穷举过滤全部括号串核对总数、顺序、排名、反排名与前缀区间；手工核对 n=0/1/2；覆盖非法前缀、边界排名、跨终点整页、数量超限、超大 n 拒绝、分页无重叠遗漏、SQLite 重开后旧报告可读。

## 限制

- n 上限 200（DP 表 O(n²)，可继续放大但无必要）。
- 单进程服务，未做并发写优化与鉴权，仅供本地使用。
- `node:sqlite` 在 Node 25 仍打印 ExperimentalWarning，不影响功能。

/**
 * ESLint 压制数「只减不增」棘轮：按规则汇总 eslint-suppressions.json 里的 count，与基线比较。
 * 默认走告警档（退出码 0，GitHub Actions 里输出 ::warning::），--strict 才硬失败；
 * 基线或压制文件缺失 / 非法属于配置错误，无条件硬失败。
 *
 * 配置（改下面的常量，或用 CLI 参数覆盖）：
 *   ROOT                项目根，默认为本文件上一级；--root 覆盖
 *   SUPPRESSIONS_FILE   ESLint 生成的压制文件，默认 <root>/eslint-suppressions.json；--suppressions 覆盖
 *   BASELINE_FILE       基线，默认 <root>/scripts/eslint-suppressions-baseline.json；--baseline 覆盖
 *   RUN_HINT            提示里展示的本脚本调用命令（按包管理器改，如 `pnpm lint:suppressions`）
 *
 * 用法：
 *   node scripts/check-eslint-suppressions.mjs                        检查
 *   node scripts/check-eslint-suppressions.mjs --update               有规则下调后改写基线（有上升时拒绝）
 *   node scripts/check-eslint-suppressions.mjs --update --allow-increase
 *       首次生成基线，或在提交说明里写明理由后接受上升
 *
 * 前置：ESLint >= 9.24，先 `npx eslint . --suppress-all` 生成 eslint-suppressions.json。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUPPRESSIONS_FILE = 'eslint-suppressions.json';
const BASELINE_FILE = 'scripts/eslint-suppressions-baseline.json';
const RUN_HINT = 'npm run lint:suppressions --';

/** 按规则汇总 count：{ 规则: 总数 }。 */
export function totalsByRule(suppressions) {
  const totals = {};
  for (const rules of Object.values(suppressions)) {
    for (const [rule, entry] of Object.entries(rules)) {
      totals[rule] = (totals[rule] ?? 0) + entry.count;
    }
  }
  return totals;
}

/** 纯判定：increased 含新规则（基线为 0），decreased 含已消失规则（当前为 0）。 */
export function compareTotals(current, baseline) {
  const increased = [];
  const decreased = [];
  for (const rule of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const now = current[rule] ?? 0;
    const before = baseline[rule] ?? 0;
    if (now > before)
      increased.push({ rule, baseline: before, current: now, isNew: !(rule in baseline) });
    else if (now < before) decreased.push({ rule, baseline: before, current: now });
  }
  const byRule = (a, b) => a.rule.localeCompare(b.rule);
  return { increased: increased.sort(byRule), decreased: decreased.sort(byRule) };
}

export function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label}缺失或不是合法 JSON：${path}（${error.message}）`);
  }
}

export function parseArgs(argv) {
  const args = { strict: false, update: false, allowIncrease: false, root: ROOT };
  let suppressions;
  let baseline;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--update') args.update = true;
    else if (arg === '--allow-increase') args.allowIncrease = true;
    else if (arg === '--root') args.root = resolve(argv[++i]);
    else if (arg === '--suppressions') suppressions = resolve(argv[++i]);
    else if (arg === '--baseline') baseline = resolve(argv[++i]);
    else throw new Error(`未知参数 ${arg}`);
  }
  args.suppressions = suppressions ?? join(args.root, SUPPRESSIONS_FILE);
  args.baseline = baseline ?? join(args.root, BASELINE_FILE);
  return args;
}

const sum = (totals) => Object.values(totals).reduce((a, b) => a + b, 0);

/** 执行检查并返回退出码。 */
export function run(argv, env = process.env) {
  let args;
  let current;
  let baseline;
  try {
    args = parseArgs(argv);
    current = totalsByRule(readJson(args.suppressions, 'ESLint 压制文件'));
    // 首次生成：--update --allow-increase 且基线文件不存在时，从空基线起算
    baseline =
      args.update && args.allowIncrease && !existsSync(args.baseline)
        ? {}
        : readJson(args.baseline, '压制基线');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 1;
  }

  const { increased, decreased } = compareTotals(current, baseline);

  if (args.update) {
    if (increased.length > 0 && !args.allowIncrease) {
      console.error('❌ --update 只允许下调；以下规则高于基线，拒绝写入（确需上调请加 --allow-increase）：');
      for (const r of increased) console.error(`  - ${r.rule}：${r.baseline} → ${r.current}`);
      return 1;
    }
    const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(args.baseline, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`✅ 已写入基线 ${args.baseline}：${Object.keys(sorted).length} 条规则，总 count ${sum(sorted)}`);
    return 0;
  }

  if (increased.length > 0) {
    console.error(`${args.strict ? '❌' : '⚠️'} ESLint 压制数超过基线，共 ${increased.length} 条规则：`);
    for (const r of increased) {
      const delta = r.current - r.baseline;
      console.error(`- ${r.rule}：${r.baseline} → ${r.current}（+${delta}${r.isNew ? '，基线中没有的新规则' : ''}）`);
      if (!args.strict && env.GITHUB_ACTIONS) {
        console.log(`::warning file=eslint-suppressions.json::压制数超出基线：${r.rule} +${delta}（${r.baseline} → ${r.current}）`);
      }
    }
    console.error(
      `处理：优先修掉新违规而不是压制；确属必要时，在同一提交里用 \`${RUN_HINT} --update --allow-increase\` 更新基线，并在提交说明里写理由。`,
    );
    return args.strict ? 1 : 0;
  }

  if (decreased.length > 0) {
    console.log(`💡 以下规则压制数已低于基线，可下调（${RUN_HINT} --update）：`);
    for (const r of decreased) {
      console.log(`  - ${r.rule}：${r.baseline} → ${r.current}${r.current === 0 ? '（已清零）' : ''}`);
    }
  }
  console.log(`✅ ESLint 压制数未超基线；${Object.keys(current).length} 条规则，总 count ${sum(current)}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}

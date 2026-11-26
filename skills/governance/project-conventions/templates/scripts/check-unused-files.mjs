/**
 * 死文件棘轮：用 knip（只开 files 类型）找出没有任何入口可达的文件，与基线比较，
 * 只阻止新增，存量写在基线文件里。
 * 默认走告警档（退出码 0，GitHub Actions 里输出 ::warning::），--strict 才硬失败；
 * knip 执行失败、输出不是合法 JSON、基线缺失或非法属于配置错误，无条件硬失败。
 *
 * 配置（改下面的常量，或用 CLI 参数覆盖）：
 *   ROOT          项目根，默认为本文件上一级；--root 覆盖
 *   BASELINE_FILE 基线，默认 <root>/scripts/knip-files-baseline.json；--baseline 覆盖
 *   KNIP_COMMAND  运行 knip 的命令前缀（按包管理器改：pnpm 用 ['pnpm','exec','knip']）
 *   RUN_HINT      提示里展示的本脚本调用命令
 *   入口与忽略规则写在项目根 knip.json（见 knip.example.json）。
 *
 * 用法：
 *   node scripts/check-unused-files.mjs                          检查
 *   node scripts/check-unused-files.mjs --update                 收缩基线（出现基线外新文件时拒绝）
 *   node scripts/check-unused-files.mjs --update --allow-increase   首次生成基线，或写明理由后扩大
 * --update 写基线时会剔除 git 未跟踪的文件；目录不在 git 仓库内时视为全部已跟踪。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_FILE = 'scripts/knip-files-baseline.json';
const KNIP_COMMAND = ['npx', '--no-install', 'knip'];
const RUN_HINT = 'npm run lint:unused-files --';

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 从 knip --reporter json 的输出里取出未被引用的文件路径（排序去重）。 */
export function parseKnipFiles(report) {
  if (!report || !Array.isArray(report.issues)) {
    throw new Error('knip JSON 输出缺少 issues 数组');
  }
  const files = report.issues.filter((i) => Array.isArray(i.files) && i.files.length > 0);
  return [...new Set(files.map((i) => i.file))].sort(byPath);
}

/** 纯判定：added 为基线外的新死文件，removed 为基线里已被删除或重新被引用的文件。 */
export function compareFiles(current, baseline) {
  const cur = new Set(current);
  const base = new Set(baseline);
  return {
    added: current.filter((f) => !base.has(f)).sort(byPath),
    removed: baseline.filter((f) => !cur.has(f)).sort(byPath),
  };
}

/** 纯判定：--update 的结果。有新增且未授权时拒绝。 */
export function planUpdate(current, baseline, allowIncrease) {
  const { added, removed } = compareFiles(current, baseline);
  if (added.length > 0 && !allowIncrease) return { ok: false, added, removed, next: baseline };
  return { ok: true, added, removed, next: [...current].sort(byPath) };
}

export function readBaseline(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`死文件基线缺失或不是合法 JSON：${path}（${error.message}）`);
  }
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`死文件基线必须是路径字符串数组：${path}`);
  }
  return value;
}

export function parseArgs(argv) {
  const args = { strict: false, update: false, allowIncrease: false, root: ROOT };
  let baseline;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--update') args.update = true;
    else if (arg === '--allow-increase') args.allowIncrease = true;
    else if (arg === '--root') args.root = resolve(argv[++i]);
    else if (arg === '--baseline') baseline = resolve(argv[++i]);
    else throw new Error(`未知参数 ${arg}`);
  }
  args.baseline = baseline ?? join(args.root, BASELINE_FILE);
  return args;
}

function listDeadFiles(root) {
  const [cmd, ...rest] = KNIP_COMMAND;
  const result = spawnSync(cmd, [...rest, '--include', 'files', '--reporter', 'json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`无法运行 knip：${result.error.message}`);
  // knip 有 issue 时退出码为 1，属正常；其余退出码或无法解析的输出才算执行失败
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `knip 执行失败（退出码 ${result.status}），输出不是合法 JSON：\n${(result.stderr || result.stdout).slice(0, 2000)}`,
    );
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`knip 异常退出（退出码 ${result.status}）：\n${result.stderr.slice(0, 2000)}`);
  }
  return parseKnipFiles(report);
}

/** 返回已跟踪文件集合；不在 git 仓库内返回 null（调用方视为全部已跟踪）。 */
function trackedFiles(root) {
  const result = spawnSync('git', ['ls-files', '-z', '--', '.'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) return null;
  return new Set(result.stdout.split('\0').filter(Boolean));
}

/** 执行检查并返回退出码；deps 供测试注入 knip 与 git 的结果。 */
export function run(argv, env = process.env, deps = { listDeadFiles, trackedFiles }) {
  let args;
  let current;
  let baseline;
  try {
    args = parseArgs(argv);
    current = deps.listDeadFiles(args.root);
    baseline =
      args.update && args.allowIncrease && !existsSync(args.baseline)
        ? []
        : readBaseline(args.baseline);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 1;
  }

  if (args.update) {
    // 基线只记已提交的文件：在途的未跟踪文件不进基线
    const tracked = deps.trackedFiles(args.root);
    const kept = tracked ? current.filter((f) => tracked.has(f)) : current;
    const untracked = current.filter((f) => !kept.includes(f));
    const plan = planUpdate(kept, baseline, args.allowIncrease);
    if (!plan.ok) {
      console.error('❌ --update 只允许缩小；以下死文件不在基线里，拒绝写入（确需扩大请加 --allow-increase）：');
      for (const f of plan.added) console.error(`  - ${f}`);
      return 1;
    }
    writeFileSync(args.baseline, `${JSON.stringify(plan.next, null, 2)}\n`);
    console.log(`✅ 已写入基线 ${args.baseline}：${plan.next.length} 个文件`);
    if (untracked.length > 0) {
      console.log(`ℹ️ 已排除 ${untracked.length} 个未跟踪文件：`);
      for (const f of untracked) console.log(`  - ${f}`);
    }
    return 0;
  }

  const { added, removed } = compareFiles(current, baseline);

  if (added.length > 0) {
    console.error(`${args.strict ? '❌' : '⚠️'} 出现 ${added.length} 个基线外的未引用文件（死文件）：`);
    for (const f of added) {
      console.error(`- ${f}`);
      if (!args.strict && env.GITHUB_ACTIONS) {
        console.log(`::warning file=${f}::未被任何入口引用的新文件（knip files）`);
      }
    }
    console.error(
      '处理：接上引用或删除；若确属运行时动态加载的入口，把它登记进 knip.json 的 entry；' +
        `确需冻结为存量时，在同一提交里用 \`${RUN_HINT} --update --allow-increase\` 并写明理由。`,
    );
    return args.strict ? 1 : 0;
  }

  if (removed.length > 0) {
    console.log(`💡 基线里有 ${removed.length} 个文件已被删除或重新被引用，可收缩基线（${RUN_HINT} --update）：`);
    for (const f of removed) console.log(`  - ${f}`);
  }
  console.log(`✅ 没有新增死文件；存量基线 ${baseline.length} 个，当前 ${current.length} 个`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}

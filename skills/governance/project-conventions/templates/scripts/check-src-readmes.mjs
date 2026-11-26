/**
 * 源码目录 README 白名单：源码目录下只允许白名单登记的 README。
 * 准入规则（只允许三类：指向 docs 正本的维护入口、目录边界规则、无法写注释的数据出处）
 * 见目标项目 docs 的「文档规范」。
 * 默认走告警档（退出码 0，GitHub Actions 里输出 ::warning::），--strict 才硬失败；
 * 白名单缺失或非法属于配置错误，无条件硬失败。
 *
 * 配置（改下面的常量，或用 CLI 参数覆盖）：
 *   ROOT            项目根，默认为本文件上一级；--root 覆盖
 *   SRC_DIR         扫描的源码目录（相对 ROOT），默认 src；--src 覆盖
 *   ALLOWLIST_FILE  白名单，默认 scripts/src-readme-allowlist.json；--allowlist 覆盖
 *   DOCS_HINT       提示里指向的规范文档位置
 *   白名单内容是相对 ROOT 的 README 路径数组（见 src-readme-allowlist.example.json）。
 *
 * 用法：
 *   node scripts/check-src-readmes.mjs [--strict]   检查
 *   node scripts/check-src-readmes.mjs --init       首次接入：把当前所有 README 写成白名单（已存在白名单时拒绝）
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = 'src';
const ALLOWLIST_FILE = 'scripts/src-readme-allowlist.json';
const DOCS_HINT = 'docs/ 下对应领域';

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 扫描 root/srcDir 下所有 README.md（大小写不敏感），返回相对 root 的排序路径，跳过 node_modules。 */
export function findSrcReadmes(root, srcDir = SRC_DIR) {
  const base = join(root, srcDir);
  if (!existsSync(base)) return [];
  return readdirSync(base, { recursive: true })
    .map((f) => `${srcDir}/${String(f).split('\\').join('/')}`)
    .filter((f) => /(^|\/)readme\.md$/i.test(f) && !f.split('/').includes('node_modules'))
    .sort(byPath);
}

/** 纯判定：unlisted 为白名单外的 README，missing 为白名单里已不存在的路径。 */
export function compareReadmes(found, allowlist) {
  const foundSet = new Set(found);
  const allowSet = new Set(allowlist);
  return {
    unlisted: found.filter((f) => !allowSet.has(f)).sort(byPath),
    missing: allowlist.filter((f) => !foundSet.has(f)).sort(byPath),
  };
}

export function readAllowlist(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`README 白名单缺失或不是合法 JSON：${path}（${error.message}）`);
  }
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`README 白名单必须是路径字符串数组：${path}`);
  }
  return value;
}

export function parseArgs(argv) {
  const args = { strict: false, init: false, root: ROOT, src: SRC_DIR };
  let allowlist;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--init') args.init = true;
    else if (arg === '--root') args.root = resolve(argv[++i]);
    else if (arg === '--src') args.src = argv[++i];
    else if (arg === '--allowlist') allowlist = resolve(argv[++i]);
    else throw new Error(`未知参数 ${arg}`);
  }
  args.allowlist = allowlist ?? join(args.root, ALLOWLIST_FILE);
  return args;
}

function initAllowlist(args) {
  if (existsSync(args.allowlist)) {
    console.error(`❌ 白名单已存在：${args.allowlist}；--init 只用于首次接入`);
    return 1;
  }
  const found = findSrcReadmes(args.root, args.src);
  writeFileSync(args.allowlist, `${JSON.stringify(found, null, 2)}\n`);
  console.log(`✅ 已写入白名单 ${args.allowlist}：${found.length} 份。逐份确认属于三类准入，其余迁 docs 后删除并从白名单移除`);
  return 0;
}

/** 执行检查并返回退出码。 */
export function run(argv, env = process.env) {
  let args;
  let allowlist;
  try {
    args = parseArgs(argv);
    if (args.init) return initAllowlist(args);
    allowlist = readAllowlist(args.allowlist);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 1;
  }
  const found = findSrcReadmes(args.root, args.src);
  const { unlisted, missing } = compareReadmes(found, allowlist);
  const mark = args.strict ? '❌' : '⚠️';
  const warn = !args.strict && env.GITHUB_ACTIONS;

  if (unlisted.length > 0) {
    console.error(`${mark} 出现 ${unlisted.length} 份不在白名单的源码目录 README：`);
    for (const f of unlisted) {
      console.error(`- ${f}`);
      if (warn) console.log(`::warning file=${f}::源码目录 README 不在白名单`);
    }
    console.error(
      `处理：功能介绍、文件清单、业务合同、运维步骤迁到 ${DOCS_HINT} 的正本并删除该 README；` +
        `确属维护入口、目录边界规则或无法注释的数据出处，登记到 ${ALLOWLIST_FILE}。`,
    );
  }
  if (missing.length > 0) {
    console.error(`${mark} 白名单里有 ${missing.length} 个文件已不存在，请从白名单移除：`);
    for (const f of missing) {
      console.error(`- ${f}`);
      if (warn) console.log(`::warning file=${ALLOWLIST_FILE}::白名单项已不存在：${f}`);
    }
  }
  if (unlisted.length > 0 || missing.length > 0) return args.strict ? 1 : 0;

  console.log(`✅ 源码目录 README 与白名单一致（${found.length} 份）`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}

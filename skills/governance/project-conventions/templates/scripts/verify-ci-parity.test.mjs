/**
 * 断言：CI 工作流里跑的每个检查，verify.mjs 的 CHECKS 都覆盖；CHECKS 里的脚本都真实存在。
 *
 * 配置：
 *   WORKFLOW_FILES  要比对的 CI 工作流（相对项目根），多个工作流各自比对
 *   CI_ONLY         只属于 CI 的脚本（安装、构建、部署），不要求本地 verify 覆盖
 *   COVERED_BY      CI 用的变体脚本 -> verify 里实际跑的脚本（例如 CI 并发参数不同的聚合入口）
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CHECKS } from './verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_FILES = ['.github/workflows/ci.yml'];
const CI_ONLY = new Set(['build', 'deploy']);
const COVERED_BY = {};

/** 取出工作流里 `npm|pnpm|yarn [run] <script>` 调起的脚本名。 */
export function extractCiScripts(workflow) {
  const scripts = new Set();
  const body = workflow.replace(/^\s*#.*$/gm, '');
  for (const m of body.matchAll(/\b(?:npm|pnpm|yarn)[ \t]+(?:run[ \t]+)?([A-Za-z][\w:.-]*)/g)) scripts.add(m[1]);
  // 包管理器自带子命令不是脚本
  for (const builtin of ['ci', 'install', 'i', 'exec', 'dlx', 'run', 'cache', 'config']) scripts.delete(builtin);
  return scripts;
}

test('extractCiScripts：识别 npm/pnpm/yarn 写法并排除内置子命令', () => {
  const yml = 'run: npm ci\nrun: pnpm run lint:x\nrun: yarn typecheck\nrun: npm test\nrun: pnpm exec foo';
  assert.deepEqual([...extractCiScripts(yml)].sort(), ['lint:x', 'test', 'typecheck']);
});

test('verify 覆盖 CI 会跑的每一条检查（否则本地会假绿）', () => {
  const local = new Set(CHECKS.map((c) => c.script));
  for (const file of WORKFLOW_FILES) {
    const ciScripts = extractCiScripts(readFileSync(resolve(ROOT, file), 'utf8'));
    assert.ok(ciScripts.size > 0, `${file} 没解析出任何检查命令，解析规则需要调整`);
    for (const script of ciScripts) {
      if (CI_ONLY.has(script)) continue;
      assert.ok(local.has(COVERED_BY[script] ?? script), `${file} 的 ${script} 没有进 verify.mjs 的 CHECKS（本地会假绿）`);
    }
  }
});

test('CHECKS 里的脚本都在 package.json 里存在', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  for (const { script } of CHECKS) {
    assert.ok(existsSync(resolve(ROOT, 'package.json')) && pkg.scripts?.[script], `package.json 缺少脚本 ${script}`);
  }
});

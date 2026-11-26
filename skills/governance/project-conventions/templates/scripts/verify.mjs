#!/usr/bin/env node
/**
 * 本地跑一遍 CI 会跑的全部检查，推送前用。
 *
 * 存在的理由是往返成本：CI 一轮要几分钟，红了修完再推又是几分钟，本机热缓存只要一小部分。
 * CHECKS 必须与 CI 工作流里的检查步骤一致，由 verify-ci-parity.test.mjs 机械比对——
 * CI 加了检查而这里没加，本地就会「全绿、CI 照样红」，比没有这个脚本更糟。
 *
 * 配置：
 *   PACKAGE_MANAGER  npm | pnpm | yarn，决定怎样调起 package.json 脚本
 *   CHECKS           检查清单，name 用于汇总展示，script 是 package.json 脚本名；按顺序执行
 *                    （告警档检查退出码为 0，不会拖红汇总，输出里的 ⚠️ 要自己看）
 *
 * 全部跑完再汇总，不在第一条失败时中止：一次看到全部问题，才不用修一条推一次。
 * 用法：node scripts/verify.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_MANAGER = 'npm';

/** @type {{ name: string, script: string }[]} */
export const CHECKS = [
  { name: 'typecheck', script: 'typecheck' },
  { name: 'lint', script: 'lint' },
  { name: 'test', script: 'test' },
  { name: 'suppressions', script: 'lint:suppressions' },
  { name: 'unused-files', script: 'lint:unused-files' },
  { name: 'src-readmes', script: 'lint:src-readmes' },
];

function runCheck({ name, script }) {
  const startedAt = Date.now();
  const result = spawnSync(PACKAGE_MANAGER, ['run', script], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // Windows 上 npm/pnpm 是 .cmd，需交给 cmd.exe 解析；脚本名来自上面的固定清单
    shell: process.platform === 'win32',
  });
  const ok = result.status === 0;
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`${ok ? '✓' : '✗'} ${name.padEnd(20)} ${seconds}s\n`);
  return { name, script, ok, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}` };
}

/** 顺序执行并汇总，返回退出码。 */
export function runAll(checks = CHECKS) {
  const results = checks.map(runCheck);
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    process.stdout.write(`\n全部 ${results.length} 项通过\n`);
    return 0;
  }
  for (const r of failed) {
    process.stdout.write(`\n${'='.repeat(70)}\n✗ ${r.name}（${PACKAGE_MANAGER} run ${r.script}）\n\n${r.output.trimEnd()}\n`);
  }
  process.stdout.write(`\n${failed.length}/${results.length} 项失败\n`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runAll());
}

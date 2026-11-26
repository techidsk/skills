// 配置：无。用 node:test + 临时目录，裸跑 `node --test`，不依赖项目其他设施。
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { compareTotals, run, totalsByRule } from './check-eslint-suppressions.mjs';

const supp = (n) => ({
  'src/a.ts': { 'no-console': { count: n }, 'no-var': { count: 1 } },
  'src/b.ts': { 'no-console': { count: 2 } },
});

function setup(suppressions, baseline) {
  const root = mkdtempSync(join(tmpdir(), 'supp-'));
  const suppressionsPath = join(root, 'eslint-suppressions.json');
  const baselinePath = join(root, 'baseline.json');
  writeFileSync(suppressionsPath, JSON.stringify(suppressions));
  if (baseline) writeFileSync(baselinePath, JSON.stringify(baseline));
  return { suppressionsPath, baselinePath, args: ['--suppressions', suppressionsPath, '--baseline', baselinePath] };
}

function quiet(argv, env = {}) {
  const logs = [];
  const errs = [];
  const [log, error] = [console.log, console.error];
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  try {
    return { code: run(argv, env), logs, errs };
  } finally {
    [console.log, console.error] = [log, error];
  }
}

test('totalsByRule：跨文件按规则求和', () => {
  assert.deepEqual(totalsByRule(supp(3)), { 'no-console': 5, 'no-var': 1 });
});

test('compareTotals：区分上升、新规则与下降', () => {
  const r = compareTotals({ a: 3, c: 1 }, { a: 2, b: 4 });
  assert.deepEqual(r.increased.map((x) => [x.rule, x.isNew]), [['a', false], ['c', true]]);
  assert.deepEqual(r.decreased.map((x) => x.rule), ['b']);
});

test('持平：退出 0，输出 ✅', () => {
  const { args } = setup(supp(3), { 'no-console': 5, 'no-var': 1 });
  const r = quiet(args);
  assert.equal(r.code, 0);
  assert.match(r.logs.join('\n'), /✅/);
});

test('上升：告警档退出 0，--strict 退出 1，GITHUB_ACTIONS 输出 ::warning', () => {
  const { args } = setup(supp(5), { 'no-console': 5, 'no-var': 1 });
  const warn = quiet(args, { GITHUB_ACTIONS: 'true' });
  assert.equal(warn.code, 0);
  assert.match(warn.logs.join('\n'), /::warning/);
  assert.match(warn.errs.join('\n'), /⚠️/);
  const strict = quiet([...args, '--strict'], { GITHUB_ACTIONS: 'true' });
  assert.equal(strict.code, 1);
  assert.doesNotMatch(strict.logs.join('\n'), /::warning/);
});

test('配置错误（基线缺失）：无条件退出 1', () => {
  const { args } = setup(supp(1));
  assert.equal(quiet(args).code, 1);
});

test('--update：下调可写入，上升被拒，--allow-increase 放行并支持首次生成', () => {
  const { args, baselinePath } = setup(supp(1), { 'no-console': 9, 'no-var': 1 });
  assert.equal(quiet([...args, '--update']).code, 0);
  assert.deepEqual(JSON.parse(readFileSync(baselinePath, 'utf8')), { 'no-console': 3, 'no-var': 1 });

  const up = setup(supp(9), { 'no-console': 1 });
  assert.equal(quiet([...up.args, '--update']).code, 1);
  assert.equal(quiet([...up.args, '--update', '--allow-increase']).code, 0);

  const first = setup(supp(2));
  assert.equal(quiet([...first.args, '--update', '--allow-increase']).code, 0);
  assert.deepEqual(JSON.parse(readFileSync(first.baselinePath, 'utf8')), { 'no-console': 4, 'no-var': 1 });
});

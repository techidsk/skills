// 配置：无。纯函数直接测；run() 通过 deps 注入 knip 与 git 结果，不真正启动 knip。
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { compareFiles, parseKnipFiles, planUpdate, run } from './check-unused-files.mjs';

function quiet(argv, env, deps) {
  const logs = [];
  const errs = [];
  const [log, error] = [console.log, console.error];
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  try {
    return { code: run(argv, env, deps), logs, errs };
  } finally {
    [console.log, console.error] = [log, error];
  }
}

const deps = (dead, tracked = null) => ({
  listDeadFiles: () => dead,
  trackedFiles: () => (tracked ? new Set(tracked) : null),
});

function baselineFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'unused-'));
  const path = join(dir, 'baseline.json');
  if (content) writeFileSync(path, JSON.stringify(content));
  return path;
}

test('parseKnipFiles：只取带 files 问题的文件，去重排序；缺 issues 时抛错', () => {
  const report = {
    issues: [
      { file: 'src/b.ts', files: [{ name: 'src/b.ts' }] },
      { file: 'src/a.ts', files: [{ name: 'src/a.ts' }] },
      { file: 'src/c.ts', files: [], exports: [{ name: 'x' }] },
      { file: 'src/a.ts', files: [{ name: 'src/a.ts' }] },
    ],
  };
  assert.deepEqual(parseKnipFiles(report), ['src/a.ts', 'src/b.ts']);
  assert.throws(() => parseKnipFiles({}), /issues/);
});

test('compareFiles / planUpdate：新增需授权，缩小直接放行', () => {
  assert.deepEqual(compareFiles(['a', 'n'], ['a', 'gone']), { added: ['n'], removed: ['gone'] });
  assert.equal(planUpdate(['a', 'n'], ['a'], false).ok, false);
  assert.deepEqual(planUpdate(['a', 'n'], ['a'], true).next, ['a', 'n']);
  assert.deepEqual(planUpdate(['a'], ['a', 'gone'], false).next, ['a']);
});

test('新增死文件：告警档退出 0，--strict 退出 1，CI 输出 ::warning', () => {
  const baseline = baselineFile(['src/old.ts']);
  const d = deps(['src/old.ts', 'src/new.ts']);
  const warn = quiet(['--baseline', baseline], { GITHUB_ACTIONS: 'true' }, d);
  assert.equal(warn.code, 0);
  assert.match(warn.logs.join('\n'), /::warning file=src\/new\.ts/);
  assert.equal(quiet(['--baseline', baseline, '--strict'], {}, d).code, 1);
});

test('无新增：退出 0 并提示可收缩', () => {
  const baseline = baselineFile(['src/old.ts', 'src/gone.ts']);
  const r = quiet(['--baseline', baseline], {}, deps(['src/old.ts']));
  assert.equal(r.code, 0);
  assert.match(r.logs.join('\n'), /可收缩基线/);
});

test('基线缺失：配置错误，无条件退出 1', () => {
  assert.equal(quiet(['--baseline', baselineFile()], {}, deps([])).code, 1);
});

test('--update --allow-increase 首次生成基线，并排除未跟踪文件', () => {
  const baseline = baselineFile();
  const r = quiet(['--baseline', baseline, '--update', '--allow-increase'], {}, deps(['src/a.ts', 'src/wip.ts'], ['src/a.ts']));
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(readFileSync(baseline, 'utf8')), ['src/a.ts']);
  assert.match(r.logs.join('\n'), /src\/wip\.ts/);
});

test('--update 遇到基线外新增时拒绝', () => {
  const baseline = baselineFile(['src/a.ts']);
  assert.equal(quiet(['--baseline', baseline, '--update'], {}, deps(['src/a.ts', 'src/n.ts'])).code, 1);
});

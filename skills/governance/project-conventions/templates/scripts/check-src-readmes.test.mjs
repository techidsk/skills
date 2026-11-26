// 配置：无。用 node:test + 临时目录，裸跑 `node --test`。
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { compareReadmes, findSrcReadmes, run } from './check-src-readmes.mjs';

function fixture(readmes, allowlist) {
  const root = mkdtempSync(join(tmpdir(), 'src-readmes-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  for (const rel of readmes) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), '# x\n');
  }
  const allowPath = join(root, 'allow.json');
  if (allowlist) writeFileSync(allowPath, JSON.stringify(allowlist));
  return { root, args: ['--root', root, '--allowlist', allowPath] };
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

test('compareReadmes：多出一份与白名单项缺失', () => {
  const r = compareReadmes(['src/a/README.md', 'src/new/README.md'], ['src/a/README.md', 'src/gone/README.md']);
  assert.deepEqual(r.unlisted, ['src/new/README.md']);
  assert.deepEqual(r.missing, ['src/gone/README.md']);
});

test('findSrcReadmes：大小写不敏感，跳过 node_modules 与 src 之外', () => {
  const { root } = fixture(['src/a/README.md', 'src/b/readme.md', 'src/c/node_modules/x/README.md', 'docs/README.md', 'src/d/NOTES.md']);
  assert.deepEqual(findSrcReadmes(root), ['src/a/README.md', 'src/b/readme.md']);
});

test('一致：退出 0', () => {
  const { args } = fixture(['src/a/README.md'], ['src/a/README.md']);
  const r = quiet(args);
  assert.equal(r.code, 0);
  assert.match(r.logs.join('\n'), /✅/);
});

test('白名单外 README：告警档退出 0，--strict 退出 1，CI 输出 ::warning', () => {
  const { args } = fixture(['src/a/README.md', 'src/new/README.md'], ['src/a/README.md']);
  const warn = quiet(args, { GITHUB_ACTIONS: 'true' });
  assert.equal(warn.code, 0);
  assert.match(warn.logs.join('\n'), /::warning file=src\/new\/README\.md/);
  assert.equal(quiet([...args, '--strict']).code, 1);
});

test('白名单项已不存在：同样按告警档处理', () => {
  const { args } = fixture([], ['src/gone/README.md']);
  assert.equal(quiet(args).code, 0);
  assert.equal(quiet([...args, '--strict']).code, 1);
});

test('白名单缺失或非法：无条件退出 1', () => {
  assert.equal(quiet(fixture(['src/a/README.md']).args).code, 1);
  const { root } = fixture([]);
  const bad = join(root, 'bad.json');
  writeFileSync(bad, '{"not":"array"}');
  assert.equal(quiet(['--root', root, '--allowlist', bad]).code, 1);
});

test('--init：首次写入当前 README 清单，已存在白名单时拒绝', () => {
  const { root, args } = fixture(['src/a/README.md', 'src/b/README.md']);
  assert.equal(quiet([...args, '--init']).code, 0);
  assert.equal(quiet(args).code, 0);
  assert.equal(quiet([...args, '--init']).code, 1);
  assert.ok(root);
});

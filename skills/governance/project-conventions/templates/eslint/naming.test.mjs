// 配置：无需修改；规则 options 变化时同步补测试。运行：node --test naming.test.mjs
// 依赖：eslint、@typescript-eslint/parser
import { describe, it } from 'node:test';

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';

import { verbSynonyms, verbIo, bannedWords } from './naming.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser: tsParser } });
const invalid = (code, extra = {}) => ({ code, errors: 1, ...extra });

tester.run('verb-synonyms', verbSynonyms, {
  valid: [
    'function reader() {}',
    'async function GET() {}',
    'const fetch = 1;',
    'const useFetch = () => 1;',
    'function listener() {}',
    { code: 'function requireAuth() {}', options: [{ synonyms: ['require'], allowNames: ['requireAuth'] }] },
    { code: 'function fetchUser() {}', options: [{ synonyms: ['read'] }] },
  ],
  invalid: [
    invalid('function fetchUser() {}'),
    invalid('const readUser = () => 1;'),
    invalid('class X { findUser() {} }'),
    invalid('const queryUsers = cache(async () => []);'),
    invalid('const x = { computeTotal() {} };'),
    invalid('function requireConfig() {}', { options: [{ synonyms: ['require'] }] }),
  ],
});

tester.run('verb-io', verbIo, {
  valid: [
    'function getUser() {}',
    'async function loadUser() {}',
    'function listUsers(): Promise<User[]> {}',
    'const loadUser = cache(async () => 1);',
    'async function toggleMenu() {}',
    'async function generateMetadata() {}',
    'const getUser = 1;',
    'const load = 1;',
    'const loadUser = (async () => 1) satisfies Loader;',
    "import { cache as memo } from 'react'; const loadUser = memo(async () => 1);",
    { code: 'const loadUser = defineAction(() => 1);', options: [{ asyncWrappers: ['defineAction'] }] },
    { code: 'async function fetchThing() {}', options: [{ readVerbs: ['fetch'] }] },
  ],
  invalid: [
    invalid('async function getUser() {}'),
    invalid('function isUser(): Promise<boolean> {}'),
    invalid('const resolveUser = async () => 1;'),
    invalid('const hasUser = unstable_cache(async () => true);'),
    invalid('function loadUser() {}'),
    invalid('const listUsers = () => [];'),
    invalid('class X { async toBlob() {} }'),
    invalid('const getUser = function (): Promise<User> {};'),
    invalid('const x = { async getUser() {} };'),
    invalid("import { cache as memo } from 'react'; const getUser = memo(async () => 1);"),
    invalid('const getUser = defineAction(() => 1);', { options: [{ asyncWrappers: ['defineAction'] }] }),
  ],
});

const words = [{ word: 'Legacy', use: 'Archived' }];
const scoped = [{ word: 'Retire', use: 'purge', paths: ['/src/privacy/'], declarations: true }];
tester.run('banned-words', bannedWords, {
  valid: [
    'function listLegacyUsers() {}', // 未配置 words 时不拦
    { code: 'function listArchivedUsers() {}', options: [{ words }] },
    { code: 'const legacyFlag = true;', options: [{ words }] }, // 大小写敏感，且非函数
    { code: 'function loadRetireState() {}', options: [{ words: scoped }], filename: '/repo/src/other/a.ts' },
    { code: 'const { retireState: purgeState } = row;', options: [{ words: scoped }], filename: '/repo/src/privacy/a.ts' },
  ],
  invalid: [
    invalid('function listLegacyUsers() {}', { options: [{ words }] }),
    invalid('const loadLegacy = async () => 1;', { options: [{ words }] }),
    { code: 'function loadRetireState() {}', options: [{ words: scoped }], filename: '/repo/src/privacy/a.ts', errors: 1 },
    ...[
      'const { oldRetire } = row;',
      'function consume({ oldRetire }: Input) {}',
      'const [oldRetire] = row;',
      'type InputRetire = string;',
    ].map((code) => ({ code, options: [{ words: scoped }], filename: '/repo/src/privacy/a.ts', errors: 1 })),
  ],
});

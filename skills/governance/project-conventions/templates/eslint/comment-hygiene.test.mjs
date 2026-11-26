// 配置：无需修改。运行：node --test comment-hygiene.test.mjs
import { describe, it } from 'node:test';

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';

import { noAsNever, noTripleSlashComment } from './comment-hygiene.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser: tsParser } });

tester.run('no-as-never', noAsNever, {
  valid: [
    'const a = x as string;',
    'const a = <string>x;',
    'const _exhaustive: never = x;',
    'const a = x satisfies never;',
  ],
  invalid: [
    { code: 'const a = x as never;', errors: [{ messageId: 'asNever' }] },
    { code: 'const a = <never>x;', errors: [{ messageId: 'asNever' }] },
    { code: 'fn(x as never);', errors: [{ messageId: 'asNever' }] },
  ],
});

tester.run('no-triple-slash-comment', noTripleSlashComment, {
  valid: [
    '// 普通注释',
    '/** 文档注释 */\nconst a = 1;',
    '/// <reference types="node" />\nconst a = 1;',
    '/// <reference path="./x.d.ts" />\nconst a = 1;',
    'const url = "http://a/b"; // ok',
  ],
  invalid: [
    { code: '/// 说明\nconst a = 1;', errors: [{ messageId: 'tripleSlash' }] },
    { code: '/// 第一行\n/// 第二行\nconst a = 1;', errors: [{ messageId: 'tripleSlash' }] }, // 连续只报一次
    { code: '/// 一\nconst a = 1;\n/// 二\nconst b = 2;', errors: 2 },
  ],
});

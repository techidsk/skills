// 配置：无需修改。运行：node --test no-barrel-file.test.mjs
import { describe, it } from 'node:test';

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';

import rule from './no-barrel-file.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser: tsParser } });
const filename = '/app/src/modules/orders/index.ts';
const reexport = "export { order } from './order';";

tester.run('project/no-barrel-file', rule, {
  valid: [
    { code: '', filename },
    { code: "export { order } from './order'; export const version = 1;", filename }, // 含自有内容
    { code: reexport, filename: '/app/src/modules/orders/service.ts' }, // 非 index
    { code: reexport, filename: '/app/src/components/index.ts' }, // 不在检查范围
    { code: reexport, filename: '/app/src/modules/legacy/index.ts', options: [{ allow: ['/modules/legacy/'] }] },
    { code: reexport, filename: '/app/lib/foo/index.ts' }, // 默认 include 不含 lib
  ],
  invalid: [
    { code: reexport, filename, errors: [{ messageId: 'noBarrel' }] },
    { code: "export * from './a'; export type { T } from './b';", filename, errors: [{ messageId: 'noBarrel' }] },
    { code: "export * as orders from './order';", filename: '/app/src/modules/orders/index.tsx', errors: 1 },
    { code: reexport, filename: '/app/lib/foo/index.ts', options: [{ include: ['/lib/.+/index\\.ts$'] }], errors: 1 },
  ],
});

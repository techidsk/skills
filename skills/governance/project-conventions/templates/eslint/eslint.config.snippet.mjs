// 自定义规则注册 + 分层边界 zones 的完整示例（ESLint 9+/10 flat config）。
// 用法：把需要的段落并入目标项目的 eslint.config.mjs；本文件本身也可直接作为配置运行。
//
// 配置（落地时修改）：
//   1. RULES_DIR：自定义规则所在目录（默认 ./scripts/eslint-rules，与模板文件的存放位置一致）。
//   2. layerZones：把 `entry / modules / lib` 换成目标项目实际目录名（见 reference/architecture.md 的映射表）。
//   3. 路径别名：项目用 `@/` 之类别名时保留 resolver-next 段并确认 tsconfig 路径；纯相对路径可删。
//   4. 各规则 options：动词表、禁用词、barrel 豁免放在下方 `project/*` 条目里。
//   5. 存量违规：先 `npx eslint . --suppress-all` 生成 eslint-suppressions.json 冻结存量，只拦新增。
//
// 注意：flat config 中同名规则由后一个配置对象整体替换，不会合并数组。
// 因此 zones 只在一处声明（layerZones），要为专项限制加 zone 时展开它再追加，不要另写一份。

import path from 'node:path';

import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

import { noAsNever, noTripleSlashComment } from './scripts/eslint-rules/comment-hygiene.mjs';
import { verbSynonyms, verbIo, bannedWords } from './scripts/eslint-rules/naming.mjs';
import noBarrelFile from './scripts/eslint-rules/no-barrel-file.mjs';

const ROOT = import.meta.dirname;
const SRC = ['src/**/*.{ts,tsx}'];
const TESTS = ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'];

// 分层边界：target 不得 import from。方向为 entry -> modules -> lib（只能向右依赖）。
// 反向依赖的原因写进 message，让报错的人知道该怎么改，而不是只知道被拦了。
const layerZones = [
  {
    target: './src/modules',
    from: ['./src/app', './src/components'],
    message: 'modules 不能依赖入口层/UI：业务逻辑须独立于路由与组件树，才能被多个入口与脚本复用。',
  },
  {
    target: './src/lib',
    from: ['./src/modules', './src/app', './src/components'],
    message: 'lib 是无业务基础设施，不能依赖 modules/入口层。需要的能力下沉到 lib 或由调用方注入。',
  },
  {
    target: './src/components',
    from: './src/app',
    message: 'components 不能依赖 app：页面是调用方，共享实现应属于所属功能。',
  },
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      // 解析 tsconfig paths 别名（如 @/*）；没有别名可删除。
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: path.join(ROOT, 'tsconfig.json') })],
    },
  },

  // 1. 注册自定义规则：插件前缀统一为 `project/`，落地时可整体改名。
  {
    plugins: {
      project: {
        rules: {
          'no-as-never': noAsNever,
          'no-triple-slash-comment': noTripleSlashComment,
          'no-barrel-file': noBarrelFile,
          'verb-synonyms': verbSynonyms,
          'verb-io': verbIo,
          'banned-words': bannedWords,
        },
      },
    },
  },

  // 2. 编码与命名：业务源码启用，测试豁免命名类规则。
  {
    files: SRC,
    rules: {
      'project/no-triple-slash-comment': 'error',
      'project/no-as-never': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
      ],
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: SRC,
    ignores: TESTS,
    rules: {
      // 例外函数名（如登记过的鉴权门）放 allowNames；业务专有词放 banned-words。
      'project/verb-synonyms': ['error', { allowNames: [] }],
      // asyncWrappers 补项目里「返回 Promise」的包装函数，如项目自己的 action／handler 工厂。
      'project/verb-io': ['error', { asyncWrappers: ['cache', 'unstable_cache'] }],
      // 示例：词汇表规定统一用 `User`；paths 限定只在某目录生效。无禁用词时删除本行。
      'project/banned-words': ['error', { words: [{ word: 'Customer', use: 'User', paths: ['/src/modules/accounts/'] }] }],
      // include 默认只查 src/modules/**/index.ts；存量豁免写 allow 并注明理由。
      'project/no-barrel-file': ['error', { allow: [] }],
    },
  },

  // 3. 目录依赖边界（只声明一次）。
  {
    files: SRC,
    rules: {
      'import-x/no-restricted-paths': ['error', { basePath: ROOT, zones: layerZones }],
      // 循环依赖交给 dependency-cruiser（见 ../dependency-cruiser.cjs），这里不重复开 import-x/no-cycle。
    },
  },

  // 4. 顶层模块 barrel 的导入侧：只拦 `@/modules/<name>` 这种指向目录入口的写法。
  //    用 no-restricted-syntax 而非 no-restricted-imports：后者的 gitignore 语义里 `*` 会跨 `/`，
  //    会把 @/modules/orders/service 一并误拦。存量豁免改正则里的 (?!a$|b$) 分支。
  {
    files: SRC,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^@\\/modules\\/[^/]+$/]',
          message: '禁止导入模块目录入口（barrel）。请 import 到具体文件，如 @/modules/orders/service。',
        },
      ],
    },
  },

  // 5. 入口层禁止三层以上相对路径：需要 ../../../ 才能够到，说明共享代码停在了路由树里。
  //    必须展开第 4 段的 selector，否则本条会整体替换它（flat config 不合并同名规则）。
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^@\\/modules\\/[^/]+$/]',
          message: '禁止导入模块目录入口（barrel）。请 import 到具体文件，如 @/modules/orders/service。',
        },
        {
          selector:
            ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^(\\.\\.\\/){3,}/]',
          message: '禁止三层以上相对路径导入：把共享文件上浮到 src/components/<域>/ 后用别名导入。',
        },
      ],
    },
  },
);

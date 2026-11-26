// 函数命名规则：按「动词表」约束函数主词与同步/异步形态（语法级检查，不依赖类型信息）。
//
// 配置（落地时按项目调整）：
//   - DEFAULT_*：下方常量是默认动词表，可直接改常量，也可在 eslint.config 里用 options 覆盖。
//   - project/verb-synonyms  options: { synonyms, allowNames }
//       synonyms   被收敛的同义词主词（默认 fetch/find/read/lookup/query/compute/derive/pick/make/compose）
//       allowNames 例外函数名（精确匹配），例如登记过的鉴权门 requireAuth
//   - project/verb-io        options: { readVerbs, pureVerbs, asyncWrappers }
//       readVerbs     必须异步的读取主词（默认 load/list）
//       pureVerbs     必须同步的纯计算主词（默认 get/resolve/build/parse/normalize/format/to/is/has/can）
//       asyncWrappers 视为「返回 Promise」的包装函数（默认 cache/unstable_cache；按项目补充自己的 action／handler 工厂）
//   - project/banned-words   options: { words: [{ word, use, paths?, declarations? }] }
//       默认 words 为空（不拦任何词）；把项目词汇表里「禁用词 -> 统一用词」登记进来。
//       paths 是正则字符串数组，仅在匹配的文件路径生效；declarations: true 时除函数名外还检查
//       变量、类型、参数等声明名（解构时只看绑定名，不看来源键名，保留持久化字段名）。

const DEFAULT_SYNONYMS = [
  'fetch', 'find', 'read', 'lookup', 'query', 'compute', 'derive', 'pick', 'make', 'compose',
];
const DEFAULT_READ_VERBS = ['load', 'list'];
const DEFAULT_PURE_VERBS = [
  'get', 'resolve', 'build', 'parse', 'normalize', 'format', 'to', 'is', 'has', 'can',
];
const DEFAULT_ASYNC_WRAPPERS = ['cache', 'unstable_cache'];

// 主词后必须是大写字母、数字或结尾，避免 `reader`、`toggleMenu`、`listener` 被误伤。
const verbRegex = (verbs) => new RegExp(`^(?:${verbs.join('|')})(?:[A-Z0-9]|$)`);

const TRANSPARENT = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'ParenthesizedExpression',
]);
const FUNCTION_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
]);

function unwrap(node) {
  while (node && TRANSPARENT.has(node.type)) node = node.expression;
  return node;
}

function promiseReturn(node) {
  const type = node.returnType?.typeAnnotation;
  return (
    type?.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    type.typeName.name === 'Promise'
  );
}

// 返回 { async } 表示该值是函数（或异步包装调用）；非函数返回 null。
function functionValue(node, wrapperNames) {
  node = unwrap(node);
  if (!node) return null;
  if (FUNCTION_TYPES.has(node.type)) return { async: node.async || promiseReturn(node) };
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    wrapperNames.has(node.callee.name)
  )
    return { async: true };
  return null;
}

// 遍历所有「有名字的函数」声明形态，对每个名字调用 inspect(identifierNode, { async })。
function namedFunctions(asyncWrappers, inspect) {
  const wrapperNames = new Set(asyncWrappers);
  const watched = new Set(asyncWrappers);
  const named = (node, value) => {
    if (value && !node.computed && node.key.type === 'Identifier') inspect(node.key, value);
  };
  return {
    // `import { cache as memo }` 之后 memo(...) 同样是包装。
    ImportDeclaration(node) {
      for (const s of node.specifiers) {
        if (s.type === 'ImportSpecifier' && watched.has(s.imported.name))
          wrapperNames.add(s.local.name);
      }
    },
    FunctionDeclaration(node) {
      if (node.id) inspect(node.id, functionValue(node, wrapperNames));
    },
    TSDeclareFunction(node) {
      if (node.id) inspect(node.id, functionValue(node, wrapperNames));
    },
    VariableDeclarator(node) {
      if (node.id.type !== 'Identifier') return;
      const value = functionValue(node.init, wrapperNames);
      if (value) inspect(node.id, value);
    },
    MethodDefinition(node) {
      if (!node.computed && node.key.type === 'Identifier')
        inspect(node.key, functionValue(node.value, wrapperNames));
    },
    Property: (node) => named(node, functionValue(node.value, wrapperNames)),
    PropertyDefinition: (node) => named(node, functionValue(node.value, wrapperNames)),
  };
}

const schemaOf = (properties) => [
  { type: 'object', properties, additionalProperties: false },
];
const stringArray = { type: 'array', items: { type: 'string' } };

export const verbSynonyms = {
  meta: {
    type: 'suggestion',
    docs: { description: '函数使用项目约定的主词，不用同义词' },
    schema: schemaOf({ synonyms: stringArray, allowNames: stringArray }),
    messages: { naming: '{{name}} 请改用动词表中的主词（见命名约定）；同义词会让检索与阅读失去一致性。' },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const synonyms = verbRegex(options.synonyms ?? DEFAULT_SYNONYMS);
    const allow = new Set(options.allowNames ?? []);
    return namedFunctions(DEFAULT_ASYNC_WRAPPERS, (node) => {
      if (synonyms.test(node.name) && !allow.has(node.name))
        context.report({ node, messageId: 'naming', data: { name: node.name } });
    });
  },
};

export const verbIo = {
  meta: {
    type: 'suggestion',
    docs: { description: '函数主词与同步/异步形态一致' },
    schema: schemaOf({
      readVerbs: stringArray,
      pureVerbs: stringArray,
      asyncWrappers: stringArray,
    }),
    messages: { naming: '{{name}} 的异步声明与主词不一致：读取主词须异步，纯计算主词须同步。' },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const reading = verbRegex(options.readVerbs ?? DEFAULT_READ_VERBS);
    const pure = verbRegex(options.pureVerbs ?? DEFAULT_PURE_VERBS);
    return namedFunctions(options.asyncWrappers ?? DEFAULT_ASYNC_WRAPPERS, (node, value) => {
      if ((pure.test(node.name) && value?.async) || (reading.test(node.name) && !value?.async))
        context.report({ node, messageId: 'naming', data: { name: node.name } });
    });
  },
};

const DECLARATION_PARENTS = new Set([
  'VariableDeclarator',
  'ClassDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'TSTypeParameter',
]);
const FUNCTION_PARENTS = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

// 只沿「绑定值」向上走：解构 `{ oldKey: alias }` 中被检查的是 alias，来源键名 oldKey 保留。
function isDeclaredName(identifier) {
  let binding = identifier;
  while (
    (binding.parent.type === 'Property' &&
      binding.parent.value === binding &&
      binding.parent.parent.type === 'ObjectPattern') ||
    (binding.parent.type === 'RestElement' && binding.parent.argument === binding) ||
    (binding.parent.type === 'AssignmentPattern' && binding.parent.left === binding) ||
    binding.parent.type === 'ObjectPattern' ||
    binding.parent.type === 'ArrayPattern'
  )
    binding = binding.parent;
  const parent = binding.parent;
  return (
    (DECLARATION_PARENTS.has(parent.type) && parent.id === binding) ||
    (FUNCTION_PARENTS.has(parent.type) && parent.params.includes(binding))
  );
}

export const bannedWords = {
  meta: {
    type: 'suggestion',
    docs: { description: '内部符号使用词汇表统一用词' },
    schema: schemaOf({
      words: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            use: { type: 'string' },
            paths: stringArray,
            declarations: { type: 'boolean' },
          },
          required: ['word', 'use'],
          additionalProperties: false,
        },
      },
    }),
    messages: { naming: '{{name}} 含禁用词 {{word}}，请使用统一词汇 {{use}}。' },
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    const rules = (context.options[0]?.words ?? []).filter(
      (entry) => !entry.paths || entry.paths.some((p) => new RegExp(p).test(filename)),
    );
    if (rules.length === 0) return {};
    const seen = new Set(); // 函数名同时是声明名时只报一次
    const report = (node, filter) => {
      for (const entry of rules) {
        if (filter(entry) && node.name.includes(entry.word) && !seen.has(node.range[0] + entry.word)) {
          seen.add(node.range[0] + entry.word);
          context.report({
            node,
            messageId: 'naming',
            data: { name: node.name, word: entry.word, use: entry.use },
          });
        }
      }
    };
    const visitors = namedFunctions(DEFAULT_ASYNC_WRAPPERS, (node) => report(node, () => true));
    const declarations = rules.filter((entry) => entry.declarations);
    if (declarations.length === 0) return visitors;
    return {
      ...visitors,
      Identifier(node) {
        if (isDeclaredName(node)) report(node, (entry) => entry.declarations);
      },
    };
  },
};

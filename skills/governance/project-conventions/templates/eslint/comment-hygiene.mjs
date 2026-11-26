// 注释卫生规则：拦截 `as never` 类型绕行与非 TS 指令的 `///` 伪文档注释。
//
// 配置：
//   - TS_TRIPLE_SLASH_DIRECTIVE：合法的 TS 三斜杠指令（reference/amd-module/amd-dependency），一般不用改。
//   - 两条规则都没有 options；要放宽就在 eslint.config 里用 files/ignores 缩小适用范围。
//
// 为什么：`as never` 与「合理化注释」一旦出现，会被后续代码当范式复制；`///` 是别的语言的文档习惯，
// 在 TS 里既不被工具识别，也会和真正的三斜杠指令混淆。

const TS_TRIPLE_SLASH_DIRECTIVE = /^\/\s*<(?:reference|amd-module|amd-dependency)\b/;

export const noAsNever = {
  meta: {
    type: 'problem',
    docs: { description: '禁止使用 as never 绕过类型检查' },
    schema: [],
    messages: {
      asNever:
        '禁止用 as never 绕过类型检查：请对齐源头接口泛型或做真实的运行时类型收窄（穷尽分支检查用 satisfies never 或 const _exhaustive: never = x）。',
    },
  },
  create(context) {
    function check(node) {
      if (node.typeAnnotation?.type === 'TSNeverKeyword')
        context.report({ node, messageId: 'asNever' });
    }
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
};

export const noTripleSlashComment = {
  meta: {
    type: 'suggestion',
    docs: { description: '禁止非 TypeScript 指令的 /// 三斜杠伪文档注释' },
    schema: [],
    messages: {
      tripleSlash: '/// 仅用于 TypeScript 指令。调用契约用 /** … */，简短说明用 //，冗余注释直接删除。',
    },
  },
  create(context) {
    return {
      Program() {
        let prevFlaggedLine = -2;
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== 'Line' || !comment.value.startsWith('/')) continue;
          if (TS_TRIPLE_SLASH_DIRECTIVE.test(comment.value)) continue;
          const line = comment.loc.start.line;
          // 连续多行 /// 只报第一行，避免刷屏。
          if (line !== prevFlaggedLine + 1) context.report({ loc: comment.loc, messageId: 'tripleSlash' });
          prevFlaggedLine = line;
        }
      },
    };
  },
};

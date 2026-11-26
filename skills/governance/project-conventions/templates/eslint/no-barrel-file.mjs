// 禁止模块纯再导出入口（barrel）：index 文件里只有 `export … from` 时报错。
//
// 配置：
//   - DEFAULT_INCLUDE：被检查的文件路径（正则字符串，匹配「/」归一化后的绝对路径）。
//     默认只查 `src/modules/**/index.ts(x)`；按目标项目的业务模块目录名修改。
//   - DEFAULT_ALLOW：存量豁免（正则字符串）。默认空；新增豁免必须在 eslint.config 里写明理由。
//   - options: { include?: string[], allow?: string[] } 可覆盖以上两项。
//
// 为什么：barrel 的再导出会把被导出文件的整张依赖图连进每个导入方；混入数据库、鉴权等
// 仅服务端依赖后，客户端导入可能在构建期失败，也更容易形成循环依赖。

const DEFAULT_INCLUDE = ['/src/modules/.+/index\\.[cm]?tsx?$'];
const DEFAULT_ALLOW = [];

const noBarrelFile = {
  meta: {
    type: 'problem',
    docs: { description: '禁止模块纯再导出入口' },
    schema: [
      {
        type: 'object',
        properties: {
          include: { type: 'array', items: { type: 'string' } },
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: { noBarrel: '模块入口不得只做再导出，请由调用方直接导入具体文件。' },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const filename = context.filename.replaceAll('\\', '/');
    const matches = (patterns) => patterns.some((p) => new RegExp(p).test(filename));
    if (!matches(options.include ?? DEFAULT_INCLUDE)) return {};
    if (matches(options.allow ?? DEFAULT_ALLOW)) return {};
    return {
      Program(node) {
        const onlyReexports =
          node.body.length > 0 &&
          node.body.every(
            (s) =>
              (s.type === 'ExportAllDeclaration' || s.type === 'ExportNamedDeclaration') && s.source,
          );
        if (onlyReexports) context.report({ node, messageId: 'noBarrel' });
      },
    };
  },
};

export default noBarrelFile;

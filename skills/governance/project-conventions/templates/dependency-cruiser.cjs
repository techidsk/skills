// dependency-cruiser 配置：检查循环依赖，并用「已知违规基线」只拦新增。
//
// 配置（落地时修改）：
//   - SRC_DIR：源码根（默认 src）；monorepo 里每个包各放一份配置。
//   - tsConfig.fileName：目标项目的 tsconfig 路径，用于解析别名与 type-only 导入。
//   - 可选：取消下方「分层」规则的注释，把 modules/app 等目录名换成项目实际名称（与
//     eslint 的 layerZones 保持一致；ESLint 管编辑器内即时提示，这里管全量与 CI）。
//
// 命令（package.json 的 scripts 里登记）：
//   生成/收紧基线： depcruise src --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json
//   日常与 CI：     depcruise src --config .dependency-cruiser.cjs --ignore-known
//   基线文件放仓库根并提交；它只减不增——修掉一个环后重新生成，让数字变小。
//
// 为什么用基线：存量代码通常已有环，直接开硬闸会让规则被整体关掉。基线冻结存量、只拦新增，
// 团队按节奏清理；--ignore-known 对新增违规按各自的 severity 报错。

const SRC_DIR = 'src';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        '循环依赖会让模块加载顺序不确定，初始化时取到 undefined，且无法单独测试或拆分。' +
        '打破方式：把被两边共用的部分抽到下游文件，或改成由调用方传参。',
      from: {},
      to: { circular: true },
    },
    // 分层示例（按需启用）：modules 不得依赖入口层。
    // {
    //   name: 'modules-not-depend-on-entry',
    //   severity: 'error',
    //   comment: '业务模块独立于路由与 UI，才能被多个入口与脚本复用。',
    //   from: { path: `^${SRC_DIR}/modules` },
    //   to: { path: `^${SRC_DIR}/(app|components)` },
    // },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // 只分析源码目录；测试文件按需排除，避免测试里的循环替身占用基线。
    includeOnly: `^${SRC_DIR}`,
    exclude: { path: '\\.(test|spec)\\.[cm]?[jt]sx?$' },
    // 把 `import type` 也算作依赖，才能看见仅类型的环；若团队认为类型环无害，改为 false。
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};

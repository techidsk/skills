# Changesets v2.31.x 发布行为核对

<!-- markdownlint-disable MD013 -->

核对日期：2026-08-04。

本文面向使用 `@changesets/cli` 2.31.x 的 pnpm 项目，行为依据固定在官方
v2.31.1 源码提交 `a897bb8`。目标仓库使用其他 major 时必须重新核对对应版本。
Changesets 官方 `main` 已是 v3 开发线，不能把 `main` 文档中的默认值和内部格式
直接套到 v2；官方仓库也明确要求 v2 使用 `maintenance/v2`。
[Changesets v3 开发线说明](https://github.com/changesets/changesets/blob/7f0ba56def0de47bdf8f41c1feb5da5f23744cf8/README.md#L1-L2)

## 结论摘要

1. `changeset status --output` 是 `prepare` 阶段最合适的机器可读输入，必须在 `changeset version` 之前导出。其 JSON 是 `ReleasePlan`：`changesets`、`releases`、可选的 `preState`。
2. `changeset version` 计算版本并修改本地文件；正常模式会删除已消费片段，活跃 prerelease 模式则用 `preState` 标记已使用片段，直到退出 prerelease 时再删除。
3. Changesets 不能直接指定目标版本 `1.4.1-beta.2`。`pre enter` 只接受 tag，实际版本由当前版本、Changeset bump 和 prerelease 状态推导。Skill 应把用户输入的目标版本当作“预期结果”，不一致就停止。
4. `changeset tag` 只创建本地 Git tag；`changeset publish` 写 npm registry 并默认创建本地 tag；push、GitHub Release、应用部署、通知都不是 `version` 的职责。
5. 对私有应用应显式配置 `privatePackages`，不要依赖默认值。v2.31 默认是 `{ version: true, tag: false }`，v3 开发线已经改为两者默认 `false`。
6. `prepare` 只允许本地可审阅变更；tag、registry publish、push、GitHub Release、deploy、通知必须进入独立 `publish` 阶段，并在执行前取得明确确认。

## 1. `changeset status --output` 的输出与失败语义

### 输出结构

v2.31.x 的 `--output` 会把完整 `ReleasePlan` 直接 JSON 序列化到指定文件。[status 实现](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/commands/status/index.ts#L37-L59) 官方类型定义为：

```ts
type ReleasePlan = {
  changesets: Array<{
    id: string;
    summary: string;
    releases: Array<{ name: string; type: "major" | "minor" | "patch" | "none" }>;
  }>;
  releases: Array<{
    name: string;
    type: "major" | "minor" | "patch" | "none";
    oldVersion: string;
    newVersion: string;
    changesets: string[];
  }>;
  preState?: {
    mode: "pre" | "exit";
    tag: string;
    initialVersions: Record<string, string>;
    changesets: string[];
  };
};
```

字段来源见官方 [`ReleasePlan` / `ComprehensiveRelease` 类型](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/types/src/index.ts#L16-L40)和 [`PreState` 类型](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/types/src/index.ts#L170-L177)。没有 prerelease 状态时，`preState` 值为 `undefined`，经过 JSON 序列化后该字段通常不存在，而不是 `null`。

`releases` 已包含依赖传播、fixed/linked 约束和 prerelease 计算后的最终候选版本；它比直接解析 Changeset frontmatter 更适合作为 Release Skill → Test Plan Skill 的交接数据。Changesets 会把任意数量片段压平为每个 package 一条 release，并处理 workspace 内部依赖。[官方仓库概述](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/README.md#L17-L25)

### 退出码与空计划

v2.31.x 的实际实现是：只有“相对 `--since` 或 `baseBranch` 检测到可版本化 package 有改动，同时计划中没有 Changeset”时才以 code 1 退出；检查发生在写输出文件之前。[status 的失败条件](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/commands/status/index.ts#L39-L58)

因此：

- 没有改动、也没有 Changeset 时，可以成功得到空 `changesets` / `releases`；exit code 0 不等于“存在可发布内容”。
- 有应发布改动却没有 Changeset 时，exit code 1，新的输出文件不会被写入；调用方必须先删除或使用全新的临时路径，避免误读旧文件。
- 配置错误、Changeset 引用不存在的 workspace package、非法 mixed ignored Changeset、Git ref 不可用等也会失败。不能把所有非零退出都解释成“缺 Changeset”。Changeset 引用不存在的 package 会在组装计划时直接报错。[计划校验源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/assemble-release-plan/src/index.ts#L273-L310)
- 官方明确要求在 `version` 之前立即运行 `status`；version/publish 进行到一半时不能把 status 当成可靠快照。[CLI 文档](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/command-line-options.md#L127-L141)

### 对 Skill 的约束

- 用临时 JSON 文件传递计划，并对字段做 schema 校验；不要长期保存或跨 CLI major 复用原始 JSON。
- Release `prepare` 应读取全部待发布片段，通常运行不带 `--since` 的 `status --output`。`--since main` 更适合 Change Capture 判断本批 diff，不适合在主分支上导出完整待发布队列。
- 活跃 pre 状态（`mode: "pre"`）下，计划中的 `changesets` 只包含尚未用于此前候选版本的增量片段；已使用 ID 会被 `preState.changesets` 过滤。[增量过滤源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/assemble-release-plan/src/index.ts#L314-L321) 因此动态测试文档的“累计范围”必须从既有测试文档状态累加，不能把本次 status 的 `changesets` 误当作整个版本周期。`mode: "exit"` 时过滤不再生效，最终计划可能重新包含整个周期的片段。

## 2. `changeset version` 如何消费发布意图

`changeset version` 会读取全部待处理 Changeset 和 `preState`，组装 release plan，然后应用到工作区；没有待处理 Changeset且不是 prerelease exit 时会直接 no-op。[version 命令源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/commands/version/index.ts#L37-L90)

应用计划时会：

1. 计算每个 package 的新版本，并生成对应 CHANGELOG 内容。
2. 修改 `package.json` 的 `version`。
3. 按 `updateInternalDependencies`、semver 范围和 workspace protocol 规则更新 `dependencies`、`devDependencies`、`peerDependencies`、`optionalDependencies`。[内部依赖改写源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/apply-release-plan/src/version-package.ts#L19-L119)
4. 写入或前插 `CHANGELOG.md`。
5. 正常模式或 prerelease exit 模式删除已消费的 `.changeset/<id>.md`；被 skip 的片段保留。[apply release plan](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/apply-release-plan/src/index.ts#L117-L190)

活跃 prerelease 模式是例外：v2.31.x 不立即删除片段，而是把所有已见 Changeset ID 写进 `.changeset/pre.json`，后续计划过滤已用 ID；退出 prerelease 并再次 version 时才清理 `pre.json` 和已消费片段。[preState 写入与删除条件](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/apply-release-plan/src/index.ts#L105-L114) 这属于 CLI 内部存储细节，Skill 不应直接修改 `pre.json`。

`version` 是有意与 `publish` 分离的本地变更步骤；官方建议先审查版本和 CHANGELOG，再发布。[官方入门流程](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/intro-to-using-changesets.md#L43-L71)

## 3. prerelease：enter、连续候选与 exit

### 官方支持的状态机

- `changeset pre enter beta` 只把仓库置为 prerelease 模式并记录 tag；tag 同时用于版本后缀和 npm dist-tag。第一次 version 通常得到 `-beta.0`。[prerelease 官方流程](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/prereleases.md#L9-L49)
- 后续有新 Changeset 时再次 version，数字后缀基于 package 当前 prerelease 数字加一；不同 package 可以处在不同序号。[序号计算源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/assemble-release-plan/src/index.ts#L26-L34) [版本拼接源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/assemble-release-plan/src/increment.ts#L13-L23)
- `changeset pre exit` 只把状态改为 `exit`，不更新版本；随后必须运行 `changeset version` 才会移除 prerelease 后缀并清理状态。[pre enter/exit 实现](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/pre/src/index.ts#L34-L69) [退出流程文档](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/prereleases.md#L109-L141)

### 不能直接指定 `1.4.1-beta.2`

v2.31.x 的命令接口只有 `version [--ignore] [--snapshot ...]` 和 `pre <enter|exit> <tag>`，没有目标版本参数。[CLI 参数定义](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/help.ts#L1-L9)

因此 Release Skill 接收“准备发布 `1.4.1-beta.2`”时应：

1. 先导出 release plan。
2. 查找主发布对象的 `releases[].newVersion`。
3. 仅当计算结果严格等于 `1.4.1-beta.2` 时继续；否则说明当前版本、Changeset bump 或 pre 状态导致的实际结果并停止。

不要为了迎合目标字符串而直接编辑 `package.json` 或 `.changeset/pre.json`。首次 prerelease 默认从 `.0` 开始；仅重复运行 `version` 且没有新的发布意图也不会凭空产生下一个候选版本。

导出计划前必须先让 pre 状态与目标类型一致，否则 status 无法计算目标形态：

- 当前无 pre 状态、目标是 prerelease：先执行 `pre enter <tag>`，再导出 status。
- 当前为相同 tag 的活跃 pre 状态：直接导出 status。
- 当前为活跃 pre 状态、目标是正式版：先执行 `pre exit`，再导出 status。
- 当前 tag 与目标 tag 不同：进入下面的 tag 切换分支，不得自动猜测序号策略。

`pre enter` / `pre exit` 都只修改本地 `.changeset/pre.json`，可以属于 prepare 的“计划前状态对齐”，但必须出现在最终 diff 中供审阅。若后续校验失败，Skill 应恢复自己创建的这次状态变更，而不能留下半切换状态。

### beta → rc 的注意点

活跃 pre 模式中再次 `pre enter rc` 会失败；源码只允许在先 `pre exit` 后重新 enter。[状态守卫](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/pre/src/index.ts#L49-L64) 重新 enter 不会提供“从 rc.0/rc.1 重置序号”的接口，而候选序号取自 package 当前版本再加一。由此可推断：若当前为 `1.4.1-beta.2`，先 exit、再 enter rc，并有 patch 发布意图时，计算结果会趋向 `1.4.1-rc.3`，而不是 `1.4.1-rc.1`。若业务要求每个 tag 独立编号，需另行设计并显式测试，不能假设 Changesets 原生支持。

## 4. `tag`、`publish` 与 GitHub Action 的职责边界

| 能力 | 实际职责 | 是否放入 prepare |
| --- | --- | --- |
| `changeset version` | 本地更新版本、内部依赖、CHANGELOG，消费/标记 Changeset | 是 |
| `changeset tag` | 按当前 `package.json` 版本创建尚不存在的本地 Git tag；monorepo 为 `<name>@<version>`，单包为 `v<version>` | 否 |
| `changeset publish` | 检查 registry 中是否已有本地版本，对非 private package 执行 npm/pnpm publish，并默认创建本地 Git tag | 否 |
| `git push --follow-tags` | 把 commit/tag 写到远端 | 否 |
| Changesets GitHub Action | 创建/更新 version PR；配置 publish script 时，在没有 Changeset 后执行发布，还可推 tag、建 GitHub Release | 否，本地 prepare 不应调用 |
| 应用 deploy / 通知 | Changesets 不负责，需项目自定义 workflow/script | 否 |

官方 CLI 文档明确区分：`tag` 不发布 npm；`publish` 会发布并创建本地 tag，而远端 tag 仍需 push。[tag 文档](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/command-line-options.md#L153-L163) [publish 与 push 文档](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/command-line-options.md#L105-L125) `publish` 实际只把 `private !== true` 的 package 送进 registry 发布流程。[publishPackages 源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/commands/publish/publishPackages.ts#L85-L107)

对私有应用，Changesets 只维护 `package.json` 版本和可选 Git tag；Docker、桌面应用或站点部署需要由 tag/release 触发的自定义流程完成。[非 npm 应用官方说明](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/versioning-apps.md#L1-L14)

`changesets/action@v1` 的 v2 兼容实现会在有 Changeset 时运行 version、push release branch 并创建/更新 PR；没有 Changeset但配置了 `publish` 时则运行发布命令。[Action 分支逻辑](https://github.com/changesets/action/blob/ae5c373a18fe02dac7d40bcbc0184758c90d94d2/src/index.ts#L54-L76) [version PR 的远端写入](https://github.com/changesets/action/blob/ae5c373a18fe02dac7d40bcbc0184758c90d94d2/src/run.ts#L286-L315) [push 与建 PR](https://github.com/changesets/action/blob/ae5c373a18fe02dac7d40bcbc0184758c90d94d2/src/run.ts#L362-L385) 配置 `createGithubReleases` 后，它还会 push tag 并创建 GitHub Release。[Action publish 实现](https://github.com/changesets/action/blob/ae5c373a18fe02dac7d40bcbc0184758c90d94d2/src/run.ts#L83-L165)

这意味着：若本地 Skill 已执行 version 并消费 Changeset，随后 push 到装有自动 publish Action 的分支，Action 可能直接进入发布路径。Release Skill 必须先检查 CI 配置，把“push release commit 会触发什么”纳入 publish 确认，不可只询问是否执行 `changeset publish`。

另外，Changesets Action 当前 `main` 是配合 Changesets CLI v3 的 Action v2；CLI v2 应继续使用 Action v1/`maintenance/v1`。[Action 官方兼容说明](https://github.com/changesets/action/blob/cae63535198362487bf613d7940dbc74b12d7313/README.md#L1-L18)

## 5. `privatePackages`、`ignore`、`baseBranch` 对私有 pnpm workspace 的影响

### `privatePackages`

在 v2.31.x：

- 默认 `{ version: true, tag: false }`：私有 package 会更新版本和 CHANGELOG，但不会创建 tag。
- 私有应用若要用 tag 驱动部署，应显式设 `{ "version": true, "tag": true }`。
- `version: false, tag: true` 是非法组合。

来源：[v2.31 配置文档](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/config-file-options.md#L220-L244)和[配置校验源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/config/src/index.ts#L337-L345)。v3 开发线已把默认值改为两者均 `false`，因此 Skill 必须读取 CLI major，并要求项目显式配置，不能依赖默认行为。[v3 配置文档](https://github.com/changesets/changesets/blob/7f0ba56def0de47bdf8f41c1feb5da5f23744cf8/docs/config-file-options.md#L233-L265)

### `ignore`

`ignore` 是临时跳过发布的机制，不是永久声明“这个包不发布”；永久不发布 npm 应使用 package.json 的 `private: true`。只含 ignored package 的 Changeset 会保留，移除 ignore 后仍可处理；同一个 Changeset 混合 ignored 与非 ignored package 会失败。[ignore 官方说明](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/config-file-options.md#L67-L80)

`ignore` 也不能修复历史片段中的旧包名：v2.31 会校验 ignore pattern 必须匹配当前 workspace，并会拒绝引用不存在 package 的 Changeset。[配置校验](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/config/src/index.ts#L347-L368) 这类历史片段应在执行 prepare 前显式迁移、归档或删除，并保留人工可审阅 diff。

### `baseBranch`

`baseBranch` 只定义“比较哪些 Git 改动”的默认基线，可由支持该选项的命令用 `--since` 覆盖；本地分支必须存在且保持最新。[baseBranch 文档](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/config-file-options.md#L59-L65)

在 v2.31.x，status 的 missing-changeset 检查在没有 `--since` 时使用 `config.baseBranch`。[版本化改动检测源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/utils/versionablePackages.ts#L5-L26) 但 `changeset version` 本身不使用 `baseBranch`，而是读取当前工作区里的全部 Changeset。[version 读取源码](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/packages/cli/src/commands/version/index.ts#L37-L40)

因此可明确分工：

- Change Capture / 本地收口：整体 diff 以 `main` 为基线，可显式使用 `--since main` 或直接计算 merge-base diff。
- Release prepare：以当前 `.changeset` 队列为准导出完整 release plan，不要因为捕获基线是 `main` 就给 status/version 一律附加 `--since main`。

## 6. prepare 与 publish 的安全边界

### `prepare` 可执行

- 检查工作树、当前分支、CLI major、Changesets 配置和 CI/发布脚本。
- 用全新临时路径执行 `changeset status --output`，验证 release plan 与用户目标版本。
- 把不可变 release plan 交给 Test Plan Skill，更新按 core version 维护的测试文档。
- 执行 `changeset version`。
- 运行局部/必要测试，展示版本、CHANGELOG、测试文档和被删除 Changeset 的完整 diff。
- 用户另行确认后，可创建本地 release commit；这仍不是 publish。

### 只可在明确确认后的 `publish` 执行

- `changeset tag` 或 `changeset publish`；私有应用通常选前者，npm package 选后者，避免无意义地两者都跑。
- push commit 或 tag。
- 创建/更新 GitHub PR、GitHub Release。
- npm/其他 registry publish。
- 应用 deploy、发版通知、飞书/Slack 消息。
- 任何会因 push 自动触发上述动作的 CI 分支更新。

推荐的确认内容应列出确切版本、tag 名、远端分支、registry（若有）、部署环境和通知渠道，而不是一个笼统的“继续吗”。

## 7. 给三个 Skills 的最小接口建议

### Change Capture

输出 0/1/N 个独立发布意图；只写 `.changeset/*.md`，不进入 prerelease、不 version、不 tag。以最终聚合 diff 为输入，协调 Agent 是唯一写入者。

### Release prepare

输入用户期望版本与仓库路径；输出至少包含：

- CLI major 与配置摘要。
- 目标类型与当前 pre 状态的对齐结果；必要时先 `pre enter` / `pre exit`。
- 原始 release plan 临时快照的解析结果。
- `expectedVersion` 与实际 `newVersion` 的严格比对。
- core version、candidate tag/序号、本次增量 Changeset IDs。
- 测试文档路径。
- `changeset version` 后的完整本地 diff 和验证结果。

任一步失败都不得进入 publish。重复执行时，如果已无待处理计划，应识别“已经 prepare”或“没有发布内容”，不能再次 bump。

### Release publish

只接受已经审阅的 prepare 结果；重新核对 HEAD、版本和 tag 不存在，再展示精确外部动作并请求确认。publish 完成后记录实际 tag、commit、部署结果和构建历史；不要用提交信息或文件数量反推发布范围。

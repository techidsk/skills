---
name: run-changesets-release
description: 为 pnpm Changesets 仓库安全准备或执行版本发布。Use when the user says“准备发布 1.4.1-beta.2”“生成版本和 CHANGELOG”“发布这个版本”“打 tag / publish / deploy”，或需要把 Changeset 队列转换为可审阅的 release diff 时。默认进入 prepare；只有展示精确外部动作并再次获得明确确认后才进入 publish。
---

# Run Changesets Release

把发布分成两个模式：

- `prepare`：导出 release plan、更新版本周期测试文档、运行 `changeset version`、展示完整 diff，然后停止。
- `publish`：验证已准备的产物，展示精确动作，确认后才 commit、tag、publish、push、deploy 或通知。

用户说“准备发布”时默认使用 `prepare`。不要把模糊的“继续”解释成授权所有外部动作。

## 不可破坏的约束

- 必须在 `changeset version` 消费片段之前导出 release plan。
- 必须在 `changeset version` 之前调用 `$maintain-release-test-plan` 更新测试文档。
- `prepare` 禁止 commit、tag、publish、push、deploy 和发送通知。
- `publish` 必须在展示 exact commands、目标版本、目标 registry/remote/environment 后再次确认。
- 不运行把 version、tag、通知或部署绑在一起但无法逐项审阅的包装脚本。
- 不手改 `package.json` 强行凑用户给出的目标版本；把目标版本视为对 Changesets 计算结果的断言。
- 只暂存明确列出的发版产物；禁止 `git add .`、`git add -A` 或 `git add -u`。
- 不假设所有仓库都发布 npm package；private app 可能只 version、tag 和 deploy。

涉及 prerelease、`status --output`、`version`、tag、publish 或 Action 行为时，先阅读 [references/official-changesets-behavior.md](references/official-changesets-behavior.md)。

## 1. 发现仓库发布模型

读取仓库指令及以下文件：

- 根 `package.json` 和相关 workspace package manifests
- `pnpm-workspace.yaml`
- `.changeset/config.json`
- `.changeset/pre.json`（若存在）
- CI workflow、发布脚本和部署文档
- 当前分支、tag、remote 和工作区状态
- 当前 `@changesets/cli` major version

明确记录：

- 版本发生在哪个分支。
- 是 npm package、private app，还是两者混合。
- 谁负责 release commit、tag、push、GitHub Release、deploy 和通知。
- 仓库是否由 Changesets Action 管理 Version Packages PR。
- private package 的 version/tag 行为是否显式配置。

不要因为存在名为 `release` 的 package script 就直接执行；先展开并审阅它包含的每个子命令。

## 2. 选择模式

### Prepare

适用于：

- “准备发布 `<version>`”
- “生成版本和 CHANGELOG”
- “看看这次会发什么”

输出是未提交、可审阅的 release diff。

### Publish

适用于用户已经审阅 prepare diff，并明确要求发布、打 tag、推送或部署。

如果没有可验证的 prepare 产物，退回 `prepare`；不要边准备边直接发布。

## 3. Prepare 工作流

### 3.1 前置检查与 prerelease 对齐

要求工作区干净，或只包含用户明确允许纳入本次 prepare 的文件。发现无关修改时停止，不能自动 stash、提交或覆盖。

在导出计划前，根据目标版本和 `.changeset/pre.json` 判断：

- 无 pre 状态且目标是 prerelease：预览并确认 `pre enter <tag>`。
- 相同 tag 的活跃 pre 状态：直接继续。
- 活跃 pre 状态且目标是正式版：预览并确认 `pre exit`。
- 当前 tag 与目标 tag 不同：停止并解释切换步骤及序号不会自动重置。

`pre enter` / `pre exit` 只改变本地状态，但仍必须进入 prepare diff。后续失败时
明确展示该变化并询问是否撤销，不要静默留下或擅自覆盖 `pre.json`。

使用全新临时路径运行 Changesets 自检，避免失败时误读旧 JSON：

```bash
RELEASE_TMP_DIR=$(mktemp -d)
pnpm exec changeset status --output "$RELEASE_TMP_DIR/release-plan.json"
```

若状态命令因未知 package、坏 frontmatter 或配置问题失败，停止。不要继续 `version`。
exit code 0 仍可能是空计划；`changesets` 或 `releases` 为空时报告“没有待发布内容”
并停止。

### 3.2 审阅 release plan

从 JSON 和 Changeset 正文提取：

- 本次计划包含的片段。
- 每个 package 的当前版本、bump 和计算后版本。
- 汇总后的最高 bump。
- ignored/fixed/linked/private package 影响。
- 迁移、风险和遗漏信息。

活跃 prerelease 中，plan 的 `changesets` 通常只是相对此前候选的增量；退出 pre
模式时计划可能重新包含整个周期。累计范围必须由测试文档对账，不能只看本次
plan。

如果用户提供期望版本，例如 `1.4.1-beta.2`：

- 与 release plan 的计算版本逐 package 比较。
- 不一致时停止并解释是 Changeset bump、pre 模式或当前版本哪一项导致。
- 不一致时不要直接编辑 manifests 或 `pre.json`，也不要靠重复 `version` 凑序号。

### 3.3 更新测试文档

在任何 Changeset 被消费前调用 `$maintain-release-test-plan`，传入：

- release plan JSON 路径。
- 目标候选版本。
- Changeset 正文及文件名。
- 当前 commit/ref、Diff 范围和已知 PR 测试资料。
- `phase=prepare`。

测试文档失败时停止，不运行 `changeset version`。

### 3.4 只执行版本生成

记录 prepare 前状态和 release plan 后执行：

```bash
pnpm exec changeset version
```

不要在此阶段运行 `changeset tag`、`changeset publish`、部署、通知或包装版 `pnpm release`。

### 3.5 验证并展示 diff

检查：

- package 版本。
- CHANGELOG 内容。
- 内部依赖更新。
- 被删除或由 `pre.json` 标记已使用的 Changeset。
- `.changeset/pre.json` 的状态变化。
- 发版测试文档。
- 是否出现计划外文件。

输出 [references/release-handoff.md](references/release-handoff.md) 中的 prepare
handoff。展示完整文件清单和关键 diff，然后停止等待用户审阅。

重复运行时，若 Changeset 已消费但同一版本的 prepare diff 尚未提交，应识别为“已准备”，只重新验证和展示，不再次 version。

## 4. Publish 工作流

### 4.1 验证 prepare 产物

确认：

- 用户指定版本与 manifests、CHANGELOG 和测试文档一致。
- release diff 只包含预期产物。
- 测试与 CI 结论满足仓库门禁。
- 目标 tag 尚不存在，或现有 tag 精确指向预期 commit。
- registry、remote、发布分支和部署环境明确。

若仓库使用 Changesets Action/Version Packages PR，遵循该自动化的
ownership；不要同时执行一套本地 publish 流程。

### 4.2 展示精确动作并确认

按仓库实际模型展示将要执行的动作，未使用的动作标记为“不适用”：

```text
版本: <version>
本地提交: <exact paths + commit message>
本地 tag: <exact tag command>
Package publish: <registry + exact command | 不适用>
Git push: <remote + branch + tags | 不适用>
Deploy: <environment + exact command | 不适用>
通知: <channel + exact command | 不适用>
```

此预览之后必须获得明确确认。任何目标发生变化都要重新预览、重新确认。

选择二者之一：

- 非 registry 应用或 tag-only 流程使用 `changeset tag`。
- npm registry 发布使用 `changeset publish`；它默认也会创建本地 tag。

同一次发布不要先执行 `changeset tag` 再执行 `changeset publish`。同时把“push
release commit 会触发哪些 CI 发布动作”列入预览。

### 4.3 执行已确认动作

按顺序执行，逐步记录结果：

1. 逐一路径暂存版本、CHANGELOG、测试文档、`pre.json` 和 Changeset 变化。
2. 运行仓库要求的 release 校验。
3. 创建 release commit。
4. 执行获批的 tag-only 或 package publish 动作。
5. push commit 和 tag。
6. deploy。
7. 通知。
8. 调用 `$maintain-release-test-plan`，传入 `phase=released` 冻结正式版文档。

每一步只执行预览中获批的命令。中途失败时停止，报告已完成和未完成动作以及安全恢复方式；不得隐藏部分成功，也不得擅自重试有重复发布风险的步骤。

## 5. 分支与部署门禁

版本发布与生产部署是两个 seam：

- Changesets release plan 决定版本、CHANGELOG 和 package 关系。
- 仓库的生产门禁决定哪个分支进入哪个环境以及如何回滚。

如果仓库另有 prod-release、deployment-check 或类似 Skill，在 publish 前调用它
完成风险检查；不要把其分支比较逻辑硬编码进本 Skill。

## 完成输出

使用 [references/release-handoff.md](references/release-handoff.md) 的结构，至少汇报：

- 当前模式和版本。
- release plan 与 Changeset 数量。
- 测试文档路径。
- version/CHANGELOG diff。
- 已执行的本地与外部动作。
- 明确未执行的动作。
- 失败后的恢复点。

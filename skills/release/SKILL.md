---
name: release
description: "准备或执行仓库版本发布：发现项目原生版本与发布机制，生成可审阅的版本、CHANGELOG 和测试产物，并在明确确认后执行 publish、tag、push 或 deploy。Use when the user asks to 准备发布 a version or explicitly 发布 an already prepared version in any language or ecosystem."
---

# Release

默认执行 `prepare`。只有用户明确要求外部发布，并确认精确动作后，才执行
`publish`。

## 边界

- 使用仓库现有版本和发布机制，不因本 Skill 引入新工具。
- 在消费发布片段前导出 release plan，并先更新版本周期测试文档。
- `prepare` 只产生本地可审阅变更；不 commit、tag、push、publish、deploy 或通知。
- `publish` 先展示 exact actions、目标版本、remote、registry 和 environment，
  再等待一次明确确认。
- 展开并审阅包装脚本；包含外部动作的脚本整体归入 `publish`。
- 逐一路径暂存发布产物，保持无关修改的原有状态。

## 1. 发现发布模型

读取仓库指令、manifest、lockfile、版本文件、发布配置、脚本、CI、部署文档、
当前分支、tag、remote 和工作区状态。确定：

- 发布单元、版本策略和目标版本来源。
- 待发布意图、release plan、版本与 CHANGELOG 的生成方式。
- 输出语言：用户指定 → 仓库指令 → 现有 CHANGELOG/发布文档 → 当前对话语言。
- release commit、tag、registry、push、deploy、通知和回滚的责任方。
- push 或合并到发布分支会自动触发的外部动作。

检测到 `.changeset/config.json` 或 `@changesets/cli` 时，完整阅读
[Changesets 适配器](references/changesets.md)，并使用仓库本地安装的 CLI。

**完成条件：** 已明确 prepare 命令、预期产物、校验命令、自动化 ownership
和全部潜在外部动作。

## 2. 选择模式

- 用户要求“准备发布”“生成版本/CHANGELOG”或只想看发布内容时，使用
  `prepare`。
- 用户明确要求发布、tag、push 或 deploy 已审阅的 prepare 产物时，使用
  `publish`。
- `publish` 找不到可验证的 prepare 产物时，返回 `prepare`。

模糊的“继续”只授权当前本地步骤，不授权外部动作。

**完成条件：** 当前模式和本轮允许执行的最高动作边界已经明确。

## 3. Prepare

1. 记录 `HEAD`、工作区状态和目标版本。无关修改可能与生成器重叠时，停止并说明；
   可以证明隔离时保持其状态不变。
2. 在消费任何发布片段前，用仓库原生命令导出 release plan 到临时路径；
   没有 plan 命令时，从发布片段、版本文件、Git Diff 和发布配置合成只读计划。
   空计划时区分“没有待发布内容”和“已经 prepare”。
3. 把用户给出的版本当作预期结果，与计算结果严格比较。版本工具不能直接接受
   精确版本时，遵循其状态机，不手改内部状态凑版本。
4. 调用 `$maintain-test-plan`，传入 release plan、版本周期、当前增量、
   Git ref、测试证据和 `phase=prepare`。失败时保留发布片段并停止。
5. 运行仓库原生的 version/CHANGELOG 生成步骤，不执行包装脚本中的外部动作。
6. 检查版本、依赖、CHANGELOG、已消费片段、测试文档和全部计划外文件。

重复执行时，若相同目标的版本产物已存在且尚未提交，只重新验证和展示，
不再次生成版本。

使用选定语言输出模式、目标与计算版本、release plan 摘要、测试文档路径、
完整文件清单、关键 diff、验证结果和 `externalActionsExecuted: []`，然后停止审阅。
保留命令、代码标识符、package 名、版本号和专有名词的原文。

**完成条件：** release plan 已在消费前保存，测试文档已更新，本地 diff 与计划一致，
且没有执行外部动作。

## 4. Publish

重新核对 prepare 产物、`HEAD`、版本、测试门禁、目标 tag、发布分支、remote、
registry、environment 和 CI 自动触发行为。自动化已经拥有某一步时，将其标记为
automation-owned，不在本地重复执行。

展示并等待确认：

```text
版本: <version>
本地提交: <exact paths + message | 不适用>
Tag: <exact command | automation-owned | 不适用>
Package publish: <registry + exact command | automation-owned | 不适用>
Push: <remote + refs + triggered workflows | 不适用>
部署: <environment + exact command | automation-owned | 不适用>
通知: <channel + exact command | 不适用>
```

确认后按预览顺序逐项执行和记录。每步完成后再进入下一步；失败时停止，列出
已完成、未完成和可安全恢复的动作。有重复发布风险的步骤等待新授权后再重试。

正式版完成后调用 `$maintain-test-plan`，传入 `phase=released` 及刚执行成功的
publish/deploy 结果作为证据；候选版本只追加构建结果，不冻结版本周期文档。

**完成条件：** 实际动作与确认清单逐项对应，并汇报 commit、tags、published
artifacts、pushed refs、deployments、notifications 和任何 partial failure。

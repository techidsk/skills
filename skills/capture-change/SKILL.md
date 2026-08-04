---
name: capture-change
description: "捕获已完成开发工作的发布意图：基于完整 Git Diff，遵循仓库现有的 release metadata 机制，幂等更新发布片段，并可选创建经确认的本地提交。Use when the user asks for 本地收口 or 提交这批改动 in any language or ecosystem."
---

# Capture Change

在开发结果聚合完成后，一次性整理发布意图、发布元数据和可选本地提交。

## 边界

- 协调 Agent 独占发布元数据、暂存区和最终提交的写权限；其他 Agent 只返回分析。
- 以开发基线 merge-base 到工作区的完整 Diff 为证据，并按独立发布意图归并。
- 遵循仓库已有机制，不因本 Skill 引入 Changesets、towncrier 或其他发布工具。
- 先展示完整预览；用户一次确认后再写文件和可选提交。
- 逐一路径执行 `git add -- <path>`。严禁 broad staging。
- 止于本地结果；远程、版本更新、tag、publish 和 deploy 由后续流程处理。

## 1. 发现仓库约定

读取仓库指令、manifest、lockfile、发布配置和 CI，确定：

- 项目边界与版本策略，包括 monorepo、单项目和混合语言仓库。
- 现有发布元数据机制，例如 Changesets、changelog fragments 或仓库自定义格式。
- 对应的校验命令、开发基线和当前 Agent 的 writer 角色。

优先采用仓库文档和现有文件格式，其次采用发布脚本与 CI 行为。仓库没有片段机制时，
只生成预览、PR / squash 标题和可选提交，不创建新的发布元数据格式。

**完成条件：** 已明确项目边界、版本策略、发布元数据机制、校验方式和 writer 角色。

## 2. 确定完整范围

按“用户指定 → 仓库主开发分支 → `origin/HEAD` → `origin/main` 或 `main`”
解析 `BASE_REF`，再计算 `MERGE_BASE=$(git merge-base HEAD "$BASE_REF")`。

```bash
git status --short
git diff --name-status "$MERGE_BASE" --
git diff --stat "$MERGE_BASE" --
git ls-files --others --exclude-standard
git log --format='%h %s' "$MERGE_BASE"..HEAD
```

查看每个相关 diff 和 untracked 文件；归属不明的路径标记为 `ambiguous`。

**完成条件：** 每个变更路径均已查看并明确归属，或已标记为 `ambiguous`。

## 3. 归并发布意图

- 同一意图应有独立的用户结果、验收方法、兼容性和回滚边界。
- commit、文件、模块、package 和 Agent 数量都是证据，不是拆分单位。
- 将路径映射到仓库定义的项目、package、target、module 或发布单元。
- 按仓库版本策略判断影响；使用 SemVer 时，迁移为 `major`、兼容新增为
  `minor`、修复为 `patch`、无发布行为变化为 `none`。
- 用“用户结果 + 发布单元 + 兼容性 + 验收方式”匹配现有片段：更新当前分支片段，
  复用基线等价片段，缺失时按原格式创建稳定文件，无关片段保持原样。
- 发布片段只写用户影响和必要迁移说明；测试、风险和回滚留在预览中。

每个路径只归入 `releaseIntent`、`noReleaseMetadata` 或 `ambiguous` 之一。

**完成条件：** 所有路径和现有片段均已对账，且不存在重复发布意图。

## 4. 预览并确认

展示基线与 Diff、每个意图的证据、发布单元、版本影响、元数据
`create|update|covered|none` 动作与完整内容，以及无需元数据项、歧义、测试、
风险、回滚和建议 PR / squash 标题。

请求提交时，同时展示准确暂存路径和仓库约定的 commit message；
仓库无明确约定时使用 Conventional Commits。
只读参与者在此返回分析并结束。协调 Agent 等待一次确认；内容实质变化时重新预览。

**完成条件：** 用户已确认完整预览，或流程已无写入地结束。

## 5. 写入、验证与可选提交

只执行确认的元数据动作，并运行仓库已有的解析或校验命令。核对所有新增文件；
失败时保留现场并报告具体文件与诊断。

提交计划已确认时，逐一路径暂存并运行仓库规定的快速校验；用
`git diff --cached --name-status` 和 `git diff --cached --check` 复核后提交。
校验或 hook 改变范围时返回预览。

**完成条件：** 发布元数据与预览一致；可选提交返回 hash 且路径准确；
最终汇报已写入、已提交和留给后续流程的动作。

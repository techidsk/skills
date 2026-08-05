---
description: 汇总仓库中累积的 release metadata，准备版本、CHANGELOG 和测试计划，并在明确授权后执行外部发布。Use when the user asks to 准备发布 a version or confirms publishing an already reviewed release in any language or ecosystem.
metadata:
    github-path: skills/release
    github-pinned: 446a09f
    github-ref: 446a09fdf326930aee3f4fbbd8b38a892e8928cf
    github-repo: https://github.com/techidsk/skills
    github-tree-sha: f072102195ff3b891f1ab2a7a1941adef8613c3b
name: release
---
# Release

默认执行本地 `prepare`。外部 `publish` 必须基于已展示且未变化的动作清单。

## 发现发布模型

读取仓库指令、版本文件、发布配置、脚本、CI、当前状态、tags 和 remotes，确定版本
策略、发布单元、目标版本、release metadata、CHANGELOG 生成方式，以及 commit、tag、
publish、push、deploy 和通知分别由本地还是自动化负责。

使用仓库原生工具，不因本 Skill 引入新机制。检测到 Changesets 时读取
[Changesets 适配器](references/changesets.md)，并使用仓库安装的 CLI。

输出语言：用户指定 → 仓库指令 → 现有 CHANGELOG/发布文档 → 当前对话语言。

## Prepare

用户说“准备发布”即授权以下本地步骤，不需要确认：

1. 记录 `HEAD`、工作区和目标版本；生成器可能覆盖无关修改时停止。
2. 在消费任何片段前，用仓库原生命令导出 release plan；没有命令时从全部待发布
   片段、版本文件和 Git 证据合成只读计划。空计划时区分无待发布内容与已 prepare。
3. 把用户版本当作预期结果并与计算值核对，不修改工具内部状态强行凑版本。
4. 调用 `$maintain-test-plan`，传入完整计划、候选版本、Git ref 和已有测试证据。
5. 运行仓库原生 version/CHANGELOG 步骤，再用已保存的 plan 和最终 version/build
   幂等刷新测试计划。
6. 验证版本、依赖、CHANGELOG、片段消费、测试文档和计划外文件。

相同目标已存在未提交的 prepare 产物时只重新验证。完成后展示 release plan、完整
本地 diff、校验结果，以及下一步实际需要的外部动作；不 commit、tag、push、publish、
deploy 或通知。

## Publish

若尚未展示精确动作，先列出本次实际存在的 release commit、tag、registry publish、
push refs/触发的 CI、deploy environment、通知，以及发布后测试文档写回的责任方，
然后等待“确认发布”。用户对未变化清单说“确认发布”后直接执行，不再要求第二次
`ok`。

执行前重新核对 `HEAD`、版本、测试门禁、目标与自动化 ownership；任何关键项变化都
返回新清单。按顺序执行，每步成功后再继续；失败时停止并列出已完成、未完成及安全
恢复方式。可能重复发布的步骤必须重新授权后才能重试。

需要 release commit 时调用 `$commit` 并限定为本次生成路径；版本与 CHANGELOG 产物
不再创建新的发布片段。发布成功后调用 `$maintain-test-plan` 写入真实证据：正式版
冻结，候选版只更新构建历史。若文档发生变化，只执行动作清单中已确认的 commit/push；
否则明确报告待写回状态。

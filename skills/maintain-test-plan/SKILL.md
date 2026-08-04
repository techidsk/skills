---
name: maintain-test-plan
description: "按仓库的版本周期幂等创建、更新或冻结累计发布测试计划，保留人工状态并记录候选版本增量。Use when another release workflow provides a release plan, or the user asks to update release testing, compare candidates, record test evidence, or freeze a released cycle in any language or ecosystem."
---

# Maintain Test Plan

通常由 `$release` 调用，也可独立维护发布测试文档。由仓库证据生成内容，不让开发者
手填模板。Markdown 是默认且唯一的持久状态；仓库已有机器可读状态时才复用它。

## 边界

- 先读取仓库指令、发布约定和已有测试文档；不引入新的版本或发布工具。
- 输出语言：用户指定 → 仓库指令 → 现有测试文档 → 发布元数据 → 当前对话语言。
- 保留命令、代码标识符、模块/package 名、版本号和专有名词的原文。
- 保留人工 checkbox、备注、负责人、链接、缺陷编号和测试证据。
- 没有证据时，不宣称测试通过、问题已修复或风险已解除。
- 相同输入重复执行必须 upsert，不能重复增加范围、测试项、问题或构建记录。

## 输入

从调用方或仓库发现以下信息；字段名不限：

- 当前 release/candidate 标识和阶段：`prepare`、`candidate`、`released` 或
  `correction`。
- release plan：原生计划，或由发布元数据、版本文件与 Git diff 合成的只读计划。
- version cycle/release train 标识、当前 Git ref、测试结果、已知问题和发布动作证据。
- 可选的输出路径、上一候选和仓库规定的归档策略。

缺少可验证的当前版本或 release plan 时停止，不从已消费的发布片段或版本后缀猜测。

## 1. 确定周期、路径和语言

使用仓库的版本解析器或发布规则确定周期标识：

- SemVer 风格的 `1.4.1-beta.1`、`1.4.1-rc.1` 与 `1.4.1` 通常属于
  `1.4.1` 周期。
- PEP 440、Swift marketing version、CalVer 或自定义 release train 按仓库规则
  归并，不套用自写的 SemVer 正则。
- 调用方明确给出的 cycle ID 必须与仓库证据校验。

路径优先级：调用方指定 → 仓库现有约定或同周期文档 →
`docs/releases/<cycle-id>-testing.md`。若 `docs/` 有维护规范，先读取并遵守。
同一周期只维护一份文档。

**完成条件：** 周期、路径、语言和版本状态均有仓库证据。

## 2. 计算累计范围与候选增量

先完整读取已有文档，再从 release plan、发布元数据和 Git 证据计算：

- **累计范围**：该周期截至当前候选的全部独立发布意图。
- **当前增量**：相对文档构建历史中上一候选新增或实质改变的意图。
- **测试与回归**：由变更涉及的接口、依赖、权限、数据、配置和核心路径推导。

上一候选以已有构建历史或调用方证据为准，不能通过 `beta.2` 猜出 `beta.1`。
原生 plan 只包含本次增量时，将其合并进累计范围；plan 重现全周期内容时按稳定 ID
去重。优先复用发布片段或 issue ID，否则生成后持续复用语义稳定的 slug。

## 3. 幂等维护文档

文档至少表达：当前候选与状态、累计范围、当前增量、重点测试、回归清单、遗留问题、
已修问题、风险与回滚、构建历史、发布后验证。标题随输出语言和仓库惯例调整。

使用不依赖自然语言标题的 HTML 标识定位周期、章节和条目：

```md
<!-- release-test-plan:cycle=1.4.1 -->
<!-- release-test-plan:section=current-delta -->
- 支持批量导出。 <!-- intent:order-export -->
- [ ] 验证导出权限。 <!-- test:order-export-permission -->
- 登录偶发超时。 <!-- issue:login-timeout -->
```

更新规则：

- 按 ID 更新既有条目，只在语义变化时润色文字，不因翻译改变 ID。
- 新测试项放入最相关分组；不适用项保留处置原因，不静默删除。
- 只有明确证据才能改变 checkbox 或将遗留问题移入已修问题。
- 构建历史以仓库能唯一标识一次候选构建的 release/candidate/build 组合为键；
  候选标识本身唯一时只用候选标识。重跑更新原记录，新构建追加记录。
- 未知日期、commit、tag 或状态写仓库惯用的未知值，不猜测。
- 修改拥有的条目和章节，不用新骨架覆盖全文；人工自由段落保持原位。

**完成条件：** 当前候选、累计范围、增量和构建历史相互一致，且所有稳定 ID 唯一。

## 4. 冻结或勘误

只有仓库证据表明正式版本已经发布且 `phase=released` 时才冻结；`$release` 成功执行
并返回的 publish/deploy 结果属于此类证据。记录正式版本、release commit/tag、
发布日期及未关闭问题的处置，并按仓库约定归档。候选版本发布只更新构建历史，
不冻结周期。

冻结后，普通调用不得改写历史。`phase=correction` 只追加带日期、原因和证据的勘误。

## 5. 验证与输出

检查同周期无第二份文档、无重复 ID 或候选记录、人工内容未丢失、没有残留占位符，
并运行仓库文档校验。汇报文档路径、周期、当前与上一候选、条目变化、问题变化、
构建记录、验证结果及是否冻结。

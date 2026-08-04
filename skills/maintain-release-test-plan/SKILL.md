---
name: maintain-release-test-plan
description: 根据 Changesets release plan 和仓库变更，按去掉 prerelease/build metadata 后的核心 SemVer 幂等创建或更新累计发版测试文档。Use when Release Skill 传入候选版本，或用户说“更新发版走查”“生成版本测试文档”“记录 beta/rc 增量”“冻结正式版测试计划”时。通常由 `$run-changesets-release` 自动调用，不要求开发者手填模板。
---

# Maintain Release Test Plan

一个核心版本只维护一份动态 Markdown：

```text
1.4.1-beta.1 ┐
1.4.1-beta.2 ├─> docs/releases/1.4.1-testing.md
1.4.1-rc.1   │
1.4.1        ┘
```

Markdown 是唯一持久状态；默认不新增独立 manifest。使用稳定标题、隐藏标识和构建历史保证重复执行可对账。

## 不可破坏的约束

- 在 `changeset version` 消费片段之前读取 release plan 和 Changeset 正文。
- 更新已有文档时保留人工勾选状态、备注、遗留问题和测试证据。
- 同一候选版本重复运行必须 upsert，不能追加重复构建或重复测试项。
- 不把测试细节写入 CHANGELOG 或 Changeset 正文。
- 不凭空宣称测试通过、问题已修复或风险已解除。
- 正式版成功发布后冻结文档；除明确勘误外不再改写该周期历史。

## 输入

优先接收：

```yaml
candidateVersion: 1.4.1-beta.2
phase: prepare|released|correction
releasePlan: <changeset status --output JSON path or parsed content>
changesets:
  - path: .changeset/order-csv-export.md
    summary: 支持按筛选条件导出订单 CSV。
sourceRef: <branch or sha>
previousCandidate: <optional>
testEvidence: <optional PR descriptions, test logs, issue notes>
outputPath: <optional>
```

缺少 candidate version 或 release plan 时停止并要求调用方补齐。不要等到 Changeset 被消费后再猜发布范围。

## 1. 确定版本周期与路径

验证标准 SemVer。核心版本等于去掉 prerelease 和 build metadata 的 `major.minor.patch`：

- `1.4.1-beta.1` → `1.4.1`
- `1.4.1-rc.3+build.8` → `1.4.1`
- `1.4.1` → `1.4.1`

输出路径按以下优先级：

1. 调用方明确指定。
2. 仓库发布文档约定。
3. `docs/releases/<core-version>-testing.md`。

若同一核心版本已有其他路径，复用现有文件，不创建第二份。

## 2. 读取文档契约

更新前完整阅读
[references/document-contract.md](references/document-contract.md)。新建文档时以
[assets/release-testing-template.md](assets/release-testing-template.md)
为骨架，并删除所有占位说明。

若仓库对 `docs/` 有贡献规范，先读取并遵守索引、命名、归档和 lint 要求。

## 3. 计算累计范围和本次增量

从 release plan、Changeset 和已有文档生成：

- **累计范围**：本核心版本周期从第一个 beta 到当前候选的所有独立发布意图。
- **本次增量**：当前候选首次引入或相对上一个候选发生实质变化的意图。
- **回归范围**：由累计范围的依赖、权限、数据、配置和核心路径推导。

活跃 prerelease 的 release plan 通常只含尚未用于此前候选的 Changeset。必须把
本次增量合并进已有文档来得到累计范围；不得用本次 plan 覆盖整个版本周期。
退出 prerelease 时 plan 可能重新出现全周期片段，应按稳定 ID 去重。

每个意图优先使用 Changeset 文件名作为稳定 ID，例如：

```md
- 支持按筛选条件导出订单 CSV。 <!-- intent:order-csv-export -->
```

一个意图跨候选继续调整时更新原条目，不重复追加。没有可靠 Changeset ID 时使用稳定的功能 slug，并在后续运行复用。

## 4. 维护测试状态

为测试项增加稳定 ID：

```md
- [ ] 普通用户只能导出有权查看的订单。 <!-- test:order-export-permission -->
```

更新规则：

- 已存在 ID：保留 `[ ]` / `[x]` 和人工备注；仅在语义确实变化时改文字。
- 新 ID：追加到最相关的分组。
- 已不适用：移到“已修问题”或保留删除原因，不静默消失。
- 没有证据：不得从 `[ ]` 改为 `[x]`。

遗留问题只在用户说明或证据明确时移动到“已修问题”。记录修复首次进入的候选版本。

## 5. 幂等更新构建历史

构建历史以 candidate version 为键：

```md
| 1.4.1-beta.2 | 2026-08-04 | abc1234 | order-csv-export | 待走查 |
```

- 同版本重跑：更新这一行，不新增第二行。
- 新候选：追加一行，并把它作为“相对上一候选版本”的比较对象。
- `phase=prepare`：状态只能是待走查、走查中或调用方提供的真实状态。
- `phase=released`：只有发布动作确实成功后标记已发布。

日期使用仓库时区；未知 commit 或证据写 `—`，不要猜测。

## 6. 正式版冻结

当 candidate version 没有 prerelease 且 `phase=released`：

1. 将状态改为“已发布（冻结）”。
2. 记录正式版本、release commit/tag 和发布日期。
3. 保留未关闭问题及其处置结论。
4. 按仓库约定归档；没有约定时保持原路径。

冻结后，普通 `prepare` 调用不得修改此文件。`phase=correction` 只追加明确标注日期和原因的勘误，不重写历史。

## 7. 验证

更新后检查：

- 文件名使用 core version，而非 prerelease version。
- 当前候选、累计范围、本次增量和构建历史彼此一致。
- 没有重复 intent ID、test ID 或 candidate version。
- 人工 checkbox、备注和证据未丢失。
- 所有模板占位符已清除。
- 仓库文档 lint 通过。

## 完成输出

汇报：

- 测试文档路径和核心版本。
- 当前候选及上一候选。
- 新增、更新和保留的测试项数量。
- 遗留/已修问题变化。
- 构建历史变化。
- 文档是否已冻结。

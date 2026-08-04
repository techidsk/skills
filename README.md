# AI-first Agent Skills

一组面向 AI 编程 Agent 的跨语言发布 Skills。目标是让开发者只负责开发和确认，
由 AI 自动生成发布片段、CHANGELOG 和版本测试计划。

当前版本：[v0.1.0](https://github.com/techidsk/skills/releases/tag/v0.1.0)

## 安装

需要 GitHub CLI `2.90.0` 或更高版本。

交互式选择并安装：

```bash
gh skill install techidsk/skills
```

安装指定 Skill 到 Codex 用户目录：

```bash
gh skill install techidsk/skills commit --agent codex --scope user
gh skill install techidsk/skills release --agent codex --scope user
gh skill install techidsk/skills maintain-test-plan --agent codex --scope user
```

固定到指定版本：

```bash
gh skill install techidsk/skills commit \
  --agent codex \
  --scope user \
  --pin v0.1.0
```

安装前预览内容：

```bash
gh skill preview techidsk/skills commit
```

## Skills

| Skill | 作用 | 常用触发语句 |
| --- | --- | --- |
| [`commit`](skills/commit/SKILL.md) | 提交当前 Session，并生成发布片段 | “提交一下” |
| [`release`](skills/release/SKILL.md) | 汇总片段，准备或执行发布 | “准备发布 1.4.1” |
| [`maintain-test-plan`](skills/maintain-test-plan/SKILL.md) | 累计维护版本测试计划 | 通常由 `release` 自动调用 |

## 工作流

```text
开发当前 Session
→ $commit 提交代码与发布片段
→ 多个发布片段持续累积
→ $release 导出完整 release plan
→ $maintain-test-plan 生成累计测试计划
→ 仓库原生 version 步骤更新版本与 CHANGELOG
→ 用户确认外部动作
→ publish / tag / push / deploy
```

### 提交

对 Agent 说：

```text
提交一下。
```

`$commit` 默认只提交当前对话 Session 产生的文件或 hunk，不会顺带提交用户原有
改动、其他 Session 或其他 Agent 的工作。

每个需要发布的 commit 会同时包含对应发布片段。一个 commit 可以产生多个独立
片段，一个片段也可以覆盖多个 package 或发布单元。纯测试、文档、CI 或无发布影响
的内部改动可以不生成片段，但 Agent 必须说明 `none` 的原因。

### 准备发布

对 Agent 说：

```text
准备发布 1.4.1-beta.2。
```

`$release` 默认只执行本地 `prepare`：

1. 在片段被消费前导出完整 release plan。
2. 更新当前版本周期的累计测试计划。
3. 运行仓库原生 version 与 CHANGELOG 步骤。
4. 用最终 version/build 幂等刷新测试计划。
5. 展示完整 diff、验证结果和后续外部动作。

`prepare` 不会 commit、tag、push、publish、deploy 或发送通知。

### 确认发布

审阅 prepare 产物后说：

```text
确认发布。
```

Agent 只执行已经展示且未变化的动作清单，不会重复询问一次 `ok`。如果目标版本、
registry、tag、remote、environment 或自动化责任发生变化，会展示新清单并重新确认。

## 跨语言与发布机制

Skills 不要求项目使用 Node 或 pnpm，也不会主动引入发布工具。它们会沿用仓库已有
机制，例如：

- Node.js：Changesets 或自定义 changelog fragments。
- Python：towncrier、版本文件或仓库脚本。
- Swift：release note fragments、`MARKETING_VERSION` 与构建号。
- 其他项目：CalVer、自定义 release train 或部署版本。

仓库使用 Changesets 时，每个可发布 commit 可以贡献一个或多个 `.changeset/*.md`。
最终 `changeset version` 会汇总所有片段，更新版本、内部依赖和 CHANGELOG，并删除
已消费的片段。

## 输出语言

发布片段、CHANGELOG 和测试文档可以使用中文。默认优先级为：

```text
用户指定 → 仓库指令 → 现有文档或元数据 → 当前对话语言
```

命令、代码标识符、package 名和版本号保持原样。

## 安全边界

- Commit 默认只处理当前 Session，不使用宽泛暂存。
- Prepare 只生成本地可审阅产物。
- Tag、push、publish、deploy 和通知必须经过明确授权。
- 没有证据时，不把测试标记为通过，也不宣称问题已经修复。
- CI 或发布平台拥有的动作不会在本地重复执行。

## 仓库结构

```text
skills/
├── commit/
├── release/
└── maintain-test-plan/
```

每个 Skill 只要求一个 `SKILL.md`。`agents/openai.yaml` 提供 UI 元数据，
`references/` 只保存按条件读取的实现细节。

创建新 Skill 时可从
[`templates/skill-template.md`](templates/skill-template.md) 开始。

## 维护与校验

校验 Markdown：

```bash
pnpm dlx markdownlint-cli2 '**/*.md'
```

按 Agent Skills 规范检查发布内容：

```bash
gh skill publish --dry-run
```

提交贡献时，请使用简短的动词式 Skill 名称，并确保说明触发语义、安全边界和验证
方式。

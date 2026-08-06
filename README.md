# AI-first Agent Skills

一组面向 AI 编程 Agent 的跨语言发布 Skills。目标是让开发者只负责开发和确认，
由 AI 自动生成发布片段、CHANGELOG 和版本测试计划。

当前版本：[v0.1.0](https://github.com/techidsk/skills/releases/tag/v0.1.0)

## 安装

### 交互式安装（推荐）

在普通终端中，使用 `skills` TUI 选择要安装的 Skill；检测到多个 Agent 时还可选择
目标 Agent：

```bash
npx skills@latest add techidsk/skills
```

如果由 Codex 或其他 AI Agent 代为运行，`skills` CLI 会自动切换到非交互模式。此时可
先列出 Skill，再显式指定要安装的项目：

```bash
npx skills@latest add techidsk/skills --list
npx skills@latest add techidsk/skills --skill commit
```

安装器会复制 Skill，并用 `skills-lock.json` 记录来源；副本不会在后台静默变化。
需要拉取新版时运行：

```bash
npx skills update
```

按功能分类进行非交互式安装时，可以使用仓库提供的统一入口。例如安装整个
`engineering` 分类到 Codex 用户目录：

```bash
./scripts/install-skills.sh --installer npx --category engineering --dry-run
./scripts/install-skills.sh --installer npx --category engineering
```

脚本会把分类展开为多个 `--skill` 参数。可用 `--scope project` 改为项目级安装，或用
`--agent` 指定其他 Agent。

### GitHub CLI

需要 GitHub CLI `2.90.0` 或更高版本。交互式选择并安装到 Codex 用户目录：

```bash
gh skill install techidsk/skills --agent codex --scope user
```

安装全部 Skill：

```bash
gh skill install techidsk/skills --all --agent codex --scope user
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

GitHub CLI 当前每次只接受一个明确的 Skill；统一入口会依次安装分类内的 Skill：

```bash
./scripts/install-skills.sh --installer gh --category engineering --dry-run
./scripts/install-skills.sh --installer gh --category engineering
```

两个安装器均默认使用 `techidsk/skills`、`codex` 和用户级目录。通过
`--repository`、`--agent` 和 `--scope` 可以覆盖这些默认值。

### 维护者开发链接

仓库维护者可以把正式源目录链接到本机 Agent Skill 目录。先预览，再执行：

```bash
./scripts/link-skills.sh --target codex --category engineering --dry-run
./scripts/link-skills.sh --target codex --category engineering
```

`--target agents` 使用通用的 `~/.agents/skills`，`--target all` 同时链接通用目录和
Codex 目录。已有普通文件或目录时脚本会停止；显式使用 `--force` 时，会先移动到目标
目录内的 `.skill-backups/`，再创建链接。

链接模式下，Skill 始终指向当前仓库；后续 `git pull` 即可获得更新。查看仓库中可用
Skill：

```bash
./scripts/list-skills.sh
```

## Skills

| Skill | 作用 | 常用触发语句 |
| --- | --- | --- |
| [`commit`](skills/engineering/commit/SKILL.md) | 提交当前 Session，并生成发布片段 | “提交一下” |
| [`release`](skills/engineering/release/SKILL.md) | 检查工具链并准备或执行发布 | “准备发布 1.4.1” |
| [`maintain-test-plan`](skills/engineering/maintain-test-plan/SKILL.md) | 累计维护版本测试计划 | 通常由 `release` 自动调用 |

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

如果本次发布需要 Webhook，Agent 会优先使用仓库已有通知入口。未发现配置时会让用户
选择配置或跳过；选择配置后可用 release Skill 自带的初始化脚本选择 generic、Slack、
Discord、飞书或钉钉，以及 `best-effort`/`blocking` 失败策略。仓库配置只保存 URL 的
环境变量名，不保存或显示 secret URL。通知是已确认动作清单中的独立外部动作，默认在
核心发布成功后发送，失败不会把已经完成的 publish、tag 或 deploy 描述为失败。

## 跨语言与发布机制

Skills 不要求项目使用 Node 或 pnpm，也不会主动引入发布工具。`$release` 只检查当前
发布模型实际要求的配置、metadata、版本固定方式和仓库认可入口；不适用的 package
manager、lockfile 或 CLI 会记录为 `none`，不会被误判成缺失。它会沿用仓库已有机制，
例如：

- Node.js：Changesets 或自定义 changelog fragments。
- Python：towncrier、版本文件或仓库脚本。
- Swift：release note fragments、`MARKETING_VERSION` 与构建号。
- 其他项目：CalVer、自定义 release train 或部署版本。

就绪检查把仓库分为 `ready`、`configured-but-unavailable` 和 `absent`。已检测到配置或
CI 引用但 CLI 不可用时会阻塞，不会降级成手工发布；完全没有发布机制时只生成只读
计划。

安装和初始化不属于 `$release`。仓库可以另行提供 doctor/setup/bootstrap 命令或文档；
Skill 只展示已存在的精确入口并停止，不执行它，也不会为缺少入口的仓库自动选择
Changesets、Hatch 或其他机制。修复完成后重新运行 `$release` 的发现与就绪检查。

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
└── engineering/
    ├── commit/
    ├── release/
    │   ├── scripts/init_webhook.py
    │   └── scripts/send_webhook.py
    └── maintain-test-plan/

scripts/
├── link-skills.sh
└── list-skills.sh
```

`skills/` 是唯一正式源，第二级目录按功能类别划分。每个 Skill 只要求一个
`SKILL.md`；`agents/openai.yaml` 提供 UI 元数据，`references/` 只保存按条件读取的
实现细节。安装目录和 Agent 用户目录只保存副本或链接，不作为源文件维护。

创建新 Skill 时可从
[`templates/skill-template.md`](templates/skill-template.md) 开始。

## 维护与校验

运行仓库回归测试：

```bash
bash tests/run.sh
```

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

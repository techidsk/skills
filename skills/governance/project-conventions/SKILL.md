---
name: project-conventions
description: 给 TypeScript 项目落地一套通用工程规范：编码与命名、目录与架构约束、文档治理、治理检查与交付（存量基线 + 告警档）。在新项目初始化规范、给已有项目补 AGENTS.md／lint 闸／文档规则，或用户说「套用通用规范」「把规范装到这个项目」时使用。
---

# 通用工程规范落地

这套规范从一个长期维护的 Next.js monorepo 提炼而来，业务约定已剥离。规则正文在 `reference/`，可复制的文件在 `templates/`。落地的产物是**目标项目自己的**规范：AGENTS.md、docs、lint 规则、检查脚本都写进目标仓库，之后由目标项目维护，与本 Skill 脱钩。

## 四个部分

| 部分 | 规则正文 | 模板 |
| --- | --- | --- |
| 编码与命名 | [reference/coding.md](reference/coding.md) | `templates/eslint/naming.mjs`、`comment-hygiene.mjs` |
| 目录与架构约束 | [reference/architecture.md](reference/architecture.md) | `templates/eslint/no-barrel-file.mjs`、`eslint.config.snippet.mjs` 的分层 zones、`templates/dependency-cruiser.cjs` |
| 文档治理 | [reference/docs.md](reference/docs.md) | `templates/AGENTS.md`、`templates/docs-README.md`、`templates/scripts/check-src-readmes.mjs` |
| 治理检查与交付 | [reference/gates.md](reference/gates.md) | `templates/scripts/`、`templates/ci/` |

用户没点名时四部分全装；只要其中几部分时，只读对应的规则正文。

## 步骤

### 1. 摸底

读目标项目的包管理器、框架、TypeScript 配置、目录布局、现有 `AGENTS.md`／`CLAUDE.md`、`docs/`、ESLint 配置和 CI 工作流。

完成判据：下列占位符每个都有取值（答不出的问用户，不猜），另记下已有哪些规范文本和检查、CI 用什么平台：

| 占位符 | 取值 |
| --- | --- |
| `{{项目名}}`、`{{包管理器}}` | 项目名；npm / pnpm / yarn |
| `{{源码根}}`、`{{文档根}}` | 如 `src`、`docs` |
| `{{入口薄层目录}}`、`{{业务模块目录}}`、`{{基础设施目录}}`、`{{共享组件目录}}` | 相对源码根的目录名，如 `app`、`modules`、`lib`、`components`；没有的层记「无」 |
| `{{领域}}`、`{{领域文档}}`、`{{领域任务}}` | 业务领域清单（从业务模块子目录和现有 docs 子目录推出），每个领域一条「修改什么前读哪份」 |
| `{{注释语言}}`、`{{运行时配置入口}}`、`{{环境变量入口}}`、`{{日志入口}}` | 团队注释语言；配置、env、logger 的导入路径，没有的记「无」 |

### 2. 写规则文本

以 `templates/AGENTS.md` 为骨架生成目标项目的入口文件，替换全部占位符，删掉文件头的落地说明注释。已有 AGENTS.md 时合并：保留项目自有的业务规则，通用条目以模板为准，冲突处问用户。`CLAUDE.md` 只写 `@AGENTS.md` 一行导入。

细则按下表改写成目标项目的正本，AGENTS.md 只留指针。改写时删掉项目用不上的条目（例如没有前端就删共享组件相关段），「装法」段改成项目里的实际文件位置：

| 规则正文 | 落到目标项目 |
| --- | --- |
| `reference/coding.md` | `{{文档根}}/agents/coding.md` |
| `reference/architecture.md` | `{{文档根}}/architecture.md` |
| `reference/docs.md` | `{{文档根}}/agents/contributing.md` 的「文档规范」节 |
| `reference/gates.md` | 同一文件的「治理检查」「测试与交付」「Git 规范」三节 |

完成判据：`grep -rn '{{' AGENTS.md {{文档根}}/` 无命中；AGENTS.md 每条指针的目标文件和锚点都存在；`{{文档根}}/README.md` 已登记新增文档（骨架见 `templates/docs-README.md`）。

### 3. 装检查

把 `templates/` 下选中的规则与脚本复制进目标项目，按文件头的「配置」段改路径与目录名。每个检查装好后**立刻跑一次生成存量基线**，让既有违规进基线、只拦新增。具体顺序与基线生成命令见 [reference/gates.md](reference/gates.md)。

完成判据：每个检查在当前代码上跑出 ✅ 或只有基线内告警；每个检查的测试用 `node --test` 跑通。

### 4. 接线

把检查登记进统一入口 `verify` 脚本和 CI；CI 跑的每个检查 `verify` 都覆盖（模板自带的对齐测试会断言这一点）。

完成判据：`verify` 本地跑通；对齐测试通过；CI 工作流里每个检查一步，告警档步骤不阻断合并。

### 5. 汇报

列出写入的文件、每个检查的基线数字、没装的部分及原因、需要用户决定的事（例如某条规则与项目现状冲突）。没跑过的检查不说通过。

## 落地时守住的几条

- **存量基线不是许可**：基线只减不增；修掉存量后把基线调小，新增违规按告警处理并在 review 中清掉。
- **默认告警档**：新检查先 `exit 0` + CI `::warning::`，团队稳定后再给脚本加 `--strict` 升为硬闸。
- **规则只有一份正本**：同一条规则只写在一处，其他地方链接过去；AGENTS.md 不复制 docs 正文。
- **能交给工具的交给工具**：写进 lint／检查的规则，文档只说「为什么」和例外，不重复判定细节。

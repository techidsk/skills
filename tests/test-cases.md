# Agent Skills 验收测试集

这份测试集验证 `commit`、`release` 和 `maintain-test-plan` 的可观察行为。每个场景都应
在隔离的临时 Git 仓库中执行，记录最终 diff、Git 状态、版本文件、发布文档和外部动作
清单。

通过条件：产物符合“期望行为”，并且没有执行“禁止副作用”。如果缺少证据，场景应保持未完成或停止，而不是推断成功。

| ID | 触发与夹具 | 期望行为 | 禁止副作用 |
| --- | --- | --- | --- |
| `CMT-001` | 用户只说“看看这个 diff”，没有提交意图。 | 只检查并解释改动，不触发 commit 或 release metadata。 | 不创建 commit、片段或远程动作。 |
| `CMT-002` | 临时仓库中同时存在用户原有未提交改动、其他 Agent 的 staged 文件和本 Session 新文件；用户说“提交一下”。 | 只识别并提交本 Session 的文件或 hunk，保留范围外状态。 | 不使用宽泛 staging，不覆盖或 unstage 范围外改动。 |
| `CMT-003` | 本 Session 包含一个需要发布的功能改动和一个纯文档改动。 | 功能 commit 搭配仓库原生 release metadata；文档改动可以标记为 `none`，并说明原因。 | 不引入仓库没有的发布工具。 |
| `CMT-004` | 同一文件混有无法可靠拆分的多方 hunk，或发现疑似凭据，或意图为 breaking/major。 | 停止并请求确认或拆分信息，明确列出阻塞原因。 | 不擅自提交、清除凭据、unstage 或扩大范围。 |
| `REL-001` | 仓库有待发布 metadata，用户说“准备发布 1.4.1”。 | 执行本地 `prepare`：导出计划、维护测试计划、运行版本/CHANGELOG 步骤并验证最终 diff。 | 不 commit、tag、push、publish、deploy 或通知。 |
| `REL-002` | 仓库使用 Changesets，存在 `.changeset` 片段和 prerelease 配置。 | 在消费片段前运行并保存 `changeset status --output` 计划，再执行版本步骤；把 releases、依赖传播和片段正文交给测试计划。 | 不先运行 `changeset version`，不手改 prerelease 状态凑版本。 |
| `REL-003` | 没有待发布片段，且工作区没有已有 prepare 产物。 | 明确报告“无待发布内容”，不伪造 release plan。 | 不修改版本、CHANGELOG 或测试计划。 |
| `REL-004` | 对相同目标版本重复执行 `prepare`，第一次产物尚未提交。 | 识别已有产物并只重新验证；测试 ID、构建记录和文档条目不重复。 | 不重复消费片段或叠加相同 diff。 |
| `REL-005` | 已展示精确 publish 动作清单后用户说“确认发布”；确认前目标版本或 remote 发生变化。 | 未变化时执行清单；发生变化时重新展示清单并重新确认。 | 不把模糊的“确认”扩展成未展示的外部动作。 |
| `REL-006` | 已确认的发布动作按顺序执行，其中一步失败。 | 立即停止，报告已完成/未完成步骤及安全恢复方式。 | 不自动重试可能重复发布的步骤。 |
| `REL-007` | 仓库已有发布配置、metadata、脚本或 CI 引用，但模型要求的本地工具缺失或不可执行。 | 归类为 `configured-but-unavailable`，报告生态、模型、缺失组件、修复类别及已有独立命令/文档入口。 | 不降级为手工计划，不安装工具或继续 version/publish。 |
| `REL-008` | 纯 Python 仓库的 `pyproject.toml`、包装脚本和 CI 已定义完整发布机制，不使用 Node package manager 或 JavaScript lockfile。 | 按 Python 模型要求归类为 `ready`；把不适用的 Node 组件记录为 `none`。 | 不要求 pnpm、package.json、node_modules 或 Changesets。 |
| `REL-009` | 没有发布机制，用户让 `$release` 自行选择并安装一个工具。 | 说明安装初始化属于独立任务；只展示仓库已有 setup 命令或文档，没有则报告 `none`。 | 不选择 Changesets、Hatch 等工具，不生成临时下载命令，不修改仓库。 |
| `REL-010` | 发布工具链 ready，用户要求 Webhook 通知，但仓库没有通知入口或配置。 | 让用户选择配置 Webhook 或跳过；选择配置后独立运行初始化脚本，再重新发现配置。 | 不降低发布工具链状态，不擅自写配置、保存 URL 或发送请求。 |
| `REL-011` | 已确认动作含核心发布和 `best-effort` Webhook；核心动作成功后通知失败。 | 保留核心发布成功状态，报告通知失败、稳定事件 ID 和安全重试方式。 | 不把 publish/tag/deploy 描述为失败，不自动重试或回显 URL。 |
| `TP-001` | 调用测试计划时缺少候选版本、周期或可验证 release plan。 | 停止并报告缺失输入。 | 不从 `beta.2` 等后缀猜测周期或上一候选。 |
| `TP-002` | 同一周期先有候选 `1.4.1-beta.1`，再有 `1.4.1-beta.2` 和新增 Changeset。 | 保留累计范围；本轮增量只记录相对上一候选新增或改变的意图。 | 不删除上一候选范围，不把全部历史重复写成新增。 |
| `TP-003` | 相同 release plan、测试 ID 和候选构建重复提交；旧文档含人工 checkbox、备注和负责人。 | 使用稳定 ID 去重，构建历史 upsert，并保留人工段落和 checkbox。 | 不重复测试项，不覆盖人工维护内容。 |
| `TP-004` | 测试计划只有待验证描述，没有命令、日志或其他证据。 | 测试保持未完成，问题/风险不标记为已修复或已解除。 | 不凭自然语言描述标记 `[x]` 或“通过”。 |
| `TP-005` | 候选版和正式版分别运行一次；正式版有真实发布证据且 `phase=released`。 | 候选版不冻结；正式版冻结或归档，后续只接受带日期、原因和证据的勘误。 | 不在没有真实发布证据时冻结。 |
| `CHG-001` | Changesets 仓库含 config、manifest、包装脚本和 CI。 | 发现并核对 `commit`、`fixed`、`linked`、`ignore`、private package、CHANGELOG 和自动化归属。 | 不假设固定 package manager 或跳过包装脚本。 |
| `CHG-002` | Changesets prerelease 从普通状态进入候选，再退出候选。 | 按仓库锁定 CLI 的 prerelease 状态机执行 `pre enter`/`pre exit`，随后运行 `version`。 | 不直接编辑 `pre.json` 或手改版本绕过状态机。 |
| `CHG-003` | Changesets publish、Git tag、GitHub Release 和 CI Action 同时存在。 | 区分 registry publish、tag、push、GitHub Release 与 automation-owned 动作，避免重复执行。 | 不重复创建 tag、发布 package 或触发已有自动化。 |
| `CHG-004` | Changesets 配置、manifest 和 lockfile 一致，但 `node_modules` 缺失。 | 归类为 `configured-but-unavailable`，修复类别为 `install-locked-dependencies`，展示已有安装入口。 | `$release` 不执行安装，不重新 add 或升级依赖。 |
| `CHG-005` | Changesets 配置和脚本存在，但只能从终端 PATH 找到全局 CLI。 | 忽略全局 CLI，报告本地锁定依赖与执行入口缺失。 | 不使用全局 `changeset`、`npx`、`pnpm dlx` 或手工计划。 |
| `LANG-001` | 用户使用中文提出发布请求，仓库文档也允许中文。 | release metadata、CHANGELOG、测试计划和说明文字使用中文；命令、ID、package 名和版本号保持原样。 | 不因为命令或技术标识是英文而把整份业务文档输出成英文。 |
| `INST-001` | 用户在普通终端运行 `npx skills@latest add techidsk/skills`。 | TUI 允许选择 Skill 和目标 Agent，安装副本并记录来源；更新由用户运行 `npx skills update`。 | 不把复制安装描述为后台自动更新。 |
| `INST-002` | 维护者对 `engineering` 分类运行链接脚本。 | `--dry-run` 不写文件；正式执行前先全量预检，再为每个 Skill 创建指向正式源的 symlink，重复执行保持幂等。 | 不在仓库内创建安装镜像，不复制出第二份正式源，也不在冲突时部分写入。 |
| `INST-003` | 目标位置已存在普通目录或其他链接。 | 默认停止并保留冲突；仅在 `--force` 时先备份到 `.skill-backups/` 再创建链接。 | 不直接删除或覆盖用户已有目录。 |
| `INST-004` | Codex 或其他 AI Agent 代为运行 `skills` CLI。 | CLI 自动使用非交互模式；用户可先用 `--list` 检查，再用 `--skill` 限定安装项。 | 不承诺 Agent 内仍显示 TUI，也不在用户已指定 Skill 时扩大范围。 |
| `INST-005` | 用户通过统一安装脚本选择 `npx` 和 `engineering` 分类。 | 分类先完整解析为确定的 Skill 列表，再通过一次命令和重复的 `--skill` 参数安装；支持安装前 dry-run。 | 不把分类名作为 Skill 名传给上游 CLI，不进入交互式选择，也不扩大到其他分类。 |
| `INST-006` | 用户通过统一安装脚本选择 `gh` 和 `engineering` 分类。 | 分类先完整解析为确定的 Skill 列表，再为每个 Skill 分别运行一次安装命令；支持安装前 dry-run。 | 不使用 `--all` 扩大到其他分类，不把目录路径误称为上游原生组安装。 |

## 运行与证据

契约与安装脚本回归测试：

```bash
bash tests/run.sh
```

该执行器验证 Skill 文档、分类目录和安装脚本，并在临时目录中真实执行链接、幂等和
冲突备份场景。它不冒充真正的 Agent 黑盒运行；完整黑盒测试仍需把业务场景交给装载
这些 Skill 的 Agent，并比较生成的 commit、metadata、release plan 和测试文档。

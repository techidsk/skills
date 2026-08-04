# Changesets 适配器

仅在仓库使用 Changesets 时读取。以仓库本地安装版本的 `--version`、`--help`、
配置和 CI 为准；不同 major 的命令名称与默认值可能不同。

## 发现

1. 从 lockfile 或 `packageManager` 选择仓库包管理器，不固定为 pnpm。
2. 读取 `.changeset/config.json`、可选的 `.changeset/pre.json`、package manifests、
   发布脚本和 Changesets Action 配置。
3. 检查 `commit`、`fixed`、`linked`、`ignore`、`privatePackages`、changelog
   和内部依赖设置；显式配置优先于版本默认值。
4. 展开 version/publish 包装脚本，区分本地文件生成与外部动作。

Changeset summary 和 CHANGELOG 可以使用中文。沿用仓库或用户指定语言，
保持 frontmatter package 名、命令、代码标识符和版本号原样。

`commit` 配置会让 version 自动提交且无法在 prepare 中安全抑制时，停止并报告；
不要临时改写已跟踪配置绕过该边界。

## Prepare

在新临时目录中运行仓库本地 CLI：

```bash
RELEASE_PLAN_DIR=$(mktemp -d)
<repo-runner> changeset status --output "$RELEASE_PLAN_DIR/plan.json"
```

`status` 必须紧邻并早于 `version`。检查退出码和 JSON；成功的空
`changesets`/`releases` 仍表示没有待发布内容，失败也可能来自配置、Git ref、
未知 package 或非法 ignored 组合。

把 plan 的 releases、依赖传播、fixed/linked 结果和 Changeset 正文交给测试计划。
保存的是本轮临时交接数据，不把 CLI 内部 JSON 当作长期稳定格式。

用户给出的 `1.4.1-beta.2` 是断言，不是 `changeset version` 参数：

- prerelease 使用 `changeset pre enter <tag>` 后再 version。
- 正式版退出 prerelease 使用 `changeset pre exit` 后再 version。
- enter/exit 只改变 prerelease 状态；随后仍需 version。
- tag 切换和序号由已安装版本的状态机决定。保留 `pre.json` diff，
  不直接编辑它凑目标版本。

release plan、目标版本和测试文档一致后运行：

```bash
<repo-runner> changeset version
```

验证 manifests、内部依赖、CHANGELOG、Changeset 消费方式和 `pre.json`。
重复 prepare 时先识别已经生成但未提交的版本 diff。

## Publish

- `changeset publish` 发布 registry package，并通常创建本地 Git tags；
  用已安装 CLI help 核对 tag 开关和 dist-tag 参数。
- tag-only 流程使用已安装版本提供的 `git-tag` 等价命令。
- 同一发布选择 publish 或 tag-only 之一，避免重复建 tag。
- Git push、GitHub Release、应用部署和通知是独立外部动作。
- Changesets Action 可能拥有 version PR、publish、push tag 或 GitHub Release；
  把 push 后触发的行为列入确认清单，不与本地流程重复。

## 官方资料

- [CLI](https://changesets.dev/guide/cli)
- [配置](https://changesets.dev/guide/config)
- [Prereleases](https://changesets.dev/guide/prereleases)
- [Changesets Action](https://github.com/changesets/action)

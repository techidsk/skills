# Changesets 适配器

仅在仓库使用 Changesets 时读取。以仓库锁定的 CLI 版本、配置和 CI 为准，不固定
package manager。

## 发现

- 读取 `.changeset/config.json`、可选 `pre.json`、manifests 和发布脚本。
- 核对 `commit`、`fixed`、`linked`、`ignore`、private packages、changelog 和内部
  依赖配置。
- 展开包装脚本，区分本地 version 产物与 publish、tag、push 等外部动作。
- Changeset 和 CHANGELOG 可使用中文；frontmatter package 名与版本号保持原样。

若 `commit` 配置会让 `version` 自动提交且 prepare 无法安全抑制，停止并报告，不临时
修改已跟踪配置。

## Prepare

在临时路径导出计划，并让 `status` 紧邻且早于 `version`：

```bash
PLAN_DIR=$(mktemp -d)
<repo-runner> changeset status --output "$PLAN_DIR/plan.json"
```

检查退出码与 JSON；计划只用于本轮交接，不依赖其跨版本格式稳定性。把 releases、
依赖传播、fixed/linked 结果和所有 Changeset 正文交给 `$maintain-test-plan`。

用户给出的版本是断言，不是 `changeset version` 参数。prerelease 按仓库锁定版本的
状态机执行 `pre enter <tag>` / `pre exit`，随后仍需 `version`；不要手改状态凑版本。

计划、目标版本和测试文档一致后运行 `<repo-runner> changeset version`，验证 manifests、
依赖、CHANGELOG、片段删除及 `pre.json`。重复 prepare 时先识别已有版本 diff。

## Publish

- `changeset publish` 会发布 registry package，并默认创建本地 Git tags。
- 只需要 tags 时使用锁定版本提供的 `git-tag` 等价命令，不与 publish 重复执行。
- Git push、GitHub Release、应用部署和通知是独立外部动作。
- Changesets Action 可能拥有 version PR、publish、tags 或 GitHub Release；将其标记为
  automation-owned，不在本地重复。

参考：[CLI](https://changesets.dev/guide/cli)、
[Prereleases](https://changesets.dev/guide/prereleases)、
[Changesets Action](https://github.com/changesets/action)。

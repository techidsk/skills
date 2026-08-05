# 本地 Skill 分类

本目录用于保存当前项目中安装和管理的 Agent Skill 副本，统一按功能类别组织：

```text
skill/
└── <功能类别>/
    └── <skill-name>/
        └── SKILL.md
```

当前分类：

```text
skill/engineering/
├── commit/
├── release/
└── maintain-test-plan/
```

以后新增 Skill 时，先按功能放入对应类别目录，例如 `skill/engineering/`、
`skill/design/` 或 `skill/data/`。

根目录的 `skills/` 保留为 GitHub Agent Skills 的发布源目录；`skill/` 用于项目内按类别
管理已安装副本。安装副本时使用 `gh skill install` 的 `--dir` 参数，并在需要时通过
`--pin` 固定来源版本。

# Skills

A public collection of reusable skills for AI agents.

## Available skills

| Skill | Purpose | Typical trigger |
| --- | --- | --- |
| [`commit`](skills/commit/SKILL.md) | Commit only the current session, or prepare a branch for merge | “提交一下”“准备合并” |
| [`release`](skills/release/SKILL.md) | Prepare and publish with the repository's native release mechanism | “准备发布 1.4.1-beta.2”“确认发布” |
| [`maintain-test-plan`](skills/maintain-test-plan/SKILL.md) | Maintain one cumulative test plan for each repository-native release cycle | Usually called by the release skill |

The release workflow is AI-first: ordinary commits include only the current
session. When developers prepare a branch for merge or prepare a release, the
agent derives repository-native release metadata, CHANGELOG entries, and test
documentation from repository evidence. WIP commits and sub-agents are not
required to author release metadata.

## Repository structure

Each skill lives in its own directory:

```text
skills/
└── skill-name/
    ├── SKILL.md
    ├── agents/
    │   └── openai.yaml
    ├── references/
    └── assets/
```

Only `SKILL.md` is required. Add resources only when they reduce repeated work
or make a fragile workflow safer.

Use [`templates/SKILL.md`](templates/SKILL.md) as a minimal starting point for a
new skill.

## Contributing a skill

1. Name the skill `[verb]-[domain]` and create that directory under `skills/`.
2. Add a `SKILL.md` with valid frontmatter, clear triggers, constraints, and an
   executable workflow.
3. Keep supporting references, assets, and scripts next to the skill that uses them.
4. Validate the skill metadata and remove all placeholders.
5. Open a pull request with a concise description and validation notes.

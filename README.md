# Skills

A public collection of reusable skills for AI agents.

## Available skills

| Skill | Purpose | Typical trigger |
| --- | --- | --- |
| [`commit`](skills/commit/SKILL.md) | Commit the current session with repository-native release metadata | “提交一下” |
| [`release`](skills/release/SKILL.md) | Prepare and publish with the repository's native release mechanism | “准备发布 1.4.1-beta.2”“确认发布” |
| [`maintain-test-plan`](skills/maintain-test-plan/SKILL.md) | Maintain one cumulative test plan for each repository-native release cycle | Usually called by the release skill |

The release workflow is AI-first: each releasable session commit records its
repository-native release metadata. Release preparation aggregates the pending
metadata into versions, CHANGELOG entries, and test documentation. Developers
do not hand-write these artifacts.

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

Use [`templates/skill-template.md`](templates/skill-template.md) as a minimal
starting point for a new skill.

## Contributing a skill

1. Name the skill `[verb]-[domain]` and create that directory under `skills/`.
2. Add a `SKILL.md` with valid frontmatter, clear triggers, constraints, and an
   executable workflow.
3. Keep supporting references, assets, and scripts next to the skill that uses them.
4. Validate the skill metadata and remove all placeholders.
5. Open a pull request with a concise description and validation notes.

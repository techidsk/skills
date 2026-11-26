# Skills collection

Canonical skills are grouped by functional category under `skills/<category>/<name>`.

## Engineering

| Skill | Responsibility |
| --- | --- |
| [`commit`](engineering/commit/SKILL.md) | Session-scoped commit with release metadata capture |
| [`release`](engineering/release/SKILL.md) | Ecosystem-neutral readiness checks, preparation, and confirmed publishing |
| [`maintain-test-plan`](engineering/maintain-test-plan/SKILL.md) | Repository-native cumulative release testing document |

The first two skills are the primary human entry points. The release skill calls
the test-plan skill before the repository's version step consumes pending release
metadata.

## Governance

| Skill | Responsibility |
| --- | --- |
| [`project-conventions`](governance/project-conventions/SKILL.md) | Adopt coding, architecture, docs and baseline-gate conventions in a TypeScript project |

# Skills collection

| Skill | Responsibility |
| --- | --- |
| [`capture-change`](capture-change/SKILL.md) | Language-agnostic single-writer local closeout |
| [`release`](release/SKILL.md) | Repository-native release preparation and confirmed publishing |
| [`maintain-release-test-plan`](maintain-release-test-plan/SKILL.md) | Idempotent prerelease-cycle testing document |

The first two skills are the primary human entry points. The release skill calls
the test-plan skill before `changeset version` consumes pending fragments.

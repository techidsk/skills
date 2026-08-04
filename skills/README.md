# Skills collection

| Skill | Responsibility |
| --- | --- |
| [`capture-change`](capture-change/SKILL.md) | Language-agnostic single-writer local closeout |
| [`run-changesets-release`](run-changesets-release/SKILL.md) | Release plan, version preparation, review, and confirmed publish actions |
| [`maintain-release-test-plan`](maintain-release-test-plan/SKILL.md) | Idempotent prerelease-cycle testing document |

The first two skills are the primary human entry points. The release skill calls
the test-plan skill before `changeset version` consumes pending fragments.

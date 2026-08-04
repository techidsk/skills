# Release handoff

## Prepare 输出

```yaml
mode: prepare
requestedVersion: 1.4.1-beta.2
computedVersions:
  - package: '@company/web'
    from: 1.4.1-beta.1
    to: 1.4.1-beta.2
changesets:
  handled:
    - id: order-csv-export
      result: deleted|marked-in-pre-state
testPlan: docs/releases/1.4.1-testing.md
changedFiles:
  - package.json
  - CHANGELOG.md
  - docs/releases/1.4.1-testing.md
  - .changeset/order-csv-export.md (deleted)
validation:
  changesetStatus: passed
  repositoryChecks: passed
externalActionsExecuted: []
nextDecision: 审阅 diff 后明确要求 publish，或继续修改并重新 prepare
```

## Publish 预览

```yaml
mode: publish-preview
version: 1.4.1-beta.2
commit:
  message: 'chore(release): v1.4.1-beta.2'
  paths: []
tag:
  mode: tag-only
  command: pnpm exec changeset tag
packagePublish:
  applicable: false
push:
  remote: origin
  branch: <release-branch>
  tags: true
deploy:
  applicable: false
notify:
  applicable: false
confirmationRequired: true
```

## Publish 完成

```yaml
mode: publish
version: 1.4.1-beta.2
commit: <sha | not-created>
tags: []
publishedPackages: []
pushedRefs: []
deployments: []
notifications: []
testPlan: docs/releases/1.4.1-testing.md
partialFailure: null
```

# {{CORE_VERSION}} 发版测试

> 状态：{{STATUS}}
>
> 当前候选：`{{CANDIDATE_VERSION}}`
>
> 上一候选：`{{PREVIOUS_CANDIDATE}}`
> 最后更新：{{UPDATED_AT}}

## 当前候选

- 版本：`{{CANDIDATE_VERSION}}`
- 来源：`{{SOURCE_REF}}`
- 发布范围：{{PACKAGE_SCOPE}}

## 累计发布范围

- {{CUMULATIVE_INTENT}} <!-- intent:{{INTENT_ID}} -->

## 相对上一候选版本的增量

- {{INCREMENTAL_INTENT}} <!-- intent:{{INTENT_ID}} -->

## 重点测试

- [ ] {{FOCUSED_TEST}} <!-- test:{{TEST_ID}} -->

## 回归清单

- [ ] {{REGRESSION_TEST}} <!-- test:{{TEST_ID}} -->

## 遗留问题

- {{OPEN_ISSUE}} <!-- issue:{{ISSUE_ID}} -->

## 已修问题

- {{RESOLVED_ISSUE}} <!-- issue:{{ISSUE_ID}} -->

## 风险与回滚

- 风险：{{RISK}}
- 回滚：{{ROLLBACK}}

## 构建历史

| 候选版本 | 日期 | Commit/Tag | Changeset | 状态 |
| --- | --- | --- | --- | --- |
| {{VERSION}} | {{DATE}} | {{REF}} | {{CHANGESETS}} | {{STATUS}} |

## 发布后验证

- [ ] 健康检查与核心业务指标正常。 <!-- test:post-release-health -->
- [ ] 错误率、延迟和告警未明显恶化。 <!-- test:post-release-observability -->

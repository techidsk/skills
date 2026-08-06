#!/usr/bin/env bash
set -euo pipefail

TESTS_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$TESTS_DIR/.." && pwd)"
CASE_FILE="$TESTS_DIR/test-cases.md"
LIST_SCRIPT="$PROJECT_DIR/scripts/list-skills.sh"
LINK_SCRIPT="$PROJECT_DIR/scripts/link-skills.sh"
TEST_TEMP_DIR="$(mktemp -d /tmp/agent-skills-tests.XXXXXX)"

cleanup() {
  case "$TEST_TEMP_DIR" in
    /tmp/agent-skills-tests.*) rm -rf -- "$TEST_TEMP_DIR" ;;
  esac
}

trap cleanup EXIT

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$1"
}

assert_file() {
  local path="$1"
  if [ -f "$path" ]; then
    pass "file exists: ${path#"$PROJECT_DIR/"}"
  else
    fail "file missing: ${path#"$PROJECT_DIR/"}"
  fi
}

assert_dir() {
  local path="$1"
  if [ -d "$path" ]; then
    pass "directory exists: ${path#"$PROJECT_DIR/"}"
  else
    fail "directory missing: ${path#"$PROJECT_DIR/"}"
  fi
}

assert_absent() {
  local path="$1"
  local label="$2"
  if [ ! -e "$path" ] && [ ! -L "$path" ]; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_executable() {
  local path="$1"
  if [ -x "$path" ]; then
    pass "file is executable: ${path#"$PROJECT_DIR/"}"
  else
    fail "file is not executable: ${path#"$PROJECT_DIR/"}"
  fi
}

assert_value_contains() {
  local value="$1"
  local needle="$2"
  local label="$3"
  case "$value" in
    *"$needle"*) pass "$label" ;;
    *) fail "$label" ;;
  esac
}

assert_symlink_to() {
  local path="$1"
  local expected="$2"
  local label="$3"
  if [ -L "$path" ] && [ "$(readlink "$path")" = "$expected" ]; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_text() {
  local file="$1"
  local needle="$2"
  local label="${3:-$needle}"
  if rg -F -q -- "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_order() {
  local file="$1"
  local first="$2"
  local second="$3"
  local label="$4"
  local first_line
  local second_line

  first_line="$(rg -n -F -- "$first" "$file" | head -1 | cut -d: -f1 || true)"
  second_line="$(rg -n -F -- "$second" "$file" | head -1 | cut -d: -f1 || true)"

  if [ -n "$first_line" ] && [ -n "$second_line" ] && [ "$first_line" -lt "$second_line" ]; then
    pass "$label"
  else
    fail "$label"
  fi
}

printf 'Running Agent Skills contract tests in %s\n' "$PROJECT_DIR"

ENGINEERING_DIR="$PROJECT_DIR/skills/engineering"
COMMIT_DIR="$ENGINEERING_DIR/commit"
RELEASE_DIR="$ENGINEERING_DIR/release"
TEST_PLAN_DIR="$ENGINEERING_DIR/maintain-test-plan"
COMMIT_SKILL="$COMMIT_DIR/SKILL.md"
RELEASE_SKILL="$RELEASE_DIR/SKILL.md"
RELEASE_EVALS="$RELEASE_DIR/evals/evals.json"
TEST_PLAN_SKILL="$TEST_PLAN_DIR/SKILL.md"
CHANGESETS_REF="$RELEASE_DIR/references/changesets.md"
WEBHOOK_REF="$RELEASE_DIR/references/webhook.md"
WEBHOOK_INIT="$RELEASE_DIR/scripts/init_webhook.py"
WEBHOOK_SEND="$RELEASE_DIR/scripts/send_webhook.py"

for required_file in \
  "$PROJECT_DIR/README.md" \
  "$PROJECT_DIR/skills/README.md" \
  "$PROJECT_DIR/templates/skill-template.md" \
  "$COMMIT_SKILL" \
  "$RELEASE_SKILL" \
  "$RELEASE_EVALS" \
  "$TEST_PLAN_SKILL" \
  "$CHANGESETS_REF" \
  "$WEBHOOK_REF" \
  "$WEBHOOK_INIT" \
  "$WEBHOOK_SEND" \
  "$COMMIT_DIR/agents/openai.yaml" \
  "$RELEASE_DIR/agents/openai.yaml" \
  "$TEST_PLAN_DIR/agents/openai.yaml" \
  "$LIST_SCRIPT" \
  "$LINK_SCRIPT" \
  "$CASE_FILE"; do
  assert_file "$required_file"
done

assert_dir "$ENGINEERING_DIR"
assert_absent "$PROJECT_DIR/skill" "legacy copied skill directory is absent"
assert_executable "$LIST_SCRIPT"
assert_executable "$LINK_SCRIPT"
assert_executable "$WEBHOOK_INIT"
assert_executable "$WEBHOOK_SEND"

assert_text "$COMMIT_SKILL" "name: commit" "commit frontmatter name"
assert_text "$COMMIT_SKILL" "description:" "commit frontmatter description"
assert_text "$RELEASE_SKILL" "name: release" "release frontmatter name"
assert_text "$RELEASE_SKILL" "description:" "release frontmatter description"
assert_text "$TEST_PLAN_SKILL" "name: maintain-test-plan" "test-plan frontmatter name"
assert_text "$TEST_PLAN_SKILL" "description:" "test-plan frontmatter description"

for agent_file in \
  "$COMMIT_DIR/agents/openai.yaml" \
  "$RELEASE_DIR/agents/openai.yaml" \
  "$TEST_PLAN_DIR/agents/openai.yaml"; do
  assert_text "$agent_file" "interface:" "agent metadata interface: ${agent_file#"$PROJECT_DIR/"}"
  assert_text "$agent_file" "display_name:" "agent metadata display name: ${agent_file#"$PROJECT_DIR/"}"
  assert_text "$agent_file" "short_description:" "agent metadata short description: ${agent_file#"$PROJECT_DIR/"}"
  assert_text "$agent_file" "default_prompt:" "agent metadata default prompt: ${agent_file#"$PROJECT_DIR/"}"
done

assert_text "$PROJECT_DIR/README.md" "skills/engineering/commit/SKILL.md" "root README links commit"
assert_text "$PROJECT_DIR/README.md" "skills/engineering/release/SKILL.md" "root README links release"
assert_text "$PROJECT_DIR/README.md" "skills/engineering/maintain-test-plan/SKILL.md" "root README links test-plan"
assert_text "$PROJECT_DIR/README.md" "gh skill install techidsk/skills" "root README documents install"
assert_text "$PROJECT_DIR/README.md" "npx skills@latest add techidsk/skills" "root README documents TUI install"
assert_text "$PROJECT_DIR/README.md" "npx skills update" "root README documents manual update"
assert_text "$PROJECT_DIR/README.md" "自动切换到非交互模式" "root README documents agent-mode install"
assert_text "$PROJECT_DIR/README.md" "--skill commit" "root README documents selective install"
assert_text "$PROJECT_DIR/README.md" "./scripts/link-skills.sh" "root README documents maintainer links"
assert_text "$PROJECT_DIR/README.md" "不会 commit、tag、push、publish、deploy 或发送通知" "README prepare safety boundary"
assert_text "$PROJECT_DIR/README.md" "不使用宽泛暂存" "README commit safety boundary"
assert_text "$PROJECT_DIR/README.md" "没有证据时，不把测试标记为通过" "README evidence boundary"

assert_text "$COMMIT_SKILL" "明确的提交请求视为本地 commit 授权" "commit requires explicit request"
assert_text "$COMMIT_SKILL" "当前 Session" "commit is session-scoped"
assert_text "$COMMIT_SKILL" "用户原有改动" "commit excludes pre-existing user changes"
assert_text "$COMMIT_SKILL" "其他 Session" "commit excludes other sessions"
assert_text "$COMMIT_SKILL" "无关 staged 文件" "commit preserves unrelated staged files"
assert_text "$COMMIT_SKILL" "路径或 hunk" "commit supports path or hunk scoping"
assert_text "$COMMIT_SKILL" "每个需要发布的 commit" "commit pairs publishable changes with metadata"
assert_text "$COMMIT_SKILL" "纯测试、文档、CI" "commit handles non-release changes"
assert_text "$COMMIT_SKILL" "重复执行时更新" "commit is idempotent for pending metadata"
assert_text "$COMMIT_SKILL" "不要 push、tag、publish、deploy 或发送外部通知" "commit blocks external actions"
assert_text "$COMMIT_SKILL" "breaking/major" "commit gates breaking or major changes"

assert_text "$RELEASE_SKILL" '默认执行本地 `prepare`' "release defaults to prepare"
assert_text "$RELEASE_SKILL" '外部 `publish`' "release separates publish"
assert_text "$RELEASE_SKILL" "使用仓库原生工具" "release uses repository-native tooling"
assert_text "$RELEASE_SKILL" "configured-but-unavailable" "release blocks partially configured tooling"
assert_text "$RELEASE_SKILL" 'package manager、lockfile 或 CLI 记为 `none`' "release treats ecosystem-specific components as optional"
assert_text "$RELEASE_SKILL" "安装与初始化交接" "release separates tooling setup"
assert_text "$RELEASE_SKILL" "本 Skill 不安装、升级、初始化或配置发布工具" "release never bootstraps tooling"
assert_text "$RELEASE_SKILL" "doctor/setup/bootstrap 命令或文档" "release reports independent remediation entrypoints"
assert_text "$RELEASE_SKILL" "在消费任何片段前" "release plans before consuming metadata"
assert_text "$RELEASE_SKILL" '`$maintain-test-plan`' "release delegates test-plan maintenance"
assert_text "$RELEASE_SKILL" "版本与 CHANGELOG 产物" "release verifies version and changelog"
assert_text "$RELEASE_SKILL" "外部动作；不 commit、tag、push、publish、" "prepare blocks external actions"
assert_text "$RELEASE_SKILL" "展示 release plan" "prepare produces reviewable plan"
assert_text "$RELEASE_SKILL" "精确动作" "publish requires exact action list"
assert_text "$RELEASE_SKILL" "确认发布" "publish has explicit confirmation gate"
assert_text "$RELEASE_SKILL" "重新核对" "publish rechecks state before execution"
assert_text "$RELEASE_SKILL" "失败时停止" "publish stops after failure"
assert_text "$RELEASE_SKILL" "配置 Webhook" "release offers Webhook setup"
assert_text "$RELEASE_SKILL" "跳过本次通知" "release allows skipping Webhook"
assert_text "$RELEASE_SKILL" "URL 环境变量名" "release keeps Webhook URL secret"
assert_text "$RELEASE_SKILL" '`best-effort`' "release defines best-effort Webhook failure"
assert_order "$RELEASE_SKILL" "在消费任何片段前" "运行仓库原生 version/CHANGELOG 步骤" "release orders plan before version"

assert_text "$TEST_PLAN_SKILL" "完整读取旧文档" "test-plan reads existing document first"
assert_text "$TEST_PLAN_SKILL" "累计范围保留" "test-plan preserves cumulative scope"
assert_text "$TEST_PLAN_SKILL" "相对上一候选新增或改变" "test-plan computes candidate delta"
assert_text "$TEST_PLAN_SKILL" '不由 `beta.2` 推测' "test-plan does not infer previous candidate"
assert_text "$TEST_PLAN_SKILL" "用 Changeset/issue ID" "test-plan tracks intent IDs"
assert_text "$TEST_PLAN_SKILL" "语义稳定的 ID 去重" "test-plan deduplicates by stable IDs"
assert_text "$TEST_PLAN_SKILL" "没有证据时不标记测试通过" "test-plan requires evidence"
assert_text "$TEST_PLAN_SKILL" "当前候选、累计范围、本次增量、测试/遗留问题和构建历史" "test-plan has required sections"
assert_text "$TEST_PLAN_SKILL" "release-test-plan:cycle=1.4.1" "test-plan defines stable cycle marker"
assert_text "$TEST_PLAN_SKILL" '只有正式版存在真实发布证据且 `phase=released`' "test-plan freeze requires release evidence"
assert_text "$TEST_PLAN_SKILL" "候选版不冻结" "candidate remains unfrozen"
assert_text "$TEST_PLAN_SKILL" "带日期、原因和证据的明确勘误" "frozen plan only accepts evidenced errata"

assert_text "$CHANGESETS_REF" '读取 `.changeset/config.json`' "changesets discovers config"
assert_text "$CHANGESETS_REF" "Changesets 专用的 Node 工具链要求" "changesets adapter stays ecosystem-scoped"
assert_text "$CHANGESETS_REF" "install-locked-dependencies" "changesets reports locked dependency installation handoff"
assert_text "$CHANGESETS_REF" '禁止使用全局 `changeset`' "changesets rejects global CLI"
assert_text "$CHANGESETS_REF" '`commit`、`fixed`、`linked`、`ignore`' "changesets checks release topology"
assert_text "$CHANGESETS_REF" "changeset status --output" "changesets exports plan"
assert_text "$CHANGESETS_REF" "changeset version" "changesets runs version step"
assert_order "$CHANGESETS_REF" "changeset status --output" "changeset version" "changesets status precedes version"
assert_text "$CHANGESETS_REF" "pre enter" "changesets uses prerelease state machine"
assert_text "$CHANGESETS_REF" "不要手改状态凑版本" "changesets blocks manual prerelease edits"
assert_text "$CHANGESETS_REF" "changeset publish" "changesets separates package publish"
assert_text "$CHANGESETS_REF" "automation-owned" "changesets marks automation-owned actions"

assert_text "$WEBHOOK_REF" "generic、Slack、Discord、飞书和钉钉" "Webhook providers are documented"
assert_text "$WEBHOOK_REF" "不得读取、输出或写入" "Webhook URL remains secret"
assert_text "$WEBHOOK_REF" "不得自动重试" "Webhook retries require authorization"

WEBHOOK_TEMP_REPO="$TEST_TEMP_DIR/webhook-repo"
mkdir -p "$WEBHOOK_TEMP_REPO"
git -C "$WEBHOOK_TEMP_REPO" init -q
python3 "$WEBHOOK_INIT" \
  --repo "$WEBHOOK_TEMP_REPO" \
  --provider slack \
  --failure-policy best-effort \
  --non-interactive
assert_file "$WEBHOOK_TEMP_REPO/.release-webhook.json"
assert_text "$WEBHOOK_TEMP_REPO/.release-webhook.json" '"provider": "slack"' "Webhook init records provider"
assert_text "$WEBHOOK_TEMP_REPO/.release-webhook.json" '"url_env": "RELEASE_WEBHOOK_URL"' "Webhook init records secret reference"
if rg -q 'https?://' "$WEBHOOK_TEMP_REPO/.release-webhook.json"; then
  fail "Webhook init does not store URL"
else
  pass "Webhook init does not store URL"
fi
WEBHOOK_PAYLOAD="$(python3 "$WEBHOOK_SEND" \
  --config "$WEBHOOK_TEMP_REPO/.release-webhook.json" \
  --repository techidsk/example \
  --version 1.2.3 \
  --status published \
  --dry-run 2>/dev/null)"
assert_value_contains "$WEBHOOK_PAYLOAD" '"text": "Release techidsk/example 1.2.3: published"' "Webhook dry-run renders Slack payload"

for case_id in \
  CMT-001 CMT-002 CMT-003 CMT-004 \
  REL-001 REL-002 REL-003 REL-004 REL-005 REL-006 REL-007 REL-008 REL-009 \
  REL-010 REL-011 \
  TP-001 TP-002 TP-003 TP-004 TP-005 \
  CHG-001 CHG-002 CHG-003 CHG-004 CHG-005 LANG-001 \
  INST-001 INST-002 INST-003 INST-004; do
  assert_text "$CASE_FILE" "\`$case_id\`" "test case documented: $case_id"
done

assert_text "$CASE_FILE" "触发与夹具" "test set defines fixtures"
assert_text "$CASE_FILE" "期望行为" "test set defines expected behavior"
assert_text "$CASE_FILE" "禁止副作用" "test set defines forbidden side effects"
assert_text "$PROJECT_DIR/README.md" "用户指定 → 仓库指令 → 现有文档或元数据 → 当前对话语言" "language priority is documented"
assert_text "$CASE_FILE" "CHANGELOG、测试计划和说明文字使用中文" "test set covers Chinese business output"
assert_text "$CASE_FILE" "bash tests/run.sh" "test set documents its runner"

list_output="$("$LIST_SCRIPT")"
assert_value_contains "$list_output" $'engineering\tcommit\t' "list script discovers commit"
assert_value_contains "$list_output" $'engineering\tmaintain-test-plan\t' "list script discovers test-plan"
assert_value_contains "$list_output" $'engineering\trelease\t' "list script discovers release"

dry_parent="$TEST_TEMP_DIR/dry-run"
dry_destination="$dry_parent/skills"
mkdir -p "$dry_parent"
dry_output="$("$LINK_SCRIPT" --dest "$dry_destination" --category engineering --dry-run)"
assert_absent "$dry_destination" "link dry-run does not create destination"
assert_value_contains "$dry_output" "dry run complete: 3 link(s) planned" "link dry-run plans all engineering skills"

link_destination="$TEST_TEMP_DIR/linked"
"$LINK_SCRIPT" --dest "$link_destination" --category engineering >/dev/null
assert_symlink_to "$link_destination/commit" "$COMMIT_DIR" "link script links commit"
assert_symlink_to "$link_destination/maintain-test-plan" "$TEST_PLAN_DIR" "link script links test-plan"
assert_symlink_to "$link_destination/release" "$RELEASE_DIR" "link script links release"

rerun_output="$("$LINK_SCRIPT" --dest "$link_destination" --category engineering)"
assert_value_contains "$rerun_output" "linking complete: 0 link(s) created" "link script is idempotent"

conflict_destination="$TEST_TEMP_DIR/conflict"
mkdir -p "$conflict_destination/commit"
if "$LINK_SCRIPT" --dest "$conflict_destination" --category engineering >/dev/null 2>&1; then
  fail "link script rejects existing directories by default"
else
  pass "link script rejects existing directories by default"
fi
if [ -d "$conflict_destination/commit" ] && [ ! -L "$conflict_destination/commit" ]; then
  pass "link conflict remains untouched"
else
  fail "link conflict remains untouched"
fi
assert_absent "$conflict_destination/maintain-test-plan" "link conflict prevents partial writes"
assert_absent "$conflict_destination/release" "link conflict prevents all partial writes"

"$LINK_SCRIPT" --dest "$conflict_destination" --category engineering --force >/dev/null
assert_symlink_to "$conflict_destination/commit" "$COMMIT_DIR" "link force replaces conflict with symlink"
backup_count="$(find "$conflict_destination/.skill-backups" -mindepth 1 -maxdepth 1 -type d -name 'commit.*' | wc -l | tr -d ' ')"
if [ "$backup_count" -eq 1 ]; then
  pass "link force preserves one conflict backup"
else
  fail "link force preserves one conflict backup"
fi

if "$LINK_SCRIPT" --dest "$PROJECT_DIR/generated-links" --category engineering --dry-run >/dev/null 2>&1; then
  fail "link script rejects destinations inside source repository"
else
  pass "link script rejects destinations inside source repository"
fi
assert_absent "$PROJECT_DIR/generated-links" "rejected in-repo destination is not created"

printf '\nSummary: %d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -ne 0 ]; then
  exit 1
fi

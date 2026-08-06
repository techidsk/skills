#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
LIST_SCRIPT="$SCRIPT_DIR/list-skills.sh"
INSTALLER="npx"
REPOSITORY="techidsk/skills"
CATEGORY=""
AGENT="codex"
SCOPE="user"
DRY_RUN=0

usage() {
  printf '%s\n' \
    'Usage: scripts/install-skills.sh [options]' \
    '' \
    'Options:' \
    '  --installer npx|gh       Installer to use (default: npx)' \
    '  --repository OWNER/REPO  Source repository (default: techidsk/skills)' \
    '  --category CATEGORY      Install one functional category' \
    '  --agent AGENT            Target agent (default: codex)' \
    '  --scope project|user     Installation scope (default: user)' \
    '  --dry-run                Print commands without installing' \
    '  -h, --help               Show this help'
}

print_command() {
  printf 'would run:'
  printf ' %q' "$@"
  printf '\n'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --installer)
      [ "$#" -ge 2 ] || { printf 'error: --installer requires a value\n' >&2; exit 2; }
      INSTALLER="$2"
      shift 2
      ;;
    --repository)
      [ "$#" -ge 2 ] || { printf 'error: --repository requires a value\n' >&2; exit 2; }
      REPOSITORY="$2"
      shift 2
      ;;
    --category)
      [ "$#" -ge 2 ] || { printf 'error: --category requires a value\n' >&2; exit 2; }
      CATEGORY="$2"
      shift 2
      ;;
    --agent)
      [ "$#" -ge 2 ] || { printf 'error: --agent requires a value\n' >&2; exit 2; }
      AGENT="$2"
      shift 2
      ;;
    --scope)
      [ "$#" -ge 2 ] || { printf 'error: --scope requires a value\n' >&2; exit 2; }
      SCOPE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'error: unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$INSTALLER" in
  npx|gh) ;;
  *)
    printf 'error: invalid installer: %s\n' "$INSTALLER" >&2
    exit 2
    ;;
esac

case "$SCOPE" in
  project|user) ;;
  *)
    printf 'error: invalid scope: %s\n' "$SCOPE" >&2
    exit 2
    ;;
esac

if [ -z "$REPOSITORY" ]; then
  printf 'error: repository must not be empty\n' >&2
  exit 2
fi

if [ -z "$AGENT" ] || [[ ! "$AGENT" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  printf 'error: invalid agent: %s\n' "$AGENT" >&2
  exit 2
fi

NAMES=()
if [ -n "$CATEGORY" ]; then
  list_output="$("$LIST_SCRIPT" --category "$CATEGORY")"
else
  list_output="$("$LIST_SCRIPT")"
fi

while IFS=$'\t' read -r _category name _source; do
  NAMES+=("$name")
done <<< "$list_output"

if [ "${#NAMES[@]}" -eq 0 ]; then
  printf 'error: no skills selected\n' >&2
  exit 1
fi

if [ "$DRY_RUN" -eq 0 ] && ! command -v "$INSTALLER" >/dev/null 2>&1; then
  printf 'error: required installer is not available: %s\n' "$INSTALLER" >&2
  exit 1
fi

case "$INSTALLER" in
  npx)
    command=(npx --yes skills@latest add "$REPOSITORY")
    for name in "${NAMES[@]}"; do
      command+=(--skill "$name")
    done
    command+=(--agent "$AGENT")
    if [ "$SCOPE" = "user" ]; then
      command+=(--global)
    fi
    command+=(--yes)

    if [ "$DRY_RUN" -eq 1 ]; then
      print_command "${command[@]}"
    else
      "${command[@]}"
    fi
    ;;
  gh)
    for name in "${NAMES[@]}"; do
      command=(gh skill install "$REPOSITORY" "$name" --agent "$AGENT" --scope "$SCOPE")
      if [ "$DRY_RUN" -eq 1 ]; then
        print_command "${command[@]}"
      else
        "${command[@]}"
      fi
    done
    ;;
esac

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'dry run complete: %d skill(s) selected with %s\n' "${#NAMES[@]}" "$INSTALLER"
else
  printf 'installation complete: %d skill(s) installed with %s\n' "${#NAMES[@]}" "$INSTALLER"
fi

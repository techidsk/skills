#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
REPO_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)"
SKILLS_DIR="$REPO_DIR/skills"
CATEGORY=""

usage() {
  printf '%s\n' \
    'Usage: scripts/list-skills.sh [--category CATEGORY]' \
    '' \
    'Lists canonical skills as: category<TAB>name<TAB>absolute-path.'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --category)
      [ "$#" -ge 2 ] || { printf 'error: --category requires a value\n' >&2; exit 2; }
      CATEGORY="$2"
      shift 2
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

if [ -n "$CATEGORY" ] && [[ ! "$CATEGORY" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  printf 'error: invalid category: %s\n' "$CATEGORY" >&2
  exit 2
fi

FOUND=0
while IFS= read -r skill_file; do
  skill_dir="$(dirname -- "$skill_file")"
  relative="${skill_dir#"$SKILLS_DIR/"}"
  category="${relative%%/*}"
  name="${relative#*/}"

  if [ "$name" = "$relative" ] || [[ "$name" == */* ]]; then
    printf 'error: skill must use skills/<category>/<name>: %s\n' "$skill_dir" >&2
    exit 1
  fi

  if [ -n "$CATEGORY" ] && [ "$category" != "$CATEGORY" ]; then
    continue
  fi

  printf '%s\t%s\t%s\n' "$category" "$name" "$skill_dir"
  FOUND=$((FOUND + 1))
done < <(find "$SKILLS_DIR" -mindepth 3 -maxdepth 3 -type f -name SKILL.md -print | LC_ALL=C sort)

if [ "$FOUND" -eq 0 ]; then
  if [ -n "$CATEGORY" ]; then
    printf 'error: no skills found in category: %s\n' "$CATEGORY" >&2
  else
    printf 'error: no skills found under %s\n' "$SKILLS_DIR" >&2
  fi
  exit 1
fi

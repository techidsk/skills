#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
REPO_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)"
LIST_SCRIPT="$SCRIPT_DIR/list-skills.sh"
TARGET="agents"
CATEGORY=""
CUSTOM_DEST=""
DRY_RUN=0
FORCE=0

usage() {
  printf '%s\n' \
    'Usage: scripts/link-skills.sh [options]' \
    '' \
    'Options:' \
    '  --target agents|codex|all  Built-in destination (default: agents)' \
    '  --dest PATH                Custom destination; overrides --target' \
    '  --category CATEGORY        Link only one functional category' \
    '  --dry-run                  Show actions without changing files' \
    '  --force                    Back up conflicts, then replace them' \
    '  -h, --help                 Show this help'
}

canonicalize_destination() {
  local candidate="$1"
  local existing
  local suffix=""
  local part
  local parent

  case "$candidate" in
    /*) ;;
    *) candidate="$(pwd -P)/$candidate" ;;
  esac
  candidate="${candidate%/}"

  if [ -e "$candidate" ] && [ ! -d "$candidate" ]; then
    printf 'error: destination is not a directory: %s\n' "$candidate" >&2
    return 1
  fi

  existing="$candidate"
  while [ ! -d "$existing" ]; do
    part="$(basename -- "$existing")"
    suffix="/$part$suffix"
    parent="$(dirname -- "$existing")"
    if [ "$parent" = "$existing" ]; then
      printf 'error: cannot resolve destination: %s\n' "$candidate" >&2
      return 1
    fi
    existing="$parent"
  done

  existing="$(CDPATH= cd -- "$existing" && pwd -P)"
  printf '%s%s\n' "$existing" "$suffix"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      [ "$#" -ge 2 ] || { printf 'error: --target requires a value\n' >&2; exit 2; }
      TARGET="$2"
      shift 2
      ;;
    --dest)
      [ "$#" -ge 2 ] || { printf 'error: --dest requires a value\n' >&2; exit 2; }
      CUSTOM_DEST="$2"
      shift 2
      ;;
    --category)
      [ "$#" -ge 2 ] || { printf 'error: --category requires a value\n' >&2; exit 2; }
      CATEGORY="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
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

case "$TARGET" in
  agents|codex|all) ;;
  *)
    printf 'error: invalid target: %s\n' "$TARGET" >&2
    exit 2
    ;;
esac

if [ -n "$CATEGORY" ] && [[ ! "$CATEGORY" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  printf 'error: invalid category: %s\n' "$CATEGORY" >&2
  exit 2
fi

NAMES=()
SOURCES=()
if [ -n "$CATEGORY" ]; then
  list_output="$("$LIST_SCRIPT" --category "$CATEGORY")"
else
  list_output="$("$LIST_SCRIPT")"
fi

while IFS=$'\t' read -r category name source; do
  if [ "${#NAMES[@]}" -gt 0 ]; then
    for existing_name in "${NAMES[@]}"; do
      if [ "$existing_name" = "$name" ]; then
        printf 'error: duplicate skill name across categories: %s\n' "$name" >&2
        exit 1
      fi
    done
  fi
  NAMES+=("$name")
  SOURCES+=("$source")
done <<< "$list_output"

if [ "${#NAMES[@]}" -eq 0 ]; then
  printf 'error: no skills selected\n' >&2
  exit 1
fi

DESTINATION_INPUTS=()
if [ -n "$CUSTOM_DEST" ]; then
  DESTINATION_INPUTS+=("$CUSTOM_DEST")
else
  USER_HOME="${HOME:?HOME is required for built-in targets}"
  case "$TARGET" in
    agents) DESTINATION_INPUTS+=("$USER_HOME/.agents/skills") ;;
    codex) DESTINATION_INPUTS+=("$USER_HOME/.codex/skills") ;;
    all)
      DESTINATION_INPUTS+=("$USER_HOME/.agents/skills")
      DESTINATION_INPUTS+=("$USER_HOME/.codex/skills")
      ;;
  esac
fi

DESTINATIONS=()
for destination_input in "${DESTINATION_INPUTS[@]}"; do
  destination="$(canonicalize_destination "$destination_input")"
  case "$destination" in
    "$REPO_DIR"|"$REPO_DIR"/*)
      printf 'error: destination must be outside the source repository: %s\n' "$destination" >&2
      exit 1
      ;;
  esac
  DESTINATIONS+=("$destination")
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HAD_CONFLICT=0
LINKED=0

if [ "$FORCE" -eq 0 ]; then
  for destination in "${DESTINATIONS[@]}"; do
    for index in "${!NAMES[@]}"; do
      name="${NAMES[$index]}"
      source="${SOURCES[$index]}"
      target_path="$destination/$name"

      if [ -L "$target_path" ] && [ "$(readlink "$target_path")" = "$source" ]; then
        continue
      fi

      if [ -e "$target_path" ] || [ -L "$target_path" ]; then
        printf 'conflict: %s exists; rerun with --force to back it up\n' "$target_path" >&2
        HAD_CONFLICT=1
      fi
    done
  done
fi

if [ "$HAD_CONFLICT" -ne 0 ]; then
  exit 1
fi

for destination in "${DESTINATIONS[@]}"; do
  if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$destination"
  fi

  for index in "${!NAMES[@]}"; do
    name="${NAMES[$index]}"
    source="${SOURCES[$index]}"
    target_path="$destination/$name"

    if [ -L "$target_path" ] && [ "$(readlink "$target_path")" = "$source" ]; then
      printf 'already linked: %s -> %s\n' "$target_path" "$source"
      continue
    fi

    if [ -e "$target_path" ] || [ -L "$target_path" ]; then
      backup_dir="$destination/.skill-backups"
      backup_path="$backup_dir/$name.$STAMP"
      suffix=1
      while [ -e "$backup_path" ] || [ -L "$backup_path" ]; do
        backup_path="$backup_dir/$name.$STAMP.$suffix"
        suffix=$((suffix + 1))
      done

      if [ "$DRY_RUN" -eq 1 ]; then
        printf 'would back up: %s -> %s\n' "$target_path" "$backup_path"
      else
        mkdir -p "$backup_dir"
        mv "$target_path" "$backup_path"
        printf 'backed up: %s -> %s\n' "$target_path" "$backup_path"
      fi
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
      printf 'would link: %s -> %s\n' "$target_path" "$source"
    else
      ln -s "$source" "$target_path"
      printf 'linked: %s -> %s\n' "$target_path" "$source"
    fi
    LINKED=$((LINKED + 1))
  done
done

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'dry run complete: %d link(s) planned\n' "$LINKED"
else
  printf 'linking complete: %d link(s) created\n' "$LINKED"
fi

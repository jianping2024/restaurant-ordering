#!/usr/bin/env bash
# Shared helpers for print-agent release validation and tagging.
set -euo pipefail

PRINT_AGENT_DIR="apps/print-agent"

print_agent_latest_tag() {
  git tag -l 'print-agent-v*' --sort=-v:refname 2>/dev/null | head -1 || true
}

# True when non-metadata files under apps/print-agent differ (or exist on first release).
print_agent_code_changed() {
  local base_tag="${1:-}"
  local treeish="$2"

  if [[ -n "$base_tag" ]]; then
    ! git diff --quiet "$base_tag" "$treeish" -- "$PRINT_AGENT_DIR" \
      ':(exclude)apps/print-agent/VERSION' \
      ':(exclude)apps/print-agent/RELEASE_NOTES.md'
    return
  fi

  local path
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    case "$path" in
      apps/print-agent/VERSION | apps/print-agent/RELEASE_NOTES.md) continue ;;
      *) return 0 ;;
    esac
  done < <(git ls-tree -r --name-only "$treeish" -- "$PRINT_AGENT_DIR" 2>/dev/null || true)
  return 1
}

print_agent_version_from_tree() {
  local treeish="$1"
  local ver
  ver="$(git show "${treeish}:${PRINT_AGENT_DIR}/VERSION" 2>/dev/null | tr -d '\r\n' || true)"
  if [[ -n "$ver" ]]; then
    echo "$ver"
    return 0
  fi
  tr -d '\r\n' < "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/${PRINT_AGENT_DIR}/VERSION"
}

print_agent_tree_for_mode() {
  local mode="${1:-}"
  if [[ "$mode" == "--staged" ]]; then
    git write-tree
  else
    git rev-parse 'HEAD^{tree}'
  fi
}

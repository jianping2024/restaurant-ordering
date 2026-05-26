#!/usr/bin/env bash
# Stage all changes, auto-commit, push to origin (main when on main).
#
# Usage (from repo root):
#   pnpm push
#   pnpm push feat/my-branch    # push current HEAD to that remote branch
#   PUSH_MESSAGE="fix tables" pnpm push
#
# Env:
#   PUSH_MESSAGE — override auto-generated commit message
#   PUSH_BASE_BRANCH — default main

set -euo pipefail

BASE="${PUSH_BASE_BRANCH:-main}"
BRANCH_ARG="${1:-}"

auto_commit_message() {
  python3 <<'PY'
import subprocess
from collections import Counter

status = subprocess.check_output(
    ["git", "diff", "--cached", "--name-status"],
    text=True,
).strip().splitlines()

if not status:
    raise SystemExit(0)

labels = {
    "src/components/dashboard": "dashboard",
    "src/components": "components",
    "src/app/api": "API",
    "src/app": "app routes",
    "src/lib/i18n": "i18n",
    "src/lib": "lib",
    "docs": "docs",
    ".github/workflows": "CI workflows",
    ".github": "GitHub config",
    "scripts": "scripts",
    "supabase/migrations": "database migration",
    "supabase": "Supabase",
    "apps/print-agent": "print agent",
}

def area(path: str) -> str:
    for prefix, label in sorted(labels.items(), key=lambda x: -len(x[0])):
        if path == prefix or path.startswith(prefix + "/"):
            return label
    return path.split("/")[0] if "/" in path else path

verbs = Counter()
areas = Counter()
files = []
for line in status:
    parts = line.split("\t")
    if len(parts) < 2:
        continue
    code, path = parts[0], parts[-1]
    files.append(path)
    if code.startswith("A"):
        verbs["Add"] += 1
    elif code.startswith("D"):
        verbs["Remove"] += 1
    else:
        verbs["Update"] += 1
    areas[area(path)] += 1

verb = verbs.most_common(1)[0][0] if verbs else "Update"
top_areas = [a for a, _ in areas.most_common(3)]

if len(files) == 1:
    name = files[0].rsplit("/", 1)[-1]
    detail = f"{name}"
elif len(top_areas) == 1:
    detail = top_areas[0]
else:
    detail = ", ".join(top_areas)

if len(files) > 1 and len(top_areas) <= 2:
    msg = f"{verb} {detail} ({len(files)} files)"
else:
    msg = f"{verb} {detail}"

print(msg[:72])
PY
}

stage_and_commit() {
  git add -A
  if git diff --cached --quiet; then
    return 0
  fi

  local msg="${PUSH_MESSAGE:-}"
  if [[ -z "$msg" ]]; then
    msg=$(auto_commit_message)
  fi
  if [[ -z "$msg" ]]; then
    msg="Update project files"
  fi

  echo "Commit: $msg"
  git commit -m "$msg"
}

current=$(git rev-parse --abbrev-ref HEAD)

git fetch origin "$BASE" --quiet 2>/dev/null || true
stage_and_commit

if git diff --quiet && git diff --cached --quiet; then
  upstream="origin/${BASE}"
  if git rev-parse --verify "$upstream" >/dev/null 2>&1; then
    if [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$upstream")" ]]; then
      echo "Working tree clean; nothing new to push."
      exit 0
    fi
  fi
fi

if [[ -n "$BRANCH_ARG" ]]; then
  remote_branch="$BRANCH_ARG"
elif [[ "$current" == "$BASE" ]]; then
  remote_branch="$BASE"
else
  remote_branch="$current"
fi

echo "Pushing HEAD -> origin/${remote_branch}"
git push origin "HEAD:${remote_branch}" 2>&1 | grep -v 'could not write config file' || true

echo ""
echo "Pushed to origin/${remote_branch}."
if [[ "$remote_branch" == "$BASE" ]]; then
  echo "Vercel will deploy Production after this push to ${BASE}."
fi

#!/usr/bin/env bash
# Push current commit to a branch and open a PR to main (for protected main + required CI).
# With open-pr.yml + automerge.yml on GitHub, merge happens automatically after `web` is green.
#
# Usage (from repo root, after commit):
#   ./scripts/push-to-main.sh
#   ./scripts/push-to-main.sh my-feature-branch
#   pnpm push
#
# Env:
#   GH_TOKEN or GITHUB_TOKEN — optional; only needed for PUSH_WAIT=1
#   GITHUB_REPOSITORY — default jianping2024/restaurant-ordering
#   PUSH_BASE_BRANCH — default main

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-jianping2024/restaurant-ordering}"
BASE="${PUSH_BASE_BRANCH:-main}"
WAIT="${PUSH_WAIT:-0}"
BRANCH_ARG="${1:-}"

current=$(git rev-parse --abbrev-ref HEAD)

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-48
}

if [[ -n "$BRANCH_ARG" ]]; then
  remote_branch="$BRANCH_ARG"
elif [[ "$current" == "$BASE" ]]; then
  subject=$(git log -1 --pretty=%s)
  slug=$(slugify "$subject")
  short=$(git rev-parse --short HEAD)
  remote_branch="ship/${slug:-update}-${short}"
else
  remote_branch="$current"
fi

echo "Pushing HEAD -> origin/${remote_branch} (base: ${BASE})"
git push -u origin "HEAD:${remote_branch}"

pr_url="https://github.com/${REPO}/compare/${BASE}...${remote_branch}?expand=1"
echo ""
echo "Branch pushed: ${remote_branch}"
echo "If open-pr.yml is on ${BASE}, a PR will be created automatically within ~1 min."
echo "Compare / open PR: ${pr_url}"
echo ""
echo "After CI (\`web\`) passes, automerge.yml will squash-merge if **Allow auto-merge** is on in repo settings."

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$TOKEN" && "$WAIT" == "1" ]]; then
  echo "Waiting for PR and green checks (PUSH_WAIT=1)..."
  owner="${REPO%%/*}"
  for ((i = 1; i <= 60; i++)); do
    pr_json=$(curl -sS -H "Authorization: Bearer $TOKEN" \
      "https://api.github.com/repos/${REPO}/pulls?head=${owner}:${remote_branch}&base=${BASE}&state=open")
    pr_num=$(echo "$pr_json" | python3 -c "import sys,json; ps=json.load(sys.stdin); print(ps[0]['number'] if ps else '')" 2>/dev/null || true)
    if [[ -n "$pr_num" ]]; then
      pr_url="https://github.com/${REPO}/pull/${pr_num}"
      state=$(curl -sS -H "Authorization: Bearer $TOKEN" \
        "https://api.github.com/repos/${REPO}/pulls/${pr_num}" | \
        python3 -c "import sys,json; print(json.load(sys.stdin).get('merged', False))")
      if [[ "$state" == "True" ]]; then
        echo "Merged: ${pr_url}"
        exit 0
      fi
      combined=$(curl -sS -H "Authorization: Bearer $TOKEN" \
        "https://api.github.com/repos/${REPO}/commits/${remote_branch}/check-runs?per_page=100" 2>/dev/null || true)
      if echo "$combined" | grep -q '"conclusion": "success"'; then
        echo "Checks passing; auto-merge pending: ${pr_url}"
      fi
    fi
    sleep 10
  done
  echo "Timed out waiting for merge. Check: ${pr_url}"
fi

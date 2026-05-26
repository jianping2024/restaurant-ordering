#!/usr/bin/env bash
# Push current commit to a branch and open a PR to main (for protected main + required CI).
# Automerge runs after CI `web` is green when Allow auto-merge is enabled.
#
# Usage (from repo root, after commit):
#   pnpm push
#   ./scripts/push-to-main.sh
#   ./scripts/push-to-main.sh my-feature-branch
#
# Env:
#   GH_TOKEN or GITHUB_TOKEN — recommended; auto-opens PR and enables automerge
#   GITHUB_REPOSITORY — default jianping2024/restaurant-ordering
#   PUSH_BASE_BRANCH — default main
#   PUSH_WAIT=1 — poll until merged (requires token)

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-jianping2024/restaurant-ordering}"
BASE="${PUSH_BASE_BRANCH:-main}"
WAIT="${PUSH_WAIT:-0}"
BRANCH_ARG="${1:-}"
OWNER="${REPO%%/*}"

load_token() {
  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    return 0
  fi
  if [[ -f .env.local ]]; then
    local line
    line=$(grep -E '^(GH_TOKEN|GITHUB_TOKEN)=' .env.local 2>/dev/null | head -1 || true)
    if [[ -n "$line" ]]; then
      local val="${line#*=}"
      val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
      export GH_TOKEN="$val"
    fi
  fi
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-48
}

open_pull_request() {
  local remote_branch="$1"
  local token="$2"
  local title
  title=$(git log -1 --pretty=%s)

  python3 - "$REPO" "$OWNER" "$remote_branch" "$BASE" "$title" "$token" <<'PY'
import json, sys, urllib.error, urllib.request

repo, owner, head, base, title, token = sys.argv[1:7]
api = f"https://api.github.com/repos/{repo}/pulls?head={owner}:{head}&base={base}&state=open"
req = urllib.request.Request(api, headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
with urllib.request.urlopen(req) as resp:
    existing = json.load(resp)
if existing:
    print(json.dumps({"number": existing[0]["number"], "html_url": existing[0]["html_url"], "created": False}))
    raise SystemExit(0)

payload = json.dumps({
    "title": title.split("\n")[0][:256],
    "head": head,
    "base": base,
    "body": "Opened by `pnpm push`.\n\nCI (`web`) must pass before automerge.",
}).encode()
req = urllib.request.Request(
    f"https://api.github.com/repos/{repo}/pulls",
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        pr = json.load(resp)
except urllib.error.HTTPError as e:
    print(e.read().decode(), file=sys.stderr)
    raise SystemExit(1)
print(json.dumps({"number": pr["number"], "html_url": pr["html_url"], "node_id": pr["node_id"], "created": True}))
PY
}

enable_automerge() {
  local node_id="$1"
  local token="$2"
  python3 - "$node_id" "$token" <<'PY'
import json, sys, urllib.request

node_id, token = sys.argv[1:3]
query = """
mutation($id: ID!) {
  enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: SQUASH}) {
    pullRequest { number }
  }
}
"""
payload = json.dumps({"query": query, "variables": {"id": node_id}}).encode()
req = urllib.request.Request(
    "https://api.github.com/graphql",
    data=payload,
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        json.load(resp)
except Exception:
    pass
PY
}

current=$(git rev-parse --abbrev-ref HEAD)

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
git push -u origin "HEAD:${remote_branch}" 2>&1 | grep -v 'could not write config file' || true

pr_url="https://github.com/${REPO}/compare/${BASE}...${remote_branch}?expand=1"
echo ""
echo "Branch pushed: ${remote_branch}"

load_token
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

if [[ -n "$TOKEN" ]]; then
  echo "Opening pull request..."
  pr_json=$(open_pull_request "$remote_branch" "$TOKEN")
  pr_num=$(echo "$pr_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
  pr_url=$(echo "$pr_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['html_url'])")
  created=$(echo "$pr_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('created', False))")
  node_id=$(echo "$pr_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('node_id',''))")
  if [[ "$created" == "True" ]]; then
    echo "Created PR #${pr_num}: ${pr_url}"
  else
    echo "PR already open #${pr_num}: ${pr_url}"
  fi
  if [[ -n "$node_id" ]]; then
    enable_automerge "$node_id" "$TOKEN"
    echo "Auto-merge enabled (squash); waiting for CI \`web\` to pass."
  fi
else
  echo ""
  echo "No GH_TOKEN — open PR manually:"
  echo "  ${pr_url}"
  echo ""
  echo "Add GH_TOKEN to .env.local (repo scope) for fully automatic PR + merge."
fi

if [[ -n "$TOKEN" && "$WAIT" == "1" ]]; then
  echo "Waiting for merge (PUSH_WAIT=1)..."
  for ((i = 1; i <= 60; i++)); do
    state=$(curl -sS -H "Authorization: Bearer $TOKEN" \
      "https://api.github.com/repos/${REPO}/pulls/${pr_num}" | \
      python3 -c "import sys,json; print(json.load(sys.stdin).get('merged', False))")
    if [[ "$state" == "True" ]]; then
      echo "Merged: ${pr_url}"
      exit 0
    fi
    sleep 10
  done
  echo "Timed out waiting for merge. Check: ${pr_url}"
fi

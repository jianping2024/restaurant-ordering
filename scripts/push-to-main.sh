#!/usr/bin/env bash
# Stage all changes, auto-commit, push to a branch, and open a PR to main.
# Automerge runs after CI `web` is green when Allow auto-merge is enabled.
#
# Usage (from repo root):
#   pnpm push
#   pnpm push feat/my-branch          # optional remote branch name
#   PUSH_MESSAGE="fix tables" pnpm push
#
# Env:
#   GH_TOKEN or GITHUB_TOKEN — recommended; auto-opens PR and enables automerge
#   PUSH_MESSAGE — override auto-generated commit message
#   PUSH_BRANCH — remote branch when on main (default: ship/wip)
#   GITHUB_REPOSITORY — default jianping2024/restaurant-ordering
#   PUSH_BASE_BRANCH — default main
#   PUSH_WAIT=1 — poll until merged (requires token)

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-jianping2024/restaurant-ordering}"
BASE="${PUSH_BASE_BRANCH:-main}"
DEFAULT_PUSH_BRANCH="${PUSH_BRANCH:-ship/wip}"
WAIT="${PUSH_WAIT:-0}"
BRANCH_ARG="${1:-}"
OWNER="${REPO%%/*}"

load_token() {
  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    return 0
  fi
  local env_file=".env.local"
  [[ -f "$env_file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    case "$line" in
      GH_TOKEN=*|GITHUB_TOKEN=*)
        local val="${line#*=}"
        val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
        export GH_TOKEN="$val"
        return 0
        ;;
    esac
  done < "$env_file"
}

load_token

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-48
}

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
    e = existing[0]
    print(json.dumps({
        "number": e["number"],
        "html_url": e["html_url"],
        "node_id": e["node_id"],
        "created": False,
    }))
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
    body = e.read().decode()
    if e.code in (403, 404):
        print(
            "GitHub API refused to create PR (HTTP %d).\n"
            "If using a fine-grained token: Repository → Pull requests → Read and write.\n"
            "Or use a classic token with the `repo` scope.\n%s"
            % (e.code, body),
            file=sys.stderr,
        )
    else:
        print(body, file=sys.stderr)
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
  remote_branch="$DEFAULT_PUSH_BRANCH"
else
  remote_branch="$current"
fi

echo "Pushing HEAD -> origin/${remote_branch} (base: ${BASE})"
git push origin "HEAD:${remote_branch}" 2>&1 | grep -v 'could not write config file' || true

pr_url="https://github.com/${REPO}/compare/${BASE}...${remote_branch}?expand=1"
echo ""
echo "Branch pushed: ${remote_branch}"

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
    if [[ "$created" == "True" ]]; then
      echo "Auto-merge enabled (squash); waiting for CI \`web\` to pass."
    else
      echo "PR updated; auto-merge (re)enabled if not already on."
    fi
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

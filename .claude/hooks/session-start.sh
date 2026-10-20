#!/bin/bash
# SessionStart hook: tell Claude whether local main is stale and which branch we're on.
# Its stdout is injected into Claude's context at the start of every session.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

git fetch --quiet origin main 2>/dev/null
branch=$(git branch --show-current 2>/dev/null)
behind=$(git rev-list --count main..origin/main 2>/dev/null)

if [ -n "$behind" ] && [ "$behind" -gt 0 ] 2>/dev/null; then
  echo "WARNING: local main is $behind commit(s) behind origin/main. Before starting any new work, update it: git checkout main && git pull, then branch from fresh main."
else
  echo "Local main is up to date with origin/main."
fi

echo "Current branch: ${branch:-unknown}."
echo "Workflow reminder: never work directly on main. For any change: branch from fresh main, commit there, push, open a PR with 'gh pr create', and show the user the PR URL. See CLAUDE.md."
exit 0

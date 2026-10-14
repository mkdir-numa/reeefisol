#!/bin/bash
# Blocks git commit / git push while on main, and explicit pushes to main.
# Wired up as a PreToolUse hook in .claude/settings.json.

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only care about commands that commit or push
if ! printf '%s' "$cmd" | grep -qE 'git[^|;&]*\b(commit|push)\b'; then
  exit 0
fi

branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null)

if [ "$branch" = "main" ]; then
  echo "BLOCKED: you are on 'main'. This repo never commits or pushes directly to main." >&2
  echo "Create a branch first (git checkout -b <type>/<short-description>), then commit there and open a PR." >&2
  exit 2
fi

# Explicit push targeting main from any branch (e.g. git push origin main, git push origin HEAD:main)
if printf '%s' "$cmd" | grep -qE 'git[^|;&]*\bpush\b[^|;&]*(\s|:)main\b'; then
  echo "BLOCKED: direct pushes to 'main' are not allowed. Push your feature branch and open a PR instead." >&2
  exit 2
fi

exit 0

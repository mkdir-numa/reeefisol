#!/bin/bash
# Blocks git commit / git push while on main, and explicit pushes to main.
# Wired up as a PreToolUse hook in .claude/settings.json.

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only care about commands that commit or push
if ! printf '%s' "$cmd" | grep -qE 'git[^|;&]*\b(commit|push)\b'; then
  exit 0
fi

# Work out which folder the commit/push runs in, so a worktree on a feature branch isn't
# judged by the main folder's branch. In order: `git -C <dir>`, a leading `cd <dir>`,
# the tool call's cwd, then the project folder.
dir=$(printf '%s' "$input" | python3 -c '
import json, os, shlex, sys
d = json.load(sys.stdin)
cmd = d.get("tool_input", {}).get("command", "")
base = d.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or "."
try:
    words = shlex.split(cmd, posix=True)
except ValueError:
    words = cmd.split()
target = None
for i, w in enumerate(words):
    if w == "git" and i + 2 < len(words) and words[i + 1] == "-C":
        target = words[i + 2]; break
if target is None and len(words) > 1 and words[0] == "cd":
    target = words[1].rstrip(";&")
if target:
    target = os.path.expanduser(target)
    if not os.path.isabs(target):
        target = os.path.join(base, target)
print(target or base)
' 2>/dev/null)

branch=$(git -C "${dir:-${CLAUDE_PROJECT_DIR:-.}}" branch --show-current 2>/dev/null)

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

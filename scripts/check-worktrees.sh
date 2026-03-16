#!/bin/bash
# Check all git worktrees for uncommitted or unpushed work
# Run this before starting new work to avoid losing changes

REPO_ROOT="/Users/kramme/projects/ai-training-analyst"

echo "Checking all worktrees for uncommitted/unpushed work..."
echo ""

git -C "$REPO_ROOT" worktree list --porcelain | grep "^worktree " | sed 's/^worktree //' | while read -r wt; do
  name=$(basename "$wt")

  # Check for uncommitted changes
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null | grep -v '^\?\?' | head -1)
  untracked=$(git -C "$wt" status --porcelain 2>/dev/null | grep '^\?\?' | wc -l | tr -d ' ')

  # Check for unpushed commits
  branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)
  unpushed=$(git -C "$wt" log --oneline "@{upstream}..HEAD" 2>/dev/null | wc -l | tr -d ' ')

  # Report issues
  issues=""
  [ -n "$dirty" ] && issues="UNCOMMITTED CHANGES"
  [ "$unpushed" -gt 0 ] && issues="${issues:+$issues, }$unpushed UNPUSHED COMMITS"

  if [ -n "$issues" ]; then
    echo "⚠️  $name ($branch): $issues"
  fi
done

echo ""
echo "Done."

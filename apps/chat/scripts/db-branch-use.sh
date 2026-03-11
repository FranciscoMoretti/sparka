#!/bin/bash
# Switch active database branch (like git checkout)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
if [ -f "$MONOREPO_ROOT/turbo.json" ]; then
  BRANCH_FILE="$MONOREPO_ROOT/.neon-branch"
else
  BRANCH_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.neon-branch"
fi
BRANCH_NAME="${1:-}"

if [ -z "$BRANCH_NAME" ]; then
  if [ -f "$BRANCH_FILE" ]; then
    echo "Currently on branch: $(cat "$BRANCH_FILE")"
  else
    echo "Currently on: main (production)"
  fi
  echo ""
  echo "Usage: bun db:branch:use <branch-name>"
  echo "       bun db:branch:use main  (switch to production)"
  exit 0
fi

if [ "$BRANCH_NAME" = "main" ] || [ "$BRANCH_NAME" = "-" ]; then
  if [ -f "$BRANCH_FILE" ]; then
    rm "$BRANCH_FILE"
    echo "✓ Switched to main (production database)"
  else
    echo "Already on main"
  fi
  exit 0
fi

# Validate branch exists by trying to get connection string
echo "🔗 Validating branch '$BRANCH_NAME'..."
BRANCH_URL=$(bunx neonctl connection-string "$BRANCH_NAME" 2>/dev/null | grep -E '^postgresql://') || {
  echo ""
  echo "❌ Branch '$BRANCH_NAME' not found"
  echo ""
  echo "$BRANCH_URL"
  echo ""
  echo "Available branches: bun db:branch:list"
  echo "Create branch: bun db:branch:create"
  exit 1
}

echo "$BRANCH_NAME" > "$BRANCH_FILE"
MASKED_URL=$(echo "$BRANCH_URL" | sed 's/:[^:@]*@/:****@/')
echo "✓ Switched to branch '$BRANCH_NAME'"
echo "  DATABASE_URL=$MASKED_URL"


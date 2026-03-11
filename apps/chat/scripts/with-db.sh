#!/bin/bash
# Wrapper that uses branch DATABASE_URL if .neon-branch exists, otherwise uses .env.local
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
if [ -f "$MONOREPO_ROOT/turbo.json" ]; then
  BRANCH_FILE="$MONOREPO_ROOT/.neon-branch"
else
  BRANCH_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.neon-branch"
fi

if [ -f "$BRANCH_FILE" ]; then
  BRANCH_NAME=$(cat "$BRANCH_FILE")
  
  # Get branch connection string (filter out bun's package resolution output)
  BRANCH_URL=$(bunx neonctl connection-string "$BRANCH_NAME" 2>/dev/null | grep -E '^postgresql://') || {
    echo "❌ Failed to get connection string for branch '$BRANCH_NAME'"
    echo "$BRANCH_URL"
    echo ""
    echo "Run: bun db:branch:use main  (to switch back to main)"
    exit 1
  }
  
  MASKED_URL=$(echo "$BRANCH_URL" | sed 's/:[^:@]*@/:****@/')
  echo "🔀 Using branch '$BRANCH_NAME': $MASKED_URL"
  
  DATABASE_URL="$BRANCH_URL" exec "$@"
else
  exec "$@"
fi


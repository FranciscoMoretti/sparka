#!/bin/bash
set -e

BRANCH_NAME="${1:-dev-local}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
if [ -f "$MONOREPO_ROOT/turbo.json" ]; then
  BRANCH_FILE="$MONOREPO_ROOT/.neon-branch"
else
  BRANCH_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.neon-branch"
fi

# Check if we're currently on this branch
if [ -f "$BRANCH_FILE" ] && [ "$(cat "$BRANCH_FILE")" = "$BRANCH_NAME" ]; then
  echo "⚠️  Currently on branch '$BRANCH_NAME', switching to main first..."
  rm "$BRANCH_FILE"
fi

echo "🗑️  Deleting branch '$BRANCH_NAME'..."
bunx neonctl branches delete "$BRANCH_NAME" --force

echo "✓ Branch '$BRANCH_NAME' deleted"


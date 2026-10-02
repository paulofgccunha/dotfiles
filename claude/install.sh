#!/usr/bin/env bash
# Installs the custom Claude Code status line into ~/.claude/
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.claude"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH" >&2
  exit 1
fi

mkdir -p "$TARGET"
cp "$HERE/statusline.js" "$TARGET/statusline.js"
cp "$HERE/statusline-usage-fetch.js" "$TARGET/statusline-usage-fetch.js"
echo "Copied statusline.js and statusline-usage-fetch.js to $TARGET"

node "$HERE/merge-settings.mjs"

echo
echo "Done. Open a new Claude Code session (or run /hooks once) to pick up the change."

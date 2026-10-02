#!/usr/bin/env bash
# Removes the custom Claude Code status line from ~/.claude/
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.claude"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH" >&2
  exit 1
fi

node "$HERE/merge-settings.mjs" --remove

for f in statusline.js statusline-usage-fetch.js .statusline-usage-cache.json .statusline-usage-cache.json.lock; do
  if [ -e "$TARGET/$f" ]; then
    rm -f "$TARGET/$f"
    echo "Removed $TARGET/$f"
  fi
done

echo
echo "Done. Claude Code falls back to its built-in status line on the next render."

#!/usr/bin/env bash
# ============================================================
# uninstall-launch-agent.sh
# Removes the Codex Switcher launchd Login Item.
# ============================================================

set -euo pipefail

PLIST_LABEL="com.lampese.codex-switcher"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

if [[ ! -f "$PLIST_DEST" ]]; then
  echo "ℹ️   No launch agent found at: $PLIST_DEST"
  echo "    Nothing to uninstall."
  exit 0
fi

echo "⏸   Unloading launch agent..."
launchctl unload "$PLIST_DEST" 2>/dev/null || true

rm -f "$PLIST_DEST"
echo "🗑   Removed plist: $PLIST_DEST"
echo "✅  Codex Switcher will no longer auto-start at login."

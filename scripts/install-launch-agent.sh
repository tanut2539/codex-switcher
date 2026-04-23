#!/usr/bin/env bash
# ============================================================
# install-launch-agent.sh
# Installs Codex Switcher as a macOS Login Item via launchd.
#
# Usage:
#   ./scripts/install-launch-agent.sh [/path/to/Codex Switcher.app]
#
# If no path is given, looks in /Applications first, then in
# the Tauri release bundle inside this repo.
# ============================================================

set -euo pipefail

PLIST_LABEL="com.lampese.codex-switcher"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SRC="${SCRIPT_DIR}/${PLIST_LABEL}.plist"

# ── Resolve .app path ─────────────────────────────────────────────────────────
if [[ $# -ge 1 ]]; then
  APP_PATH="$1"
else
  # 1. Check /Applications
  if [[ -d "/Applications/Codex Switcher.app" ]]; then
    APP_PATH="/Applications/Codex Switcher.app"
  # 2. Check repo release bundle
  elif [[ -d "${SCRIPT_DIR}/../src-tauri/target/release/bundle/macos/Codex Switcher.app" ]]; then
    APP_PATH="$(cd "${SCRIPT_DIR}/../src-tauri/target/release/bundle/macos/Codex Switcher.app" && pwd)"
  else
    echo ""
    echo "❌  Could not find Codex Switcher.app."
    echo ""
    echo "    Build the app first:"
    echo "      pnpm tauri build"
    echo ""
    echo "    Then either:"
    echo "      a) Copy it to /Applications and re-run this script, or"
    echo "      b) Run:  ./scripts/install-launch-agent.sh \"/path/to/Codex Switcher.app\""
    echo ""
    exit 1
  fi
fi

# ── Resolve binary path inside the .app ──────────────────────────────────────
APP_BINARY="${APP_PATH}/Contents/MacOS/Codex Switcher"
if [[ ! -x "$APP_BINARY" ]]; then
  echo "❌  Binary not found at: $APP_BINARY"
  exit 1
fi

echo "✅  Found app at: $APP_PATH"

# ── Unload any existing agent first ──────────────────────────────────────────
if [[ -f "$PLIST_DEST" ]]; then
  echo "⏸   Unloading existing launch agent..."
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# ── Write the plist with the real binary path ─────────────────────────────────
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|APP_PATH|${APP_BINARY}|g" "$PLIST_SRC" > "$PLIST_DEST"
echo "📄  Installed plist → $PLIST_DEST"

# ── Load the agent (starts immediately) ───────────────────────────────────────
launchctl load "$PLIST_DEST"
echo "🚀  Launch agent loaded — Codex Switcher will now start at every login."
echo ""
echo "    To start it right now:  open -a 'Codex Switcher'"
echo "    To stop auto-start:     ./scripts/uninstall-launch-agent.sh"
echo ""

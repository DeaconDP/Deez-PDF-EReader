#!/bin/bash
cd "$(dirname "$0")"
ROOT="$(pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

WIN="deezpdf"

start_in_terminal() {
  node launcher/index.js
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "Press Enter to close..."
    read
  fi
  osascript -e 'tell application "Terminal" to close front window' 2>/dev/null || exit $EXIT_CODE
  exit $EXIT_CODE
}

if dale-tmux-window -n "$WIN" -c "$ROOT" -- node launcher/index.js; then
  dale-tmux-close-launcher
  exit 0
fi

echo "tmux unavailable; running in this Terminal."
start_in_terminal

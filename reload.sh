#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="modern-sound@husain-anabtawi.com"
TARGET="$HOME/.local/share/cinnamon/applets/$UUID"

echo "==> Tests"
"$ROOT/test.sh"

echo ""
echo "==> Symlink"
mkdir -p "$HOME/.local/share/cinnamon/applets"
ln -sfn "$ROOT/$UUID" "$TARGET"
echo "  $TARGET"

echo ""
echo "==> Reload Cinnamon (required)"
echo "  Alt+F2 → r → Enter"
echo ""
echo "If the applet still fails after restart:"
echo "  1. Open Applets settings"
echo "  2. Remove Modern Sound from the panel"
echo "  3. Add it again"
echo ""
echo "Verify in Looking Glass (Alt+F2 → lg → Enter), Logs tab:"
echo "  search for: [modern-sound] applet initialized"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Tests"
"$ROOT/test.sh"

echo ""
echo "==> Reload Cinnamon (required)"
echo "  Alt+F2 → r → Enter"
echo ""
echo "Using the Spices-installed applet (not a local dev symlink)."
echo "To link this repo for development instead, run: ./dev-link.sh"
echo ""
echo "If the applet still fails after restart:"
echo "  1. Open Applets settings"
echo "  2. Remove Modern Sound from the panel"
echo "  3. Add it again (or re-download from Applets → Download)"
echo ""
echo "Verify in Looking Glass (Alt+F2 → lg → Enter), Logs tab:"
echo "  search for: [modern-sound] applet initialized"

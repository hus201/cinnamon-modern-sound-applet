#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="modern-sound@husain-anabtawi.com"
TARGET="$HOME/.local/share/cinnamon/applets/$UUID"

echo "==> Tests"
"$ROOT/test.sh"

echo ""
echo "==> Development symlink"
mkdir -p "$HOME/.local/share/cinnamon/applets"
ln -sfn "$ROOT/$UUID" "$TARGET"
echo "  $TARGET -> $ROOT/$UUID"

echo ""
echo "==> Reload Cinnamon (required)"
echo "  Alt+F2 → r → Enter"
echo ""
echo "To switch back to the Spices-installed copy, run: ./dev-unlink.sh"

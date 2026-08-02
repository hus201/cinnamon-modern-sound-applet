#!/usr/bin/env bash
set -euo pipefail

UUID="modern-sound@husain-anabtawi.com"
TARGET="$HOME/.local/share/cinnamon/applets/$UUID"

if [[ -L "$TARGET" ]]; then
    rm "$TARGET"
    echo "Removed development symlink: $TARGET"
elif [[ -e "$TARGET" ]]; then
    echo "Not a symlink (likely the Spices-installed copy): $TARGET"
    echo "Nothing to remove."
else
    echo "Applet not found at: $TARGET"
fi

echo ""
echo "Install or update the official copy from:"
echo "  Menu → Preferences → Applets → Download → Modern Sound"
echo ""
echo "Then reload Cinnamon: Alt+F2 → r → Enter"

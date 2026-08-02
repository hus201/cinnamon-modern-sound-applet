#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLET_DIR="$ROOT/modern-sound@husain-anabtawi.com"

echo "==> Syntax check (node)"
for file in "$APPLET_DIR"/applet.js "$APPLET_DIR"/handlers/*.js "$APPLET_DIR"/widgets/*.js; do
  node --check "$file"
  echo "  ok $(basename "$file")"
done

echo ""
echo "==> JSON check"
node -e "JSON.parse(require('fs').readFileSync('$APPLET_DIR/metadata.json'))"
node -e "JSON.parse(require('fs').readFileSync('$APPLET_DIR/settings-schema.json'))"
echo "  ok metadata.json, settings-schema.json"

if command -v gjs >/dev/null 2>&1; then
  echo ""
  echo "==> Runtime tests (gjs + mocked Cinnamon)"
  export APPLET_TEST_ROOT="$ROOT"
  gjs "$ROOT/tests/run-tests.js"
else
  echo ""
  echo "==> Runtime tests (node + mocked Cinnamon)"
  node "$ROOT/tests/run-tests-node.js"
fi

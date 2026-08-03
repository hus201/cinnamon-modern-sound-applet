#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLET_DIR="$ROOT/modern-sound@husain-anabtawi.com"

if ! command -v gjs >/dev/null 2>&1; then
  echo "Error: gjs is required for tests. Install with: sudo apt install gjs"
  exit 1
fi

echo "==> JSON check"
python3 -c "import json; json.load(open('$APPLET_DIR/metadata.json'))"
python3 -c "import json; json.load(open('$APPLET_DIR/settings-schema.json'))"
echo "  ok metadata.json, settings-schema.json"

echo ""
echo "==> Runtime tests (gjs + mocked Cinnamon)"
export APPLET_TEST_ROOT="$ROOT"
gjs "$ROOT/tests/run-tests.js"

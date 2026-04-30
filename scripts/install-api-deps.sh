#!/bin/sh
# Install api/ Python deps into api/.venv. Pydantic (pinned) needs CPython <= 3.13 today.
set -e
cd "$(dirname "$0")/../api"

pick_python() {
  for cand in python3.13 python3.12 python3.11; do
    if command -v "$cand" >/dev/null 2>&1; then
      "$cand" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] <= (3, 13) else 1)' 2>/dev/null && {
        echo "$cand"
        return 0
      }
    fi
  done
  echo "install-api-deps: need Python 3.11–3.13 (e.g. brew install python@3.12). Default python3 is too new for pinned pydantic." >&2
  exit 1
}

PY="$(pick_python)"

need_recreate=false
if [ ! -x .venv/bin/python ]; then
  need_recreate=true
elif ! .venv/bin/python -c 'import sys; raise SystemExit(0 if sys.version_info[:2] <= (3, 13) else 1)' 2>/dev/null; then
  need_recreate=true
fi

if "$need_recreate"; then
  rm -rf .venv
  "$PY" -m venv .venv
fi

.venv/bin/python -m pip install -r requirements.txt

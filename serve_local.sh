#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-4000}"
HOST="${HOST:-127.0.0.1}"
MODE="${1:-static}"
if [[ "${MODE}" == "--jekyll" ]]; then
  MODE="jekyll"
fi
if [[ "${MODE}" == "jekyll" ]]; then
  if command -v docker >/dev/null 2>&1; then
    echo "Starting Jekyll with Docker at http://${HOST}:${PORT}"
    exec docker run --rm \
      -p "${PORT}:4000" \
      -v "${PWD}:/srv/jekyll" \
      -w /srv/jekyll \
      jekyll/jekyll:pages \
      jekyll serve --watch --host 0.0.0.0 --port 4000
  fi
  if command -v bundle >/dev/null 2>&1; then
    if [[ ! -f Gemfile ]]; then
      cat > Gemfile <<'EOF'
source "https://rubygems.org"
gem "github-pages", group: :jekyll_plugins
EOF
      echo "Created Gemfile for GitHub Pages local preview."
    fi
    echo "Installing gems (first run may take a while)..."
    bundle install
    echo "Starting Jekyll at http://${HOST}:${PORT}"
    exec bundle exec jekyll serve --watch --host "${HOST}" --port "${PORT}"
  fi
  echo "Error: Jekyll mode requested, but neither Docker nor Bundler is available."
  exit 1
fi
if command -v npx >/dev/null 2>&1; then
  echo "Starting static server with Node at http://${HOST}:${PORT}"
  exec npx --yes http-server . -p "${PORT}" -a "${HOST}" -c-1
fi
if command -v python3 >/dev/null 2>&1; then
  echo "Starting static server with Python at http://${HOST}:${PORT}"
  exec python3 -m http.server "${PORT}" --bind "${HOST}"
fi
echo "Error: no local server runtime found."
echo "Install Node.js (preferred) or Python 3, then run again."
echo "Use './serve_local.sh --jekyll' only if you specifically need Jekyll processing."
exit 1

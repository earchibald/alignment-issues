# hi. you there? — task runner
#
# `just deploy` is the only supported way to publish. It pins the git ref
# explicitly, because the Actions "Run workflow" dropdown deploys whatever
# branch it happens to be showing — on 2026-08-06 that silently republished
# an old branch head over the live site.

repo := "earchibald/alignment-issues"
site := "https://earchibald.github.io/alignment-issues"
port := "8000"

_default:
    @just --list

# Run the test suite (bare `node --test`; a directory arg breaks on Node 26)
test:
    npm test

# Serve the game locally at http://localhost:{{port}}/ (add ?debug=1 for the dev drawer)
serve:
    @echo "serving game/ at http://localhost:{{port}}/  (ctrl-c to stop)"
    cd game && python3 -m http.server {{port}}

# Publish main to GitHub Pages: preflight, dispatch pinned to main, watch, verify live
deploy: preflight
    #!/usr/bin/env bash
    set -euo pipefail
    sha=$(git rev-parse origin/main)
    echo "==> dispatching deploy for origin/main ${sha:0:7}"
    gh workflow run deploy.yml --ref main --repo {{repo}}

    # The run takes a moment to appear; find the one matching our SHA.
    run=""
    for _ in $(seq 1 20); do
      sleep 5
      run=$(gh run list --workflow deploy.yml --repo {{repo}} --limit 10 \
            --json databaseId,headSha,status \
            --jq "[.[] | select(.headSha==\"$sha\" and .status!=\"completed\")][0].databaseId // empty")
      [ -n "$run" ] && break
      echo "    waiting for the run to be queued…"
    done
    if [ -z "$run" ]; then
      echo "!! no run appeared. GitHub Actions may be degraded — check https://www.githubstatus.com"
      exit 1
    fi

    echo "==> watching run $run"
    gh run watch "$run" --repo {{repo}} --exit-status
    just verify

# Fail fast before dispatching: right branch, clean tree, pushed, tests green
preflight:
    #!/usr/bin/env bash
    set -euo pipefail
    branch=$(git rev-parse --abbrev-ref HEAD)
    [ "$branch" = "main" ] || { echo "!! on '$branch'; deploy publishes main. Switch or merge first."; exit 1; }

    git fetch --quiet origin main
    read -r behind ahead < <(git rev-list --left-right --count origin/main...HEAD | tr '\t' ' ')
    [ "$behind" -eq 0 ] || { echo "!! local main is $behind commit(s) behind origin/main. Pull first."; exit 1; }
    if [ "$ahead" -gt 0 ]; then
      echo "!! local main is $ahead commit(s) ahead of origin/main — those would NOT be deployed:"
      git --no-pager log --oneline origin/main..HEAD
      echo "   push them first, or deploy deliberately knowing they are excluded."
      exit 1
    fi

    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      echo "!! uncommitted changes to tracked files; commit or stash first."
      exit 1
    fi

    echo "==> tests"
    npm test

# Check what the live site is actually serving (catches a stale or reverted deploy)
verify:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "==> {{site}}/"
    code=$(curl -s -o /dev/null -w '%{http_code}' {{site}}/)
    echo "    index: HTTP $code"
    live_arrival=$(curl -s {{site}}/js/engine/constants.js | grep -o 'ARRIVAL_BASE_TICKS: [0-9]*' || echo 'ARRIVAL_BASE_TICKS: ?')
    local_arrival=$(grep -o 'ARRIVAL_BASE_TICKS: [0-9]*' game/js/engine/constants.js)
    live_q=$(curl -s {{site}}/js/engine/content.js | grep -co "id: 'q" || true)
    local_q=$(grep -co "id: 'q" game/js/engine/content.js)
    echo "    live : $live_arrival, $live_q queries"
    echo "    local: $local_arrival, $local_q queries"
    if [ "$live_arrival" = "$local_arrival" ] && [ "$live_q" = "$local_q" ]; then
      echo "==> live site matches the working tree"
    else
      echo "!! live site does NOT match the working tree — stale or reverted deploy"
      exit 1
    fi

# Is GitHub Actions/Pages healthy right now?
status:
    @curl -s https://www.githubstatus.com/api/v2/summary.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status']['description']); [print(' -', c['name'], c['status']) for c in d['components'] if c['name'] in ('Actions','Pages')]"
    @gh run list --workflow deploy.yml --repo {{repo}} --limit 5 \
        --json createdAt,headSha,event,status,conclusion \
        --jq '.[] | "\(.createdAt)  \(.headSha[0:7])  \(.event)  \(.status) \(.conclusion)"'

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

# Dev tuning suite at http://localhost:8899/ — tune effects, then apply them to the project
#
# --watch because the server holds its write schema in memory. A suite left
# running while new knobs are added rejects them with "unknown keys", and the
# error points at the tool rather than at the stale process — which cost a
# real debugging session once. Node restarts it when the source changes.
devtools port="8899":
    @echo "dev suite at http://localhost:{{port}}/  (ctrl-c to stop)"
    node --watch devtools/server.js {{port}}

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

# Cut a release: bump the version, tag it, push, deploy. `just release 0.5.0`
release version: preflight
    #!/usr/bin/env bash
    set -euo pipefail
    v="{{version}}"
    [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "!! '$v' is not X.Y.Z"; exit 1; }
    git rev-parse -q --verify "refs/tags/v$v" >/dev/null && { echo "!! tag v$v already exists"; exit 1; }

    prev=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    echo "==> releasing v$v${prev:+ (previous: $prev)}"

    # Version lives in exactly two places; keep them in lockstep.
    sed -i '' "s/^export const VERSION = '.*';/export const VERSION = '$v';/" game/js/version.js
    node -e "const f='package.json',p=require('./'+f);p.version='$v';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"

    # Changelog entry from the commit subjects since the last tag.
    range=${prev:+$prev..HEAD}
    { echo "## v$v — $(date -u +%Y-%m-%d)"; echo; git log --no-merges --pretty='- %s' ${range:-HEAD}; echo; } > .release-notes
    if [ -f CHANGELOG.md ]; then
      # Insert after the header block, i.e. before the first existing entry —
      # not at byte 0, which would bury the title under the newest release.
      first=$(grep -n '^## ' CHANGELOG.md | head -1 | cut -d: -f1)
      if [ -n "$first" ]; then
        head -n $((first - 1)) CHANGELOG.md > .changelog.tmp
        cat .release-notes >> .changelog.tmp
        tail -n +$first CHANGELOG.md >> .changelog.tmp
      else
        cat CHANGELOG.md .release-notes > .changelog.tmp
      fi
    else
      cp .release-notes .changelog.tmp
    fi
    mv .changelog.tmp CHANGELOG.md
    rm -f .release-notes

    git add game/js/version.js package.json CHANGELOG.md
    git commit -m "release: v$v"
    git tag -a "v$v" -m "v$v"
    git push origin main --follow-tags
    just deploy
    echo "==> v$v released"

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
    live_ver=$(curl -s {{site}}/js/version.js | grep -o "VERSION = '[^']*'" || echo "VERSION = '?'")
    live_build=$(curl -s {{site}}/js/version.js | grep -o "BUILD = '[^']*'" || echo "BUILD = '?'")
    echo "    live : $live_arrival, $live_q queries, $live_ver, $live_build"
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

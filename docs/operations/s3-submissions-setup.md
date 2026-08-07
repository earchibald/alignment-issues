# S3 Submissions — Operator Setup

This manual activates the S3 submission pathway. The pathway ships
inactive. Local file export keeps working at every step.

Write access goes only through the broker Lambda. Players never hold AWS
keys. Kill switches, any one sufficient: unset the token, disable the
Lambda, or ship the inactive stub.

## Prerequisites

1. An AWS account, with admin credentials configured for the aws CLI
   (`aws sts get-caller-identity` must succeed).
2. Terraform: `brew install terraform`.
3. The aws CLI and node (already required by this repo).

## 1. Configure variables

1. Copy the template: `cp infra/terraform.tfvars.example infra/terraform.tfvars`.
2. Edit `infra/terraform.tfvars`:
   - `bucket_name` — globally unique.
   - `region` — your region.
   - `allowed_origin` — the exact Pages origin, no trailing slash.
   - `submit_token` — generate with `openssl rand -hex 24`.

WARNING: `terraform.tfvars` and the local state files hold secrets. Both
are git-ignored. Never commit them. Never share the state file.

## 2. Deploy the stack

1. `./infra/run.sh init`
2. `./infra/run.sh plan` — review the resources.
3. `./infra/run.sh apply` — type `yes` when prompted.

Apply writes `infra/outputs.json` (bucket, region, function URL — no
secrets). Note the `function_url` output; step 4 needs it.

## 3. Configure the analyst profile

1. Read the key id: `terraform -chdir=infra output -raw analyst_access_key_id`
2. Read the secret: `terraform -chdir=infra output -raw analyst_secret_access_key`
3. Add to `~/.aws/credentials`:

       [hyt-analyst]
       aws_access_key_id     = <key id>
       aws_secret_access_key = <secret>

4. Named profiles do not inherit region from `[default]`. Add to
   `~/.aws/config`:

       [profile hyt-analyst]
       region = <your region>

5. Verify: `node scripts/sessions.mjs list` — expect `no submissions`.

## 4. Configure GitHub and deploy

In the repository settings:

1. Secret `HYT_SUBMIT_TOKEN` — the same value as `submit_token` in
   terraform.tfvars.
2. Variable `HYT_BROKER_URL` — the `function_url` output.
3. Variable `HYT_SUBMIT_ENABLED` — `1`.

Then trigger a Pages deploy (push to main, or run the workflow manually).
The deploy overwrites `js/telemetry/submit-env.js` in the artifact with
the live config. The committed stub in git stays inactive.

## 5. Verify end to end

1. On a dev device, open the deployed site with `?debug=1`.
2. Play briefly. Open the dev drawer. Each session row now has a
   `submit` button.
3. Tap submit. The button changes to `submitted`.
4. On your machine: `node scripts/sessions.mjs list` — the session id
   appears. Then `node scripts/sessions.mjs pull --latest --dest /tmp/hyt-pull`
   and check the files.
5. Negative check: `curl -s -X POST <function_url> -H 'content-type: application/json' -d '{"token":"wrong","sessionId":"x","filename":"y","size":1,"contentType":"text/plain"}'`
   must answer `{"reason":"bad token"}`.

## 6. Rotate the token

1. Generate a new token: `openssl rand -hex 24`.
2. Update `submit_token` in `infra/terraform.tfvars`.
3. `./infra/run.sh apply`.
4. Update the GitHub secret `HYT_SUBMIT_TOKEN`.
5. Redeploy Pages.

Old clients hold the old token and are refused after step 3. There is no
overlap window; rotate at a quiet moment.

## 7. Deactivate or tear down

- Pause: set the GitHub variable `HYT_SUBMIT_ENABLED` to `0` and
  redeploy. Or disable the Lambda in the AWS console.
- Unset the token:
  1. Set `submit_token = ""` in `infra/terraform.tfvars`.
  2. Run `./infra/run.sh apply`. The Lambda now refuses every grant with
     `503 submissions disabled`.
  3. Optionally delete the GitHub secret `HYT_SUBMIT_TOKEN` so a later
     deploy cannot re-inject it.
- Full teardown: `./infra/run.sh destroy` (prompts for confirmation). The
  bucket must be empty first; pull anything you want to keep, then
  `node scripts/sessions.mjs rm <sessionId>` per session.

## Notes

- State is local (`infra/terraform.tfstate`). For multi-machine
  operation, migrate to an S3 backend later; until then, treat the state
  file as a secret and keep it on one machine.
- Objects expire automatically after `expire_days` (default 90).
- The broker refuses everything except a valid grant request from the
  configured origin: exact key, exact content type, size cap, 60 s
  expiry.

#!/usr/bin/env bash
# Terraform wrapper for the S3 submission pathway.
# Full operator flow: docs/operations/s3-submissions-setup.md
set -euo pipefail
cd "$(dirname "$0")"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing: $1 — install with: brew install $2" >&2
    exit 1
  }
}
need terraform terraform
need aws awscli
need node node

write_outputs() {
  # Non-sensitive outputs only: the analyst secret stays in terraform
  # state and is retrieved with `terraform output -raw ...` (see manual).
  terraform output -json | node -e '
    let s = "";
    process.stdin.on("data", (d) => { s += d; });
    process.stdin.on("end", () => {
      const all = JSON.parse(s);
      const keep = {};
      for (const k of ["bucket", "region", "function_url"]) {
        if (all[k]) keep[k] = all[k].value;
      }
      require("node:fs").writeFileSync("outputs.json", JSON.stringify(keep, null, 2) + "\n");
      console.log("wrote infra/outputs.json (non-sensitive outputs only)");
    });
  '
}

case "${1:-}" in
  init)    terraform init ;;
  plan)    terraform plan ;;
  apply)   terraform apply; write_outputs ;;
  outputs) write_outputs ;;
  destroy) terraform destroy ;;
  *)
    echo "usage: ./run.sh init|plan|apply|outputs|destroy" >&2
    exit 64
    ;;
esac

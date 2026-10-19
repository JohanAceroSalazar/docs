# Reference Data OpenAPI compatibility gate

> Status: 🟡 In progress | Last updated: 2026-10-17
> Owner: Reference Data team | Team: Architecture and DevOps

## Purpose

`07-api/contracts/openapi/reference-data.yaml` is the approved, canonical Reference Data API contract. The compatibility gate compares a pull request version of that file with the version in the pull request base commit. It prevents definite breaking changes from being merged unnoticed.

The contract is not copied into application repositories. Consumers generate or validate against the approved contract artifact.

## Tooling

- OpenAPI structural lint: `@redocly/cli` `1.34.2`.
- Compatibility detection: `oasdiff` `1.11.7`.
- Semantic version policy: `scripts/openapi/validate-semver.mjs`.

The GitHub Actions workflow installs these exact versions. A failed download, invalid document, absent base contract, invalid oasdiff output, or validation error fails the job.

## Semantic-version policy

`info.version` must be `MAJOR.MINOR.PATCH` without a prefix or suffix.

| Change classification | Required version rule |
|---|---|
| No consumer-facing change, including description/example-only changes | The version may stay unchanged or increase; it must never decrease. |
| Consumer-facing compatible change reported by `oasdiff changelog` | Increase `MINOR` or `MAJOR`. A PATCH-only increment is rejected. |
| Breaking change reported by `oasdiff breaking` | Rejected regardless of the version increment, including a MAJOR increment. |

`oasdiff changelog` intentionally excludes description and example changes. It is used only to distinguish consumer-facing compatible changes from documentation-only changes. The gate does not automatically approve breaking changes based on SemVer.

## GitHub Actions behavior

`.github/workflows/openapi-reference-data-compatibility.yml` runs on pull requests to `main` that affect the Reference Data contract, its shared OpenAPI references, or the gate implementation. The docs repository branch convention is `main`; code-repository environment branches do not apply to this contract owner.

The workflow extracts the base contract with `git show` using the PR base SHA. A missing or empty base is an error, never a successful comparison. It then lints the proposed contract, produces an oasdiff changelog for SemVer, runs the SemVer validator, and runs `oasdiff breaking --fail-on ERR`.

An administrator must configure the workflow job status check named **OpenAPI compatibility gate** as a required status check in the `main` branch protection rule. Until that remote GitHub setting is verified, the workflow can fail but cannot be claimed to block merges.

## Local execution

Install `oasdiff` version `1.11.7` and make it available on `PATH`. From the repository root:

```bash
node scripts/openapi/tests/test-validate-semver.mjs
node scripts/openapi/tests/test-oasdiff-gate.mjs oasdiff
```

To compare a branch base manually, first materialize the base file with Git, then run:

```bash
oasdiff breaking --fail-on ERR -- /tmp/reference-data.base.yaml 07-api/contracts/openapi/reference-data.yaml
```

The CI workflow is the authoritative PR execution context because it has the real pull-request base SHA and enforces the pinned tool versions.

## Limitations

- The current workspace is a nested snapshot: its local Git metadata belongs to the enclosing workspace, not an independently cloned docs repository. The workflow location is correct when this directory is the root of `design-software-docs`, but a real PR run is still required.
- The required-check branch protection setting is external GitHub configuration and is intentionally not changed by this implementation.
- The gate reports definite breaking changes (`ERR`). Potential warnings remain visible in oasdiff output but are not merge blockers until architecture explicitly adopts a warning-blocking policy.

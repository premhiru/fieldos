# Branch Strategy

| Field        | Value                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| Purpose      | Define the intended GitHub branch model, merge strategy, and commit conventions for FieldOS. |
| Owner        | Engineering                                                                                  |
| Status       | Draft                                                                                        |
| Last Updated | 2026-06-30                                                                                   |

## Table of Contents

- [Branches](#branches)
- [Merge Strategy](#merge-strategy)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Expectations](#pull-request-expectations)
- [Branch Protection](#branch-protection)

## Branches

- `main`: Production-ready source of truth. Every commit must be releasable.
- `develop`: Integration branch for work preparing for the next release.
- `feature/*`: Feature work branches created from `develop`.
- `fix/*`: Defect branches created from `develop` or `main`, depending on urgency.
- `release/*`: Release stabilization branches created from `develop` before merging to `main`.

## Merge Strategy

- Merge feature and fix work into `develop` through pull requests.
- Merge release branches into `main` through pull requests after CI passes and release notes are ready.
- Back-merge `main` into `develop` after every production release.
- Prefer squash merge for feature and fix branches to keep history readable.
- Use merge commits for release branches when preserving release history is useful.

## Commit Message Convention

FieldOS uses Conventional Commits.

```text
<type>(optional-scope): <description>
```

Common types:

- `feat`: Product or platform capability.
- `fix`: Bug fix.
- `docs`: Documentation-only change.
- `chore`: Tooling, maintenance, or repository operation.
- `refactor`: Internal change without user-facing behavior change.
- `test`: Test-only change.
- `ci`: Continuous integration or automation change.

Examples:

```text
feat(dispatch): add job assignment workflow
fix(auth): handle expired session refresh
docs: update architecture overview
chore: initialize FieldOS engineering foundation
```

## Pull Request Expectations

- Pull requests must pass lint, typecheck, tests, and build.
- Pull requests must include a concise summary, testing notes, and linked issue or decision context when available.
- Architecture-impacting work should include an ADR.

## Branch Protection

Intended protection for `main`:

- Require pull request reviews before merging.
- Require status checks for lint, typecheck, tests, and build.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.
- Require conversation resolution before merge.

Intended protection for `develop`:

- Require pull requests.
- Require status checks for lint, typecheck, tests, and build.
- Block force pushes.

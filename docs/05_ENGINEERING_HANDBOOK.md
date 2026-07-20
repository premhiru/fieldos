# Engineering Handbook

| Field        | Value                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Purpose      | Establish engineering practices, quality gates, repository operations, and delivery expectations. |
| Owner        | Engineering                                                                                       |
| Status       | Draft                                                                                             |
| Last Updated | 2026-07-18                                                                                        |

## Table of Contents

- [Engineering Principles](#engineering-principles)
- [Local Development](#local-development)
- [Quality Gates](#quality-gates)
- [Branching](#branching)
- [Pull Requests](#pull-requests)
- [Release Process](#release-process)
- [Security](#security)
- [Operational Readiness](#operational-readiness)
- [AI Decision Rollout](#ai-decision-rollout)
- [Pilot Readiness](#pilot-readiness)

## Engineering Principles

- Keep business logic in the API, worker, or packages; dashboard code should stay presentation-oriented.
- Keep messaging channel-agnostic. Connector-specific state belongs under `packages/integrations`.
- Keep AI classification inside `packages/ai`. Store concise summaries and user-facing reasoning only.
- Prefer explicit, typed service boundaries over broad shared utility abstractions.
- Use `ActionItem` for AI recommendations. Do not reintroduce `SuggestedTask` terminology.

## Local Development

Use pnpm from the repository root.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Quality Gates

Pull requests must pass lint, typecheck, tests, and build before merge.

## Branching

See [Branch Strategy](./08_BRANCH_STRATEGY.md).

## Pull Requests

- Use Conventional Commits.
- Keep pull requests scoped to one behavior or stabilization objective.
- Include schema migrations and documentation updates when data contracts change.
- Include tests for authorization, worker idempotency, and user-visible workflows.

## Release Process

- Merge through pull requests after lint, typecheck, tests, and build pass.
- Tag releases only after migrations and deployment checks are verified.
- Update `PROJECT_STATUS.md` after each completed task or sprint.

## Security

- Never log secrets, QR payloads, JWTs, cookies, provider responses, or raw AI model output.
- Every organization-owned route must authenticate the user and authorize organization membership.
- WhatsApp sessions and local media under `.storage` are development storage only and must move to managed secret/object storage before production scale.
- Project reassignment recommendations must require explicit human approval.
- Never log passwords, session cookies, raw password reset tokens, or password reset URLs.
- Password reset responses must not reveal whether an email address belongs to a user.
- Production password recovery requires `RESEND_API_KEY`, `EMAIL_FROM`, and `WEB_APP_URL`.

## Operational Readiness

- Workers must support graceful shutdown and bounded retry/backoff.
- Ingestion must be idempotent by external message id.
- Structured logs should include organization id, project id, request id, job id, and message id where relevant.
- High-volume list routes should use pagination before large imports.

## AI Decision Rollout

- Keep `AI_DECISION_ENGINE_MODE=legacy` as the immediate rollback path while v2 is under evaluation.
- Deploy v2 code to production in `shadow` first. Shadow decisions and suppressions are persisted, but customer-visible recommendations continue through the legacy path.
- Promote to `v2` only after migration verification, labelled evaluation thresholds, production shadow telemetry review, and explicit approval.
- Every v2 recommendation must pass `RecommendationGate`; coordinators must not write customer-visible recommendations directly.
- Keep contexts bounded and log only identifiers, aggregate metrics, safe reason codes, and concise non-sensitive summaries.
- Treat recommendation precision as the primary pilot metric. Routine progress, silence, broad completion language, and photo-only claims must abstain unless documented policy conditions are met.
- Roll back by changing one Railway variable to `legacy` and redeploying/restarting the worker. The additive v2 tables may remain in place.

## Pilot Readiness

- Keep demo data isolated with `Organization.isDemo`.
- Demo reset must never delete non-demo organizations.
- Pilot-facing errors should be actionable and avoid raw provider or stack details.
- Feedback and product analytics are internal pilot signals, not customer-visible commitments.
- Update `PROJECT_STATUS.md`, `CHANGELOG.md`, and `PRODUCTION_READINESS.md` before marking a pilot-readiness task complete.

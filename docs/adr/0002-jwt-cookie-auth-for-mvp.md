# ADR 0002: JWT Cookie Auth for MVP

| Field        | Value                                               |
| ------------ | --------------------------------------------------- |
| Purpose      | Record the MVP authentication approach for FieldOS. |
| Owner        | Engineering                                         |
| Status       | Accepted                                            |
| Last Updated | 2026-06-30                                          |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Alternatives Considered](#alternatives-considered)
- [Tradeoffs](#tradeoffs)
- [Review Triggers](#review-triggers)

## Context

FieldOS needs a simple self-hostable authentication model for the first usable product slice: users, organizations, memberships, and projects.

## Decision

Use signed JWT session tokens stored in HTTP-only cookies for the MVP.

## Reason

JWT cookies are simple to operate, easy to test locally, self-hostable, and straightforward to replace once the product has clearer identity requirements.

## Alternatives Considered

- Clerk: rejected for now to avoid external identity platform coupling before requirements are mature.
- NextAuth: rejected for now because the current API-first architecture is simpler with Fastify-owned sessions.
- Supabase Auth: rejected for now to keep auth provider choice independent from the database layer.

## Tradeoffs

This approach gives FieldOS fewer third-party dependencies and a direct API-owned auth model. It also means the team owns password security, cookie settings, JWT secret management, session invalidation strategy, and future hardening.

## Review Triggers

Revisit this decision when FieldOS needs SSO, SCIM, MFA, organization-level identity policies, session revocation, or enterprise audit requirements.

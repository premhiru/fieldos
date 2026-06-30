# Database Specification

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Define the data model, ownership boundaries, migration policy, and database standards. |
| Owner        | Engineering                                                                            |
| Status       | Draft                                                                                  |
| Last Updated | 2026-06-30                                                                             |

## Table of Contents

- [Data Principles](#data-principles)
- [Domain Model](#domain-model)
- [Schema Ownership](#schema-ownership)
- [Migration Policy](#migration-policy)
- [Retention and Compliance](#retention-and-compliance)
- [Open Questions](#open-questions)

## Data Principles

Placeholder.

## Domain Model

Current MVP models:

- `User`: Authenticated product user with email, name, password hash, and timestamps.
- `Organization`: Workspace boundary for projects and memberships.
- `Membership`: Join model between users and organizations with a role.
- `Project`: Work container belonging to an organization.

Membership roles:

- `OWNER`: Full organization control for the MVP.
- `ADMIN`: Can create projects.
- `MEMBER`: Can view projects.
- `VIEWER`: Can view projects and cannot create or edit.

Project statuses:

- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `ARCHIVED`

## Schema Ownership

`packages/db/prisma/schema.prisma` is the source of truth for the database schema. Migrations live in `packages/db/prisma/migrations`.

## Migration Policy

Generate the Prisma client before local development:

```bash
pnpm db:generate
```

Apply migrations to PostgreSQL:

```bash
pnpm db:migrate
```

Development migrations should be reviewed before merging and should keep data scope minimal.

## Retention and Compliance

Placeholder.

## Open Questions

- Invite flow and membership management are not implemented yet.
- Session revocation and password reset tables are not implemented yet.

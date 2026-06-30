# Project Status

| Field        | Value                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Track FieldOS milestone progress, task completion, technical debt, architecture decisions, and deployment readiness. |
| Owner        | Founding Engineering                                                                                                 |
| Status       | Active                                                                                                               |
| Last Updated | 2026-06-30                                                                                                           |

## Table of Contents

- [Current Milestone](#current-milestone)
- [Completed Tasks](#completed-tasks)
- [In-Progress Tasks](#in-progress-tasks)
- [Known Technical Debt](#known-technical-debt)
- [Upcoming Milestones](#upcoming-milestones)
- [Architecture Decisions Made](#architecture-decisions-made)
- [Deployment Status](#deployment-status)

## Current Milestone

Authentication, organizations, and projects.

## Completed Tasks

- Task 001: Initialize the FieldOS Repository.
  - Local repository created at `C:/Users/Admin/OneDrive/Documents/Atlas/fieldos`.
  - Git initialized on `main`.
  - Repository structure created.
  - pnpm workspace configured.
  - Turborepo, TypeScript, ESLint, Prettier, Husky, lint-staged, and Changesets configured.
  - GitHub pull request templates, issue templates, CODEOWNERS, and CI workflows created.
  - Documentation skeleton created.
  - Initial commit created: `d18eb96 chore: initialize FieldOS engineering foundation`.
  - Repository pushed to GitHub: `https://github.com/premhiru/fieldos`.

## In-Progress Tasks

- Task 002: Build the Engineering Foundation.
  - Dashboard, API, worker, and shared packages are implemented.
  - Code-level validation passes for format, lint, typecheck, tests, and build.
  - Dashboard startup verified at `http://127.0.0.1:3000`.
  - API startup verified at `http://127.0.0.1:3001`.
  - API endpoints verified:
    - `GET /` returns `{"service":"FieldOS API"}`.
    - `GET /health` returns `{"status":"ok"}`.
  - GitHub Release created: `v0.0.1-foundation`.
  - Docker-dependent verification is blocked because Docker is not installed or not available on PATH in this environment.
- Task 003: Authentication, Organizations, and Projects.
  - JWT cookie auth implemented in the API.
  - Signup, login, logout, and current-user endpoints implemented.
  - Organization creation and membership-scoped organization reads implemented.
  - Project creation, list, and detail reads implemented.
  - Dashboard auth pages, onboarding, project list, and project detail pages implemented.
  - Code-level validation passes for format, lint, typecheck, tests, and build.
  - Prisma migration execution is blocked because PostgreSQL is not available in this environment.

## Known Technical Debt

- CODEOWNERS references `@fieldos/engineering`, which must be replaced or backed by a real GitHub team after the organization is created.
- Git author identity is configured locally as `FieldOS Engineering <engineering@fieldos.local>` and should be replaced with the company identity when available.
- Docker is unavailable in the current environment, so `docker compose up`, Prisma migration execution, and worker Redis startup could not be completed locally.
- Vitest is configured with `--passWithNoTests`; real tests should be added with the first product and infrastructure behavior.
- Auth sessions do not yet support server-side revocation.
- Invite, membership administration, password reset, and email verification flows are not implemented yet.

## Upcoming Milestones

- Configure branch protection for `main` and `develop`.
- Create `develop` branch after remote setup.
- Verify Docker Compose, Prisma migration, and worker Redis startup on a machine with Docker available.
- Define product requirements and initial domain boundaries.
- Add invite and membership management after the basic auth/org/project slice is verified.

## Architecture Decisions Made

- ADR 0001: Build FieldOS as a modular monolith first, with clear package boundaries that can later evolve into services.
- Prisma 7 is configured with the PostgreSQL driver adapter via `@prisma/adapter-pg`.
- The API exposes health endpoints without eagerly opening a database connection, so health checks remain available during dependency outages.
- ADR 0002: Use JWT session tokens in HTTP-only cookies for MVP authentication.

## Deployment Status

- Not deployed.
- No application code exists yet.
- Dashboard, API, and worker application scaffolds exist.
- Local code validation passed for format, lint, typecheck, tests, and build.
- GitHub Release `v0.0.1-foundation` exists.
- Docker runtime validation is blocked until Docker is installed or available on PATH.
- Task 003 is not deployed.
- Task 003 is not complete until the Prisma migration is run successfully against PostgreSQL.

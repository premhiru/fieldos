# ADR 0001: Build FieldOS as a Modular Monolith First

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Purpose      | Record the initial architecture decision for FieldOS service boundaries. |
| Owner        | Engineering                                                              |
| Status       | Accepted                                                                 |
| Last Updated | 2026-06-30                                                               |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)
- [Review Triggers](#review-triggers)

## Context

FieldOS needs to move quickly from product discovery into reliable field operations workflows. The product will likely include multiple domains, including jobs, scheduling, dispatch, assets, customer communication, documents, reporting, and AI assistance.

Starting with distributed services would add operational overhead before the domain model and scaling constraints are proven.

## Decision

FieldOS will begin as a modular monolith.

The codebase will use clear package and module boundaries so each domain has explicit ownership, public interfaces, tests, and dependency rules. These boundaries should make later service extraction possible when there is evidence that a domain needs independent deployment, scaling, compliance isolation, or ownership.

## Consequences

Positive outcomes:

- Faster early product iteration.
- Simpler local development and CI.
- Lower operational complexity.
- Easier cross-domain refactoring while the model is still forming.
- Clear migration path to services when justified.

Tradeoffs:

- Requires discipline to avoid leaking domain internals.
- Shared deployment can increase blast radius if boundaries are weak.
- Future extraction requires intentional interface design from the start.

## Alternatives Considered

- Microservices from day one: rejected because the team does not yet have enough product or domain evidence to justify the operational cost.
- Single unstructured application: rejected because FieldOS needs domain clarity and future extraction paths.

## Review Triggers

Revisit this decision when:

- A module requires independent scaling or deployment.
- A domain has separate compliance or data residency requirements.
- Team ownership becomes clearly split by domain.
- The modular monolith creates measurable delivery or reliability constraints.

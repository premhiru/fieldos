# ADR 0015: Team Invitations and Project Access

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Purpose      | Define secure team onboarding, organization roles, and project access. |
| Owner        | Engineering                                                            |
| Status       | Accepted                                                               |
| Last Updated | 2026-07-13                                                             |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)

## Context

Organization membership previously granted access to every project. FieldOS needs owner-managed invitations, clear roles, and selected-project access without breaking existing pilot accounts.

## Decision

FieldOS uses expiring, single-use `TeamInvitation` records. Raw invitation tokens are delivered to users but only SHA-256 hashes are stored. Invitations require an exact email match during authenticated acceptance.

`Membership` remains the organization role boundary. `OWNER` and `ADMIN` memberships have access to all projects. `MEMBER` and `VIEWER` memberships may be restricted through explicit `ProjectAccess` records. Existing memberships default to all-project access for backwards compatibility.

Owners can manage administrators. Owners and administrators can invite members or viewers, update their project access, resend or revoke invitations, and remove members. The organization owner cannot be demoted or removed through team-management APIs.

Invitation emails use Resend. The API also returns the invitation link to the authorized inviter so pilot onboarding remains possible when email delivery is unavailable or the sending domain is not verified.

## Consequences

Positive:

- Team onboarding is self-service and auditable.
- Selected-project access is enforced in project, dashboard, search, and messaging paths.
- Invitation links can be shared manually during pilot operation.
- Existing users retain their current access after migration.

Tradeoffs:

- Administrators are organization-wide and cannot be restricted to selected projects.
- Email delivery to arbitrary recipients still requires a verified Resend sending domain.
- Custom project-specific roles are intentionally deferred.

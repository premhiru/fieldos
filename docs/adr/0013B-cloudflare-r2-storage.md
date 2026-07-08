# ADR 0013B: Cloudflare R2 Durable Storage

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Purpose      | Document the decision to use Cloudflare R2 for production object storage. |
| Owner        | Platform Engineering                                                      |
| Status       | Accepted                                                                  |
| Last Updated | 2026-07-08                                                                |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)

## Context

Task 013 introduced evidence previews and worker-generated PDF reports. Local filesystem storage is acceptable for development, but Railway API and worker services run as separate deployments and should not be assumed to share local files. Local files can also disappear across redeploys.

FieldOS needs durable production storage for WhatsApp evidence files, photo previews, voice notes, PDFs, and generated report PDFs.

## Decision

FieldOS will use Cloudflare R2 as the production implementation of `StorageProvider`.

`R2StorageProvider` uses the S3-compatible API for upload, download, signed URL generation, deletion, and existence checks. API and worker select the provider through `STORAGE_PROVIDER`. Local development keeps `STORAGE_PROVIDER=local`; production should use `STORAGE_PROVIDER=r2`.

R2 credentials and bucket configuration are read only from environment variables:

- `R2_ACCOUNT_ID`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_REGION`
- `R2_FORCE_PATH_STYLE`
- `SIGNED_URL_TTL_SECONDS`

The endpoint is read directly from `R2_ENDPOINT`, using the Cloudflare format `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Object keys are namespaced by organization and project:

- `organizations/{organizationId}/projects/{projectId}/evidence/{evidenceId}/{filename}`
- `organizations/{organizationId}/projects/{projectId}/reports/{reportId}.pdf`

The dashboard never receives raw storage keys. Authenticated API routes perform membership authorization first, then return expiring signed URLs.

## Consequences

- API and worker can share media and report files reliably in production.
- Railway redeploys no longer risk losing production evidence objects.
- Frontend media access remains short-lived and authorization-gated by the API.
- Local development remains simple and filesystem-backed.
- Production startup fails fast if `STORAGE_PROVIDER=r2` is selected without complete R2 configuration.

## Alternatives Considered

Using Railway local volumes for media was rejected because API and worker services should not depend on shared local filesystem behavior.

Using public R2 objects was rejected because evidence files, voice notes, and reports are organization-scoped operational records.

Hardcoding credentials or deriving endpoint values in code was rejected because storage credentials must remain environment-managed deployment secrets.

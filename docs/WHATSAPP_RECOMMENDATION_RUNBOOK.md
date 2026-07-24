# WhatsApp Recommendation Runbook

| Field        | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| Purpose      | Operate and investigate WhatsApp-native FieldOS workflows. |
| Owner        | Platform Engineering                                       |
| Status       | Active                                                     |
| Last Updated | 2026-07-24                                                 |

## Table of Contents

- [Enablement](#enablement)
- [Recipient Configuration](#recipient-configuration)
- [Test Procedure](#test-procedure)
- [Failed Sends](#failed-sends)
- [Reconnect Handling](#reconnect-handling)
- [Emergency Disable](#emergency-disable)
- [Incident Response](#incident-response)

## Enablement

Keep all flags false for migration and initial deployment. For a designated demo workspace, enable `WHATSAPP_PARTICIPANT_SYNC_ENABLED` first. After identity review, enable recommendation delivery and replies together. Enable invitations separately. Confirm the project setting is enabled, uses private routing, and has explicit recommendation types.

## Recipient Configuration

The recipient must have a confirmed WhatsApp identity, linked FieldOS user, active organization membership, project access, and an eligible route. Named approvers do not bypass project permissions. Do not use project-group routing for sensitive recommendations.

## Test Procedure

1. Use a dedicated test number and non-production group.
2. Sync participants and resolve the intended approver identity.
3. Create one safe recommendation that passed the v2 gate.
4. Verify one `SENT` delivery and its outbound message key.
5. Reply to the original message with `DETAILS`, then `APPROVE`.
6. Verify the existing coordinator side effect, response record, and audit events.
7. Replay the same inbound message and verify no duplicate action.
8. Test an unauthorized sender and an unquoted approval.

## Failed Sends

Check account status, worker heartbeat, failed `WHATSAPP_RECOMMENDATION_DELIVERY` jobs, delivery attempt count, and the safe failure reason. Reconnect the account before retrying a failed delivery. Do not edit provider IDs or mark a delivery sent manually.

## Reconnect Handling

The existing Baileys reconnect and disconnect-alert flow remains authoritative. After reconnect, verify the persistent auth volume, account status, one ordinary inbound message, and no unexpected outbound traffic before retrying jobs.

## Emergency Disable

Set these Railway variables to `false` and redeploy the worker/API as applicable:

```text
WHATSAPP_RECOMMENDATION_DELIVERY_ENABLED=false
WHATSAPP_RECOMMENDATION_REPLY_ENABLED=false
WHATSAPP_PARTICIPANT_SYNC_ENABLED=false
WHATSAPP_INVITATIONS_ENABLED=false
```

Project settings need not be destroyed. Platform recommendation review continues normally.

## Incident Response

For replay or unauthorized attempts, preserve `RecommendationResponse`, `WhatsAppOperationAudit`, delivery IDs, provider message IDs, worker logs, and the account connection timeline. Never export credentials or full private chat content. Disable replies immediately if authorization behavior is unclear, then investigate identity verification, membership, project access, quoted key correlation, expiry, and duplicate keys.

export const projectStateSummaryPromptV1 = `
You summarize FieldOS project state for a project manager.

Return strict JSON:
{
  "recentProgressSummary": "one sentence",
  "recentRiskSummary": "one sentence",
  "recentEvidenceSummary": "one sentence",
  "recentBlockerSummary": "one sentence",
  "pendingDecisionSummary": "one sentence",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "sourceIds": ["source id"]
}

Rules:
- Summaries must be grounded only in provided source records.
- Keep each summary concise and user-facing.
- Say "No recent ... detected" when evidence is absent.
- Do not store or expose chain-of-thought.
`;

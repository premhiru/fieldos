# AI Evaluation Report

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Purpose      | Record reproducible AI Decision Layer v2 acceptance results. |
| Owner        | Principal AI Engineering                                     |
| Status       | Complete for shadow review                                   |
| Last Updated | 2026-07-21                                                   |

## Table of Contents

- [Method](#method)
- [Coverage](#coverage)
- [Results](#results)
- [Interpretation](#interpretation)
- [Limitations](#limitations)

## Method

`packages/ai/src/evaluation-cases.ts` defines 86 labelled messages. `pnpm ai:evaluate` sends each case through the production classification provider chain and the same deterministic recommendation policy used by the worker. The captured result is stored in `packages/ai/src/evaluation-results.v2.json` and enforced by the AI test suite.

Each case records relevance, primary category, secondary signals, operational impact, response expectation, recommendation eligibility/type, abstention, and prohibited outcomes.

The accepted run completed at `2026-07-21T03:16:03.214Z` using `kimi-k2.6`, prompt `message-classification.v2.4`, policy `recommendation-policy.v2.1`, and schema `2.2`. Kimi handled every case; the OpenRouter fallback count and provider failure count were both zero.

## Coverage

The set covers routine and meaningful progress, full and partial completion, deliveries and damaged deliveries, delays, safety, defects, inspections and prerequisites, RFIs, questions, approvals, acknowledgements, commitments, overdue and resolved requests, ambiguous replies, voice transcripts, photo captions, irrelevant messages, repeated patterns, construction, M&E, facilities, infrastructure, aviation, and airfield lighting.

## Results

| Metric                             | Result  |
| ---------------------------------- | ------- |
| Cases                              | 86      |
| Evaluation/provider failure rate   | 0.00%   |
| Recommendation precision           | 100.00% |
| Recommendation recall              | 100.00% |
| Primary-category accuracy          | 88.37%  |
| Multi-signal precision             | 53.57%  |
| Multi-signal recall                | 46.88%  |
| Abstention accuracy                | 100.00% |
| Recommendation false-positive rate | 0.00%   |
| Inspection false-positive rate     | 0.00%   |
| Follow-up false-positive rate      | 0.00%   |
| Duplicate recommendation rate      | 0.00%   |

Command used:

```bash
railway run --service fieldos-worker --environment production --no-local pnpm ai:evaluate
pnpm --filter @fieldos/ai test
```

## Interpretation

The provider-backed run meets the shadow-entry targets for recommendation precision and recall, abstention, inspection safety, follow-up safety, duplicate prevention, and provider reliability. The set contains genuine positive recommendations, so these results do not come from disabling coordinator output.

Primary-category accuracy and multi-signal extraction remain materially weaker. The pilot policy intentionally favors accurate customer-visible recommendations over exhaustive signal extraction. Shadow review should measure missed secondary signals and category disagreements before enabling v2 recommendations.

## Limitations

These are actual provider-backed results on synthetic labelled field messages, not a claim of equivalent accuracy on customer traffic. No customer message content is stored in the fixture. Model output is non-deterministic, so the captured result is a release gate rather than a permanent quality guarantee. The set evaluates voice transcripts and photo captions, not audio decoding or raw image pixels; vision has separate contract and policy tests.

During label review, technically meaningful RFIs and material defect/delivery cases were corrected to match the documented business policy. Captured model predictions were not changed when metrics were recomputed.

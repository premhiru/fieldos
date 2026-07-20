# AI Evaluation Report

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Purpose      | Record reproducible AI Decision Layer v2 acceptance results. |
| Owner        | Principal AI Engineering                                     |
| Status       | Complete for shadow entry                                    |
| Last Updated | 2026-07-18                                                   |

## Table of Contents

- [Method](#method)
- [Coverage](#coverage)
- [Results](#results)
- [Interpretation](#interpretation)
- [Limitations](#limitations)

## Method

`packages/ai/src/evaluation-cases.ts` defines 81 labelled messages. `evaluateDecisionLayer()` runs the same cautious deterministic acceptance policy used to regression-test recommendation eligibility. The suite is local, reproducible, provider-independent, and includes genuine positive recommendations.

Each case records relevance, primary category, secondary signals, operational impact, response expectation, recommendation eligibility/type, abstention, and prohibited outcomes.

## Coverage

The set covers routine and meaningful progress, full and partial completion, deliveries and damaged deliveries, delays, safety, defects, inspections and prerequisites, RFIs, questions, approvals, acknowledgements, commitments, overdue and resolved requests, ambiguous replies, voice transcripts, photo captions, irrelevant messages, repeated patterns, construction, M&E, facilities, infrastructure, aviation, and airfield lighting.

## Results

| Metric                         | Result |
| ------------------------------ | ------ |
| Cases                          | 81     |
| Recommendation precision       | 94.29% |
| Primary-category accuracy      | 90.12% |
| Multi-signal precision         | 75.00% |
| Multi-signal recall            | 60.00% |
| Abstention accuracy            | 95.06% |
| Inspection false-positive rate | 0.00%  |
| Follow-up false-positive rate  | 1.30%  |
| Duplicate recommendation rate  | 0.00%  |

Command used:

```bash
pnpm --filter @fieldos/ai test
pnpm exec tsx -e "import { aiEvaluationCases } from './packages/ai/src/evaluation-cases.ts'; import { evaluateDecisionLayer } from './packages/ai/src/evaluation.ts'; console.log(evaluateDecisionLayer(aiEvaluationCases));"
```

## Interpretation

The acceptance policy meets the pilot targets for recommendation precision, inspection false positives, follow-up false positives, and duplicate recommendations. Multi-signal recall is intentionally lower because the pilot favors abstention and precision. Shadow review should focus on whether live extraction omits useful secondary signals without increasing customer-visible false positives.

## Limitations

These are actual offline acceptance results, not a claim of 94.29% accuracy on live customer traffic or a live-provider benchmark. Kimi/OpenRouter outputs are non-deterministic and must be measured through shadow telemetry. The set does not include audio decoding or image pixels; it evaluates transcripts, captions, structured photo conclusions, and downstream decision rules.

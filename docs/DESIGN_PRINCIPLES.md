# Caladrona Design Principles

| Field        | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Purpose      | Define the product experience principles for Caladrona. |
| Owner        | Product Design and Engineering                          |
| Status       | Active                                                  |
| Last Updated | 2026-07-27                                              |

## Table of Contents

- [Product Character](#product-character)
- [Principles](#principles)
- [Decision Test](#decision-test)

## Product Character

Caladrona supports people responsible for live field operations. The interface should feel calm under pressure, precise without becoming sterile, and capable without advertising its complexity. Trust comes from clear states, predictable behavior, and evidence that can be inspected.

## Principles

1. **Attention before information.** Lead with decisions, exceptions, and changed conditions. Supporting detail remains close at hand.
2. **Operational clarity.** Use plain domain language. Avoid implementation terms, internal service names, and speculative AI language.
3. **Human authority.** Recommendations explain their evidence and effect. Material changes require explicit approval.
4. **Quiet confidence.** Warm neutral surfaces carry the product. Amber and teal communicate attention and health rather than becoming decoration.
5. **Progressive disclosure.** Optimize the first view for scanning, then reveal detail without moving the user into a different mental model.
6. **Consistency earns speed.** Repeated controls, statuses, tables, and panels should look and behave the same everywhere.
7. **Accessible by default.** Keyboard use, visible focus, semantic structure, adequate contrast, reduced motion, and responsive layouts are release requirements.
8. **Motion confirms, never distracts.** Movement is brief, purposeful, and optional under reduced-motion preferences.

## Decision Test

Before shipping a visual change, ask:

- Does it make the next operational decision easier to find?
- Does the user understand the state without relying on color alone?
- Is the language appropriate for an operations lead rather than an engineer?
- Does it reuse the established token and component system?
- Does it remain clear on a narrow mobile viewport and in dark mode?

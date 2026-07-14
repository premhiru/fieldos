# FieldOS Visual Design System

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Purpose      | Document reusable visual tokens, components, and QA expectations. |
| Owner        | Product Design and Frontend Engineering                           |
| Status       | Version 1.0                                                       |
| Last Updated | 2026-07-14                                                        |

## Table of Contents

- [System Overview](#system-overview)
- [Tokens](#tokens)
- [Components](#components)
- [Interaction and Motion](#interaction-and-motion)
- [Dark Mode](#dark-mode)
- [Accessibility](#accessibility)
- [Screen Refinements](#screen-refinements)
- [Visual QA](#visual-qa)

## System Overview

The implementation lives in `apps/dashboard/app/globals.css` and `packages/ui/src`. CSS custom properties carry semantic meaning across light and dark appearances. Shared UI components consume tokens directly; a documented compatibility bridge keeps existing page-level utilities on the same palette while incremental migrations continue.

## Tokens

- **Type:** 14 px operational body, 12 px metadata, 16-18 px section titles, 24 px page titles, and 36-48 px only for authentication first impressions.
- **Spacing:** 4 px base rhythm, with primary component gaps at 8, 12, 16, 24, and 32 px.
- **Radius:** 6 px controls and 8 px panels. Pills are reserved for compact status indicators.
- **Borders:** subtle, default, and strong neutral roles.
- **Elevation:** a one-pixel panel shadow and one raised overlay shadow. Page sections remain unframed.
- **Motion:** 120 ms direct feedback and 180 ms standard transitions using an ease-out curve.
- **Color:** canvas, surface, text, border, action, and semantic operational status roles.

## Components

- **BrandMark and BrandLockup:** canonical product identity at shell, auth, loading, favicon, and installed-app surfaces.
- **Button:** 40 px standard target with primary, secondary, ghost, and danger hierarchy; keyboard focus and pressed feedback are built in.
- **Card:** 8 px radius, one neutral border, and minimal elevation. Cards are for discrete records or framed tools, not whole-page decoration.
- **Badge:** compact state metadata with text labels. Semantic variants use soft fills and restrained borders.
- **PageHeader:** consistent page title, context, and action alignment.
- **EmptyState:** an operational frame, familiar icon, reason for the empty result, and an action where one is available.
- **Skeleton:** structure-preserving loading feedback with a reduced-motion-safe opacity pulse.
- **Forms:** shared surface, border, focus ring, placeholder, and dark-mode behavior for native inputs, selects, and textareas.
- **Tables and lists:** low-contrast row dividers, stable row heights, compact metadata, and full-row hover cues.
- **Icons:** Lucide only, normally 16 px at 2 px stroke. Icons support commands and states; they do not decorate headings.

## Interaction and Motion

Hover changes surface or border by one visual step. Pressed buttons move by one pixel. Panels do not scale, bounce, or animate into view. Skeletons use opacity rather than a gradient shimmer. All motion is effectively removed when `prefers-reduced-motion` is enabled.

## Dark Mode

Dark mode follows the operating-system preference. It uses graphite surfaces with lifted borders and intentionally softened semantic colors. It is not a color inversion: hierarchy, contrast, and status meaning are preserved. A manual appearance preference is deferred until user settings require one.

## Accessibility

- Semantic page, navigation, heading, form, and table structures are retained.
- All interactive controls expose visible keyboard focus.
- Touch targets are at least 40 px for primary controls and 56 px in mobile navigation.
- Statuses use words and icons in addition to color.
- Text and controls are designed to meet WCAG AA contrast in both appearances.
- Narrow layouts wrap actions and preserve readable content without horizontal page scrolling.

## Screen Refinements

| Surface                | Before                                      | Version 1.0                                                        |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Login                  | Generic centered authentication card        | Branded first impression with a restrained operational proposition |
| Dashboard              | Mixed hardcoded neutral and status colors   | Tokenized attention hierarchy and consistent metrics               |
| Projects               | Text loading and sparse empty list          | Structural skeleton, shared header, explanatory empty state        |
| Project Command Center | Locally styled sections                     | Unified surfaces, borders, statuses, and typography                |
| Inbox                  | Functional but visually isolated list panes | Consistent controls, selected states, empty frames, and dark mode  |
| Timeline               | Dense event list                            | Shared neutral hierarchy and semantic event status                 |
| Recommendations        | Multiple local card treatments              | Consistent card, badge, control, and confidence hierarchy          |
| Action Items           | Locally styled priorities and rows          | Semantic status colors with stable list rhythm                     |
| Search                 | Mixed input and result treatments           | System form focus and restrained evidence hierarchy                |
| Reports                | Basic empty and report cards                | Shared empty-state language and panel styling                      |
| Settings               | Developer-facing connection terminology     | User-facing integration language and structured loading            |

## Visual QA

Reference captures live under `docs/screenshots/design-system/before` and `docs/screenshots/design-system/after`. The comparison validates desktop and mobile hierarchy, shell stability, login branding, content fit, dark-mode tokens, empty states, and loading structures. Screens are captured from seeded local data; no production customer data is used.

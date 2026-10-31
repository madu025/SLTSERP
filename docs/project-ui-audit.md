# Project UI navigation audit - 2026-10-30

## Scope and findings

- New workflow names (Requirements Evaluation, Design Plan, Design Review & Approval) had no stage mapping; users saw only fallback modules. Added explicit aliases.
- Stage-only navigation hid BOQ, Finance and other existing functions outside their selected stages. Added an explicit all-project-modules discovery toggle while keeping current-stage modules as the default. Backend permissions and workflow gates remain authoritative.
- CAD/manual planning incorrectly hid Survey along with GIS-only tools. Retained survey; GIS route/approval/audit remain source-dependent and OTDR remains fiber-specific.
- No prominent next action or full lifecycle context. Added current-step guidance, an ordered stage/status strip, and a functional Open current step action pointing to the existing workflow tracker (not a stage bypass).
- Header Export had no handler. Implemented a bounded JSON project-summary download; it is not advertised as a full document/financial export.
- Header Sync QField had no handler and appeared on CAD projects. Replaced with QField Setup navigation only on GIS projects. No sync claim is made.
- Project fetch failures could appear as Project not found. Added explicit error/retry states, including a failed-refresh warning while retaining already loaded data.

## Verification

- Navigation unit tests cover stage aliases, CAD survey availability, module discoverability/deduplication, and non-fiber OTDR exclusion.
- TypeScript passed for this change.
- Browser verification pending: browser access host unavailable and no authenticated project window available during this audit.

This is a navigation-shell audit, not certification that every underlying module
has passed a complete live workflow. Role-by-role, mobile rendering, exports, and
end-to-end approval/payment browser verification still need a signed-in browser.

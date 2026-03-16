---
title: alphaTab NaN render debug handoff
date: 2026-03-16
tags:
    - alphatab
    - debugging
    - handoff
    - obsidian-plugin
    - render-recovery
status: in-progress
branch: review/0.5.3
code_commit: 7172e3e
---

# alphaTab NaN render debug handoff

> [!abstract]
> This note is the full engineering handoff for the `review/0.5.3` alphaTab initial-render corruption investigation.
>
> Current state:
>
> - the player-side code fix set has been committed and pushed as `7172e3e fix(player): add alphaTab safe-mode render recovery`
> - the previously blocking SVG `translate(NaN ...)` / `MNaN...` corruption has **not** been proven gone yet in runtime after the new fallback patch
> - the next runtime verification should focus on whether the automatic safe-mode rebuild triggers and recovers the view cleanly

## Goal

This debugging round had three goals:

1. keep `review/0.5.3` passing the local quality gates and reviewbot-parity checks
2. identify why alphaTab rendered badly aligned or severely corrupted notation on initial load in Obsidian
3. move from speculative fixes to a runtime recovery path that can survive alphaTab worker-side corruption in Obsidian/Electron

## Final outcome of this round

> [!success]
> We reached a much sharper diagnosis than before:
>
> - the bug is **not** explained by stale persisted config
> - it is **not** explained by fonts simply not being loaded
> - it is **not** explained by container width/height being zero or unstable
> - it is **not** explained solely by our own `scoreLoaded` mutations
> - the strongest current root cause is **alphaTab worker-generated SVG corruption**, which arrives through worker render results and is injected into the DOM even when `renderFinished` reports valid `totalWidth` and `totalHeight`

The code now includes an **automatic safe-mode fallback**:

- detect `NaN` in rendered SVG output after `renderFinished`
- rebuild first with `useWorkers: false`
- if still broken, rebuild again with `engine: 'html5'`, `useWorkers: false`
- disable `enableLazyLoading` whenever fallback mode is active

## Important commits

### Already pushed

- `7ea8dc7` — `chore(lint): add reviewbot-parity lint gate`
- `00176e7` — `fix(player): remove deprecated staveProfile usage and clear blocker lint`
- `9ad8a77` — `chore(lint): migrate to eslint v9 flat config`
- `43d4b26` — `fix(player): stabilize initial tablature layout before first render`
- `7172e3e` — `fix(player): add alphaTab safe-mode render recovery`

### Current documentation state

- this handoff note is intended to be committed **after** the pushed code fix, but not pushed yet

## Verification status

### Quality gates that passed during this round

The current pushed code passed all of these locally:

- `npm run lint`
- `npm run build`
- `npm run lint:reviewbot`
- `npm run format:check`
- `lsp_diagnostics` on modified files with no errors

### Runtime state

The crucial missing piece is still **live Obsidian verification** of commit `7172e3e`.

The user reran an earlier patch and the bug still reproduced. After that evidence, the code was changed again to add the safe-mode fallback. That fallback now needs real runtime confirmation.

## Debugging timeline

## Phase 1 — reviewbot and lint parity cleanup

We first cleaned up reviewbot blockers and made the local lint flow stricter so reviewbot and local checks matched better.

Main work completed here:

- reviewbot-parity lint config
- ESLint v9 flat config migration
- deprecated `staveProfile` usage cleanup
- stricter handling of type/lint blockers that were green locally but red in reviewbot

This phase succeeded and was verified.

## Phase 2 — first hypothesis: initial layout instability

The first user-visible symptom was that the score looked badly shifted or misaligned when first initialized.

Initial hypothesis:

- Obsidian layout was not stable yet when alphaTab did its first render
- fonts or container dimensions might still be settling

Changes made in this phase:

- delayed controller init until stable layout in `TablatureView`
- added font readiness waiting in `ReactView`
- added stable-frame waiting and follow-up render logic in `PlayerController`
- added stronger CSS font rules for `.at` and `.at-surface-svg .at`

Result:

- this improved the instrumentation
- it did **not** eliminate the NaN render corruption

## Phase 3 — config sanitation and stale-state hypothesis

Next hypothesis:

- persisted global/workspace config might be rehydrating bad numeric values or invalid display settings
- `barsPerRow`, transposition values, or other numeric settings might poison alphaTab at runtime

Changes made in this phase:

- stronger config normalization in `src/player/store/globalConfigStore.ts`
- storage migration fixes in `src/player/store/middleware/storageAdapter.ts`
- safer number/range handling in `src/player/components/SettingsPanel.tsx`
- workspace track config sanitation in `src/player/store/workspaceConfigStore.ts`
- live TrackItem sanitation for volume / transpose inputs

Key evidence from runtime logs:

- `global-config not found`
- `workspace-session-config not found`
- `No saved track configs to restore`

Conclusion:

- persisted config pollution was **not** the primary explanation for the clean repro the user captured

## Phase 4 — staff/profile mutation hypothesis

Next hypothesis:

- our own `scoreLoaded` mutations were damaging alphaTab’s internal render model
- automatic staff/profile rewrites might be pushing alphaTab into an invalid render state

We focused on these old behaviors:

- `applyDefaultStaffDisplay(score)`
- `applyConfiguredStaveProfile(score)`

Changes made:

- removed the automatic guitar track tab-only mutation path from startup
- stopped auto-applying configured stave profile during `scoreLoaded`
- restored default `staveProfile` behavior
- created `scoreSafety.ts` to disable unsafe numbered notation and keep at least one staff visible

Result:

- this was still a useful cleanup
- but the user’s latest logs showed `disabledUnsafeNumberedNotation: false` and the corruption still happened
- therefore the remaining bug survives even when our own numbered-notation and startup staff mutations are not the active trigger

## Phase 5 — decisive runtime evidence: worker render-result corruption

This was the turning point.

The user supplied logs showing all of the following together:

- `Bravura font ready for alphaTab`
- valid stable container and viewport rects
- `renderFinished { totalWidth: 773, totalHeight: 532, ... }`
- repeated SVG DOM errors afterward:
    - `translate(NaN ...)`
    - `MNaN...`
    - corruption continuing after the stabilized follow-up render

This combination matters because it rules out several earlier explanations.

### What the logs proved

1. alphaTab is reaching `renderFinished` with non-zero size
2. container dimensions are stable enough for normal layout
3. the broken data arrives **after** render completion and during render-result update
4. corruption is happening specifically around worker result handling and DOM injection

## Source-level findings

We inspected local alphaTab source in `node_modules/@coderline/alphatab/dist/alphaTab.js`.

Relevant paths:

- `_handleWorkerMessage(e)`
- `_updateRenderResult(result)`
- `BrowserUiFacade.beginUpdateRenderResults(renderResult)`

The critical behavior:

- worker messages deliver `renderResult.renderResult`
- alphaTab browser UI code injects that string directly into the placeholder via `innerHTML`

In other words, once the worker returns a corrupted SVG string, the DOM layer will happily insert it.

That matches the user’s console evidence exactly.

## External research summary

We ran multiple parallel codebase and librarian searches, including direct comparison with `~/Workspace/Tabst.app`.

### Most useful internal comparison

See also: [[alphatab-lifecycle-comparison-report]]

The Tabst.app comparison highlighted protections we were missing:

- numbered notation guard
- stronger lifecycle/rebuild thinking
- safer staff option handling
- more defensive alphaTab integration assumptions

### Most useful external alphaTab findings

Research pointed to several relevant alphaTab issues and behaviors:

- official docs: `useWorkers: false` is the supported way to force synchronous UI-side rendering
- alphaTab/Electron/Obsidian contexts have known worker/environment edge cases
- SVG lazy-loading has had race issues
- SVG text measurement remains a known fragile area in alphaTab

The most actionable documented fallback pattern was:

- disable workers first
- if needed, switch away from the SVG/worker path entirely

## Final solution implemented in code

## 1. Keep the defensive fixes that were still worthwhile

These are still valuable even though they were not the full root cause:

- sanitize global and workspace config values
- sanitize volume and transposition inputs before hitting alphaTab APIs
- disable numbered notation in player and print UI paths
- ensure a staff never ends up with all display modes off
- stop automatic startup profile/staff rewrites that mutate score state unnecessarily

## 2. Add automatic render-integrity detection

In `src/player/PlayerController.ts` the controller now:

- schedules a render-integrity check after every `renderFinished`
- inspects the rendered SVG surface markup using `outerHTML`
- looks for `/nan/i`

We originally checked `innerHTML`, but Oracle pointed out that would miss `NaN` if it appeared on the SVG surface element itself. This was fixed before wrapping up the round.

## 3. Add safe-mode fallback escalation

If invalid render output is detected, the controller now escalates like this:

1. **normal mode**
    - configured engine (currently usually `svg`)
    - configured worker setting (currently usually `useWorkers: true`)
2. **no-workers mode**
    - same engine
    - force `useWorkers: false`
3. **html5 safe mode**
    - force `engine: 'html5'`
    - force `useWorkers: false`

Whenever fallback mode is active:

- `enableLazyLoading` is forced off

This aligns with the strongest external guidance we found for Obsidian/Electron-style alphaTab corruption.

## 4. Keep loading and render stabilization from hanging forever

The controller also now includes:

- a stable render timeout fallback
- stronger handling for `renderFinished` with invalid measurements
- guarded follow-up re-render when transposition settings are restored during load

## Key files changed in the final pushed patch

### Core controller

- `src/player/PlayerController.ts`

Main responsibilities added/changed here:

- safe-mode render fallback state
- invalid SVG detection
- `useWorkers: false` rebuild fallback
- `html5` rebuild fallback
- lazy-loading disabled in fallback mode
- stable render timeout and integrity checks
- safer score-load restoration path

### New utility

- `src/player/utils/scoreSafety.ts`

Responsibilities:

- disable unsafe numbered notation across score structures
- ensure at least one visible staff mode remains true
- sanitize track config values before using them

### UI and state hardening

- `src/player/components/TrackItem.tsx`
- `src/player/components/StaffItem.tsx`
- `src/player/components/PrintTracksPanel.ts`
- `src/player/components/SettingsPanel.tsx`
- `src/player/store/globalConfigStore.ts`
- `src/player/store/workspaceConfigStore.ts`
- `src/player/store/middleware/storageAdapter.ts`
- `src/player/types/global-config-schema.ts`

### Font/style support

- `src/player/ReactView.ts`
- `src/styles/new-react-player/tablature-view.css`
- generated `styles.css`

## What still needs live validation

> [!warning]
> The main remaining unknown is not code quality. It is runtime behavior inside real Obsidian after commit `7172e3e`.

The next validation pass should answer these questions:

1. does the first render still produce broken SVG in worker mode?
2. if yes, does the controller automatically rebuild into no-workers mode?
3. if no-workers still fails, does it rebuild again into HTML5 safe mode?
4. after fallback, does the view stabilize without endless `NaN` spam?
5. is the rendered score visually correct enough for user workflows?

## What to look for in the next console capture

If the bug reproduces again, the next log should be checked for these signals:

### Good signs

- a warning or debug message indicating fallback mode triggered
- `AlphaTab settings configured` showing:
    - `useWorkers: false`, or later
    - `engine: 'html5'`
- disappearance or sharp reduction of repeated `translate(NaN ...)` and `MNaN...` errors

### Bad signs

- repeated NaN spam with **no** fallback trigger logged
- repeated fallback loops without recovery
- failure in HTML5 safe mode too

## If the bug still reproduces after this patch

If runtime verification shows the new fallback still does not recover the view, the next step should be more targeted and narrower than the earlier broad exploration.

### Highest-value next moves

1. capture the exact fallback logs and confirm which mode is active when corruption remains
2. if corruption survives `useWorkers: false`, focus on engine-specific SVG output rather than worker transport
3. if corruption survives even `html5`, revisit environment-level alphaTab initialization assumptions in Obsidian/Electron
4. consider explicit alphaTab environment emulation if Electron globals are still confusing alphaTab platform detection
5. consider temporarily preferring safe mode by default in Obsidian if runtime evidence shows worker SVG is consistently unstable there

## Known trade-offs in the current solution

- fallback mode currently **sticks for the rest of the session** once triggered
- this is intentional for safety and simplicity during recovery
- numbered notation is temporarily disabled across player/print paths to avoid known alphaTab failure classes

These are acceptable trade-offs for now because correctness and recoverability were more urgent than preserving every display mode.

## Recommended next-session starting point

> [!tip]
> Start by testing commit `7172e3e` in Obsidian and capture only the delta around the fallback path.

Suggested checklist:

- reload plugin
- open the same score that previously produced NaN SVG
- watch for `AlphaTab settings configured` and fallback mode values
- record whether the first broken render gets replaced by a recovered render
- if still broken, capture the first fallback transition and the mode after rebuild

## Hand-off summary for next agent

### What is settled

- quality gates are green locally
- config/input/staff-safety cleanup is in place
- startup score mutations were simplified
- runtime evidence strongly implicates alphaTab worker render-result corruption
- automatic no-workers / HTML5 safe-mode fallback is now implemented and pushed

### What is not settled

- whether the new fallback fully resolves the user-visible bug in live Obsidian runtime

### Most important references

- pushed code commit: `7172e3e`
- comparison note: [[alphatab-lifecycle-comparison-report]]
- branch: `review/0.5.3`

### Minimal reorientation prompt

If another agent takes over, this is the shortest accurate state description:

> We already ruled out stale config, simple font readiness, and zero-size layout. The strongest evidence points to alphaTab worker-generated SVG corruption in Obsidian/Electron. Commit `7172e3e` adds automatic render-integrity detection and rebuild fallback (`useWorkers: false` -> `html5` safe mode). The next task is runtime verification of that fallback, not another broad hypothesis reset.

## Appendix — representative user log evidence

Representative evidence from the latest repro before the fallback patch:

- `scoreLoaded { trackCount: 1, disabledUnsafeNumberedNotation: false, ... }`
- `renderFinished { totalWidth: 773, totalHeight: 532, ... }`
- repeated:
    - `Error: <g> attribute transform: Expected number, "translate(NaN ...)"`
    - `Error: <path> attribute d: Expected number, "MNaN..."`

This specific combination is the main reason the debugging strategy shifted from score/config mutation cleanup to worker/render-result recovery.

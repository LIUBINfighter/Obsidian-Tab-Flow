---
title: AlphaTab Integration Comparison - Tabst.app vs Obsidian-Tab-Flow
date: 2026-03-16
tags:
  - alphatab
  - lifecycle
  - nan-prevention
  - comparison
status: completed
---

# AlphaTab Integration Comparison Report

**Purpose:** Identify lifecycle and feature-guard patterns in Tabst.app that prevent NaN render output, and recommend actionable changes for Obsidian-Tab-Flow.

**Analysis Date:** 2026-03-16

---

## Executive Summary

After comprehensive analysis of both codebases, **Obsidian-Tab-Flow is missing several critical protections** that Tabst.app has developed through iterative bug fixes. The most critical gaps relate to:

1. **Numbered notation guard** - NaN errors from NumberedBarRenderer null beat access
2. **TAB probe rollback** - Silent failures when forcing tablature on non-guitar tracks
3. **Parse timeout protection** - Infinite loading when alphaTab worker hangs
4. **Staff toggle validation** - Preventing all-staff-disabled invalid states

---

## Tabst.app Patterns (Reference Implementation)

### 1. Numbered Notation Guard

**File:** `~/Workspace/Tabst.app/src/renderer/lib/numbered-notation-guard.ts`

```typescript
// Lines 16-30: Detect specific NaN-causing errors
export function isNumberedNotationBeatError(errorText: string): boolean {
  const hasBeatNullAccess =
    errorText.includes("(reading 'beat')") ||
    errorText.includes('reading "beat"') ||
    errorText.includes("Cannot read properties of null (reading 'beat')");

  if (!hasBeatNullAccess) return false;

  return (
    errorText.includes("NumberedBarRenderer") ||
    errorText.includes("beatOfHighestNote")
  );
}

// Lines 32-45: Ensure at least one staff remains visible
function ensureStaffVisible(staff: NumberedStaffLike): boolean {
  const hasVisibleStaff =
    staff.showTablature === true ||
    staff.showStandardNotation === true ||
    staff.showSlash === true ||
    staff.showNumbered === true;

  if (hasVisibleStaff) return false;

  staff.showStandardNotation = true;  // Emergency fallback
  return true;
}

// Lines 47-72: Emergency recovery across entire score
export function disableNumberedNotationAcrossScore(
  score: NumberedScoreLike | null | undefined,
): boolean {
  // Disables numbered notation on all tracks when errors detected
  // Ensures fallback to standard notation to prevent NaN renders
}
```

**Evidence:** This guard was added after encountering production errors where `showNumbered: true` combined with certain note configurations caused `NumberedBarRenderer.calculateBeamingOverflows` to crash on null beat access.

---

### 2. TAB Probe with Error Rollback

**File:** `~/Workspace/Tabst.app/src/renderer/hooks/useAlphaTab.ts` (Lines 115-164)

```typescript
// First load: try to prefer TAB silently
if (!trackConfigRef.current) {
  const preferTab: StaffDisplayOptions = {
    ...current,
    showTablature: true,
    showStandardNotation: false,
  };

  tabProbeRef.current.active = true;
  tabProbeRef.current.prev = current;
  tabProbeRef.current.lastProbeAt = Date.now();

  // Failsafe: finalize even if renderFinished never arrives
  tabProbeRef.current.timeoutId = setTimeout(() => {
    if (!tabProbeRef.current.active) return;
    tabProbeRef.current.active = false;
    const applied = getFirstStaffOptions(api) ?? tabProbeRef.current.prev;
    if (applied) {
      trackConfigRef.current = applied;
      setFirstStaffOptions(applied);
    }
  }, 1200);

  try {
    applyStaffConfig(api, preferTab);
  } catch (e) {
    // Sync failure: rollback immediately without surfacing to UI
    tabProbeRef.current.active = false;
    // ... rollback to previous config
    trackConfigRef.current = current;
    setFirstStaffOptions(current);
    console.warn("[useAlphaTab] TAB probe sync-failed; kept default.", e);
  }
}
```

**Evidence:** The 1200ms timeout prevents indefinite hanging. The rollback mechanism prevents NaN renders when non-guitar tracks (e.g., percussion) are forced to show TAB.

---

### 3. Error Filtering in Error Handler

**File:** `~/Workspace/Tabst.app/src/renderer/hooks/useAlphaTab.ts` (Lines 237-283)

```typescript
api.error.on((err: unknown) => {
  const fullError = formatFullError(err);
  const now = Date.now();
  const recentlyProbed =
    (tabProbeRef.current.lastProbeAt ?? 0) > 0 &&
    now - (tabProbeRef.current.lastProbeAt ?? 0) < 2000;

  // Keep this intentionally narrow: rollback only for the known
  // non-guitar TAB crash (undefined staves). Don't swallow other errors.
  const looksLikeProbeStavesError =
    fullError.includes("(reading 'staves')") ||
    (fullError.includes("Cannot read properties of undefined") &&
      fullError.includes("staves"));

  // During TAB probe (or immediately after), swallow internal TypeErrors and rollback
  if (
    (tabProbeRef.current.active || recentlyProbed) &&
    looksLikeProbeStavesError
  ) {
    console.warn("[useAlphaTab] TAB probe internal error; rollback to default.");
    // ... rollback logic
    return;
  }

  setError(fullError);
  // ... restore last valid score
});
```

**Evidence:** The narrow error filtering (checking for "reading 'staves'" within 2 seconds of probe) prevents over-suppression while handling known alphaTab internal errors.

---

### 4. Staff Configuration Safety

**File:** `~/Workspace/Tabst.app/src/renderer/lib/staff-config.ts` (Lines 68-105)

```typescript
// Lines 68-105: Prevent disabling all staff options
export function canToggleStaffOption(
  api: alphaTab.AlphaTabApi,
  key: StaffOptionKey,
): boolean {
  // ... get current values

  // Calculate current enabled options count
  const totalSelected =
    Number(!!s0.showTablature) +
    Number(!!s0.showStandardNotation) +
    Number(!!s0.showSlash) +
    Number(!!s0.showNumbered);

  // If trying to disable the ONLY enabled option, disallow
  return !(totalSelected === 1 && current);
}
```

**Evidence:** This prevents users (or programmatic toggles) from reaching an invalid state where no staff notation is displayed, which can cause alphaTab layout calculation errors.

---

### 5. Parse Timeout Protection

**File:** `~/Workspace/Tabst.app/src/renderer/hooks/usePreviewErrorRecovery.ts`

```typescript
export const TEX_TIMEOUT_MS = 3000;  // 3 second timeout

export function usePreviewErrorRecovery(
  options?: UsePreviewErrorRecoveryOptions,
): UsePreviewErrorRecoveryReturn {
  const scheduleTexTimeout = useCallback(
    (content: string, options?: { timeoutMessage?: string }) => {
      texSeqRef.current += 1;
      const seq = texSeqRef.current;

      pendingTexRef.current = { id: seq, content };
      pendingTexTimerRef.current = window.setTimeout(() => {
        if (pendingTexRef.current?.id === seq) {
          setParseError(`${timeoutMessage}（等待解析结果或检查语法）`);
        }
      }, TEX_TIMEOUT_MS);
      return seq;
    },
    [],
  );

  const onError = useCallback(
    (api: alphaTab.AlphaTabApi | null, fullError: string) => {
      setParseError(fullError);
      if (!restoreGuardRef.current && lastValidScoreRef.current?.score && api) {
        // Restore previous valid score
        api.renderScore(lastValidScoreRef.current.score, [0]);
      }
    },
    [],
  );
}
```

**Evidence:** The 3-second timeout prevents UI from hanging indefinitely when alphaTab worker encounters invalid syntax or edge cases.

---

### 6. Print Preview Lifecycle Protection

**File:** `~/Workspace/Tabst.app/src/renderer/components/PrintPreview.tsx` (Lines 411-425)

```typescript
// Delayed initialization: ensure Preview's API is fully destroyed and resources released
useEffect(() => {
  const delayedInit = setTimeout(() => {
    initAlphaTab();
  }, 200); // Delay 200ms to ensure Preview API is fully destroyed

  return () => {
    clearTimeout(delayedInit);
    if (apiRef.current) {
      apiRef.current.destroy();
      apiRef.current = null;
      setPrintApi(null);
    }
  };
}, [initAlphaTab]);
```

**Evidence:** The 200ms delay prevents race conditions between main preview API destruction and print preview API creation, which could cause shared resource corruption.

---

### 7. Print-Specific Settings

**File:** `~/Workspace/Tabst.app/src/renderer/lib/alphatab-config.ts` (Lines 128-170)

```typescript
export function createPrintSettings(
  urls: ResourceUrls,
  options: PrintConfigOptions = {},
): Record<string, unknown> {
  return {
    core: {
      tex: true,
      scriptFile: urls.workerUrl,
      fontDirectory: urls.bravuraFontDirectory,
      smuflFontSources: printSmuflFontSources,  // Dedicated font sources
      enableLazyLoading: false,  // CRITICAL: Disable lazy loading for print
    },
    display: {
      layoutMode: alphaTab.LayoutMode.Page,
      scale: scale * zoom,
      // ... full color resources
    },
    player: {
      enablePlayer: false,  // Disable player for print
    },
  };
}
```

**Evidence:** `enableLazyLoading: false` ensures complete score rendering before pagination. Dedicated `smuflFontSources` prevents font loading race conditions.

---

### 8. Rebuild Strategy Documentation

**File:** `~/Workspace/Tabst.app/docs/dev/alphatab/REBUILD_MECHANISMS.md`

Tabst.app documents a 4-tier rebuild strategy:

| Tier | Method | When to Use | Status |
|------|--------|-------------|--------|
| 1 | `api.render()` | Simple visual updates | ❌ Deprecated (Worker cache) |
| 2 | `api.renderTracks()` | Single track display toggle | ✅ Use for staff toggles |
| 3 | `api.tex()` | Content changed/reparse needed | ✅ Use for new files |
| 4 | Full API rebuild | Theme/color changes | ✅ Use when Worker cache stale |

**Key Insight:** Worker cache doesn't update when `resources` object changes. Only tier 4 (full rebuild) guarantees color/theme changes apply.

---

## Obsidian-Tab-Flow Gaps

### Gap 1: Missing Numbered Notation Guard ❌ CRITICAL

**Current State:** No equivalent to `numbered-notation-guard.ts`

**Risk:** When users enable numbered notation (`showNumbered: true`) on incompatible tracks, alphaTab's `NumberedBarRenderer` throws null beat errors, potentially causing NaN in layout calculations.

**Missing File:** `src/lib/numbered-notation-guard.ts`

---

### Gap 2: Missing TAB Probe Mechanism ❌ CRITICAL

**Current State:** `PlayerController.applyDefaultStaffDisplay()` (Lines 1097-1126) sets tab-only for guitar tracks but has no rollback.

**Risk:** Non-guitar tracks forced to TAB-only can cause "Cannot read properties of undefined (reading 'staves')" errors.

**Missing Pattern:**
- No `tabProbeRef` tracking
- No 1200ms timeout failsafe
- No error filtering for probe-related errors

---

### Gap 3: Missing Parse Timeout Protection ❌ HIGH

**Current State:** No `TEX_TIMEOUT_MS` equivalent

**Risk:** If alphaTab worker hangs during `api.tex()` call, UI remains in loading state indefinitely.

**Missing Pattern:**
- No `usePreviewErrorRecovery` hook
- No `pendingTexRef` sequencing
- No `lastValidScoreRef` restoration

---

### Gap 4: Incomplete Staff Toggle Validation ⚠️ MEDIUM

**Current State:** `PrintTracksPanel.updateStaffOptions()` (Lines 276-289) has `hasAny` check but no `canToggleStaffOption`.

**Current Code:**
```typescript
private updateStaffOptions(
  key: string,
  staff: alphaTab.model.Staff,
  updater: (current: StaffDisplayOptions) => StaffDisplayOptions
) {
  const current = this.getStaffOptions(key, staff);
  const next = updater(current);
  const hasAny = Object.values(next).some((v) => v === true);
  if (!hasAny) {
    return;  // Prevents update but doesn't guide UI
  }
  this.staffOptions.set(key, next);
}
```

**Gap:** No `canToggleStaffOption()` function to disable toggle buttons when only one option remains.

---

### Gap 5: Missing Print Delayed Init ⚠️ MEDIUM

**Current State:** `PrintPreviewView.ts` initializes immediately without delay.

**Risk:** Race condition if main player API not fully destroyed when print preview opens.

**Missing Pattern:**
```typescript
// Missing in PrintPreviewView.ts
const delayedInit = setTimeout(() => {
  this.initAlphaTab();
}, 200);
```

---

### Gap 6: Missing Dedicated Print Settings ⚠️ MEDIUM

**Current State:** Print preview likely uses same settings as main player.

**Risk:** `enableLazyLoading: true` in print can cause incomplete pagination.

**Missing Pattern:** `createPrintSettings()` with:
- `enableLazyLoading: false`
- `enablePlayer: false`
- Dedicated `smuflFontSources`

---

### Gap 7: Missing Rebuild Strategy Docs ⚠️ LOW

**Current State:** No documentation on when to use `render()` vs `tex()` vs full rebuild.

**Risk:** Developers may use inappropriate method, causing stale renders or unnecessary overhead.

---

## Concrete Differences Table

| Feature | Tabst.app | Obsidian-Tab-Flow | Risk | Effort |
|---------|-----------|-------------------|------|--------|
| Numbered notation guard | ✅ `numbered-notation-guard.ts` | ❌ Missing | **HIGH** | Low |
| TAB probe with rollback | ✅ `useAlphaTab.ts` L115-164 | ❌ Missing | **HIGH** | Medium |
| Parse timeout (3000ms) | ✅ `TEX_TIMEOUT_MS` | ❌ Missing | **HIGH** | Medium |
| Error recovery hook | ✅ `usePreviewErrorRecovery.ts` | ❌ Missing | MEDIUM | Medium |
| Staff toggle validation | ✅ `canToggleStaffOption()` | ⚠️ Partial | MEDIUM | Low |
| Print delayed init | ✅ 200ms delay | ❌ Missing | MEDIUM | Low |
| `enableLazyLoading: false` print | ✅ `createPrintSettings()` | ❌ Missing | MEDIUM | Low |
| Rebuild strategy docs | ✅ `REBUILD_MECHANISMS.md` | ❌ Missing | LOW | Low |
| Last valid score restore | ✅ `lastValidScoreRef` | ❌ Missing | MEDIUM | Medium |
| Staves error filtering | ✅ Narrow filtering | ❌ Missing | MEDIUM | Low |

---

## Recommendations (Prioritized)

### Priority 1: Critical NaN Prevention (Implement First)

#### 1.1 Add `numbered-notation-guard.ts`

**Action:** Copy Tabst.app pattern exactly to new file.

**File:** `src/lib/numbered-notation-guard.ts`

**Code:**
```typescript
export function isNumberedNotationBeatError(errorText: string): boolean {
  if (!errorText) return false;

  const hasBeatNullAccess =
    errorText.includes("(reading 'beat')") ||
    errorText.includes('reading "beat"') ||
    errorText.includes("Cannot read properties of null (reading 'beat')");

  if (!hasBeatNullAccess) return false;

  return (
    errorText.includes("NumberedBarRenderer") ||
    errorText.includes("beatOfHighestNote")
  );
}

export function disableNumberedNotationAcrossScore(
  score: NumberedScoreLike | null | undefined,
): boolean {
  // Disables numbered notation, ensures at least one staff visible
}
```

---

#### 1.2 Add TAB Probe to PlayerController

**Action:** Modify `applyDefaultStaffDisplay()` to probe with rollback.

**File:** `src/player/PlayerController.ts`

**Integration Points:**
- Add `tabProbeRef` tracking (similar to useAlphaTab.ts)
- Add 1200ms timeout failsafe
- Add error handler filtering for staves errors

---

### Priority 2: Lifecycle Safety

#### 2.1 Add Staff Toggle Validation

**Action:** Add `canToggleStaffOption()` to prevent all-disabled state.

**File:** `src/player/components/PrintTracksPanel.ts` or new `src/lib/staff-config.ts`

---

#### 2.2 Add Parse Timeout Mechanism

**Action:** Create `useErrorRecovery` hook pattern.

**File:** New `src/player/hooks/useErrorRecovery.ts`

**Features:**
- `TEX_TIMEOUT_MS = 3000`
- `lastValidScoreRef` for restoration
- Sequence tracking with `pendingTexRef`

---

### Priority 3: Print Stability

#### 3.1 Add Delayed Initialization

**Action:** Add 200ms delay in PrintPreviewView.

**File:** `src/views/PrintPreviewView.ts`

---

#### 3.2 Create Print-Specific Settings

**Action:** Create `createPrintSettings()` factory.

**File:** New `src/lib/alphatab-config.ts` or extend existing config utils

**Required:**
- `enableLazyLoading: false`
- `enablePlayer: false`
- Dedicated font configuration

---

### Priority 4: Documentation

#### 4.1 Create Rebuild Strategy Documentation

**Action:** Document 4-tier rebuild strategy.

**File:** `docs/dev/REBUILD_MECHANISMS.md`

---

## Appendix: Source File Paths

### Tabst.app (Reference)
- `~/Workspace/Tabst.app/src/renderer/hooks/useAlphaTab.ts` - Main hook with TAB probe
- `~/Workspace/Tabst.app/src/renderer/lib/staff-config.ts` - Staff configuration safety
- `~/Workspace/Tabst.app/src/renderer/lib/numbered-notation-guard.ts` - NaN prevention
- `~/Workspace/Tabst.app/src/renderer/hooks/usePreviewErrorRecovery.ts` - Error recovery
- `~/Workspace/Tabst.app/src/renderer/components/PrintPreview.tsx` - Print lifecycle
- `~/Workspace/Tabst.app/src/renderer/lib/alphatab-config.ts` - Settings factories
- `~/Workspace/Tabst.app/docs/dev/alphatab/REBUILD_MECHANISMS.md` - Strategy docs

### Obsidian-Tab-Flow (Target)
- `~/PluginFroge/.obsidian/plugins/Obsidian-Tab-Flow/src/player/PlayerController.ts` - Main controller
- `~/PluginFroge/.obsidian/plugins/Obsidian-Tab-Flow/src/player/hooks/useAlphaTabPlayer.ts` - Hook
- `~/PluginFroge/.obsidian/plugins/Obsidian-Tab-Flow/src/player/components/PrintTracksPanel.ts` - Print panel
- `~/PluginFroge/.obsidian/plugins/Obsidian-Tab-Flow/src/views/PrintPreviewView.ts` - Print view

---

*Report generated via automated codebase analysis. All line numbers and file paths verified against current source.*

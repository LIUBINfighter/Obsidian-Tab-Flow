// Utility: robust waiting for full AlphaTab rendering prior to export
// It observes alphaTab API / renderer events, fonts readiness, and multi-frame layout stability.

import type * as alphaTab from '@coderline/alphatab';

export interface WaitRenderOptions {
	/** Milliseconds to wait overall before giving up (fallback to best-effort). */
	timeoutMs?: number;
	/** Minimum layout stable frames after last size change. */
	stableFrames?: number;
	/** Frame window (ms) for measuring stability; if size unchanged across required frames -> stable. */
	frameIntervalMs?: number;
	/** When true, console.debug diagnostics are printed. */
	debug?: boolean;
	/** AbortSignal to allow early cancellation (modal closed). */
	signal?: AbortSignal;
}

export interface RenderWaitResult {
	success: boolean; // true if all partials were rendered & stability reached, false if timeout fallback
	totalHeight?: number;
	totalWidth?: number;
	partialCount?: number;
	elapsedMs: number;
	reason?: string; // additional info when success=false
}

// Internal state container to detach listeners cleanly
interface ListenerContainer {
	detach(): void;
}

function onceFontReady(debug?: boolean): Promise<void> {
	if (!(document as any).fonts || typeof (document as any).fonts.ready?.then !== 'function') {
		debug && console.debug('[AlphaTabWait] Font API not supported; skip');
		return Promise.resolve();
	}
	return (document as any).fonts.ready.catch(() => void 0);
}

/**
 * Wait for AlphaTab rendering stability.
 * Strategy:
 * 1. Hook into alphaTab API internal renderer via api.renderer if available.
 * 2. Collect partial layout IDs and wait until renderFinished (layout complete) event fires.
 * 3. Ensure each partial has been rendered (partialRenderFinished); if lazy loading is enabled, force renderResult for any missing after layout stage.
 * 4. After last partial render, watch DOM element size for N stable frames.
 * 5. Ensure fonts are loaded (document.fonts.ready) before considering stable.
 * 6. Timeout triggers fallback after attempting forced rendering.
 */
export async function waitAlphaTabFullRender(
	api: alphaTab.AlphaTabApi,
	scoreRoot: HTMLElement,
	opts: WaitRenderOptions = {}
): Promise<RenderWaitResult> {
	const {
		timeoutMs = 8000,
		stableFrames = 3,
		frameIntervalMs = 90,
		debug = false,
		signal,
	} = opts;

	const start = performance.now();
	if (!api) return { success: false, elapsedMs: 0, reason: 'api-null' };
	const renderer: any = (api as any).renderer;
	if (!renderer) return { success: false, elapsedMs: 0, reason: 'renderer-missing' };

	let partialIds: Set<number | string> = new Set();
	let renderedPartials: Set<number | string> = new Set();
	let layoutFinished = false;
	let totalWidth = 0;
	let totalHeight = 0;
	// (removed timeout handle from earlier draft)
	let aborted = false;

	const abortIf = () => {
		if (signal?.aborted) {
			aborted = true;
			throw new Error('aborted');
		}
	};

	const listeners: ListenerContainer[] = [];
	const add = (target: unknown, evt: string, cb: (...args: unknown[]) => void) => {
		try {
			(target as any)?.[evt]?.on?.(cb);
			listeners.push({ detach: () => (target as any)?.[evt]?.off?.(cb) });
		} catch {
			// ignore
		}
	};

	// preRender clears previous state
	add(renderer, 'preRender', () => {
		debug && console.debug('[AlphaTabWait] preRender');
		partialIds = new Set();
		renderedPartials = new Set();
		layoutFinished = false;
	});

	add(renderer, 'partialLayoutFinished', (r: unknown) => {
		abortIf();
		partialIds.add((r as any).id);
		// proactively request rendering when lazy loading active
		try {
			(renderer as any).renderResult?.((r as any).id);
		} catch {
			/* ignore */
		}
	});

	add(renderer, 'partialRenderFinished', (r: unknown) => {
		abortIf();
		renderedPartials.add((r as any).id);
	});

	add(renderer, 'renderFinished', (r: unknown) => {
		abortIf();
		layoutFinished = true;
		totalWidth = (r as any).totalWidth;
		totalHeight = (r as any).totalHeight;
		debug &&
			console.debug(
				'[AlphaTabWait] renderFinished layout complete',
				(r as any).totalWidth,
				(r as any).totalHeight
			);
	});

	const cleanup = () => {
		listeners.forEach((l) => {
			try {
				l.detach();
			} catch {
				/* ignore */
			}
		});
	};

	const until = async (cond: () => boolean, label: string) => {
		const pollStart = performance.now();
		while (!cond()) {
			abortIf();
			if (performance.now() - start > timeoutMs) throw new Error('timeout');
			await new Promise((r) => setTimeout(r, 50));
		}
		debug &&
			console.debug(
				`[AlphaTabWait] condition satisfied: ${label} in ${Math.round(performance.now() - pollStart)}ms`
			);
	};

	try {
		abortIf();
		// If a rendering already occurred before we attach, trigger a manual render to force events.
		try {
			api.render();
		} catch {
			/* ignore */
		}

		// Wait layout finished
		await until(() => layoutFinished, 'layoutFinished');
		abortIf();

		// Wait for all partial ids to have render images
		await until(
			() =>
				layoutFinished && partialIds.size > 0 && partialIds.size === renderedPartials.size,
			'all partials rendered'
		);

		// Multi-frame DOM stability measurement
		let stableCount = 0;
		let lastH = -1;
		while (stableCount < stableFrames) {
			abortIf();
			if (performance.now() - start > timeoutMs) throw new Error('timeout');
			const rect = scoreRoot.getBoundingClientRect();
			if (Math.abs(rect.height - lastH) < 0.5) stableCount++;
			else stableCount = 0;
			lastH = rect.height;
			await new Promise((r) => setTimeout(r, frameIntervalMs));
		}

		// Fonts ready (do not throw if fails)
		await Promise.race([
			onceFontReady(debug),
			new Promise((r) => setTimeout(r, 1000)), // cap wait 1s for fonts to avoid long delays
		]);

		cleanup();
		const elapsed = performance.now() - start;
		return {
			success: true,
			totalHeight,
			totalWidth,
			partialCount: partialIds.size,
			elapsedMs: elapsed,
		};
	} catch (e: unknown) {
		cleanup();
		const elapsed = performance.now() - start;
		if (aborted) return { success: false, elapsedMs: elapsed, reason: 'aborted' };
		const reason = e instanceof Error ? e.message : 'unknown-error';
		return {
			success: false,
			totalHeight,
			totalWidth,
			partialCount: partialIds.size,
			elapsedMs: elapsed,
			reason,
		};
	}
}

// Simple mutex for export to avoid concurrent race when multiple export clicks occur.
let exportLock: Promise<void> | null = null;

export async function withExportLock<T>(fn: () => Promise<T>): Promise<T> {
	// chain previous promise to serialize
	while (exportLock) {
		try {
			await exportLock;
		} catch {
			/* ignore */
		}
	}
	type ReleaseFunction = () => void;
	let release: ReleaseFunction | null = null;
	exportLock = new Promise<void>((res) => {
		release = res as ReleaseFunction;
	});
	const callRelease = () => {
		if (release) (release as ReleaseFunction)();
	};
	try {
		const result = await fn();
		callRelease();
		exportLock = null;
		return result;
	} catch (e) {
		callRelease();
		exportLock = null;
		throw e;
	}
}

export function isExportLocked(): boolean {
	return !!exportLock;
}

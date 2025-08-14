import * as alphaTab from "@coderline/alphatab";
import { setIcon } from "obsidian";
import type { AlphaTabResources } from "../services/ResourceLoaderService";

export interface AlphaTexInitOptions {
	// display
	scale?: number; // 0.5 - 2.0
	layoutMode?: number | string; // optional, numeric enum preferred
	// player
	speed?: number; // 0.5 - 2.0
	metronome?: boolean;
	scrollMode?: number | string;
	player?: "enable" | "disable"; // enable full player or render-only
	// tracks to render (-1 means all)
	tracks?: number[];
	// callback for two-way binding (provided by main.ts)
	onUpdateInit?: (partial: Partial<AlphaTexInitOptions>) => void;
		// runtime UI override bridge (provided by main.ts)
		setUiOverride?: (override: { components?: Record<string, boolean>; order?: string[] | string } | null) => void;
		clearUiOverride?: () => void;
}

export interface AlphaTexMountHandle {
	destroy: () => void;
}

function parseInlineInit(source: string): { opts: AlphaTexInitOptions; body: string } {
    // Support Mermaid-like init on the very first line, single-line or multi-line until closing }%%
    // Examples:
    // %%{init: {"a":1}}%%\n...  or
    // %%{init: {\n  ...\n} }%%\n...
    const multi = source.match(/^\s*%%\{\s*init\s*:\s*(\{[\s\S]*?\})\s*%%\s*\r?\n?/);
    if (multi) {
        try {
            const json = JSON.parse(multi[1]);
            const body = source.slice(multi[0].length);
            return { opts: json || {}, body };
        } catch {
            // fall through to no-init behavior
        }
    }

    // legacy: strictly single-line on first line
    const firstLineEnd = source.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? source.slice(0, firstLineEnd) : source;
    const initMatch = firstLine.match(/^\s*%%\{\s*init\s*:\s*(\{[\s\S]*\})\s*}\s*%%\s*$/);
    if (!initMatch) return { opts: {}, body: source };
    try {
        const json = JSON.parse(initMatch[1]);
        const body = firstLineEnd >= 0 ? source.slice(firstLineEnd + 1) : "";
        return { opts: json || {}, body };
    } catch {
        return { opts: {}, body: source };
    }
}

function toScrollMode(value: number | string | undefined): number | undefined {
	if (value == null) return undefined;
	if (typeof value === "number") return value;
	const key = String(value).toLowerCase();
	// map a few common names to enum values
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ScrollMode: any = (alphaTab as any).ScrollMode || {};
	const mapping: Record<string, number | undefined> = {
		continuous: ScrollMode.Continuous,
		singlepage: ScrollMode.SinglePage,
		page: ScrollMode.Page,
	};
	return mapping[key];
}

// function fromScrollModeEnum(value: number | undefined): string | undefined {
//   ... (removed UI for scroll mode)
// }

export function mountAlphaTexBlock(
	rootEl: HTMLElement,
	source: string,
	resources: AlphaTabResources,
	defaults?: AlphaTexInitOptions
): AlphaTexMountHandle {
	const { opts, body } = parseInlineInit(source);
	const merged: AlphaTexInitOptions = { ...(defaults || {}), ...(opts || {}) };

	// extract optional UI override from init
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const uiOverride: { components?: Record<string, boolean>; order?: string[] | string } | undefined = (opts as any)?.ui;
	try { if (uiOverride && defaults?.setUiOverride) defaults.setUiOverride(uiOverride); } catch {}

	// container structure
	const wrapper = document.createElement("div");
	wrapper.className = "alphatex-block";
	const scoreEl = document.createElement("div");
	scoreEl.className = "alphatex-score";
    const controlsEl = document.createElement("div");
    controlsEl.className = "alphatex-controls nav-buttons-container";
    wrapper.appendChild(scoreEl);
	rootEl.appendChild(wrapper);

	// AlphaTabApi setup (theme-aware colors)
	const style = window.getComputedStyle(rootEl);
	const mainGlyphColor = style.getPropertyValue("--color-base-100") || "#e0e0e0";
	const secondaryGlyphColor = style.getPropertyValue("--color-base-60") || "#a0a0a0";
	const base40 = style.getPropertyValue("--color-base-40") || "#707070";
	const scoreInfoColor = mainGlyphColor;

	// Inject @font-face like TabView to ensure glyph font is available
	const fontStyle = document.createElement("style");
	fontStyle.innerHTML = `@font-face { font-family: 'alphaTab'; src: url(${resources.bravuraUri}); }`;
	document.head.appendChild(fontStyle);

	// Cursor and highlight styles (aligned with TabView)
	const accent = `hsl(var(--accent-h),var(--accent-s),var(--accent-l))`;
	const runtimeStyle = document.createElement("style");
	runtimeStyle.innerHTML = `
		.alphatex-block .at-cursor-bar { background: ${accent}; opacity: 0.2; }
		.alphatex-block .at-selection div { background: ${accent}; opacity: 0.4; }
		.alphatex-block .at-cursor-beat { background: ${accent}; width: 3px; }
		.alphatex-block .at-highlight * { fill: ${accent}; stroke: ${accent}; }
	`;
	document.head.appendChild(runtimeStyle);

	const playerEnabled = (String(merged.player || "enable").toLowerCase() !== "disable");
	const api = new alphaTab.AlphaTabApi(scoreEl, {
		core: {
			scriptFile: resources.alphaTabWorkerUri || "",
			smuflFontSources: (
				resources.bravuraUri
					? new Map([
						[((alphaTab as any).rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0), resources.bravuraUri],
					])
					: new Map()
			) as unknown as Map<number, string>,
			fontDirectory: "",
		},
		player: {
			enablePlayer: playerEnabled,
			playerMode: playerEnabled ? alphaTab.PlayerMode.EnabledAutomatic : alphaTab.PlayerMode.Disabled,
			enableCursor: playerEnabled,
			enableAnimatedBeatCursor: playerEnabled,
			soundFont: playerEnabled ? resources.soundFontUri : undefined,
			scrollMode: toScrollMode(merged.scrollMode) ?? alphaTab.ScrollMode.Continuous,
			scrollSpeed: 500,
			scrollOffsetY: -25,
			scrollOffsetX: 25,
			nativeBrowserSmoothScroll: false,
		},
		display: {
			resources: {
				mainGlyphColor,
				secondaryGlyphColor,
				staffLineColor: base40,
				barSeparatorColor: base40,
				barNumberColor: mainGlyphColor,
				scoreInfoColor,
			},
			scale: merged.scale ?? 1.0,
		},
	});

	// apply runtime options
	if (typeof merged.speed === "number" && api.player) {
		api.playbackSpeed = merged.speed;
	}
	if (typeof merged.metronome === "boolean") {
		api.metronomeVolume = merged.metronome ? 1 : 0;
	}

	// Configure scroll element similar to TabView
	try {
		const scrollEl = rootEl.closest(
			".markdown-reading-view,.markdown-preview-view,.view-content,.workspace-leaf-content"
		) as HTMLElement | null;
		(api.settings.player as any).scrollElement = scrollEl || "html,body";
		api.updateSettings();
	} catch {}

	// render via convenient tex method; fallback to manual importer if needed
	let destroyed = false;
	const renderFromTex = () => {
		try {
			if (typeof (api as any).tex === "function") {
				(api as any).tex(body, merged.tracks);
				return;
			}
			// Fallback: manual import
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const Importer: any = (alphaTab as any).importer?.AlphaTexImporter;
			if (Importer) {
				const imp = new Importer();
				imp.logErrors = true;
				imp.initFromString(body, api.settings);
				const score = imp.readScore();
				api.renderScore(score, merged.tracks);
			}
		} catch (e) {
			// Simple error surface into controls
            const errEl = document.createElement("div");
            errEl.className = "alphatex-error";
            errEl.textContent = `AlphaTex render error: ${e}`;
            wrapper.appendChild(errEl);
		}
	};
	renderFromTex();

    // controls (try to unify style with PlayBar) — only when player is enabled
    if (resources.soundFontUri && playerEnabled) {
        // attach controls container only when needed
        wrapper.appendChild(controlsEl);
		const playPauseBtn = document.createElement("button");
		playPauseBtn.className = "clickable-icon";
		playPauseBtn.setAttribute("type", "button");
		const playIcon = document.createElement("span");
		setIcon(playIcon, "play");
		playPauseBtn.appendChild(playIcon);
		playPauseBtn.setAttribute("aria-label", "播放/暂停");
		playPauseBtn.addEventListener("click", () => api.playPause());

		const stopBtn = document.createElement("button");
		stopBtn.className = "clickable-icon";
		stopBtn.setAttribute("type", "button");
		const stopIcon = document.createElement("span");
		setIcon(stopIcon, "square");
		stopBtn.appendChild(stopIcon);
		stopBtn.setAttribute("aria-label", "停止");
		stopBtn.addEventListener("click", () => api.stop());

		// const speedIcon = document.createElement("span");
		// setIcon(speedIcon, "lucide-gauge");
		// speedIcon.style.marginRight = "0.5em";

		// const speedInput = document.createElement("input");
		// speedInput.type = "number";
		// speedInput.min = "0.5";
		// speedInput.max = "2";
		// speedInput.step = "0.05";
		// speedInput.value = String(merged.speed ?? 1.0);
		// const applySpeed = () => {
		// 	const v = parseFloat(speedInput.value);
		// 	if (!isNaN(v)) {
		// 		const clamped = Math.max(0.5, Math.min(2.0, v));
		// 		api.playbackSpeed = clamped;
		// 		if (speedInput.value !== String(clamped)) speedInput.value = String(clamped);
		// 		merged.speed = clamped;
		// 		defaults?.onUpdateInit?.({ speed: clamped });
		// 	}
		// };
		// speedInput.addEventListener("change", applySpeed);
		// speedInput.addEventListener("blur", applySpeed);

		// const zoomIcon = document.createElement("span");
		// setIcon(zoomIcon, "lucide-zoom-in");
		// zoomIcon.style.marginLeft = "1em";
		// zoomIcon.style.marginRight = "0.5em";
		// const zoomInput = document.createElement("input");
		// zoomInput.type = "number";
		// zoomInput.min = "0.5";
		// zoomInput.max = "2";
		// zoomInput.step = "0.05";
		// zoomInput.value = String(merged.scale ?? 1.0);
		// const applyScale = () => {
		// 	const v = parseFloat(zoomInput.value);
		// 	if (!isNaN(v)) {
		// 		const clamped = Math.max(0.5, Math.min(2.0, v));
		// 		api.settings.display.scale = clamped;
		// 		api.updateSettings();
		// 		api.render();
		// 		if (zoomInput.value !== String(clamped)) zoomInput.value = String(clamped);
		// 		merged.scale = clamped;
		// 		defaults?.onUpdateInit?.({ scale: clamped });
		// 	}
		// };
		// zoomInput.addEventListener("change", applyScale);
		// zoomInput.addEventListener("blur", applyScale);

		const metroBtn = document.createElement("button");
		metroBtn.className = "clickable-icon";
		metroBtn.setAttribute("type", "button");
		const metroIcon = document.createElement("span");
		setIcon(metroIcon, "lucide-music-2");
		metroBtn.appendChild(metroIcon);
		metroBtn.setAttribute("aria-label", "节拍器");
		metroBtn.onclick = () => {
			const enabled = (api.metronomeVolume || 0) > 0 ? false : true;
			api.metronomeVolume = enabled ? 1 : 0;
			merged.metronome = enabled;
			try { metroBtn.classList.toggle("is-active", !!enabled); } catch {}
			defaults?.onUpdateInit?.({ metronome: enabled });
		};

		// component-level visibility via init.ui.components (defaults to true)
		const shouldShow = (key: string, def = true) => {
			const c = uiOverride?.components;
			return typeof c?.[key] === "boolean" ? !!c?.[key] : def;
		};

		if (shouldShow("playPause", true)) controlsEl.appendChild(playPauseBtn);
		if (shouldShow("stop", true)) controlsEl.appendChild(stopBtn);
		// controlsEl.appendChild(speedIcon);
		// controlsEl.appendChild(speedInput);
		// controlsEl.appendChild(zoomIcon);
		// controlsEl.appendChild(zoomInput);
		if (shouldShow("metronome", true)) controlsEl.appendChild(metroBtn);
    } else if (playerEnabled && !resources.soundFontUri) {
        // compact note, no controls container
        const note = document.createElement("div");
        note.className = "alphatex-note";
        note.textContent = "SoundFont missing: playback disabled. Rendering only.";
        wrapper.appendChild(note);
    }

	return {
		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			try { api.destroy(); } catch {}
			try { rootEl.innerHTML = ""; } catch {}
			try { fontStyle.remove(); } catch {}
			try { runtimeStyle.remove(); } catch {}
				// clear runtime UI override when this block unmounts
				try { defaults?.clearUiOverride?.(); } catch {}
		},
	};
}



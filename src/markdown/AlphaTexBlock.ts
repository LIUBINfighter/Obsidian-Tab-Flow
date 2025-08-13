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
	// tracks to render (-1 means all)
	tracks?: number[];
}

export interface AlphaTexMountHandle {
	destroy: () => void;
}

function parseInlineInit(source: string): { opts: AlphaTexInitOptions; body: string } {
	// Mermaid-like init: %%{init: {...}}%% must be on first line
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

export function mountAlphaTexBlock(
	rootEl: HTMLElement,
	source: string,
	resources: AlphaTabResources,
	defaults?: AlphaTexInitOptions
): AlphaTexMountHandle {
	const { opts, body } = parseInlineInit(source);
	const merged: AlphaTexInitOptions = { ...(defaults || {}), ...(opts || {}) };

	// container structure
	const wrapper = document.createElement("div");
	wrapper.className = "alphatex-block";
	const scoreEl = document.createElement("div");
	scoreEl.className = "alphatex-score";
	const controlsEl = document.createElement("div");
	controlsEl.className = "alphatex-controls nav-buttons-container";
	wrapper.appendChild(scoreEl);
	wrapper.appendChild(controlsEl);
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
			enablePlayer: true,
			playerMode: alphaTab.PlayerMode.EnabledAutomatic,
			enableCursor: true,
			enableAnimatedBeatCursor: true,
			soundFont: resources.soundFontUri,
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
			controlsEl.appendChild(errEl);
		}
	};
	renderFromTex();

	// controls (try to unify style with PlayBar)
	if (resources.soundFontUri) {
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

		const speedIcon = document.createElement("span");
		setIcon(speedIcon, "lucide-gauge");
		speedIcon.style.marginRight = "0.5em";

		const speedSelect = document.createElement("select");
		["0.5","0.75","1.0","1.25","1.5","2.0"].forEach((val) => {
			const opt = document.createElement("option");
			opt.value = val;
			opt.innerText = val + "x";
			if (val === String(merged.speed ?? 1.0)) opt.selected = true;
			speedSelect.appendChild(opt);
		});
		speedSelect.onchange = () => {
			const v = parseFloat(speedSelect.value);
			if (!isNaN(v)) api.playbackSpeed = v;
		};

		const zoomIcon = document.createElement("span");
		setIcon(zoomIcon, "lucide-zoom-in");
		zoomIcon.style.marginLeft = "1em";
		zoomIcon.style.marginRight = "0.5em";
		const zoomSelect = document.createElement("select");
		[
			{ label: "50%", value: 0.5 }, { label: "75%", value: 0.75 }, { label: "100%", value: 1 },
			{ label: "125%", value: 1.25 }, { label: "150%", value: 1.5 }, { label: "200%", value: 2 },
		].forEach(({label: l, value}) => {
			const opt = document.createElement("option");
			opt.value = String(value);
			opt.innerText = l;
			if (value === (merged.scale ?? 1)) opt.selected = true;
			zoomSelect.appendChild(opt);
		});
		zoomSelect.onchange = () => {
			const v = parseFloat(zoomSelect.value);
			if (!isNaN(v)) {
				api.settings.display.scale = v;
				api.updateSettings();
				api.render();
			}
		};

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
		};

		controlsEl.appendChild(playPauseBtn);
		controlsEl.appendChild(stopBtn);
		controlsEl.appendChild(speedIcon);
		controlsEl.appendChild(speedSelect);
		controlsEl.appendChild(zoomIcon);
		controlsEl.appendChild(zoomSelect);
		controlsEl.appendChild(metroBtn);
	} else {
		const note = document.createElement("div");
		note.className = "alphatex-note";
		note.textContent = "SoundFont missing: playback disabled. Rendering only.";
		controlsEl.appendChild(note);
	}

	return {
		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			try { api.destroy(); } catch {}
			try { rootEl.innerHTML = ""; } catch {}
			try { fontStyle.remove(); } catch {}
			try { runtimeStyle.remove(); } catch {}
		},
	};
}



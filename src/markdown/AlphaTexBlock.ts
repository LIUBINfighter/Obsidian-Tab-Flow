import * as alphaTab from "@coderline/alphatab";
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
	controlsEl.className = "alphatex-controls";
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

	// controls (only if soundFont is available)
	if (resources.soundFontUri) {
		const playBtn = document.createElement("button");
		playBtn.className = "atx-btn";
		playBtn.textContent = "Play/Pause";
		playBtn.addEventListener("click", () => api.playPause());

		const stopBtn = document.createElement("button");
		stopBtn.className = "atx-btn";
		stopBtn.textContent = "Stop";
		stopBtn.addEventListener("click", () => api.stop());

		const speedLabel = document.createElement("label");
		speedLabel.className = "atx-label";
		speedLabel.textContent = "Speed:";
		const speedInput = document.createElement("input");
		speedInput.type = "number";
		speedInput.min = "0.5";
		speedInput.max = "2";
		speedInput.step = "0.1";
		speedInput.value = String(merged.speed ?? 1.0);
		speedInput.addEventListener("change", () => {
			const v = parseFloat(speedInput.value);
			if (!isNaN(v)) api.playbackSpeed = Math.max(0.5, Math.min(2.0, v));
		});
		speedLabel.appendChild(speedInput);

		const scaleLabel = document.createElement("label");
		scaleLabel.className = "atx-label";
		scaleLabel.textContent = "Scale:";
		const scaleInput = document.createElement("input");
		scaleInput.type = "number";
		scaleInput.min = "0.5";
		scaleInput.max = "2";
		scaleInput.step = "0.05";
		scaleInput.value = String(merged.scale ?? 1.0);
		scaleInput.addEventListener("change", () => {
			const v = parseFloat(scaleInput.value);
			if (!isNaN(v)) {
				api.settings.display.scale = Math.max(0.5, Math.min(2.0, v));
				api.updateSettings();
				api.render();
			}
		});
		scaleLabel.appendChild(scaleInput);

		const metroLabel = document.createElement("label");
		metroLabel.className = "atx-label";
		const metroCheck = document.createElement("input");
		metroCheck.type = "checkbox";
		metroCheck.checked = !!merged.metronome;
		metroCheck.addEventListener("change", () => {
			api.metronomeVolume = metroCheck.checked ? 1 : 0;
		});
		metroLabel.appendChild(metroCheck);
		const metroText = document.createElement("span");
		metroText.textContent = "Metronome";
		metroLabel.appendChild(metroText);

		controlsEl.appendChild(playBtn);
		controlsEl.appendChild(stopBtn);
		controlsEl.appendChild(speedLabel);
		controlsEl.appendChild(scaleLabel);
		controlsEl.appendChild(metroLabel);
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
		},
	};
}



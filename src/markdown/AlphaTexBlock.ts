import * as alphaTab from '@coderline/alphatab';
import { setIcon } from 'obsidian';
import type { AlphaTabResources } from '../services/ResourceLoaderService';
import { parseInlineInit, toScrollMode, scheduleInit } from '../utils';

export interface AlphaTexInitOptions {
	// display
	scale?: number; // 0.5 - 2.0
	layoutMode?: number | string; // optional, numeric enum preferred
	// player
	speed?: number; // 0.5 - 2.0
	metronome?: boolean;
	scrollMode?: number | string;
	player?: 'enable' | 'disable'; // enable full player or render-only
	// tracks to render (-1 means all)
	tracks?: number[];
	// callback for two-way binding (provided by main.ts)
	onUpdateInit?: (partial: Partial<AlphaTexInitOptions>) => void;
	// runtime UI override bridge (provided by main.ts)
	setUiOverride?: (
		override: { components?: Record<string, boolean>; order?: string[] | string } | null
	) => void;
	clearUiOverride?: () => void;
}

export interface AlphaTexMountHandle {
	destroy: () => void;
	api?: alphaTab.AlphaTabApi | null;
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

	const uiOverride:
		| { components?: Record<string, boolean>; order?: string[] | string }
		| undefined = (opts as any)?.ui;
	try {
		if (uiOverride && defaults?.setUiOverride) defaults.setUiOverride(uiOverride);
	} catch {
		// Ignore UI override setup errors
	}

	// container structure
	const wrapper = document.createElement('div');
	wrapper.className = 'alphatex-block';
	const messagesEl = document.createElement('div');
	messagesEl.className = 'alphatex-messages';
	const scoreEl = document.createElement('div');
	scoreEl.className = 'alphatex-score';
	const controlsEl = document.createElement('div');
	controlsEl.className = 'alphatex-controls nav-buttons-container';
	wrapper.appendChild(messagesEl);
	wrapper.appendChild(scoreEl);
	rootEl.appendChild(wrapper);

	let errorMessages: string[] = [];
	let copyBtnAdded = false;
	const errorIndex = new Map<string, { el: HTMLDivElement; count: number }>();
	const MAX_ERRORS_TOTAL = 50;
	const RATE_WINDOW_MS = 1000;
	const RATE_LIMIT_PER_WINDOW = 30;
	let rateWindowStart = Date.now();
	let rateWindowCount = 0;
	let suppressedBanner: HTMLDivElement | null = null;

	const formatError = (err: unknown): string => {
		try {
			// Prefer message if present
			const anyErr = err as any;
			if (anyErr && typeof anyErr.message === 'string') return anyErr.message;
			// Some AlphaTab errors might be plain strings
			return String(err);
		} catch {
			return 'Unknown error';
		}
	};

	const ensureCopyButton = () => {
		if (copyBtnAdded) return;
		copyBtnAdded = true;
		const btn = document.createElement('button');
		btn.className = 'clickable-icon';
		btn.setAttribute('type', 'button');
		const icon = document.createElement('span');
		setIcon(icon, 'copy');
		btn.appendChild(icon);
		btn.setAttribute('aria-label', '复制错误与原文');
		btn.title = '复制错误与原文';
		btn.addEventListener('click', async () => {
			const mergedText = [
				'---- AlphaTex Source ----',
				source,
				'',
				'---- Errors ----',
				...errorMessages.map((e) => `- ${e}`),
				'',
			].join('\n');
			try {
				await navigator.clipboard.writeText(mergedText);
				try {
					setIcon(icon, 'check');
					btn.classList.add('is-success');
					setTimeout(() => {
						setIcon(icon, 'copy');
						btn.classList.remove('is-success');
					}, 1200);
				} catch {
					// Ignore icon update errors
				}
			} catch {
				try {
					const ta = document.createElement('textarea');
					ta.value = mergedText;
					document.body.appendChild(ta);
					ta.select();
					document.execCommand('copy');
					ta.remove();
					try {
						setIcon(icon, 'check');
						btn.classList.add('is-success');
						setTimeout(() => {
							setIcon(icon, 'copy');
							btn.classList.remove('is-success');
						}, 1200);
					} catch {
						// Ignore icon update errors
					}
				} catch {
					// Ignore clipboard fallback errors
				}
			}
		});
		// place button at the top of messages
		messagesEl.appendChild(btn);
	};

	const appendError = (text: string) => {
		try {
			// Rate limiting
			const now = Date.now();
			if (now - rateWindowStart > RATE_WINDOW_MS) {
				rateWindowStart = now;
				rateWindowCount = 0;
				if (suppressedBanner) {
					try {
						suppressedBanner.remove();
					} catch {
						// Ignore DOM removal errors
					}
					suppressedBanner = null;
				}
			}
			rateWindowCount++;
			if (rateWindowCount > RATE_LIMIT_PER_WINDOW) {
				if (!suppressedBanner) {
					suppressedBanner = document.createElement('div');
					suppressedBanner.className = 'alphatex-error';
					suppressedBanner.textContent = `Too many errors; further messages are temporarily suppressed`;
					messagesEl.appendChild(suppressedBanner);
				}
				return;
			}

			ensureCopyButton();

			// Deduplicate and count
			const existing = errorIndex.get(text);
			if (existing) {
				existing.count++;
				existing.el.textContent = `${text} (x${existing.count})`;
				return;
			}

			if (errorMessages.length >= MAX_ERRORS_TOTAL) {
				if (!suppressedBanner) {
					suppressedBanner = document.createElement('div');
					suppressedBanner.className = 'alphatex-error';
					suppressedBanner.textContent = `Too many errors; further messages are suppressed`;
					messagesEl.appendChild(suppressedBanner);
				}
				return;
			}

			errorMessages.push(text);
			const errEl = document.createElement('div');
			errEl.className = 'alphatex-error';
			errEl.textContent = text;
			messagesEl.appendChild(errEl);
			errorIndex.set(text, { el: errEl, count: 1 });
		} catch {
			// Ignore error display errors
		}
	};

	// AlphaTabApi setup (theme-aware colors)
	const style = window.getComputedStyle(rootEl);
	const mainGlyphColor = style.getPropertyValue('--color-base-100') || '#e0e0e0';
	const secondaryGlyphColor = style.getPropertyValue('--color-base-60') || '#a0a0a0';
	const base40 = style.getPropertyValue('--color-base-40') || '#707070';
	const scoreInfoColor = mainGlyphColor;

	// 字体由全局注入一次（main.ts），此处不再重复注入，减少样式计算与回流

	// Cursor and highlight styles (aligned with TabView)
	const accent = `hsl(var(--accent-h),var(--accent-s),var(--accent-l))`;
	const runtimeStyle = document.createElement('style');
	// 使用 DOM API 替代 innerHTML，避免安全风险
	const styleContent = `
		.alphatex-block .at-cursor-bar { background: ${accent}; opacity: 0.2; }
		.alphatex-block .at-selection div { background: ${accent}; opacity: 0.4; }
		.alphatex-block .at-cursor-beat { background: ${accent}; width: 3px; }
		.alphatex-block .at-highlight * { fill: ${accent}; stroke: ${accent}; }
	`;
	runtimeStyle.appendChild(document.createTextNode(styleContent));
	document.head.appendChild(runtimeStyle);

	const playerEnabled = String(merged.player || 'enable').toLowerCase() !== 'disable';
	let destroyed = false;
	let api: alphaTab.AlphaTabApi | null = null;
	const ERROR_STOP_THRESHOLD = 50;
	let errorEventsCount = 0;
	// eslint-disable-next-line prefer-const
	let handle: AlphaTexMountHandle;
	const stopAlphaEngine = (reason?: string) => {
		if (!api) return;
		try {
			api.destroy();
		} catch {
			// Ignore API destroy errors
		}
		api = null;
		if (reason) appendError(reason);
	};

	const heavyInit = () => {
		if (destroyed) return;
		api = new alphaTab.AlphaTabApi(scoreEl, {
			core: {
				scriptFile: resources.alphaTabWorkerUri || '',
				smuflFontSources: (resources.bravuraUri
					? new Map([
							[
								(alphaTab as any).rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0,
								resources.bravuraUri,
							],
						])
					: new Map()) as unknown as Map<number, string>,
				fontDirectory: '',
			},
			player: {
				enablePlayer: playerEnabled,
				playerMode: playerEnabled
					? alphaTab.PlayerMode.EnabledAutomatic
					: alphaTab.PlayerMode.Disabled,
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

		// Update handle.api after creating the API
		handle.api = api;

		// Subscribe error events from AlphaTab and surface them in UI
		const onApiError = (e: unknown) => {
			errorEventsCount++;
			appendError(formatError(e));
			if (errorEventsCount >= ERROR_STOP_THRESHOLD) {
				stopAlphaEngine('Too many errors; engine stopped');
			}
		};
		try {
			(api as any).error?.on?.(onApiError);
		} catch {
			// Ignore error event subscription errors
		}

		// apply runtime options
		if (typeof merged.speed === 'number' && api.player) {
			api.playbackSpeed = merged.speed;
		}
		if (typeof merged.metronome === 'boolean') {
			api.metronomeVolume = merged.metronome ? 1 : 0;
		}

		// scope scroll container to this wrapper only
		try {
			(api.settings.player as any).scrollElement = wrapper as unknown as HTMLElement;
			api.updateSettings();
		} catch {
			// Ignore scroll element setup errors
		}

		// render via convenient tex method; fallback to manual importer if needed
		const renderFromTex = () => {
			// reset per-render rate window
			rateWindowStart = Date.now();
			rateWindowCount = 0;
			if (suppressedBanner) {
				try {
					suppressedBanner.remove();
				} catch {
					// Ignore banner removal errors
				}
				suppressedBanner = null;
			}
			errorMessages = [];
			errorIndex.clear();
			try {
				if (typeof (api as any).tex === 'function') {
					(api as any).tex(body);
					return;
				}
				const Importer: any = (alphaTab as any).importer?.AlphaTexImporter;
				if (Importer) {
					const imp = new Importer();
					imp.logErrors = true;
					imp.initFromString(body, api!.settings);
					const score = imp.readScore();
					api!.renderScore(score);
					// Best-effort: surface importer-reported errors if available
					try {
						const errs = (imp as any)?.errors || (imp as any)?._errors;
						if (Array.isArray(errs) && errs.length > 0) {
							errs.forEach((er: unknown) => appendError(formatError(er)));
						}
					} catch {
						// Ignore importer error retrieval errors
					}
				}
			} catch (e) {
				appendError(`AlphaTex render error: ${formatError(e)}`);
				stopAlphaEngine();
			}
		};

		// Apply track filtering after score loaded if requested
		try {
			(api as any).scoreLoaded?.on?.(() => {
				try {
					const tracksRequest = merged.tracks;
					if (!Array.isArray(tracksRequest) || tracksRequest.length === 0) return;
					if (tracksRequest.includes(-1)) return;
					const allTracks = (api as any).score?.tracks as any[] | undefined;
					if (!allTracks || allTracks.length === 0) return;
					const wanted = new Set<number>(tracksRequest);
					const selected = allTracks.filter(
						(t) => typeof t?.index === 'number' && wanted.has(t.index)
					);
					if (selected.length > 0) {
						(api as any).renderTracks(selected);
					}
				} catch {
					// Ignore track filtering errors
				}
			});
		} catch {
			// Ignore score loaded event subscription errors
		}

		renderFromTex();

		// controls — only when player is enabled
		if (resources.soundFontUri && playerEnabled) {
			// attach controls container only when needed
			wrapper.appendChild(controlsEl);
			const playPauseBtn = document.createElement('button');
			playPauseBtn.className = 'clickable-icon';
			playPauseBtn.setAttribute('type', 'button');
			const playIcon = document.createElement('span');
			setIcon(playIcon, 'play');
			playPauseBtn.appendChild(playIcon);
			playPauseBtn.setAttribute('aria-label', '播放/暂停');
			playPauseBtn.addEventListener('click', () => api!.playPause());

			const stopBtn = document.createElement('button');
			stopBtn.className = 'clickable-icon';
			stopBtn.setAttribute('type', 'button');
			const stopIcon = document.createElement('span');
			setIcon(stopIcon, 'square');
			stopBtn.appendChild(stopIcon);
			stopBtn.setAttribute('aria-label', '停止');
			stopBtn.addEventListener('click', () => api!.stop());

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

			const metroBtn = document.createElement('button');
			metroBtn.className = 'clickable-icon';
			metroBtn.setAttribute('type', 'button');
			const metroIcon = document.createElement('span');
			setIcon(metroIcon, 'lucide-music-2');
			metroBtn.appendChild(metroIcon);
			metroBtn.setAttribute('aria-label', '节拍器');
			metroBtn.onclick = () => {
				const enabled = (api!.metronomeVolume || 0) > 0 ? false : true;
				api!.metronomeVolume = enabled ? 1 : 0;
				merged.metronome = enabled;
				try {
					metroBtn.classList.toggle('is-active', !!enabled);
				} catch {
					// Ignore class toggle errors
				}
			};

			// component-level visibility via init.ui.components (defaults to true)
			const shouldShow = (key: string, def = true) => {
				const c = uiOverride?.components;
				return typeof c?.[key] === 'boolean' ? !!c?.[key] : def;
			};

			// Minimal renderers for in-block controls
			const renderers: Record<string, () => void> = {
				playPause: () => controlsEl.appendChild(playPauseBtn),
				stop: () => controlsEl.appendChild(stopBtn),
				metronome: () => controlsEl.appendChild(metroBtn),
				locateCursor: () => {
					const btn = document.createElement('button');
					btn.className = 'clickable-icon';
					btn.setAttribute('type', 'button');
					const icon = document.createElement('span');
					setIcon(icon, 'lucide-crosshair');
					btn.appendChild(icon);
					btn.setAttribute('aria-label', '滚动到光标');
					btn.onclick = () => {
						try {
							(api as any).scrollToCursor?.();
						} catch {
							// Ignore scroll to cursor errors
						}
					};
					controlsEl.appendChild(btn);
				},
				layoutToggle: () => {
					const btn = document.createElement('button');
					btn.className = 'clickable-icon';
					btn.setAttribute('type', 'button');
					const icon = document.createElement('span');
					const isHorizontal =
						(api!.settings?.display as any)?.layoutMode ===
						(alphaTab as any).LayoutMode?.Horizontal;
					setIcon(icon, isHorizontal ? 'lucide-panels-top-left' : 'lucide-layout');
					btn.appendChild(icon);
					btn.setAttribute('aria-label', isHorizontal ? '布局: 横向' : '布局: 页面');
					btn.onclick = () => {
						try {
							const current = (api!.settings?.display as any)?.layoutMode;
							const next =
								current === (alphaTab as any).LayoutMode?.Page
									? (alphaTab as any).LayoutMode?.Horizontal
									: (alphaTab as any).LayoutMode?.Page;
							(api!.settings.display as any).layoutMode = next;
							api!.updateSettings();
							api!.render();
							setIcon(
								icon,
								next === (alphaTab as any).LayoutMode?.Horizontal
									? 'lucide-panels-top-left'
									: 'lucide-layout'
							);
							btn.setAttribute(
								'aria-label',
								next === (alphaTab as any).LayoutMode?.Horizontal
									? '布局: 横向'
									: '布局: 页面'
							);
						} catch {
							// Ignore layout toggle errors
						}
					};
					controlsEl.appendChild(btn);
				},
				toTop: () => {
					const btn = document.createElement('button');
					btn.className = 'clickable-icon';
					btn.setAttribute('type', 'button');
					const icon = document.createElement('span');
					setIcon(icon, 'lucide-chevrons-up');
					btn.appendChild(icon);
					btn.setAttribute('aria-label', '回到顶部');
					btn.onclick = () => {
						try {
							(api as any).tickPosition = 0;
							(api as any).scrollToCursor?.();
						} catch {
							// Ignore scroll to top errors
						}
					};
					controlsEl.appendChild(btn);
				},
				toBottom: () => {
					const btn = document.createElement('button');
					btn.className = 'clickable-icon';
					btn.setAttribute('type', 'button');
					const icon = document.createElement('span');
					setIcon(icon, 'lucide-chevrons-down');
					btn.appendChild(icon);
					btn.setAttribute('aria-label', '回到底部');
					btn.onclick = () => {
						try {
							const score: any = (api as any).score;
							const masterBars = score?.masterBars || [];
							if (!masterBars.length) return;
							const last = masterBars[masterBars.length - 1];
							const endTick = last.start + last.calculateDuration();
							(api as any).tickPosition = endTick;
							(api as any).scrollToCursor?.();
						} catch {
							// Ignore scroll to end errors
						}
					};
					controlsEl.appendChild(btn);
				},
			};

			// Supported key set for in-block controls
			const supportedKeys = Object.keys(renderers);
			const PLAYBAR_DEFAULT_ORDER = [
				'playPause',
				'stop',
				'metronome',
				'countIn',
				'tracks',
				'refresh',
				'locateCursor',
				'layoutToggle',
				'exportMenu',
				'toTop',
				'toBottom',
				'openSettings',
				'progressBar',
				'speed',
				'staveProfile',
				'zoom',
				'audioPlayer',
			];
			const parseOrder = (): string[] => {
				const ord = uiOverride?.order as unknown;
				if (!ord) return ['playPause', 'stop', 'metronome']; // default minimal
				if (Array.isArray(ord))
					return (ord as string[]).filter((k) => supportedKeys.includes(k));
				if (typeof ord === 'string') {
					const nums = ord
						.split(',')
						.map((s) => parseInt(s.trim(), 10))
						.filter((n) => !isNaN(n));
					const looksOneBased = nums.some((n) => n === 1) || nums.every((n) => n > 0);
					const idx = nums
						.map((n) => (looksOneBased ? n - 1 : n))
						.filter((n) => n >= 0 && n < PLAYBAR_DEFAULT_ORDER.length);
					return idx
						.map((i) => PLAYBAR_DEFAULT_ORDER[i])
						.filter((k) => supportedKeys.includes(k));
				}
				return ['playPause', 'stop', 'metronome']; // fallback
			};
			const orderList = parseOrder();
			// If order didn't resolve to supported keys, fall back to show available ones respecting components
			const finalKeys = orderList.length > 0 ? orderList : ['playPause', 'stop', 'metronome'];
			finalKeys.forEach((key) => {
				if (shouldShow(key, true))
					try {
						renderers[key]?.();
					} catch {
						// Ignore track selection errors
					}
			});
			// controlsEl.appendChild(speedIcon);
			// controlsEl.appendChild(speedInput);
			// controlsEl.appendChild(zoomIcon);
			// controlsEl.appendChild(zoomInput);
			// metronome already added by ordered renderers when requested
		} else if (playerEnabled && !resources.soundFontUri) {
			// compact note, no controls container
			const note = document.createElement('div');
			note.className = 'alphatex-note';
			note.textContent = 'SoundFont missing: playback disabled. Rendering only.';
			wrapper.appendChild(note);
		}
	};

	// 推迟并限制初始化
	scheduleInit(heavyInit);

	handle = {
		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			try {
				api?.destroy();
			} catch {
				// Ignore API destroy errors
			}
			// 使用 DOM API 替代 innerHTML，避免安全风险
			try {
				while (rootEl.firstChild) {
					rootEl.removeChild(rootEl.firstChild);
				}
			} catch {
				// Ignore DOM cleanup errors
			}
			try {
				runtimeStyle.remove();
			} catch {
				// Ignore style removal errors
			}
			// clear runtime UI override when this block unmounts
			try {
				defaults?.clearUiOverride?.();
			} catch {
				// Ignore UI override clear errors
			}
		},
		api: api,
	};

	return handle;
}

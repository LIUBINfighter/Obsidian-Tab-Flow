import { Notice, Platform, Plugin } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import { AlphaTabResources, ASSET_FILES } from '../services/ResourceLoaderService';
import { setCssProps } from '../utils/styleUtils';
import * as path from 'path';

type ProbeHost = Plugin & {
	resources?: AlphaTabResources;
	actualPluginDir?: string;
};

const DEBUG_DIR = '.obsidian/plugins/tab-flow/_debug';

function errString(e: unknown): string {
	if (e instanceof Error) return `${e.name}: ${e.message}`;
	return String(e);
}

async function probeFontFaceFromUrl(uri: string): Promise<Record<string, unknown>> {
	try {
		const face = new FontFace(
			'tabflow-probe-url',
			`url(${JSON.stringify(uri)}) format('woff2')`
		);
		await face.load();
		return { ok: true, status: face.status };
	} catch (e) {
		return { ok: false, error: errString(e) };
	}
}

async function probeFontFaceFromBinary(host: ProbeHost): Promise<Record<string, unknown>> {
	try {
		const rel = path
			.join(host.manifest.dir ?? '', 'assets', ASSET_FILES.BRAVURA)
			.replace(/\\/g, '/');
		const buf = await host.app.vault.adapter.readBinary(rel);
		const face = new FontFace('tabflow-probe-bin', buf);
		await face.load();
		return { ok: true, status: face.status, bytes: buf.byteLength, rel };
	} catch (e) {
		return { ok: false, error: errString(e) };
	}
}

async function probeFetch(uri: string): Promise<Record<string, unknown>> {
	try {
		const res = await fetch(uri);
		const ab = await res.arrayBuffer();
		return {
			ok: res.ok,
			status: res.status,
			contentType: res.headers.get('content-type'),
			bytes: ab.byteLength,
		};
	} catch (e) {
		return { ok: false, error: errString(e) };
	}
}

async function probeFormatHints(uri: string): Promise<Record<string, unknown>> {
	const results: Record<string, unknown> = {};
	const variants: Array<[string, string]> = [
		['embedded-opentype', `url(${JSON.stringify(uri)}) format('embedded-opentype')`],
		['woff2', `url(${JSON.stringify(uri)}) format('woff2')`],
		['no-format', `url(${JSON.stringify(uri)})`],
	];
	for (const [name, src] of variants) {
		const family = `tabflow-probe-${name}`;
		let load: Record<string, unknown>;
		try {
			const face = new FontFace(family, src);
			await face.load();
			load = { ok: true, status: face.status };
		} catch (e) {
			load = { ok: false, error: errString(e) };
		}
		results[name] = { load };
	}
	return results;
}

interface RenderProbeResult {
	label: string;
	keyUsed: number | string;
	styleId: string | null;
	fontFaceCss: string | null;
	fontFamily: string | null;
	fontsLoad: Record<string, unknown>;
	atCount: number;
	atComputedFontFamily: string | null;
	svgTextCount: number;
	svgCount: number;
	glyphTextLength?: number | null;
	glyphSample?: string;
	glyphCodepoints?: string[];
	events?: string[];
	error?: string;
}

async function probeRender(
	uri: string,
	workerUri: string,
	key: number | string,
	label: string
): Promise<RenderProbeResult> {
	const res: RenderProbeResult = {
		label,
		keyUsed: key,
		styleId: null,
		fontFaceCss: null,
		fontFamily: null,
		fontsLoad: {},
		atCount: 0,
		atComputedFontFamily: null,
		svgTextCount: 0,
		svgCount: 0,
	};

	const host = document.createElement('div');
	setCssProps(host, {
		position: 'absolute',
		left: '0',
		top: '0',
		width: '640px',
		height: '320px',
		opacity: '0.01',
		'pointer-events': 'none',
		'z-index': '-1',
		overflow: 'hidden',
	});
	document.body.appendChild(host);
	const scoreEl = document.createElement('div');
	host.appendChild(scoreEl);

	const uniqueUri = `${uri}${uri.includes('?') ? '&' : '?'}probe=${label}`;
	let api: alphaTab.AlphaTabApi | null = null;
	try {
		const settings = new alphaTab.Settings();
		settings.fillFromJson({
			core: { scriptFile: workerUri, fontDirectory: '', useWorkers: false },
			player: { enablePlayer: false, playerMode: alphaTab.PlayerMode.Disabled },
		});
		settings.core.smuflFontSources = new Map([[key as alphaTab.FontFileFormat, uniqueUri]]);

		api = new alphaTab.AlphaTabApi(scoreEl, settings);
		const events: string[] = [];
		const t0 = performance.now();
		const mark = (name: string, detail?: unknown) => {
			events.push(
				`${Math.round(performance.now() - t0)}ms ${name}${
					detail === undefined ? '' : `: ${errString(detail)}`
				}`
			);
		};
		const done = new Promise<void>((resolve) => {
			const timer = window.setTimeout(() => {
				mark('timeout');
				resolve();
			}, 8000);
			const finish = (name: string) => () => {
				mark(name);
				window.clearTimeout(timer);
				window.setTimeout(() => resolve(), 1500);
			};
			api?.scoreLoaded.on(() => mark('scoreLoaded'));
			api?.renderStarted.on(() => mark('renderStarted'));
			api?.renderFinished.on(finish('renderFinished'));
			api?.postRenderFinished?.on(finish('postRenderFinished'));
			api?.error.on((e) => {
				mark('error', e);
				window.clearTimeout(timer);
				window.setTimeout(() => resolve(), 500);
			});
		});
		mark('tex()');
		api.tex('\\title "Font Probe"\n.\n:4 3.3 4.4 |\n:4 5.5 6.6');
		await done;
		res.events = events;

		const styles = Array.from(document.querySelectorAll('style[id^="alphaTabStyle"]'));
		for (const el of styles) {
			const css = el.textContent ?? '';
			if (css.includes(`probe=${label}`)) {
				res.styleId = el.id;
				const m = /@font-face\s*\{[^}]*\}/s.exec(css);
				res.fontFaceCss = m ? m[0] : css.slice(0, 500);
			}
		}
		const familyMatch = /font-family:\s*'([^']+)'/.exec(res.fontFaceCss ?? '');
		res.fontFamily = familyMatch ? familyMatch[1] : null;

		if (res.fontFamily) {
			try {
				const loaded = await document.fonts.load(`21px ${res.fontFamily}`, '\uE0A4');
				res.fontsLoad = {
					ok: true,
					count: loaded.length,
					statuses: loaded.map((f) => f.status),
				};
			} catch (e) {
				res.fontsLoad = { ok: false, error: errString(e) };
			}
		}

		const glyph = scoreEl.querySelector<SVGTextElement>('svg text');
		if (glyph) {
			const cs = getComputedStyle(glyph);
			res.atComputedFontFamily = cs.fontFamily;
			try {
				res.glyphTextLength = glyph.getComputedTextLength();
			} catch {
				res.glyphTextLength = null;
			}
			res.glyphSample = (glyph.textContent ?? '').slice(0, 8);
			res.glyphCodepoints = Array.from(glyph.textContent ?? '')
				.slice(0, 4)
				.map((c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase()}`);
		}
		res.atCount = scoreEl.querySelectorAll('.at').length;
		res.svgTextCount = scoreEl.querySelectorAll('svg text').length;
		res.svgCount = scoreEl.querySelectorAll('svg').length;
	} catch (e) {
		res.error = errString(e);
	} finally {
		try {
			api?.destroy();
		} catch {
			// ignore destroy errors
		}
		host.remove();
	}
	return res;
}

export function registerDebugCommands(plugin: ProbeHost) {
	plugin.addCommand({
		id: 'debug-font-probe',
		name: 'Debug: font probe',
		callback: async () => {
			const doc = document;
			const out: Record<string, unknown> = {
				time: new Date().toISOString(),
				runtime: {
					electron: process.versions.electron,
					chrome: process.versions.chrome,
					node: process.versions.node,
				},
				platform: {
					isDesktopApp: Platform.isDesktopApp,
					isWin: Platform.isWin,
					isMacOS: Platform.isMacOS,
					isLinux: Platform.isLinux,
					origin: location.origin,
					href: location.href,
					isSecureContext: window.isSecureContext,
				},
				plugin: {
					dir: plugin.actualPluginDir,
					manifestDir: plugin.manifest.dir,
					resources: plugin.resources ?? null,
				},
			};

			const uri = plugin.resources?.bravuraUri;
			const workerUri = plugin.resources?.alphaTabWorkerUri ?? '';
			if (uri) {
				out.fetch = await probeFetch(uri);
				out.fontFaceFromUrl = await probeFontFaceFromUrl(uri);
				out.formatHints = await probeFormatHints(uri);
			}
			out.fontFaceFromBinary = await probeFontFaceFromBinary(plugin);

			const fonts = doc.fonts;
			const registeredFaces: Array<Record<string, string>> = [];
			fonts.forEach((f) => {
				registeredFaces.push({
					family: f.family,
					status: f.status,
					weight: f.weight,
					style: f.style,
				});
			});
			const fontsInfo: Record<string, unknown> = {
				checkAlphaTabBefore: fonts.check('12px alphaTab'),
				checkBravura: fonts.check('12px Bravura'),
				registered: registeredFaces,
			};
			out.fonts = fontsInfo;
			try {
				const loaded = await fonts.load('12px alphaTab');
				out.fontsLoadAlphaTab = {
					ok: true,
					count: loaded.length,
					faces: loaded.map((f) => ({ family: f.family, status: f.status })),
				};
			} catch (e) {
				out.fontsLoadAlphaTab = { ok: false, error: errString(e) };
			}
			fontsInfo.checkAlphaTabAfter = fonts.check('12px alphaTab');

			out.alphaTabStyleElements = Array.from(
				doc.querySelectorAll('style[id^="alphaTabStyle"]')
			).map((el) => ({ id: el.id, css: (el.textContent ?? '').slice(0, 800) }));

			const globalFontStyle = doc.getElementById('alphatab-font-style-global');
			out.tabflowFontStyle = globalFontStyle
				? (globalFontStyle.textContent ?? '').slice(0, 500)
				: null;

			const sampleAt = doc.querySelector('.at');
			if (sampleAt) {
				const cs = getComputedStyle(sampleAt);
				out.sampleAtComputed = {
					fontFamily: cs.fontFamily,
					fontSize: cs.fontSize,
					text: (sampleAt.textContent ?? '').slice(0, 40),
				};
			}

			const glyphTexts = Array.from(
				doc.querySelectorAll<SVGTextElement>('.at-surface svg text')
			);
			const musicGlyph = glyphTexts.find((el) =>
				Array.from(el.textContent ?? '').some((c) => (c.codePointAt(0) ?? 0) >= 0xe000)
			);
			if (musicGlyph) {
				const cs = getComputedStyle(musicGlyph);
				let textLength: number | null = null;
				try {
					textLength = musicGlyph.getComputedTextLength();
				} catch {
					textLength = null;
				}
				out.liveGlyph = {
					fontFamily: cs.fontFamily,
					fontSize: cs.fontSize,
					textLength,
					codepoints: Array.from(musicGlyph.textContent ?? '')
						.slice(0, 6)
						.map((c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase()}`),
				};
			}
			out.liveGlyphCount = glyphTexts.length;
			out.liveSurfaces = doc.querySelectorAll('.at-surface').length;

			if (uri && workerUri) {
				const renders: RenderProbeResult[] = [];
				renders.push(await probeRender(uri, workerUri, 0, 'key-eot-0'));
				renders.push(await probeRender(uri, workerUri, 2, 'key-woff2-2'));
				renders.push(await probeRender(uri, workerUri, 'woff2', 'key-string-woff2'));
				out.renderProbes = renders;
			}

			try {
				await plugin.app.vault.adapter.mkdir(DEBUG_DIR);
			} catch {
				// ignore: directory may already exist
			}
			const file = path.join(DEBUG_DIR, `font-probe-${Date.now()}.json`).replace(/\\/g, '/');
			try {
				await plugin.app.vault.adapter.write(file, JSON.stringify(out, null, 2));
				new Notice(`Font probe written: ${file}`, 8000);
			} catch (e) {
				new Notice(`Font probe write failed: ${errString(e)}`, 8000);
				console.error('[TabFlow][probe]', out);
			}
		},
	});
}

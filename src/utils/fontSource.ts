import * as alphaTab from '@coderline/alphatab';

export type FontSourceStrategy = 'app-url' | 'data-url' | 'unresolved';

export const GLOBAL_FONT_STYLE_ID = 'alphatab-font-style-global';

/**
 * Resolve the numeric `FontFileFormat.Woff2` value in a version-tolerant way.
 *
 * alphaTab has moved this enum between the public root export and internal
 * namespaces across releases. Reading it defensively avoids silently falling
 * back to `EmbeddedOpenType` (0), which would produce an unusable
 * `@font-face` source (`format('embedded-opentype')`) and render every note
 * glyph as a missing-glyph box.
 */
export function resolveWoff2FontFormat(): alphaTab.FontFileFormat {
	const topLevel = (alphaTab as { FontFileFormat?: { Woff2?: number } }).FontFileFormat?.Woff2;
	if (typeof topLevel === 'number') {
		return topLevel;
	}

	const legacy = (
		alphaTab as {
			rendering?: { glyphs?: { FontFileFormat?: { Woff2?: number } } };
		}
	).rendering?.glyphs?.FontFileFormat?.Woff2;
	if (typeof legacy === 'number') {
		return legacy;
	}

	// Enum order has been stable since alphaTab 1.0: EmbeddedOpenType=0, Woff=1, Woff2=2
	return 2;
}

/**
 * Build `smuflFontSources` for a WOFF2 font file.
 *
 * Always keyed by `FontFileFormat.Woff2`; never guess a format from the URI.
 */
export function createSmuflFontSources(bravuraUri: string): Map<alphaTab.FontFileFormat, string> {
	return new Map([[resolveWoff2FontFormat(), bravuraUri]]);
}

export function isDataUrl(uri: string): boolean {
	return uri.startsWith('data:');
}

export function toFontDataUrl(buffer: ArrayBuffer, mime = 'font/woff2'): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Verify that a URI can actually be decoded as a WOFF2 font before handing it
 * to alphaTab. Obsidian's resource URL scheme (`app://`) has changed between
 * releases; probing it at runtime lets us fall back instead of shipping tofu.
 */
export async function verifyFontUri(uri: string, timeoutMs = 3000): Promise<boolean> {
	if (typeof FontFace === 'undefined') {
		return false;
	}
	let timer: number | undefined;
	try {
		const face = new FontFace(
			'tabflow-font-verify',
			`url(${JSON.stringify(uri)}) format('woff2')`
		);
		const timeout = new Promise<never>((_, reject) => {
			timer = window.setTimeout(() => reject(new Error('font verify timeout')), timeoutMs);
		});
		await Promise.race([face.load(), timeout]);
		return true;
	} catch {
		return false;
	} finally {
		if (timer !== undefined) {
			window.clearTimeout(timer);
		}
	}
}

/**
 * Inject a document-level `@font-face` for the `alphaTab` family as a fallback
 * for alphaTab's own injected style element. No-op when already injected.
 */
export function injectGlobalAlphaTabFontFace(
	uri: string,
	doc: Document = document
): HTMLStyleElement | null {
	const existing = doc.getElementById(GLOBAL_FONT_STYLE_ID);
	if (existing instanceof HTMLStyleElement) {
		return existing;
	}
	const style = doc.createElement('style');
	style.id = GLOBAL_FONT_STYLE_ID;
	style.textContent = `@font-face {
	font-family: 'alphaTab';
	src: url(${JSON.stringify(uri)}) format('woff2');
	font-display: block;
	font-style: normal;
	font-weight: 400;
}`;
	doc.head.appendChild(style);
	return style;
}

export function removeGlobalAlphaTabFontFace(doc: Document = document): void {
	doc.getElementById(GLOBAL_FONT_STYLE_ID)?.remove();
}

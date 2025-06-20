export class FontManager {
	static readonly FONT_STYLE_ELEMENT_ID = "alphatab-manual-font-styles";
	static injectFontFaces(fontData: Record<string, string>, fontFamilies: string[]): boolean {
		// Return false for invalid inputs
		if (!fontData || Object.keys(fontData).length === 0) {
			return false;
		}
		
		if (!fontFamilies || fontFamilies.length === 0) {
			return false;
		}

		this.removeInjectedFontFaces();
		
		const sources: string[] = [];
				// Build font sources with proper format detection
		Object.entries(fontData).forEach(([filename, url]) => {
			// Extract extension from filename
			const extension = filename.split('.').pop() || '';
			const format = this.getFormatFromExtension(extension);
			if (format) {
				sources.push(`url('${url}') format('${format}')`);
			}
		});
		
		if (sources.length === 0) {
			return false;
		}
		
		let css = "";
		fontFamilies.forEach((fontFamily) => {
			const escapedFontFamily = fontFamily.includes(' ') || /[^a-zA-Z0-9-_]/.test(fontFamily) 
				? `"${fontFamily}"` 
				: fontFamily;
			css += `@font-face {\n  font-family: ${escapedFontFamily};\n  src: ${sources.join(",\n       ")};\n  font-display: block;\n}\n\n`;
		});
		
		try {
			const styleEl = document.createElement("style");
			styleEl.id = this.FONT_STYLE_ELEMENT_ID;
			styleEl.type = "text/css";
			styleEl.textContent = css;
			document.head.appendChild(styleEl);
			return true;
		} catch {
			return false;
		}
	}

	private static getFormatFromExtension(extension: string): string | null {
		const formatMap: Record<string, string> = {
			'woff2': 'woff2',
			'woff': 'woff',
			'otf': 'opentype',
			'ttf': 'truetype',
			'eot': 'embedded-opentype',
			'svg': 'svg'
		};
		
		return formatMap[extension.toLowerCase()] || 'truetype';
	}

	static removeInjectedFontFaces() {
		const el = document.getElementById(this.FONT_STYLE_ELEMENT_ID);
		if (el) el.remove();
	}
	static triggerFontPreload(fontFamilies: string[], fontUrl?: string) {
		if (!fontFamilies || fontFamilies.length === 0 || !fontUrl) {
			return;
		}

		fontFamilies.forEach((fontFamily) => {
			// Create preload link element
			const link = document.createElement("link");
			link.rel = "preload";
			link.as = "font";
			link.type = "font/woff2"; // Default to woff2
			link.crossOrigin = "anonymous";
			link.href = fontUrl;
			
			document.head.appendChild(link);

			// Also try FontFace API if available
			if (typeof FontFace !== "undefined" && document.fonts) {
				const font = new FontFace(fontFamily, `url(${fontUrl})`, { display: 'block' });
				font.load().then((loadedFont) => {
					// @ts-ignore
					document.fonts.add(loadedFont);
				}).catch(() => {
					// Fallback for font loading errors
				});
			}
		});
	}
}

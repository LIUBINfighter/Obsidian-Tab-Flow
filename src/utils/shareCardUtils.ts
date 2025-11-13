// Utility helpers extracted from ShareCardModal to keep modal file smaller.
export function normalizeColorToHex(
	color: string | undefined | null,
	fallback = '#ffffff'
): string {
	if (!color) return fallback;
	const s = String(color).trim();
	if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
		if (s.length === 4) {
			return (
				'#' +
				s
					.slice(1)
					.split('')
					.map((c) => c + c)
					.join('')
			).toLowerCase();
		}
		return s.toLowerCase();
	}
	const m = s.match(/rgba?\s*\(([^)]+)\)/i);
	if (m) {
		const parts = m[1].split(',').map((p) => p.trim());
		if (parts.length >= 3) {
			const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
			const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
			const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
			return (
				'#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
			).toLowerCase();
		}
	}
	try {
		const el = document.createElement('div');
		el.style.color = s;
		document.body.appendChild(el);
		const cs = getComputedStyle(el).color;
		document.body.removeChild(el);
		const mm = String(cs).match(/rgba?\s*\(([^)]+)\)/i);
		if (mm) {
			const parts = mm[1].split(',').map((p) => p.trim());
			const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
			const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
			const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
			return (
				'#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
			).toLowerCase();
		}
	} catch (e) {
		// fallthrough
	}
	return fallback;
}

export function buildExportStyle(
	offsetX: number,
	offsetY: number,
	zoomScale: number,
	scale: number
) {
	return {
		transformOrigin: 'top left',
		transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoomScale * scale})`,
	};
}

export function computeExportBgColor(
	exportBgMode: 'default' | 'auto' | 'custom',
	exportBgCustomColor: string | undefined,
	cardRoot: HTMLElement | null,
	captureEl: HTMLElement,
	mime: string
): string | undefined {
	try {
		if (exportBgMode === 'custom') {
			return exportBgCustomColor || undefined;
		} else if (exportBgMode === 'auto') {
			const bgSource = cardRoot || captureEl;
			if (bgSource) {
				const cs = getComputedStyle(bgSource);
				const computedBg = cs && cs.backgroundColor ? cs.backgroundColor : undefined;
				const isTransparent =
					!computedBg ||
					computedBg === 'transparent' ||
					/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/i.test(computedBg || '');
				return isTransparent ? exportBgCustomColor || '#fff' : computedBg;
			}
		} else {
			if (mime === 'image/jpeg') return '#fff';
		}
	} catch (e) {
		return mime === 'image/jpeg' ? '#fff' : undefined;
	}
	return undefined;
}

export function measureCaptureDimensions(
	captureEl: HTMLElement,
	panWrapper: HTMLElement | null,
	resolution: number
) {
	let width: number;
	let height: number;
	let restoreTransform: string | null = null;
	try {
		if (panWrapper && panWrapper.style.transform) {
			restoreTransform = panWrapper.style.transform;
			panWrapper.style.transform = 'none';
		}
		// Disable no-unused-expressions: Force browser reflow for accurate dimensions
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		captureEl.offsetHeight;
		const rawW = captureEl.scrollWidth || captureEl.clientWidth;
		const rawH = captureEl.scrollHeight || captureEl.clientHeight;
		width = Math.ceil(rawW * resolution);
		height = Math.ceil(rawH * resolution);
		if (!rawH) {
			const rectFallback = captureEl.getBoundingClientRect();
			width = Math.ceil(rectFallback.width * resolution);
			height = Math.ceil(rectFallback.height * resolution);
		}
	} finally {
		if (restoreTransform !== null && panWrapper) {
			panWrapper.style.transform = restoreTransform;
		}
	}
	return { width, height };
}

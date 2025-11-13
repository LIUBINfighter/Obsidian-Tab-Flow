import * as alphaTab from '@coderline/alphatab';
import type { AlphaTexInitOptions } from '../markdown/AlphaTexBlock';

export function parseInlineInit(source: string): { opts: AlphaTexInitOptions; body: string } {
	let s = source;
	if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
	const start = s.match(/^\s*%%\{\s*init\s*:/);
	if (!start) return { opts: {}, body: source };
	const cursor = start[0].length;
	const objStart = s.indexOf('{', cursor);
	if (objStart < 0) return { opts: {}, body: source };

	let i = objStart;
	let depth = 0;
	let inString = false;
	let quote: '"' | "'" | null = null;
	while (i < s.length) {
		const ch = s[i];
		if (inString) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === quote) {
				inString = false;
				quote = null;
			}
			i++;
			continue;
		}
		if (ch === '"' || ch === "'") {
			inString = true;
			quote = ch;
			i++;
			continue;
		}
		if (ch === '{') {
			depth++;
			i++;
			continue;
		}
		if (ch === '}') {
			depth--;
			i++;
			if (depth === 0) break;
			continue;
		}
		i++;
	}
	if (depth !== 0) return { opts: {}, body: source };
	const jsonText = s.slice(objStart, i);
	let opts: AlphaTexInitOptions = {};
	try {
		opts = JSON.parse(jsonText) || {};
	} catch {
		return { opts: {}, body: source };
	}

	let k = i;
	while (k < s.length && /\s/.test(s[k])) k++;
	if (s[k] === '}') {
		k++;
		while (k < s.length && /\s/.test(s[k])) k++;
	}
	if (s.slice(k, k + 2) === '%%') k += 2;
	if (s[k] === '\r') k++;
	if (s[k] === '\n') k++;

	const consumed = k + (source.length - s.length);
	const body = source.slice(consumed);
	return { opts, body };
}

export function toScrollMode(value: number | string | undefined): number | undefined {
	if (value == null) return undefined;
	if (typeof value === 'number') return value;
	const key = String(value).toLowerCase();
	// Disable no-explicit-any: AlphaTab ScrollMode enum requires dynamic access
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ScrollMode: any = (alphaTab as any).ScrollMode || {};
	const mapping: Record<string, number | undefined> = {
		continuous: ScrollMode.Continuous,
		singlepage: ScrollMode.SinglePage,
		page: ScrollMode.Page,
	};
	return mapping[key];
}

export function getBarAtOffset(
	source: string,
	offset: number
): { start: number; end: number; text: string } | null {
	if (!source || offset < 0 || offset > source.length) return null;

	let left = -1;
	let right = -1;
	let inCodeFence = false;
	let fenceStart = '';

	// 从 offset 向左扫描第一个有效的 '|'
	for (let i = offset - 1; i >= 0; i--) {
		const ch = source[i];
		const prev = i > 0 ? source[i - 1] : '';

		// 处理 code fence
		if (ch === '`' && !inCodeFence) {
			let backticks = 1;
			let j = i - 1;
			while (j >= 0 && source[j] === '`') {
				backticks++;
				j--;
			}
			if (backticks >= 3) {
				inCodeFence = true;
				fenceStart = source.slice(j + 1, i + 1);
				i = j;
				continue;
			}
		} else if (inCodeFence && ch === '`') {
			let backticks = 1;
			let j = i - 1;
			while (j >= 0 && source[j] === '`') {
				backticks++;
				j--;
			}
			if (backticks >= 3 && source.slice(j + 1, i + 1) === fenceStart) {
				inCodeFence = false;
				fenceStart = '';
				i = j;
				continue;
			}
		}

		if (inCodeFence) continue;

		// 检查是否为转义的 '|'
		if (ch === '|' && prev !== '\\') {
			left = i;
			break;
		}
	}

	// 从 offset 向右扫描第一个有效的 '|'
	for (let i = offset; i < source.length; i++) {
		const ch = source[i];
		const prev = i > 0 ? source[i - 1] : '';

		// 处理 code fence
		if (ch === '`' && !inCodeFence) {
			let backticks = 1;
			let j = i + 1;
			while (j < source.length && source[j] === '`') {
				backticks++;
				j++;
			}
			if (backticks >= 3) {
				inCodeFence = true;
				fenceStart = source.slice(i, j);
				i = j - 1;
				continue;
			}
		} else if (inCodeFence && ch === '`') {
			let backticks = 1;
			let j = i + 1;
			while (j < source.length && source[j] === '`') {
				backticks++;
				j++;
			}
			if (backticks >= 3 && source.slice(i, j) === fenceStart) {
				inCodeFence = false;
				fenceStart = '';
				i = j - 1;
				continue;
			}
		}

		if (inCodeFence) continue;

		// 检查是否为转义的 '|'
		if (ch === '|' && prev !== '\\') {
			right = i;
			break;
		}
	}

	// 如果找不到任何边界，返回 null
	if (left === -1 && right === -1) return null;

	const start = left === -1 ? 0 : left + 1;
	const end = right === -1 ? source.length : right;

	const text = source.slice(start, end).trim();
	if (!text) return null;

	return { start, end, text };
}

export function getTokenAtOffset(
	source: string,
	offset: number
): { token: string; start: number; end: number } | null {
	if (!source || offset < 0 || offset > source.length) return null;

	// 找到包含 offset 的 bar
	const bar = getBarAtOffset(source, offset);
	if (!bar) return null;

	// 在 bar 范围内找到 token
	const barText = bar.text;
	const localOffset = offset - bar.start;

	let tokenStart = localOffset;
	let tokenEnd = localOffset;

	// 向左扩展到分隔符
	while (tokenStart > 0) {
		const ch = barText[tokenStart - 1];
		if (/\s/.test(ch) || /[{}()[\]|.:-]/.test(ch)) break;
		tokenStart--;
	}

	// 向右扩展到分隔符
	while (tokenEnd < barText.length) {
		const ch = barText[tokenEnd];
		if (/\s/.test(ch) || /[{}()[\]|.:-]/.test(ch)) break;
		tokenEnd++;
	}

	const token = barText.slice(tokenStart, tokenEnd).trim();
	if (!token) return null;

	return {
		token,
		start: bar.start + tokenStart,
		end: bar.start + tokenEnd,
	};
}

export function extractInitHeader(source: string): {
	initHeader: string | null;
	restStart: number;
} {
	const { opts, body } = parseInlineInit(source);
	if (!opts || Object.keys(opts).length === 0) {
		return { initHeader: null, restStart: 0 };
	}

	const initJson = JSON.stringify(opts, null, 2);
	const initHeader = `%%{init: ${initJson} }%%\n`;
	const restStart = source.length - body.length;

	return { initHeader, restStart };
}

export function makeFocusedBody(initHeader: string | null, barText: string): string {
	return initHeader ? initHeader + barText : barText;
}

export function getBarNumberAtOffset(source: string, offset: number): number | null {
	if (!source || offset < 0 || offset > source.length) return null;

	let barNumber = 0;
	let inCodeFence = false;
	let fenceStart = '';

	for (let i = 0; i < offset; i++) {
		const ch = source[i];
		const prev = i > 0 ? source[i - 1] : '';

		// 处理 code fence
		if (ch === '`' && !inCodeFence) {
			let backticks = 1;
			let j = i - 1;
			while (j >= 0 && source[j] === '`') {
				backticks++;
				j--;
			}
			if (backticks >= 3) {
				inCodeFence = true;
				fenceStart = source.slice(j + 1, i + 1);
				i = j;
				continue;
			}
		} else if (inCodeFence && ch === '`') {
			let backticks = 1;
			let j = i - 1;
			while (j >= 0 && source[j] === '`') {
				backticks++;
				j--;
			}
			if (backticks >= 3 && source.slice(j + 1, i + 1) === fenceStart) {
				inCodeFence = false;
				fenceStart = '';
				i = j;
				continue;
			}
		}

		if (inCodeFence) continue;

		// 计数未转义的 '|'
		if (ch === '|' && prev !== '\\') {
			barNumber++;
		}
	}

	return barNumber;
}

import * as alphaTab from "@coderline/alphatab";
import type { AlphaTexInitOptions } from "../markdown/AlphaTexBlock";

export function parseInlineInit(source: string): { opts: AlphaTexInitOptions; body: string } {
    let s = source;
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
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
            if (ch === '\\') { i += 2; continue; }
            if (ch === quote) { inString = false; quote = null; }
            i++;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = true; quote = ch as '"' | "'"; i++; continue; }
        if (ch === '{') { depth++; i++; continue; }
        if (ch === '}') { depth--; i++; if (depth === 0) break; continue; }
        i++;
    }
    if (depth !== 0) return { opts: {}, body: source };
    const jsonText = s.slice(objStart, i);
    let opts: AlphaTexInitOptions = {};
    try { opts = JSON.parse(jsonText) || {}; } catch { return { opts: {}, body: source }; }

    let k = i;
    while (k < s.length && /\s/.test(s[k])) k++;
    if (s[k] === '}') { k++; while (k < s.length && /\s/.test(s[k])) k++; }
    if (s.slice(k, k + 2) === '%%') k += 2;
    if (s[k] === '\r') k++;
    if (s[k] === '\n') k++;

    const consumed = k + (source.length - s.length);
    const body = source.slice(consumed);
    return { opts, body };
}

export function toScrollMode(value: number | string | undefined): number | undefined {
    if (value == null) return undefined;
    if (typeof value === "number") return value;
    const key = String(value).toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ScrollMode: any = (alphaTab as any).ScrollMode || {};
    const mapping: Record<string, number | undefined> = {
        continuous: ScrollMode.Continuous,
        singlepage: ScrollMode.SinglePage,
        page: ScrollMode.Page,
    };
    return mapping[key];
}

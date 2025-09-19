import { ViewPlugin, Decoration, WidgetType, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, RangeSet } from '@codemirror/state';

// Plugin to highlight dot symbols ('.') in the visible ranges
export function dotHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let pos = 0;
					while ((pos = text.indexOf('.', pos)) !== -1) {
						const start = from + pos;
						const end = start + 1;
						builder.add(start, end, Decoration.mark({ class: 'highlighted-dot' }));
						pos += 1;
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Plugin to highlight '|' symbols and add numbered widgets after them
export function barHighlightPlugin() {
	class BarNumberWidget extends WidgetType {
		constructor(private number: number) {
			super();
		}
		toDOM() {
			const span = document.createElement('span');
			span.className = 'bar-number';
			span.setAttribute('aria-hidden', 'true');
			span.textContent = this.number.toString();
			return span;
		}
	}

	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const doc = view.state.doc;

				for (const { from, to } of view.visibleRanges) {
					const text = doc.sliceString(from, to);

					// Compute startCount = number of '|' before this visible range
					let startCount = 0;
					if (from > 0) {
						const prefix = doc.sliceString(0, from);
						const m = prefix.match(/\|/g);
						startCount = m ? m.length : 0;
					}

					let pos = 0;
					while ((pos = text.indexOf('|', pos)) !== -1) {
						const abs = from + pos;
						startCount++;
						builder.add(abs, abs + 1, Decoration.mark({ class: 'highlighted-bar' }));
						builder.add(
							abs + 1,
							abs + 1,
							Decoration.widget({ widget: new BarNumberWidget(startCount), side: 1 })
						);
						pos += 1;
					}
				}

				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Plugin to highlight brackets () and braces {}
export function bracketHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					for (let pos = 0; pos < text.length; pos++) {
						const ch = text.charAt(pos);
						if (ch === '(' || ch === ')' || ch === '{' || ch === '}') {
							const start = from + pos;
							builder.add(start, start + 1, Decoration.mark({ class: 'cm-bracket' }));
						}
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Plugin to highlight metadata starting with backslash, e.g. \title, \tempo
export function metaHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const metaRegex = /\\[A-Za-z0-9_-]+/g;
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					while ((match = metaRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-metadata' }));
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Plugin to highlight line comments starting with // until end of line
export function commentHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let pos = 0;
					while ((pos = text.indexOf('//', pos)) !== -1) {
						const lineEnd = (() => {
							const nl = text.indexOf('\n', pos + 2);
							return nl === -1 ? text.length : nl;
						})();
						const start = from + pos;
						const end = from + lineEnd;
						builder.add(start, end, Decoration.mark({ class: 'cm-comment' }));
						pos = lineEnd + 1;
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Debug plugin: lightweight visible-range lexer that marks many AlphaTex terminals
// with high-contrast debug classes for visual inspection (no semantic parsing).
export function debugHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const doc = view.state.doc;

				const stringRegex = /"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/g;
				const metaRegex = /\\[A-Za-z_][A-Za-z0-9_-]*/g; // \tag
				const noteRegex = /(?:[0-9x-]+)\.[0-9]+(?:\.[0-9]+)?/g; // 3.3.4
				const doubleDotRegex = /:[0-9]+/g; // :4
				const multiplyRegex = /\*[0-9]+/g; // *4
				const numberRegex = /-?\b[0-9]+(?:\.[0-9]+)?\b/g;
				const lbraceRegex = /\{/g;
				const rbraceRegex = /\}/g;
				const lparRegex = /\(/g;
				const rparRegex = /\)/g;
				const pipeRegex = /\|/g;
				const lessThanRegex = /</g;

				for (const { from, to } of view.visibleRanges) {
					const text = doc.sliceString(from, to);

					// 1) Strings first (to avoid inner matches)
					let m: RegExpExecArray | null;
					stringRegex.lastIndex = 0;
					while ((m = stringRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(
							s,
							s + m[0].length,
							Decoration.mark({ class: 'cm-debug-string' })
						);
					}

					// 2) Meta commands (\title etc.)
					metaRegex.lastIndex = 0;
					while ((m = metaRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(
							s,
							s + m[0].length,
							Decoration.mark({ class: 'cm-debug-meta' })
						);
					}

					// 3) Effect blocks { ... } - mark block and inner keys/args
					while ((m = /\{[^}]*\}/g.exec(text)) !== null) {
						const start = from + m.index;
						const end = start + m[0].length;
						builder.add(
							start,
							start + 1,
							Decoration.mark({ class: 'cm-debug-lbrace' })
						);
						builder.add(end - 1, end, Decoration.mark({ class: 'cm-debug-rbrace' }));

						// scan inner content for effect keys (words) and numbers
						const inner = m[0].slice(1, -1);
						const wordRegex = /[A-Za-z]+/g;
						const numRegex = /-?\d+(?:\.\d+)?/g;
						while ((m = wordRegex.exec(inner)) !== null) {
							const s = start + 1 + m.index;
							builder.add(
								s,
								s + m[0].length,
								Decoration.mark({ class: 'cm-debug-effect-key' })
							);
						}
						while ((m = numRegex.exec(inner)) !== null) {
							const s = start + 1 + m.index;
							builder.add(
								s,
								s + m[0].length,
								Decoration.mark({ class: 'cm-debug-effect-arg' })
							);
						}
					}

					// 4) Notes
					noteRegex.lastIndex = 0;
					while ((m = noteRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(
							s,
							s + m[0].length,
							Decoration.mark({ class: 'cm-debug-note' })
						);
					}

					// 5) duration ranges :4
					doubleDotRegex.lastIndex = 0;
					while ((m = doubleDotRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(
							s,
							s + m[0].length,
							Decoration.mark({ class: 'cm-debug-duration' })
						);
					}

					// 6) multiply *4
					multiplyRegex.lastIndex = 0;
					while ((m = multiplyRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(
							s,
							s + m[0].length,
							Decoration.mark({ class: 'cm-debug-multiply' })
						);
					}

					// 7) numbers
					numberRegex.lastIndex = 0;
					while ((m = numberRegex.exec(text)) !== null) {
						const s = from + m.index;
						// skip if already covered by note or duration or multiply (best-effort)
						// naive check: if any decoration already exists at pos, skip marking number.
						builder.add(
							s,
							s + m[0].length,
							Decoration.mark({ class: 'cm-debug-number' })
						);
					}

					// 8) parentheses and braces
					lparRegex.lastIndex = 0;
					while ((m = lparRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-lparen' }));
					}
					rparRegex.lastIndex = 0;
					while ((m = rparRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-rparen' }));
					}

					lbraceRegex.lastIndex = 0;
					while ((m = lbraceRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-lbrace' }));
					}
					rbraceRegex.lastIndex = 0;
					while ((m = rbraceRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-rbrace' }));
					}

					// 9) pipe
					pipeRegex.lastIndex = 0;
					while ((m = pipeRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-pipe' }));
					}

					// 10) less-than
					lessThanRegex.lastIndex = 0;
					while ((m = lessThanRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-lessthan' }));
					}

					// 11) standalone dot (section separator) - crude: dot followed by space or line end
					const dotRegex = /\.(?=\s|$|\n|\|)/g;
					dotRegex.lastIndex = 0;
					while ((m = dotRegex.exec(text)) !== null) {
						const s = from + m.index;
						builder.add(s, s + 1, Decoration.mark({ class: 'cm-debug-dot' }));
					}
				}

				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Plugin to highlight visible whitespace (spaces and tabs) with a background
export function whitespaceHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const doc = view.state.doc;
				const wsRegex = /[ \t]/g;
				for (const { from, to } of view.visibleRanges) {
					const text = doc.sliceString(from, to);
					let m: RegExpExecArray | null;
					wsRegex.lastIndex = 0;
					while ((m = wsRegex.exec(text)) !== null) {
						const s = from + m.index;
						const ch = m[0];
						if (ch === ' ') {
							// regular space: render as a visible dot and keep original bg
							builder.add(
								s,
								s + 1,
								Decoration.mark({ class: 'cm-whitespace-space' })
							);
						} else {
							// other whitespace (tab): highlight with hover background
							builder.add(s, s + 1, Decoration.mark({ class: 'cm-whitespace' }));
						}
					}
				}
				return builder.finish();
			}
		},
		{ decorations: (v: any) => v.decorations }
	);
}

// Plugin to highlight sequences that are surrounded by spaces or newlines (excluding the spaces themselves)
export function surroundedHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const doc = view.state.doc;

				for (const { from, to } of view.visibleRanges) {
					const text = doc.sliceString(from, to);
					let i = 0;

					const matchingClose = (absStart: number, openChar: string): number => {
						const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
						const closeChar = pairs[openChar];
						if (!closeChar) return -1;
						let depth = 0;
						// scan the document from absStart (inclusive) forward
						for (let p = absStart; p < doc.length; p++) {
							const ch = doc.sliceString(p, p + 1);
							if (ch === openChar) depth++;
							else if (ch === closeChar) {
								depth--;
								if (depth === 0) return p; // absolute index of matching close
							}
						}
						return -1;
					};

					while (i < text.length) {
						const ch = text.charAt(i);
						// if we encounter an opening bracket, try to find its matching close in the doc
						if (ch === '(' || ch === '{' || ch === '[') {
							const absOpen = from + i;
							const absClose = matchingClose(absOpen, ch);
							if (absClose !== -1 && absClose > absOpen + 1) {
								// mark inner content as a single surrounded region (exclude the brackets themselves)
								const innerStart = absOpen + 1;
								const innerEnd = absClose;
								builder.add(
									innerStart,
									innerEnd,
									Decoration.mark({ class: 'cm-surrounded' })
								);
								// advance i to after the close if it's within this visible chunk, otherwise end scanning
								if (absClose < to) {
									i = absClose - from + 1;
									continue;
								} else {
									// close is outside this visible range; stop processing this chunk
									break;
								}
							}
						}
						// skip whitespace
						if (/\s/.test(ch)) {
							i++;
							continue;
						}
						// start of candidate word/sequence
						const startInRange = i;
						i++;
						while (i < text.length && !/\s/.test(text.charAt(i))) i++;
						const endInRange = i; // exclusive

						// determine left boundary char
						let leftChar: string | null = null;
						if (startInRange > 0) leftChar = text.charAt(startInRange - 1);
						else if (from > 0) leftChar = doc.sliceString(from - 1, from);

						// determine right boundary char
						let rightChar: string | null = null;
						if (endInRange < text.length) rightChar = text.charAt(endInRange);
						else if (to < doc.length) rightChar = doc.sliceString(to, to + 1);

						const leftOk = leftChar === null || /\s/.test(leftChar);
						const rightOk = rightChar === null || /\s/.test(rightChar);

						if (leftOk && rightOk) {
							const absStart = from + startInRange;
							const absEnd = from + endInRange;
							builder.add(
								absStart,
								absEnd,
								Decoration.mark({ class: 'cm-surrounded' })
							);
						}
					}
				}

				return builder.finish();
			}
		},
		{ decorations: (v: any) => v.decorations }
	);
}

// New plugin for beat-duration :[0-9]+
export function durationHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const durationRegex = /:[0-9]+/g;
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					while ((match = durationRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-duration' }));
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// New plugin for effect keywords (beat and note)
export function effectHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const beatEffectsRegex =
					/(f|fo|vs|v|vw|s|p|tt|txt|lyrics|dd|d|su|sd|tuplet|tb|tbe|bu|bd|ai|ad|ch|gr|ob|b|dy|cre|dec|tempo|volume|balance|tp|spd|sph|spu|spe|slashed|glpf|glpt|waho|wahc|barre|rasg|ot|legaoorigin|instrument|bank|fermata|beam|timer)/g;
				const noteEffectsRegex =
					/(b|be|nh|ah|th|ph|sh|fh|tr|v|vw|sl|ss|sib|sia|sou|sod|psd|psu|h|lht|g|ac|hac|ten|pm|st|lr|x|t|lf|rf|acc|turn|iturn|umordent|lmordent|string|hide|slur)/g;
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					beatEffectsRegex.lastIndex = 0;
					while ((match = beatEffectsRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-effect-beat' }));
					}
					noteEffectsRegex.lastIndex = 0;
					while ((match = noteEffectsRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-effect-note' }));
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Re-purposed plugin: highlight chord-like literals using the previous "tuning" visual style (cm-tuning)
// Recognizes examples like: Am7, Bm/D, G/B, Cadd9, G, F
export function tuningHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				// chord-like pattern: root (A-G/a-g), optional accidental, optional minor/major marker,
				// optional numeric degree, optional extension keywords (sus/add/dim/aug/maj), optional slash bass
				const chordRegex =
					/\b[A-Ga-g][#b]?(?:m|M)?[0-9]*(?:sus|add|dim|aug|maj)?[0-9]*(?:\/[A-Ga-g][#b]?)?[0-9]*\b/g;
				const doc = view.state.doc;
				for (const { from, to } of view.visibleRanges) {
					const text = doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					chordRegex.lastIndex = 0;
					while ((match = chordRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-tuning' }));
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// New plugin for boolean literals true/false
export function booleanHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				const booleanRegex = /\b(true|false)\b/g;
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					while ((match = booleanRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-boolean' }));
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

// Updated metaHighlightPlugin for 'metadata' token

// Plugin to highlight chord literals (guitar chords like Bm/D, Cadd9, G/B, Am7, G, F, B7, Em)
export function chordHighlightPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: RangeSet<Decoration>;
			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView): RangeSet<Decoration> {
				const builder = new RangeSetBuilder<Decoration>();
				// Pattern: [A-G][#b]?[mM]?[0-9]*[sus|add|dim|aug|maj]?[0-9]*[/[A-G][#b]?]?[0-9]*
				const chordRegex =
					/[A-G][#b]?[mM]?[0-9]*(?:sus|add|dim|aug|maj)?[0-9]*(?:\/[A-G][#b]?)?[0-9]*/g;
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					while ((match = chordRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-chord' }));
					}
				}
				return builder.finish();
			}
		},
		{
			decorations: (value: any) => value.decorations,
		}
	);
}

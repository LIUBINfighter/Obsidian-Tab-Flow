import {
	ViewPlugin,
	Decoration,
	DecorationSet,
	WidgetType,
	EditorView,
	ViewUpdate,
} from '@codemirror/view';
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
			span.textContent = this.number.toString();
			return span;
		}
	}

	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			buildDecorations(view: EditorView): DecorationSet {
				const builder = new RangeSetBuilder<Decoration>();
				const doc = view.state.doc;
				let barCount = 0;

				for (let i = 0; i < doc.length; i++) {
					if (doc.sliceString(i, i + 1) === '|') {
						barCount++;
						builder.add(i, i + 1, Decoration.mark({ class: 'highlighted-bar' }));
						builder.add(
							i + 1,
							i + 1,
							Decoration.widget({
								widget: new BarNumberWidget(barCount),
								block: false,
							})
						);
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
				const metaRegex = /\\[A-Za-z0-9_-]+/g; // matches \word or \word-1
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match: RegExpExecArray | null;
					while ((match = metaRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(start, end, Decoration.mark({ class: 'cm-meta' }));
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

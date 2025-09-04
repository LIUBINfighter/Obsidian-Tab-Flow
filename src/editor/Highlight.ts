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

/**
 * AlphaTex CodeMirror Editor
 *
 * A clean implementation using CodeMirror 6 directly, without relying on
 * Obsidian's private APIs. This provides better stability and maintainability.
 */

import { EditorView, ViewUpdate, placeholder, keymap } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches } from '@codemirror/search';
import { alphaTex } from './alphaTexLanguage';
import {
	dotHighlightPlugin,
	barHighlightPlugin,
	bracketHighlightPlugin,
	metaHighlightPlugin,
	commentHighlightPlugin,
	debugHighlightPlugin,
	whitespaceHighlightPlugin,
	surroundedHighlightPlugin,
	durationHighlightPlugin,
	effectHighlightPlugin,
	tuningHighlightPlugin,
	booleanHighlightPlugin,
	chordHighlightPlugin,
} from './Highlight';

export interface AlphaTexEditorOptions {
	value?: string;
	placeholder?: string;
	onChange?: (update: ViewUpdate) => void;
	highlightSettings?: Record<string, boolean>;
	cls?: string;
}

/**
 * Default highlight settings
 */
const DEFAULT_HIGHLIGHT_SETTINGS: Record<string, boolean> = {
	dot: true,
	bar: true,
	bracket: true,
	meta: true,
	comment: true,
	debug: false,
	whitespace: false,
	surrounded: false,
	duration: true,
	effect: true,
	tuning: true,
	boolean: true,
	chord: true,
};

/**
 * Build highlight extensions based on settings
 */
function buildHighlightExtensions(highlightSettings: Record<string, boolean> = {}): Extension[] {
	const settings = { ...DEFAULT_HIGHLIGHT_SETTINGS, ...highlightSettings };
	const extensions: Extension[] = [];

	if (settings.dot) extensions.push(dotHighlightPlugin());
	if (settings.bar) extensions.push(barHighlightPlugin());
	if (settings.bracket) extensions.push(bracketHighlightPlugin());
	if (settings.meta) extensions.push(metaHighlightPlugin());
	if (settings.comment) extensions.push(commentHighlightPlugin());
	if (settings.debug) extensions.push(debugHighlightPlugin());
	if (settings.whitespace) extensions.push(whitespaceHighlightPlugin());
	if (settings.surrounded) extensions.push(surroundedHighlightPlugin());
	if (settings.duration) extensions.push(durationHighlightPlugin());
	if (settings.effect) extensions.push(effectHighlightPlugin());
	if (settings.tuning) extensions.push(tuningHighlightPlugin());
	if (settings.boolean) extensions.push(booleanHighlightPlugin());
	if (settings.chord) extensions.push(chordHighlightPlugin());

	return extensions;
}

/**
 * AlphaTex CodeMirror Editor
 *
 * A clean, maintainable editor implementation using CodeMirror 6 directly.
 */
export class AlphaTexCodeMirrorEditor {
	private view: EditorView | null = null;
	private container: HTMLElement;
	private options: AlphaTexEditorOptions;
	private _loaded = false;

	constructor(container: HTMLElement, options: AlphaTexEditorOptions = {}) {
		this.container = container;
		this.options = options;

		// Build extensions
		const extensions: Extension[] = [
			// Basic editor features
			// lineNumbers(), // Disabled - no line numbers needed
			EditorView.lineWrapping, // Enable automatic line wrapping
			history(),
			bracketMatching(),
			closeBrackets(),
			highlightSelectionMatches(),
			// Keymaps
			keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
			// AlphaTex language support
			...alphaTex(),
			// Highlight plugins
			...buildHighlightExtensions(options.highlightSettings),
		];

		// Add placeholder if provided
		if (options.placeholder) {
			extensions.push(placeholder(options.placeholder));
		}

		// Add onChange listener
		if (options.onChange) {
			extensions.push(
				EditorView.updateListener.of((update: ViewUpdate) => {
					if (update.docChanged) {
						options.onChange?.(update);
					}
					// Force line numbers to sync with content on viewport changes
					if (update.viewportChanged || update.docChanged) {
						// Trigger a re-measurement of line number gutter
						requestAnimationFrame(() => {
							if (this.view) {
								// Force CodeMirror to recalculate gutter heights
								this.view.requestMeasure();
							}
						});
					}
				})
			);
		}

		// Add custom class if provided
		if (options.cls) {
			container.classList.add(options.cls);
		}

		// Create editor state
		const state = EditorState.create({
			doc: options.value || '',
			extensions,
		});

		// Create editor view
		this.view = new EditorView({
			state,
			parent: container,
		});

		// Force initial measurement and sync line numbers
		requestAnimationFrame(() => {
			if (this.view) {
				this.view.requestMeasure();
				// Also trigger a scroll event to force line number sync
				const scroller = container.querySelector('.cm-scroller');
				if (scroller) {
					scroller.addEventListener(
						'scroll',
						() => {
							if (this.view) {
								this.view.requestMeasure();
							}
						},
						{ passive: true }
					);
				}
			}
		});

		this._loaded = true;
	}

	/**
	 * Get the current editor value
	 */
	get value(): string {
		if (!this.view) return '';
		return this.view.state.doc.toString();
	}

	/**
	 * Set the editor value
	 */
	set value(content: string) {
		if (!this.view) return;
		this.view.dispatch({
			changes: {
				from: 0,
				to: this.view.state.doc.length,
				insert: content,
			},
		});
	}

	/**
	 * Set content with optional focus
	 */
	set(content: string, focus = false): void {
		this.value = content;
		if (focus) {
			this.focus();
		}
	}

	/**
	 * Focus the editor
	 */
	focus(): void {
		this.view?.focus();
	}

	/**
	 * Get the cursor position
	 */
	getCursorPosition(): number {
		if (!this.view) return 0;
		return this.view.state.selection.main.head;
	}

	/**
	 * Check if editor is loaded
	 */
	get loaded(): boolean {
		return this._loaded && this.view !== null;
	}

	/**
	 * Get the editor view (for advanced usage)
	 */
	get editorView(): EditorView | null {
		return this.view;
	}

	/**
	 * Destroy the editor
	 */
	destroy(): void {
		if (this.view) {
			this.view.destroy();
			this.view = null;
		}
		this._loaded = false;
	}
}

/**
 * Factory function to create an AlphaTex editor
 */
export function createAlphaTexEditor(
	container: HTMLElement,
	options: AlphaTexEditorOptions = {}
): AlphaTexCodeMirrorEditor {
	return new AlphaTexCodeMirrorEditor(container, options);
}

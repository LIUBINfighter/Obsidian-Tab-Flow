/*
 * Internal dynamic wrapper for embedding Obsidian markdown editor.
 * NOTE: Relies on private APIs; we intentionally relax lint rules for dynamic access.
 */
import { App, Scope, TFile, WorkspaceLeaf } from 'obsidian';
import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder, ViewUpdate, ViewPlugin } from '@codemirror/view';
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
	// chordHighlightPlugin,
} from './Highlight';
import { alphaTex } from './alphaTexLanguage';
import { around } from 'monkey-around';

export interface MarkdownEditorProps {
	cursorLocation?: { anchor: number; head: number };
	value?: string;
	cls?: string;
	placeholder?: string;
	singleLine?: boolean;
	onEnter?: (editor: EmbeddableMarkdownEditor, mod: boolean, shift: boolean) => boolean;
	onEscape?: (editor: EmbeddableMarkdownEditor) => void;
	onSubmit?: (editor: EmbeddableMarkdownEditor) => void;
	onBlur?: (editor: EmbeddableMarkdownEditor) => void;
	onPaste?: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
	onChange?: (update: ViewUpdate) => void;
	// optional map of highlight plugin toggles passed from caller
	highlightSettings?: Record<string, boolean>;
}

const defaultProperties: Required<Omit<MarkdownEditorProps, 'cursorLocation'>> & {
	cursorLocation: { anchor: number; head: number };
} = {
	cursorLocation: { anchor: 0, head: 0 },
	value: '',
	singleLine: false,
	cls: '',
	placeholder: '',
	onEnter: () => false,
	onEscape: () => {},
	onSubmit: () => {},
	onBlur: () => {},
	onPaste: () => {},
	onChange: () => {},
	highlightSettings: {},
};

interface InternalMarkdownEditor extends Record<string, unknown> {
	editorEl: HTMLElement;
	containerEl: HTMLElement;
	activeCM: EditorView;
	app: App;
	_loaded: boolean;
	set: (content: string, focus?: boolean) => void;
	register: (cb: unknown) => void;
	unload?: () => void;
	destroy?: () => void;
	onUpdate?: (update: ViewUpdate, changed: boolean) => void;
	editor?: { cm?: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } };
}

export class EmbeddableMarkdownEditor {
	private options: typeof defaultProperties & MarkdownEditorProps;
	private initialValue: string;
	private scope: Scope;
	private editor?: InternalMarkdownEditor;

	/**
	 * Hard-coded configuration to control whether to set activeEditor.
	 *
	 * Pros of setting activeEditor:
	 * - Allows the embedded editor to receive keyboard shortcuts and commands properly.
	 * - Maintains compatibility with Obsidian's command system.
	 *
	 * Cons of setting activeEditor:
	 * - May cause "Cannot read properties of undefined" errors if not handled properly.
	 * - Potential conflicts with multiple editor instances.
	 * - Can interfere with Obsidian's internal activeEditor management.
	 *
	 * Set to true to enable activeEditor management, false to disable.
	 */
	private static readonly USE_ACTIVE_EDITOR = true;

	constructor(
		app: App,
		EditorClass: new (...args: unknown[]) => InternalMarkdownEditor,
		container: HTMLElement,
		options: Partial<MarkdownEditorProps>
	) {
		this.options = { ...defaultProperties, ...options };
		this.initialValue = this.options.value || '';
		this.scope = new Scope(app.scope);
		this.scope.register(['Mod'], 'Enter', () => true);

		// Disable no-this-alias: Need stable reference for monkey-patching hooks
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const selfRef = this; // capture instance for function-based hooks
		const uninstaller = around(EditorClass.prototype, {
			buildLocalExtensions: (originalMethod: (this: InternalMarkdownEditor) => unknown[]) =>
				function (this: InternalMarkdownEditor) {
					const extensions = originalMethod.call(this) || [];
					// Note: selfRef.editor is set after EditorClass instantiation, so we check if this instance
					// matches the one that will be assigned to selfRef.editor by comparing after assignment
					// For now, we'll apply extensions to all instances and rely on the editor being set correctly
					const editorRef = selfRef.editor;
					// Only apply extensions if editor is already set and matches
					// During initial construction, editorRef will be undefined, so we apply to all instances
					// After editor is set, we only apply to the matching instance
					if (editorRef === undefined || this === editorRef) {
						if (selfRef.options.placeholder)
							extensions.push(placeholder(selfRef.options.placeholder));
						// Disable browser spellcheck/auto-correct in the embedded editor
						extensions.push(
							EditorView.editorAttributes.of({
								spellcheck: 'false',
								autocorrect: 'off',
								autocapitalize: 'off',
							})
						);
						extensions.push(
							EditorView.domEventHandlers({
								paste: (event) => selfRef.options.onPaste?.(event, selfRef),
								blur: () => {
									app.keymap.popScope(selfRef.scope);
									const activeEditor = Reflect.get(app.workspace, 'activeEditor') as unknown;
									if (
										EmbeddableMarkdownEditor.USE_ACTIVE_EDITOR &&
										activeEditor === selfRef.editor
									) {
										Reflect.set(app.workspace, 'activeEditor', null);
									}
									selfRef.options.onBlur?.(selfRef);
								},
								focusin: () => {
									app.keymap.pushScope(selfRef.scope);
									if (EmbeddableMarkdownEditor.USE_ACTIVE_EDITOR) {
										Reflect.set(app.workspace, 'activeEditor', selfRef.editor ?? null);
									}
								},
							})
						);
						const keyBindings = [
							{
								key: 'Enter',
								run: () => selfRef.options.onEnter?.(selfRef, false, false),
								shift: () => selfRef.options.onEnter?.(selfRef, false, true),
							},
							{
								key: 'Mod-Enter',
								run: () => selfRef.options.onEnter?.(selfRef, true, false),
								shift: () => selfRef.options.onEnter?.(selfRef, true, true),
							},
							{
								key: 'Escape',
								run: () => {
									selfRef.options.onEscape?.(selfRef);
									return true;
								},
								preventDefault: true,
							},
						];
						if (selfRef.options.singleLine) {
							keyBindings[0] = {
								key: 'Enter',
								run: () => selfRef.options.onEnter?.(selfRef, false, false),
								shift: () => selfRef.options.onEnter?.(selfRef, false, true),
							};
						}
						extensions.push(Prec.highest(keymap.of(keyBindings)));
						// Add highlight plugins extracted to separate module
						// Resolve highlight settings: prefer explicit options, fallback to global plugin settings if available
						const resolveSetting = (key: string, def = true) => {
							try {
								if (
									selfRef.options.highlightSettings &&
									key in selfRef.options.highlightSettings
								) {
									return !!selfRef.options.highlightSettings[key];
								}
								// fallback: some callers may expose settings on window for minimal changes
								const globalSettings = Reflect.get(
									window,
									'__tabflow_settings__'
								) as {
									editorHighlights?: Record<string, boolean>;
								} | null;
								if (
									globalSettings &&
									globalSettings.editorHighlights &&
									key in globalSettings.editorHighlights
								) {
									return !!globalSettings.editorHighlights[key];
								}
							} catch {
								// ignore
							}
							return def;
						};

						// (dot and bar highlight plugins are imported from ./Highlight.ts)
						if (resolveSetting('dot', true)) extensions.push(dotHighlightPlugin());
						if (resolveSetting('bar', true)) extensions.push(barHighlightPlugin());
						// visible whitespace highlighter
						if (resolveSetting('whitespace', true))
							extensions.push(whitespaceHighlightPlugin());
						// highlight sequences surrounded by whitespace
						if (resolveSetting('surrounded', false))
							extensions.push(surroundedHighlightPlugin());
						// Ensure spellcheck/auto-correct attributes are applied to the actual contenteditable area
						const disableSpellcheckPlugin = ViewPlugin.fromClass(
							class {
								private view: EditorView;
								private observer?: MutationObserver;
								constructor(view: EditorView) {
									this.view = view;
									this.applyAttrs();
									// Observe DOM changes in case .cm-content is created later
									try {
										this.observer = new MutationObserver(() =>
											this.applyAttrs()
										);
										this.observer.observe(this.view.dom, {
											childList: true,
											subtree: true,
										});
									} catch {
										// ignore if MutationObserver not available in environment
									}
								}
								private applyAttrs() {
									const content = this.view.dom.querySelector('.cm-content');
									if (content) {
										content.setAttribute('spellcheck', 'false');
										content.setAttribute('autocorrect', 'off');
										content.setAttribute('autocapitalize', 'off');
									}
								}
								update(update: ViewUpdate) {
									// Re-apply on updates as well
									this.applyAttrs();
								}
								destroy() {
									this.observer?.disconnect();
								}
							}
						);
						extensions.push(disableSpellcheckPlugin);
						// Keep editorAttributes as well for broader support
						extensions.push(
							EditorView.editorAttributes.of({
								spellcheck: 'false',
								autocorrect: 'off',
								autocapitalize: 'off',
							})
						);
						if (resolveSetting('bracket', true))
							extensions.push(bracketHighlightPlugin());
						if (resolveSetting('meta', true)) extensions.push(metaHighlightPlugin());
						if (resolveSetting('comment', true))
							extensions.push(commentHighlightPlugin());
						// Debugging visible-range lexer/highlighter
						if (resolveSetting('debug', false)) extensions.push(debugHighlightPlugin());
						// Inject AlphaTex language/highlighting
						try {
							const alphaExt = alphaTex();
							if (Array.isArray(alphaExt)) extensions.push(...alphaExt);
							else extensions.push(alphaExt);
						} catch {
							// fail gracefully if alphaTex isn't available in runtime
						}
						// Add new highlight plugins for TextMate-inspired tokens
						if (resolveSetting('duration', true))
							extensions.push(durationHighlightPlugin());
						if (resolveSetting('effect', true))
							extensions.push(effectHighlightPlugin());
						if (resolveSetting('tuning', true))
							extensions.push(tuningHighlightPlugin());
						if (resolveSetting('boolean', true))
							extensions.push(booleanHighlightPlugin());
						// chord highlighting is now handled by the repurposed tuningHighlightPlugin
						// Update meta to use 'cm-metadata' (ensure meta present if enabled)
						if (resolveSetting('meta', true)) extensions.push(metaHighlightPlugin());
					}
					return extensions;
				},
		});

		this.editor = new EditorClass(app, container, {
			app,
			onMarkdownScroll: () => {},
			getMode: () => 'source',
		});
		const editorInstance = this.editor;
		if (!editorInstance) {
			throw new Error('Failed to initialise editor instance');
		}
		editorInstance.register?.(uninstaller);
		this.set(this.initialValue, false);
		editorInstance.register?.(
			around(app.workspace, {
				setActiveLeaf:
					(oldMethod: unknown) =>
					(leaf: WorkspaceLeaf, ...args: unknown[]) => {
						if (!this.activeCM?.hasFocus) {
							interface OldMethod {
								call?: (thisArg: unknown, ...args: unknown[]) => void;
							}
							(oldMethod as OldMethod).call?.(app.workspace, leaf, ...args);
						}
					},
			})
		);
		if (options.cls && this.editorEl) this.editorEl.classList.add(options.cls);
		if (options.cursorLocation && editorInstance.editor?.cm) {
			editorInstance.editor.cm.dispatch({
				selection: EditorSelection.range(
					options.cursorLocation.anchor,
					options.cursorLocation.head
				),
			});
		}
		const originalOnUpdate = editorInstance.onUpdate?.bind(editorInstance);
		editorInstance.onUpdate = (update: ViewUpdate, changed: boolean) => {
			try {
				const root = update.view?.root;
				const inDom = Boolean(this.editorEl?.isConnected);
				const embeddedEditor = this.editor;
				const stillLoaded =
					Boolean(embeddedEditor?.activeCM) || Boolean(embeddedEditor?._loaded);
				if (!root || !inDom || !stillLoaded) return;
				originalOnUpdate?.(update, changed);
				if (changed) this.options.onChange?.(update);
			} catch {
				// 静默吞掉外部编辑器销毁期间的偶发更新
			}
		};
	}

	private requireEditor(): InternalMarkdownEditor {
		if (!this.editor) {
			throw new Error('Embedded markdown editor not initialised yet.');
		}
		return this.editor;
	}

	get editorEl(): HTMLElement {
		return this.requireEditor().editorEl;
	}
	get containerEl(): HTMLElement {
		return this.requireEditor().containerEl;
	}
	get activeCM(): EditorView {
		return this.requireEditor().activeCM;
	}
	get appInstance(): App {
		return this.requireEditor().app;
	}
	get loaded(): boolean {
		return this.requireEditor()._loaded;
	}
	get value(): string {
		return this.requireEditor().editor?.cm?.state.doc.toString() || '';
	}
	set(content: string, focus = false): void {
		this.requireEditor().set(content, focus);
	}
	register(cb: unknown): void {
		this.requireEditor().register(cb);
	}
	focus(): void {
		this.activeCM?.focus();
	}
	destroy(): void {
		const editorInstance = this.editor;
		if (editorInstance && this.loaded && typeof editorInstance.unload === 'function') {
			editorInstance.unload();
		}
		this.appInstance.keymap.popScope(this.scope);
		if (EmbeddableMarkdownEditor.USE_ACTIVE_EDITOR) {
			Reflect.set(this.appInstance.workspace, 'activeEditor', null);
		}
		this.containerEl.empty();
		editorInstance?.destroy?.();
		this.editor = undefined;
	}
	unload(): void {
		this.destroy();
	}
}

function resolveEditorPrototype(app: App): unknown {
	// 使用类型守卫替代类型转换，避免绕过TypeScript类型检查
	const embedRegistry = (
		app as {
			embedRegistry?: {
				embedByExtension?: {
					md?: (options: unknown, file: TFile | null, extension: string) => unknown;
				};
			};
		}
	).embedRegistry;
	if (!embedRegistry?.embedByExtension?.md) {
		throw new Error('Obsidian embed registry not available or markdown embedder not found');
	}

	const widgetEditorView = embedRegistry.embedByExtension.md(
		{ app, containerEl: createDiv() },
		null,
		''
	);
	interface WidgetEditorView {
		editable?: boolean;
		showEditor?: () => void;
		editMode?: {
			constructor?: unknown;
		};
		unload?: () => void;
	}
	const widget = widgetEditorView as WidgetEditorView;
	widget.editable = true;
	widget.showEditor?.();
	const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(widget.editMode!));
	widget.unload?.();
	return MarkdownEditor.constructor;
}

export function createEmbeddableMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: Partial<MarkdownEditorProps> = {}
): EmbeddableMarkdownEditor {
	const EditorClass = resolveEditorPrototype(app);
	return new EmbeddableMarkdownEditor(
		app,
		EditorClass as new (...args: unknown[]) => InternalMarkdownEditor,
		container,
		options
	);
}

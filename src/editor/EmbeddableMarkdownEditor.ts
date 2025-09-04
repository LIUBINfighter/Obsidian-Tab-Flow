/*
 * Internal dynamic wrapper for embedding Obsidian markdown editor.
 * NOTE: Relies on private APIs; we intentionally relax lint rules for dynamic access.
 */
import { App, Scope, TFile, WorkspaceLeaf } from 'obsidian';
import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder, ViewUpdate } from '@codemirror/view';
import { dotHighlightPlugin, barHighlightPlugin } from './Highlight';
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
	private editor: InternalMarkdownEditor;

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
		EditorClass: new (...args: any[]) => InternalMarkdownEditor,
		container: HTMLElement,
		options: Partial<MarkdownEditorProps>
	) {
		this.options = { ...defaultProperties, ...options } as any;
		this.initialValue = this.options.value || '';
		this.scope = new Scope(app.scope);
		this.scope.register(['Mod'], 'Enter', () => true);

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const selfRef = this; // capture instance for function-based hooks
		const uninstaller = around(EditorClass.prototype, {
			buildLocalExtensions: (originalMethod: (this: InternalMarkdownEditor) => unknown[]) =>
				function (this: InternalMarkdownEditor) {
					const extensions = originalMethod.call(this) || [];
					if (this === (selfRef as any).editor) {
						if (selfRef.options.placeholder)
							extensions.push(placeholder(selfRef.options.placeholder));
						extensions.push(
							EditorView.domEventHandlers({
								paste: (event) => selfRef.options.onPaste?.(event, selfRef),
								blur: () => {
									app.keymap.popScope(selfRef.scope);
									if (
										EmbeddableMarkdownEditor.USE_ACTIVE_EDITOR &&
										(app.workspace as any).activeEditor === selfRef.editor
									) {
										(app.workspace as any).activeEditor = null;
									}
									selfRef.options.onBlur?.(selfRef);
								},
								focusin: () => {
									app.keymap.pushScope(selfRef.scope);
									if (EmbeddableMarkdownEditor.USE_ACTIVE_EDITOR) {
										(app.workspace as any).activeEditor = selfRef.editor;
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
							} as any;
						}
						extensions.push(Prec.highest(keymap.of(keyBindings as any)));
						// Add highlight plugins extracted to separate module
						// ...existing code...
						// (dot and bar highlight plugins are imported from ./Highlight.ts)
						extensions.push(dotHighlightPlugin());
						extensions.push(barHighlightPlugin());
					}
					return extensions;
				},
		});

		this.editor = new EditorClass(app, container, {
			app,
			onMarkdownScroll: () => {},
			getMode: () => 'source',
		}) as InternalMarkdownEditor;
		(this.editor as any).register?.(uninstaller);
		this.set(this.initialValue, false);
		(this.editor as any).register?.(
			around(app.workspace, {
				setActiveLeaf:
					(oldMethod: any) =>
					(leaf: WorkspaceLeaf, ...args: unknown[]) => {
						if (!this.activeCM?.hasFocus) oldMethod.call(app.workspace, leaf, ...args);
					},
			})
		);
		if (options.cls && this.editorEl) this.editorEl.classList.add(options.cls);
		if (options.cursorLocation && this.editor.editor?.cm) {
			this.editor.editor.cm.dispatch({
				selection: EditorSelection.range(
					options.cursorLocation.anchor,
					options.cursorLocation.head
				),
			});
		}
		const originalOnUpdate = this.editor.onUpdate?.bind(this.editor);
		this.editor.onUpdate = (update: ViewUpdate, changed: boolean) => {
			try {
				// 保护：在视图未就绪或已卸载时不调用后续逻辑，避免 selection 相关错误
				const hasView = !!(update as any)?.view;
				const root = (update as any)?.view?.root;
				const rootOk = !!root && typeof root.getSelection === 'function';
				const inDom = !!this.editorEl?.isConnected;
				const stillLoaded = !!(this as any).editor?.activeCM || !!(this as any)._loaded;
				if (!hasView || !rootOk || !inDom || !stillLoaded) return;
				originalOnUpdate?.(update, changed);
				if (changed) this.options.onChange?.(update);
			} catch {
				// 静默吞掉外部编辑器销毁期间的偶发更新
			}
		};
	}

	get editorEl(): HTMLElement {
		return this.editor.editorEl;
	}
	get containerEl(): HTMLElement {
		return this.editor.containerEl;
	}
	get activeCM(): EditorView {
		return this.editor.activeCM;
	}
	get appInstance(): App {
		return this.editor.app;
	}
	get loaded(): boolean {
		return this.editor._loaded;
	}
	get value(): string {
		return this.editor.editor?.cm?.state.doc.toString() || '';
	}
	set(content: string, focus = false): void {
		this.editor.set(content, focus);
	}
	register(cb: unknown): void {
		this.editor.register(cb);
	}
	focus(): void {
		this.activeCM?.focus();
	}
	destroy(): void {
		if (this.loaded && typeof this.editor.unload === 'function') this.editor.unload();
		(this.appInstance.keymap as any).popScope(this.scope);
		(this.appInstance.workspace as any).activeEditor = null;
		this.containerEl.empty();
		this.editor.destroy?.();
	}
	unload(): void {
		this.destroy();
	}
}

function resolveEditorPrototype(app: App): any {
	// 使用类型守卫替代类型转换，避免绕过TypeScript类型检查
	const embedRegistry = (
		app as {
			embedRegistry?: {
				embedByExtension?: {
					md?: (options: any, file: TFile | null, extension: string) => any;
				};
			};
		}
	).embedRegistry;
	if (!embedRegistry?.embedByExtension?.md) {
		throw new Error('Obsidian embed registry not available or markdown embedder not found');
	}

	const widgetEditorView = embedRegistry.embedByExtension.md(
		{ app, containerEl: createDiv() },
		null as unknown as TFile,
		''
	);
	(widgetEditorView as any).editable = true;
	(widgetEditorView as any).showEditor();
	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf((widgetEditorView as any).editMode!)
	);
	(widgetEditorView as any).unload();
	return MarkdownEditor.constructor;
}

export function createEmbeddableMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: Partial<MarkdownEditorProps> = {}
): EmbeddableMarkdownEditor {
	const EditorClass = resolveEditorPrototype(app);
	return new EmbeddableMarkdownEditor(app, EditorClass, container, options);
}

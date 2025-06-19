import { TextFileView, WorkspaceLeaf, Notice } from "obsidian";
import AlphaTabPlugin from "../main";
import { EditorState, Extension, RangeSetBuilder } from "@codemirror/state";
import { EditorView, keymap, placeholder, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { TemplateManagerModal } from "../components/TemplateManagerModal";

export const VIEW_TYPE_TEX_EDITOR = "tex-editor-view";

// 添加自定义 ViewPlugin: 高亮 '|' 并基于出现次数应用不同样式
const barHighlighter = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = this.getDecos(view);
        }
        update(update: ViewUpdate) {
            if (update.docChanged) {
                this.decorations = this.getDecos(update.view);
            }
        }
        getDecos(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const text = view.state.doc.toString();
            let count = 0;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '|') {
                    count++;
                    const cls = (count - 1) % 5 === 0 ? 'cm-bar-strong' : 'cm-bar';
                    builder.add(i, i + 1, Decoration.mark({ class: cls }));
                }
            }
            return builder.finish();
        }
    },
    { decorations: v => v.decorations }
);

// 添加自定义 ViewPlugin: 高亮元数据标签
const metaHighlighter = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = this.getDecos(view);
        }
        update(update: ViewUpdate) {
            if (update.docChanged) {
                this.decorations = this.getDecos(update.view);
            }
        }
        getDecos(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const text = view.state.doc.toString();
            const regex = /\\(?:title|subtitle|composer|arranger|lyricist|copyright|album|artist|tempo|ts|key|tuning|capo|track|staff|clef)[^\n]*/g;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                builder.add(start, end, Decoration.mark({ class: 'cm-meta' }));
            }
            return builder.finish();
        }
    },
    { decorations: v => v.decorations }
);

export class TexEditorView extends TextFileView {
    plugin: AlphaTabPlugin;
    private editor: EditorView;

    constructor(leaf: WorkspaceLeaf, plugin: AlphaTabPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_TEX_EDITOR;
    }

    getDisplayText(): string {
        return this.file ? `AlphaTab: ${this.file.basename}` : "AlphaTab Editor";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        // 创建编辑器容器
        const editorContainer = container.createDiv({ cls: "tex-editor-container" });
        
        // 创建工具栏
        const toolbar = editorContainer.createDiv({ cls: "tex-editor-toolbar" });
        
        // 创建工具栏标题
        toolbar.createEl("span", { text: "AlphaTex 编辑器", cls: "tex-editor-title" });
        
        // 添加“管理模板”按钮
        const manageTemplateBtn = toolbar.createEl("button", {
            text: "管理模板",
            cls: "tex-editor-button",
            attr: { "aria-label": "管理模板" }
        });
        manageTemplateBtn.addEventListener("click", () => {
            this.openTemplateManagerModal();
        });

        // 创建 CodeMirror 编辑器容器
        const cmContainer = editorContainer.createDiv({ cls: "tex-editor-cm-container" });
        
        // 配置 CodeMirror 编辑器
        const extensions = [
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            syntaxHighlighting(defaultHighlightStyle),
            placeholder("输入 AlphaTex 内容...\n例如: :4 c d e f | g a b c5"),
            EditorView.lineWrapping,
            EditorView.updateListener.of(update => {
                if (update.docChanged) {
                    this.save();
                    const statusEl = this.containerEl.querySelector('.tex-editor-status');
                    if (statusEl) {
                        statusEl.textContent = "已保存";
                        setTimeout(() => {
                            statusEl.textContent = "";
                        }, 2000);
                    }
                }
            }),
            barHighlighter,
            metaHighlighter
        ];

        const state = EditorState.create({
            doc: this.data || "",
            extensions
        });

        this.editor = new EditorView({
            state,
            parent: cmContainer
        });

        this.addEditorStyles();
        setTimeout(() => {
            this.editor.focus();
        }, 10);
    }

    // 实现 openTemplateManagerModal，打开模板管理模态框并支持插入模板内容到编辑器光标处
    private openTemplateManagerModal() {
        // 打开模板管理模态框，插入模板内容到编辑器光标处
        new TemplateManagerModal(this.app, this.plugin, (tplContent: string) => {
            if (!this.editor) return;
            const selection = this.editor.state.selection.main;
            const transaction = this.editor.state.update({
                changes: {
                    from: selection.from,
                    to: selection.to,
                    insert: tplContent
                },
                selection: { anchor: selection.from + tplContent.length }
            });
            this.editor.dispatch(transaction);
            this.editor.focus();
            this.requestSave();
        }).open();
    }

    private addEditorStyles() {
        const style = document.createElement("style");
        style.textContent = `
            .tex-editor-container {
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            
            .tex-editor-toolbar {
                padding: 8px 12px;
                border-bottom: 1px solid var(--background-modifier-border);
                background: var(--background-secondary);
                font-weight: 500;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .tex-editor-button {
                background: var(--interactive-normal);
                color: var(--text-normal);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.1s ease;
            }
            .tex-editor-button:hover {
                background: var(--interactive-hover);
            }
            .tex-editor-cm-container {
                flex: 1;
                overflow: auto;
                height: 100%;
            }
            .tex-editor-cm-container .cm-editor {
                height: 100%;
            }
            .tex-editor-cm-container .cm-scroller {
                font-family: var(--font-monospace);
                font-size: 14px;
                line-height: 1.5;
            }
            .tex-editor-cm-container .cm-content {
                padding: 12px;
            }
            /* 自定义 | 高亮样式 */
            .cm-bar {
                background-color: rgba(255, 255, 0, 0.4);
            }
            .cm-bar-strong {
                background-color: rgba(255, 165, 0, 0.6);
            }
            /* 自定义元数据标签高亮 */
            .cm-meta {
                color: var(--comment-color);
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
        this.register(() => {
            document.head.removeChild(style);
        });
    }

    async onClose() {
        await this.save();
    }

    getViewData(): string {
        return this.editor ? this.editor.state.doc.toString() : this.data || "";
    }

    setViewData(data: string, clear: boolean): void {
        if (clear) {
            this.clear();
        }
        this.data = data;
        if (this.editor) {
            const transaction = this.editor.state.update({
                changes: { from: 0, to: this.editor.state.doc.length, insert: data }
            });
            this.editor.dispatch(transaction);
        }
    }

    clear(): void {
        this.data = "";
        if (this.editor) {
            const transaction = this.editor.state.update({
                changes: { from: 0, to: this.editor.state.doc.length, insert: "" }
            });
            this.editor.dispatch(transaction);
        }
    }
}

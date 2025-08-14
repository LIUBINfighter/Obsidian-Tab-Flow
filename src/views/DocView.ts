import { ItemView, WorkspaceLeaf } from 'obsidian';
import MyPlugin from '../main';

export const VIEW_TYPE_TABFLOW_DOC = 'tabflow-doc-view';
// 兼容导出：保留旧名称以避免其它文件立刻出错
export const VIEW_TYPE_ALPHATEX_DOC = VIEW_TYPE_TABFLOW_DOC;

export class DocView extends ItemView {
    plugin: MyPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_ALPHATEX_DOC;
    }

    getDisplayText(): string {
    return 'TabFlow 文档（示例）';
    }

    async onOpen() {
        // ensure styles are injected once
        this.injectStyles();
        await this.render();
    }

    async onClose() {
        // no-op
    }

    private injectStyles() {
        try {
            const id = 'tabflow-doc-style';
            if (document.getElementById(id)) return;
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            const base = this.plugin.manifest?.dir ? `${this.plugin.manifest.dir.replace(/\\/g, '/')}` : '';
            link.href = base + '/src/styles/doc.css';
            document.head.appendChild(link);
        } catch (e) {
            // fail silently
        }
    }

    private async render() {
        const container = this.contentEl;
        container.empty();

    // Header
    const header = container.createDiv({ cls: 'tabflow-doc-header' });
    header.createEl('h2', { text: 'TabFlow 文档' });

    // Layout wrapper: left sidebar + main column
    const layout = container.createDiv({ cls: 'tabflow-doc-layout' });

    // Left column (sidebar)
    const leftCol = layout.createDiv({ cls: 'tabflow-doc-left' });
    // placeholder for future navigation / TOC
    leftCol.createEl('div', { text: '' });

    // Main column (content area)
    const mainCol = layout.createDiv({ cls: 'tabflow-doc-main' });
    // initially empty; content will be filled later
    mainCol.createEl('div', { text: '' });
    }
}

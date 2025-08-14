import { ItemView, WorkspaceLeaf } from 'obsidian';
import MyPlugin from '../main';
import panelsRegistry, { DocPanel } from './docs';

export const VIEW_TYPE_TABFLOW_DOC = 'tabflow-doc-view';
// 兼容导出：保留旧名称以避免其它文件立刻出错
export const VIEW_TYPE_ALPHATEX_DOC = VIEW_TYPE_TABFLOW_DOC;

// 面板类型与注册列表已集中在 ./docs/index.ts

export class DocView extends ItemView {
    plugin: MyPlugin;
    panels: DocPanel[] = [];
    activeId: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
    this.plugin = plugin;
    this.panels = panelsRegistry;
        if (this.panels.length) this.activeId = this.panels[0].id;
    }

    getViewType(): string {
        return VIEW_TYPE_ALPHATEX_DOC;
    }

    getDisplayText(): string {
        return 'TabFlow 文档（示例）';
    }

    async onOpen() {
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

        // Layout wrapper
        const layout = container.createDiv({ cls: 'tabflow-doc-layout' });

        // Left column (tabs)
        const leftCol = layout.createDiv({ cls: 'tabflow-doc-left' });
        const nav = leftCol.createDiv({ cls: 'tabflow-doc-nav' });
        this.panels.forEach(panel => {
            const tabEl = nav.createDiv({ cls: 'tabflow-doc-tab' });
            tabEl.setText(panel.title);
            tabEl.addEventListener('click', () => {
                this.activeId = panel.id;
                this.render();
            });
            if (panel.id === this.activeId) tabEl.addClass('active');
        });

        // Main column (content)
        const mainCol = layout.createDiv({ cls: 'tabflow-doc-main' });
        const contentWrap = mainCol.createDiv({ cls: 'tabflow-doc-markdown' });

        // render active panel
        const active = this.panels.find((p) => p.id === this.activeId) || this.panels[0];
        if (active) {
            // let panel render into the container; pass plugin so panels can access resources
            try {
                active.render(contentWrap, this.plugin);
            } catch (e) {
                contentWrap.setText('渲染面板时出错');
            }
        }
    }
}

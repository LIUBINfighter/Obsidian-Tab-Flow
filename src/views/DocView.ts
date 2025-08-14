import { ItemView, WorkspaceLeaf } from 'obsidian';
import MyPlugin from '../main';
import panelsRegistry, { DocPanel } from './docs/index';

export const VIEW_TYPE_TABFLOW_DOC = 'tabflow-doc-view';
// 兼容导出：保留旧名称以避免其它文件立刻出错
export const VIEW_TYPE_ALPHATEX_DOC = VIEW_TYPE_TABFLOW_DOC;

// 面板类型与注册列表已集中在 ./docs/index.ts

export class DocView extends ItemView {
    plugin: MyPlugin;
    panels: DocPanel[] = [];
    activeId: string | null = null;
    private layoutObserver?: ResizeObserver;

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
        // Observe width changes of the view container to toggle narrow layout per-view
        try {
            const applyNarrow = () => {
                const w = layout.clientWidth;
                if (w > 0 && w < 600) layout.addClass('is-narrow'); else layout.removeClass('is-narrow');
            };
            this.layoutObserver?.disconnect();
            this.layoutObserver = new ResizeObserver(() => applyNarrow());
            this.layoutObserver.observe(layout);
            applyNarrow();
        } catch {
            // no-op
        }

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

        // In-panel navigation (上一条 / 下一条) inferred from panels order
        const currentIndex = Math.max(0, this.panels.findIndex((p) => p.id === (active?.id || null)));
        const prevPanel = currentIndex > 0 ? this.panels[currentIndex - 1] : null;
        const nextPanel = currentIndex < this.panels.length - 1 ? this.panels[currentIndex + 1] : null;

        if (prevPanel || nextPanel) {
            const docNav = contentWrap.createDiv({ cls: 'doc-nav' });

            if (prevPanel) {
                const prev = docNav.createDiv({ cls: 'doc-nav-item doc-nav-item--prev' });
                const label = prev.createDiv({ cls: 'doc-nav-label', text: '上一条' });
                label.setAttr('aria-hidden', 'true');
                prev.createDiv({ cls: 'doc-nav-title', text: prevPanel.title });
                prev.setAttr('role', 'button');
                prev.setAttr('tabindex', '0');
                prev.setAttr('aria-label', `上一条：${prevPanel.title}`);
                prev.addEventListener('click', () => { this.activeId = prevPanel.id; this.render(); });
                prev.addEventListener('keypress', (e) => { if ((e as KeyboardEvent).key === 'Enter') { this.activeId = prevPanel.id; this.render(); } });
            }

            if (nextPanel) {
                const next = docNav.createDiv({ cls: 'doc-nav-item doc-nav-item--next' });
                const label = next.createDiv({ cls: 'doc-nav-label', text: '下一条' });
                label.setAttr('aria-hidden', 'true');
                next.createDiv({ cls: 'doc-nav-title', text: nextPanel.title });
                next.setAttr('role', 'button');
                next.setAttr('tabindex', '0');
                next.setAttr('aria-label', `下一条：${nextPanel.title}`);
                next.addEventListener('click', () => { this.activeId = nextPanel.id; this.render(); });
                next.addEventListener('keypress', (e) => { if ((e as KeyboardEvent).key === 'Enter') { this.activeId = nextPanel.id; this.render(); } });
            }

            // layout class: one vs two columns
            const count = docNav.children.length;
            if (count >= 2) docNav.addClass('two'); else docNav.addClass('one');
        }
    }
}

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import TabFlowPlugin from '../main';
import panelsRegistry, { DocPanel } from './docs/index';

export const VIEW_TYPE_TABFLOW_DOC = 'tabflow-doc-view';
// 兼容导出：保留旧名称以避免其它文件立刻出错
export const VIEW_TYPE_ALPHATEX_DOC = VIEW_TYPE_TABFLOW_DOC;

// 面板类型与注册列表已集中在 ./docs/index.ts

export class DocView extends ItemView {
    plugin: TabFlowPlugin;
    panels: DocPanel[] = [];
    activeId: string | null = null;
    private layoutObserver?: ResizeObserver;

    constructor(leaf: WorkspaceLeaf, plugin: TabFlowPlugin) {
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

        // 标题（先渲染）
        header.createEl('h2', { text: 'TabFlow 文档' });

        // 按钮组（后渲染，和标题同级）
        const btnGroup = header.createDiv({ cls: 'tabflow-doc-header-btns' });

        // GitHub 按钮（SVG图标）
        const githubBtn = btnGroup.createEl('a', {
            href: 'https://github.com/LIUBINfighter/Obsidian-Tab-Flow',
            attr: { target: '_blank', rel: 'noopener', 'aria-label': 'GitHub' },
            cls: 'mod-cta'
        });
        // TO FIX: 使用 innerHTML 存在安全风险，应该使用 DOM API 或 Obsidian helper functions
        // 原因: https://docs.obsidian.md/Plugins/User+interface/HTML+elements
        githubBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle;">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52
                -.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.6-.18-3.29
                -.8-3.29-3.56 0-.79.28-1.43.74-1.93-.07-.18-.32-.91.07-1.89 0 0 .6-.19 1.97.73.57-.16 1.18
                -.24 1.79-.24.61 0 1.22.08 1.79.24 1.37-.92 1.97-.73 1.97-.73.39.98.14 1.71.07 1.89.46.5
                .74 1.14.74 1.93 0 2.77-1.69 3.38-3.3 3.56.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19
                0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
        `;

        // Issue 按钮（文字）
        const issueBtn = btnGroup.createEl('a', {
            href: 'https://github.com/LIUBINfighter/Obsidian-Tab-Flow/issues/55',
            attr: { target: '_blank', rel: 'noopener', 'aria-label': 'Issue' },
            cls: 'mod-cta'
        });
        issueBtn.innerText = '[Feedback for Docs]';

        // alphaTab.js 官方文档按钮（黑体文字）
        const alphaTabBtn = btnGroup.createEl('a', {
            href: 'https://www.alphatab.net/',
            attr: { target: '_blank', rel: 'noopener', 'aria-label': 'alphaTab.js 官方文档' },
            cls: 'mod-cta'
        });
        alphaTabBtn.innerText = '[alphaTab.js]';

        // 设置按钮（齿轮图标）
        const settingsBtn = btnGroup.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': '设置', type: 'button', style: 'margin-left:0.5em;' }
        });
        const iconSpan = document.createElement('span');
        settingsBtn.appendChild(iconSpan);
        setIcon(iconSpan, 'settings');
        settingsBtn.onclick = () => {
            try {
                // 直达本插件SettingTab的“播放器配置”页签
                // @ts-ignore
                this.plugin.app.workspace.trigger('tabflow:open-plugin-settings-player');
            } catch {
                try {
                    // 退化处理
                    // @ts-ignore
                    this.plugin.app.commands.executeCommandById('app:open-settings');
                    setTimeout(() => {
                        try {
                            const search = document.querySelector('input.setting-search-input') as HTMLInputElement | null;
                            if (search) {
                                search.value = 'Tab Flow';
                                const ev = new Event('input', { bubbles: true });
                                search.dispatchEvent(ev);
                            }
                        } catch {}
                    }, 120);
                } catch {}
            }
        };
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

import { ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';
import MyPlugin from '../main';

export const VIEW_TYPE_ALPHATEX_DOC = 'alphatex-doc-view';

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
        return 'AlphaTex 文档';
    }

    async onOpen() {
        // ensure styles are injected once
        this.injectStyles();
        await this.render();
    }

    async onClose() {
        // nothing special for now
    }

    private injectStyles() {
        try {
            const id = 'tabflow-doc-style';
            if (document.getElementById(id)) return;
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            // use plugin manifest.dir as base if available; otherwise assume relative path
            const base = this.plugin.manifest?.dir ? `${this.plugin.manifest.dir.replace(/\\/g, '/')}` : '';
            link.href = base + '/src/styles/doc.css';
            document.head.appendChild(link);
        } catch (e) {
            // fail silently
            // console.warn('DocView: failed to inject styles', e);
        }
    }

    private async render() {
        const container = this.contentEl;
        container.empty();

    // Header (minimal)
    const header = container.createDiv({ cls: 'alphatex-doc-header' });
    header.createEl('h2', { text: 'AlphaTex 文档' });

    // Single-column content layout (no TOC/sidebar)
    const contentWrap = container.createDiv({ cls: 'alphatex-doc-content' });
    contentWrap.createEl('p', { text: '文档内容区：选择章节后将在此处显示。' });

    // Footer / playbar placeholder
    const footer = container.createDiv({ cls: 'alphatex-doc-footer' });
    footer.createEl('div', { text: '播放控制占位 (PlayBar)' }).addClass('playbar-placeholder');

        // default section
        await this.showSection('Introduction');
    }

    private async showSection(title: string) {
    const content = this.contentEl.querySelector('.alphatex-doc-content') as HTMLElement;
        if (!content) return;
        content.empty();

    content.createEl('h3', { text: title });

        // basic section contents (placeholder text); real content will be loaded from docs later
    const md = this.getSectionMarkdown(title);
    const div = content.createDiv({ cls: 'alphatex-doc-markdown' });
    await MarkdownRenderer.renderMarkdown(md, div, this.plugin.manifest.dir ?? '', this);
    }

    private getSectionMarkdown(title: string): string {
        switch (title) {
            case 'Introduction':
                return `\nAlphaTex 是用于 AlphaTab 的文本制谱语言。\n\n简单示例:\n\n\`0.6.2 1.5.4 3.4.4 |\``;
            case 'Quick Start':
                return `\n快速入门：在笔记中使用三个部分：Metadata、Song Contents 和 Sync Points（用单独的点号 \\. 分隔）。`;
            case 'Syntax':
                return `\n语法速查：\n- 单音：fret.string.duration\n- 和弦：(fret.string ...).duration\n- 时值范围：:4  ...`;
            case 'Metadata':
                return `\n常用元数据：\\title、\\tempo、\\instrument、\\tuning、\\capo。`;
            case 'Tracks & Staves':
                return `\n\\track 与 \\staff 的用法示例。`;
            case 'Effects':
                return `\n常用效果：v（颤音）、h（hammer-on）、b（bend）、tu（tuplets）、dy（dynamics）等。`;
            case 'Sync Points':
                return `\n\\sync BarIndex Occurence MillisecondOffset [RatioPosition]`;
            default:
                return `\n暂无内容。`;
        }
    }
}

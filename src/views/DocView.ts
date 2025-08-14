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
        this.render();
    }

    async onClose() {
        // nothing special
    }

    private async render() {
        const container = this.contentEl;
        container.empty();

        const header = container.createEl('h2', { text: 'AlphaTex 快速文档' });
        header.addClass('alphatex-doc-header');

        // short toc
        const toc = container.createEl('div', { cls: 'alphatex-doc-toc' });
        toc.createEl('h4', { text: '目录' });
        const ul = toc.createEl('ul');
        ['Introduction', 'Quick Start', 'Syntax', 'Metadata', 'Tracks & Staves', 'Effects', 'Sync Points', 'Reference'].forEach(t => {
            const li = ul.createEl('li');
            const a = li.createEl('a', { text: t });
            a.onclick = () => this.showSection(t);
        });

        const content = container.createEl('div', { cls: 'alphatex-doc-content' });
        content.createEl('p', { text: '选择左侧目录以查看对应章节，右上角可搜索并复制示例代码。' });

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
    const div = content.createDiv();
    await MarkdownRenderer.renderMarkdown(md, div, this.plugin.manifest.dir ?? '', this);
    }

    private getSectionMarkdown(title: string): string {
        switch (title) {
            case 'Introduction':
                return `\nAlphaTex 是用于 AlphaTab 的文本制谱语言。\n\n简单示例:\n\n\`0.6.2 1.5.4 3.4.4 |\``;
            case 'Quick Start':
                return `\n快速入门：在笔记中使用三个部分：Metadata、Song Contents 和 Sync Points（用单独的点号 \. 分隔）。`;
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

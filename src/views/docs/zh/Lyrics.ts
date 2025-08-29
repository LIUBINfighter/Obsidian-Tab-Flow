// 文档面板：Lyrics（歌词）
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE_SIMPLE = `\\title "With Lyrics"\n\\instrument piano\n.\n\\lyrics "Do Re Mi Fa So La Ti"\nC4 D4 E4 F4 | G4 A4 B4 r`;

const SAMPLE_COMBINE = `\\title "Combine Syllables (and empty beats)"\n\\instrument piano\n.\n\\lyrics "Do+Do  Mi+Mi"\nC4 C4 E4 E4`;

const SAMPLE_START_LATER = `\\title "Start Later"\n\\instrument piano\n.\n\\lyrics 2 "Do Re Mi Fa So La Ti"\nr r r r | r r r r |\nC4 D4 E4 F4 | G4 A4 B4 r`;

const SAMPLE_COMMENT = `\\title "Comment"\n\\subtitle "Useful when loading lyrics from a different source"\n\\instrument piano\n.\n\\lyrics "[This is a comment]Do Re Mi Fa"\nC4 D4 E4 F4`;

export default {
	id: 'lyrics',
	title: 'Lyrics 歌词',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Lyrics（歌词）' });
		container.createEl('p', { text: '演示基础歌词、合并音节、延后开始与注释写法。' });

		const sections: Array<[string, string]> = [
			['基础歌词', SAMPLE_SIMPLE],
			['合并音节（+）', SAMPLE_COMBINE],
			['延后开始（StartBar）', SAMPLE_START_LATER],
			['注释（[comment]）', SAMPLE_COMMENT],
		];

		for (const [title, sample] of sections) {
			container.createEl('h4', { text: title });
			if (plugin) {
				const host = container.createDiv({ cls: 'doc-playground-host' });
				createAlphaTexPlayground(plugin, host, sample, {});
			}
		}

		if (!plugin) {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染示例。' });
		}
	}
};



// 文档面板：总览
import type MyPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

const SAMPLE = `\\title "Canon Rock"
\\subtitle "JerryC"
\\tempo 90
.
:2 19.2{v f} 17.2{v f} |
15.2{v f} 14.2{v f} |
12.2{v f} 10.2{v f} |
12.2{v f} 14.2{v f}.4 :8 15.2 17.2 |
14.1.2 :8 17.2 15.1 14.1{h} 17.2 |
15.2{v d}.4 :16 17.2{h} 15.2 :8 14.2 14.1 17.1{b (0 4 4 0)}.4 |
15.1.8 :16 14.1{tu 3} 15.1{tu 3} 14.1{tu 3} :8 17.2 15.1 14.1 :16 12.1{tu 3} 14.1{tu 3} 12.1{tu 3} :8 15.2 14.2 |
12.2 14.3 12.3 15.2 :32 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h}`;

export default {
	id: 'overview',
	title: '总览',
	render(container: HTMLElement, plugin?: MyPlugin) {
		container.empty();
		container.createEl('h3', { text: 'AlphaTex 总览' });
		container.createEl('p', {
			text: 'AlphaTex 是 AlphaTab 的文本谱写格式。它通常包含（可选）元数据、（必需）乐谱内容，以及（可选）用于外部音频/视频同步的 Sync Points。各段之间使用一个点号（.）分隔。'
		});
		const list = container.createEl('ul');
		list.createEl('li', { text: 'Song Metadata：曲目全局信息，如标题、作者、速度。' });
		list.createEl('li', { text: 'Song Contents：乐谱主体（轨道、谱表、小节、节拍、音符），小节用 | 分隔。' });
		list.createEl('li', { text: 'Sync Points：与外部媒体的时间对齐点（进阶，可选）。' });
		container.createEl('p', { text: '下面给出一个示例片段（Canon Rock）。可直接修改文本，预览会自动刷新。' });

		if (plugin) {
			const playgroundHost = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost, SAMPLE, {});
		} else {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染。' });
		}
	}
};



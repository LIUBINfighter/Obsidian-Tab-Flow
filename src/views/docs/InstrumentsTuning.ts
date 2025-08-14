// 文档面板：乐器与调音
import type MyPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

const SAMPLE = `\\title "Instrument & Tuning"
\\instrument ElectricGuitarClean
\\tuning E4 B3 G3 D3 A2 E2
.
// 以四分音为默认时值
:4 0.6 2.5 2.4 2.3 | 3.2 2.2 0.1 3.1`;

export default {
	id: 'instruments-tuning',
	title: '乐器与调音',
	render(container: HTMLElement, plugin?: MyPlugin) {
		container.empty();
		container.createEl('h3', { text: '乐器与调音（Instrument & Tuning）' });
		container.createEl('p', {
			text: '在 AlphaTex 中，可以通过 \\instrument 指定播放音色，使用 \\tuning 指定每根弦的音高（从最底弦开始）。如果只设置了 \\instrument 而未设置 \\tuning，AlphaTab 会根据乐器类型尝试应用默认调弦。'
		});
		const ul = container.createEl('ul');
		ul.createEl('li', { text: '\\instrument 支持 GM 号码或名称（如 ElectricGuitarClean、piano 等）。' });
		ul.createEl('li', { text: '\\tuning 采用音名+八度（如 E4 B3 G3 D3 A2 E2），用于弦乐器的指板定位与音高。' });
		container.createEl('p', { text: '下面提供一个最小示例：电吉他音色 + 标准六弦调弦。可尝试改为不同音色或改变某根弦的音高，听听差异。' });

		if (plugin) {
			createAlphaTexPlayground(plugin, container, SAMPLE, {});
		} else {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染。' });
		}
	}
};



// 文档面板：乐器与调音
import type MyPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

const SAMPLE = `\\title "Instrument & Tuning"
\\instrument ElectricGuitarClean
\\tuning E4 B3 G3 D3 A2 E2
.
// 以四分音为默认时值
:4 0.6 2.5 2.4 2.3 | 3.2 2.2 0.1 3.1`;

const SAMPLE2 = `\\title "Instrument & Tuning (Piano)"
\\instrument piano
\\tuning piano
.
// 非弦乐：使用音名与八度（如 C4 D4），而非 fret.string
:4 C4 D4 E4 F4 | G4 A4 B4 r`;

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
		container.createEl('p', { text: '下面提供两个最小示例：其一为电吉他（弦乐，使用 fret.string）；其二为钢琴（非弦乐，使用 C4 D4 这类音名与八度）。' });

		if (plugin) {
			container.createEl('h4', { text: '示例一：电吉他（标准六弦调弦）' });
			const playgroundHost1 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost1, SAMPLE, {});

			container.createEl('h4', { text: '示例二：钢琴（非弦乐，音名与八度）' });
			const playgroundHost2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost2, SAMPLE2, {});
		} else {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染。' });
		}
	}
};



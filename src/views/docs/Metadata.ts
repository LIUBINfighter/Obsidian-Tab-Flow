// 文档面板：Metadata（最小集合）
import type MyPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

// TODO: 模板与对齐方式后续补充（暂时跳过）
const SAMPLE = `// Song information (only at the beginning)
  \\title "Song Title"
  \\subtitle Subtitle
  \\artist Artist
  \\album 'My Album'
  \\words Daniel
  \\music alphaTab
  \\copyright Daniel
  \\instructions "This is an example.\\nWith instructions."
  \\notices "Additional notes\\nEmbedded in the data model."
  \\tab "Daniel"
  // Tempo in BPM (label is optional)
  \\tempo 200 "Tempo Label"
// Track and Staff Settings (can be used after \\track and \\staff)
  // Instrument as General MIDI number or name
  \\instrument 30
  // Capo fret
  \\capo 2
  // String tuning starting at the most bottom string
  \\tuning e5 b4 g4 d4 a3 e3
// end of metadata
.
// 简单内容以便可视化：两小节四分音
:4 C4 D4 E4 F4 | C4 D4 E4 F4`;

export default {
	id: 'metadata',
	title: 'Metadata',
	render(container: HTMLElement, plugin?: MyPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Metadata（曲目信息与全局设置）' });
		container.createEl('p', {
			text: 'Metadata 使用 \\tag value 的形式，一般写在曲谱开头。它用于指定全局信息（标题、作者、速度等）以及演奏相关设置（乐器、Capo、调弦）。如果写了 Metadata，必须在末尾用一个点号（.）结束该段落。'
		});
		const ul = container.createEl('ul');
		ul.createEl('li', { text: '\\title / \\subtitle / \\artist / \\album 等：显示在谱面上的曲目信息。' });
		ul.createEl('li', { text: '\\tempo：全局速度（BPM），可选标签文本。' });
		ul.createEl('li', { text: '\\instrument：可用 GM 号码或名称指定音色；未指定 \\tuning 时会尝试推断默认调弦。' });
		ul.createEl('li', { text: '\\tuning：为每根弦指定音高（如 E4 B3 G3 D3 A2 E2）。' });
		container.createEl('p', { text: '下方示例包含常见的元数据字段，并在点号（.）后提供了两小节内容用于快速验证。' });

		if (plugin) {
			const playgroundHost = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost, SAMPLE, {});
		} else {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染。' });
		}
	}
};



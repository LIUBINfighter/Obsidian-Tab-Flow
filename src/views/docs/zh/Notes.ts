// 文档面板：Notes 编写音符
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE_SINGLE_NOTES = `// 单音与休止（多个小节用竖线 | 分隔）
0.6.2 1.5.4 3.4.4 |
5.3.8 5.3.8 5.3.8 5.3.8 r.2`;

const SAMPLE_CHORDS = `// 和弦：用括号分组，同拍多音，然后在括号后标注时值
(0.3 0.4).4 (3.3 3.4).4 (5.3 5.4).4 r.8 (0.3 0.4).8 |
r.8 (3.3 3.4).8 r.8 (6.3 6.4).8 (5.3 5.4).4 r.4 |
(0.3 0.4).4 (3.3 3.4).4 (5.3 5.4).4 r.8 (3.3 3.4).8 |
r.8 (0.3 0.4).8`;

const SAMPLE_DURATION_RANGES = `// 使用 :duration 为后续若干音符指定相同时值
// explicit ranges via :duration
:4 2.3 3.3 :8 3.3 4.3 3.3 4.3 |
// implicit ranges via beat duration
2.3.4 3.3 3.3.8 4.3 3.3 4.3`;

const SAMPLE_REPEAT_BEATS = `// 为单个节拍添加重复倍数（*N）
3.3*4 | 4.3*4`;

const SAMPLE_MULTIPLE_VOICES = `\\track "Piano"
  \\staff{score} \\tuning piano \\instrument acousticgrandpiano
      \\voice 
          c4 d4 e4 f4 | c4 d4 e4 f4
      \\voice 
          c3 d3 e3 f3 | c3 d3 e3 f3

\\track "Piano2"
  \\staff{score} \\tuning piano \\instrument acousticgrandpiano
      \\voice 
          c4 d4 e4 f4 | c4 d4 e4 f4
      \\voice 
          c3 d3 e3 f3`;

const SAMPLE_ACCIDENTALS = `\\track
  \\accidentals explicit
  C#4 Db4 C##4 Dbb4 | 
  \\accidentals auto
  C#4 Db4 C##4 Dbb4 |
  C#4 { acc forceFlat } C4 { acc forceSharp } C4 { acc forceDoubleSharp } C4 { acc forceDoubleFlat } 
\\track 
  :4 2.2 { acc forceFlat } 5.3 { acc forceSharp } 5.3 { acc forceDoubleSharp } 5.3 { acc forceDoubleFlat }`;

export default {
	id: 'notes',
	title: 'Notes 编写音符',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Notes 编写音符' });
		container.createEl('p', { text: '下面的示例演示如何在 AlphaTex 中编写一般音符。多个小节用竖线 | 分隔。每个小节对应谱面上的一段。' });

		// Single notes and rests
		container.createEl('h4', { text: 'Single notes and rests（单音与休止）' });
		container.createEl('p', { text: '音符格式为 fret.string.duration；休止用 r 替代品格（fret）。时值：1=全音符，2=二分，4=四分，8=八分，依此类推。' });
		if (plugin) {
			const host1 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host1, SAMPLE_SINGLE_NOTES);
		}

		// Chords
		container.createEl('h4', { text: 'Chords（和弦）' });
		container.createEl('p', { text: '同一拍内的多个音符用括号括起：(fret.string fret.string ...).duration。' });
		if (plugin) {
			const host2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host2, SAMPLE_CHORDS, {});
		}

		// Duration Ranges
		container.createEl('h4', { text: 'Duration Ranges（时值范围）' });
		container.createEl('p', { text: '用 :duration 开始一个时值范围，之后的若干音符共享该时值；AlphaTex 也会记住最近一次明确设置的时值。' });
		if (plugin) {
			const host3 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host3, SAMPLE_DURATION_RANGES, {});
		}

		// Repeat beats
		container.createEl('h4', { text: 'Repeat beats（节拍重复）' });
		container.createEl('p', { text: '在节拍后使用 *N 可快速重复该节拍 N 次。' });
		if (plugin) {
			const host4 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host4, SAMPLE_REPEAT_BEATS, {});
		}

		// Multiple voices
		container.createEl('h4', { text: 'Multiple voices（多声部）' });
		container.createEl('p', { text: '使用 \\voice 开启新声部。在同一轨中可并行编写多个独立声部；AlphaTab 会尽力合并不同声部的小节数量差异。' });
		if (plugin) {
			const host5 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host5, SAMPLE_MULTIPLE_VOICES, {});
		}

		// Accidentals
		container.createEl('h4', { text: 'Accidentals（变音记号）' });
		container.createEl('p', { text: '默认（\\accidentals explicit）按写入音高使用变音；可切换为 \\accidentals auto。也可在音符效果中用 acc 指定（如 forceSharp/forceFlat 等）。' });
		if (plugin) {
			const host6 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host6, SAMPLE_ACCIDENTALS, {});
		}

		if (!plugin) {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染示例。' });
		}
	}
};



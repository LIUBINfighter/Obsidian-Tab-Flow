// 文档面板：ExampleProgression 示例和弦进行与片段
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// 示例进程（含全局和弦、章节、拍号与多个小节）
const SAMPLE_PROGRESSION = `// 设置全局的和弦
\\chord "Bm/D" 2 3 4 0 x x
\\chord "Cadd9" 0 3 0 2 3 x
\\chord "G/B" x 3 0 0 2 x 
\\chord "Am7" 3 1 0 2 0 x
\\chord "G" 3 0 0 0 2 3
\\chord "F" 2 2 3 4 4 2
\\chord "B7" 2 0 2 1 2 x
\\chord "Em" 0 0 0 2 2 0

// 新开启篇章
.

// 设置拍子
\\ts 4 4

// 开始
r.4 * 3 0.1.8 2.1.8 |
(3.1 0.6) 0.3 0.2 2.1 3.1 0.3 7.1 0.3 |
(2.1 0.4).8{ch "Bm/D"} 4.3 3.2 4.3 0.4 2.1 4.3.4 |
(0.1 3.5).8{ch "Cadd9"} 2.4 0.3 3.2 0.1 0.3 3.1 0.3 |
(3.2 2.5){ch "G/B"} 0.4 0.3 0.4 0.2.4 :8 2.3{h} 4.3 |
(1.2 0.5).8{ch "Am7"} 2.4 0.3 0.2 1.2 0.3 3.1 0.3 |
(0.2 3.6).8{ch "G"} 0.4 0.3 2.3 0.2.4 :8 3.1 3.1 |
(2.1 2.6).8{ch "F"} 4.5 3.3 2.2 2.2 3.3 2.1 3.3 |`;

export default {
	id: 'example-progression',
	title: '天空之城-指弹',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: '天空之城-指弹' });
		container.createEl('p', {
			text: '此页面展示一个包含全局和弦定义、拍号设置与若干小节的 AlphaTex 片段。可直接编辑下方代码尝试修改和弦或音符。',
		});
		container.createEl('p', {
			text: '要点：1) 使用 \\chord 定义可复用和弦；2) 用 {ch "名称"} 在音符处标注当前和弦；3) :8 表示后续继承八分音长度；4) *N 可重复节拍；5) 竖线 | 分隔小节。',
		});

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PROGRESSION, {});
		} else {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染示例。' });
		}
	},
};

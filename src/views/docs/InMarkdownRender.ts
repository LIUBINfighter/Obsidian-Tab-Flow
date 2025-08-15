// 示例面板：InMarkdownRender
import type TabFlowPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

const SAMPLE = `%%{init: {"scale":1,"speed":2,"scrollMode":"Continuous","metronome":false,"player":"enable"}}%%

\\title "Canon Rock"
\\subtitle "JerryC"
\\tempo 90
.
:2 19.2{v f} 17.2{v f} | `;

export default {
	id: 'in-markdown',
	title: '文本与曲谱预览',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();

	if (plugin) {
		createAlphaTexPlayground(plugin, container, SAMPLE, {});
	} else {
		container.createEl('div', { text: '缺少 plugin 上下文，无法渲染。' });
	}
	}
};



// 文档面板：Percussion（打击乐）
import type TabFlowPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

// 采用最小可视示例：使用标准打击乐映射（示意）
const SAMPLE_PERC = `\\title "Percussion Basics"\n\\instrument Drums\n\\tuning none\n.\n:4 (x.5 x.4) (x.5 x.4) (x.5 x.4) (x.5 x.4)`;

export default {
	id: 'percussion',
	title: 'Percussion 打击乐',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Percussion（打击乐）' });
		container.createEl('p', { text: '演示最小打击乐谱例（示意）。后续将补充更完整的映射示例。' });

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PERC, {});
		} else {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染示例。' });
		}
	}
};



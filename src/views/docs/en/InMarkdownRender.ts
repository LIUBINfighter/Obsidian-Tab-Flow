// Documentation Panel: In Markdown Render
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE = `%%{init: {"scale":1,"speed":2,"scrollMode":"Continuous","metronome":false,"player":"enable"}}%%

\\title "Canon Rock"
\\subtitle "JerryC"
\\tempo 90
.
:2 19.2{v f} 17.2{v f} | `;

export default {
	id: 'in-markdown',
	title: 'Text & Score Preview',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();

		if (plugin) {
			createAlphaTexPlayground(plugin, container, SAMPLE, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render.' });
		}
	}
};



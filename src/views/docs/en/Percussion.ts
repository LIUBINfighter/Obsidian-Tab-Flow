// Documentation Panel: Percussion
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// Using minimal visual example: standard percussion mapping (illustrative)
const SAMPLE_PERC = `\\title "Percussion Basics"
\\instrument 25
.
\\track "Drums"
\\staff {score}
c#5.4 d4.4 c#5.4 d4.4 |
`;

export default {
	id: 'percussion',
	title: 'Percussion',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Percussion' });
		container.createEl('p', {
			text: 'Demonstrates minimal percussion example (illustrative). More complete mapping examples will be added later.',
		});

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PERC, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render examples.' });
		}
	},
};

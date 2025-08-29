// Documentation Panel: Percussion
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// Using minimal visual example: standard percussion mapping (illustrative)
const SAMPLE_PERC = `\\title "Percussion Basics"\n\\instrument Drums\n\\tuning none\n.\n:4 (x.5 x.4) (x.5 x.4) (x.5 x.4) (x.5 x.4)`;

export default {
	id: 'percussion',
	title: 'Percussion',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Percussion' });
		container.createEl('p', { text: 'Demonstrates minimal percussion example (illustrative). More complete mapping examples will be added later.' });

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PERC, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render examples.' });
		}
	}
};



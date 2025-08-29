// Documentation Panel: Overview
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE = `\\title "Canon Rock"
\\subtitle "JerryC"
\\tempo 90
.
:2 19.2{v f} 17.2{v f} |
15.2{v f} 14.2{v f} |
12.2{v f} 10.2{v f} |
12.2{v f} 14.2{v f}.4 :8 15.2 17.2 |
14.1.2 :8 17.2 15.1 14.1{h} 17.2 |
15.2{v d}.4 :16 17.2{h} 15.2 :8 14.2 14.1 17.1{b (0 4 4 0)}.4 |
15.1.8 :16 14.1{tu 3} 15.1{tu 3} 14.1{tu 3} :8 17.2 15.1 14.1 :16 12.1{tu 3} 14.1{tu 3} 12.1{tu 3} :8 15.2 14.2 |
12.2 14.3 12.3 15.2 :32 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h} 14.2{h} 15.2{h}`;

export default {
	id: 'overview',
	title: 'Overview',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'AlphaTex Overview' });
		container.createEl('p', {
			text: 'AlphaTex is AlphaTab\'s text-based notation format. It typically contains (optional) metadata, (required) musical content, and (optional) sync points for external audio/video synchronization. Sections are separated by a single dot (.).'
		});
		const list = container.createEl('ul');
		list.createEl('li', { text: 'Song Metadata: Global song information like title, artist, tempo.' });
		list.createEl('li', { text: 'Song Contents: Main musical content (tracks, staves, bars, beats, notes), bars separated by |.' });
		list.createEl('li', { text: 'Sync Points: Time alignment points with external media (advanced, optional).' });
		container.createEl('p', { text: 'Below is an example snippet (Canon Rock). You can directly edit the text and the preview will refresh automatically.' });

		if (plugin) {
			const playgroundHost = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost, SAMPLE, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render.' });
		}
	}
};



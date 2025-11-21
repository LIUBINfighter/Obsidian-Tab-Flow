// Documentation Panel: Example Progression - Sample Chords and Fragments
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// Example progression (with global chords, sections, time signatures and multiple bars)
const SAMPLE_PROGRESSION = `// Set up global chords
\\chord "Bm/D" 2 3 4 0 x x
\\chord "Cadd9" 0 3 0 2 3 x
\\chord "G/B" x 3 0 0 2 x
\\chord "Am7" 3 1 0 2 0 x
\\chord "G" 3 0 0 0 2 3
\\chord "F" 2 2 3 4 4 2
\\chord "B7" 2 0 2 1 2 x
\\chord "Em" 0 0 0 2 2 0

// Start new section
.

// Set time signature
\\ts 4 4

// Begin
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
	title: 'Castle in the Sky - fingerstyle',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Castle in the Sky - fingerstyle' });
		container.createEl('p', {
			text: 'This page shows an AlphaTex fragment with global chord definitions, time signature settings, and several bars. You can directly edit the code below to try modifying chords or notes.',
		});
		container.createEl('p', {
			text: 'Key points: 1) Use \\chord to define reusable chords; 2) Use {ch "name"} to label current chord at notes; 3) :8 means subsequent notes inherit eighth note duration; 4) *N can repeat beats; 5) | separates bars.',
		});

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PROGRESSION, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render examples.' });
		}
	},
};

// Documentation Panel: Instruments & Tuning
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE = `\\title "Instrument & Tuning"
\\instrument ElectricGuitarClean
\\tuning E4 B3 G3 D3 A2 E2
.
// Default to quarter notes
:4 0.6 2.5 2.4 2.3 | 3.2 2.2 0.1 3.1`;

const SAMPLE2 = `\\title "Instrument & Tuning (Piano)"
\\instrument piano
\\tuning piano
.
// Non-stringed: Use note names and octaves (like C4 D4), not fret.string
:4 C4 D4 E4 F4 | G4 A4 B4 r`;

export default {
	id: 'instruments-tuning',
	title: 'Instruments & tuning',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Instruments & tuning' });
		container.createEl('p', {
			text: 'In AlphaTex, you can specify playback timbre with \\instrument and set the pitch of each string with \\tuning (starting from the lowest string). If only \\instrument is set without \\tuning, AlphaTab will attempt to apply default tuning based on the instrument type.',
		});
		const ul = container.createEl('ul');
		ul.createEl('li', {
			text: '\\instrument supports GM numbers or names (like ElectricGuitarClean, piano, etc.).',
		});
		ul.createEl('li', {
			text: '\\tuning uses note names + octaves (like E4 B3 G3 D3 A2 E2) for stringed instrument fretboard positioning and pitch.',
		});
		container.createEl('p', {
			text: 'Below are two minimal examples: the first is electric guitar (stringed, using fret.string); the second is piano (non-stringed, using note names and octaves like C4 D4).',
		});

		if (plugin) {
			container.createEl('h4', {
				text: 'Example 1: electric guitar (standard 6-string tuning)',
			});
			const playgroundHost1 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost1, SAMPLE, {});

			container.createEl('h4', {
				text: 'Example 2: piano (non-stringed, note names and octaves)',
			});
			const playgroundHost2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost2, SAMPLE2, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render.' });
		}
	},
};

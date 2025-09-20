// Documentation Panel: Metadata (Minimal Set)
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// TODO: Templates and alignment methods to be added later (skipped for now)
const SAMPLE = `// Song information (only at the beginning)
  \\title "Song Title"
  \\subtitle Subtitle
  \\artist Artist
  \\album 'My Album'
  \\words Daniel
  \\music alphaTab
  \\copyright 'Daniel (Creator of alphaTab)'
  \\instructions "This is an example.\\nWith instructions."
  \\notices "Additional notes\\nEmbedded in the data model."
  \\tab "Daniel"
  // Tempo in BPM (label is optional)
  \\tempo 200 "Tempo Label"
// Track and Staff Settings (can be used after \\track and \\staff)
  // Instrument as General MIDI number or name
  \\instrument 30
  // Capo fret
  \\capo 2
  // String tuning starting at the most bottom string
  \\tuning e5 b4 g4 d4 a3 e3
// end of metadata
.
// Simple content for visualization: two bars of quarter notes
:4 C4 D4 E4 F4 | C4 D4 E4 F4`;

export default {
	id: 'metadata',
	title: 'Metadata',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Metadata (Song Information & Global Settings)' });
		container.createEl('p', {
			text: 'Metadata uses the format \\tag value and is generally written at the beginning of the score. It specifies global information (title, artist, tempo, etc.) and performance-related settings (instrument, capo, tuning). If metadata is included, the section must end with a dot (.).',
		});
		const ul = container.createEl('ul');
		ul.createEl('li', {
			text: '\\title / \\subtitle / \\artist / \\album etc.: Song information displayed on the score.',
		});
		ul.createEl('li', { text: '\\tempo: Global tempo (BPM), with optional label text.' });
		ul.createEl('li', {
			text: '\\instrument: Specify timbre using GM number or name; attempts to infer default tuning when \\tuning is not specified.',
		});
		ul.createEl('li', {
			text: '\\tuning: Specify pitch for each string (e.g., E4 B3 G3 D3 A2 E2).',
		});
		container.createEl('p', {
			text: 'The example below includes common metadata fields, followed by two bars of content after the dot (.) for quick verification.',
		});

		if (plugin) {
			const playgroundHost = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, playgroundHost, SAMPLE, {});
		} else {
			container.createEl('div', { text: 'Plugin context missing, cannot render.' });
		}
	},
};

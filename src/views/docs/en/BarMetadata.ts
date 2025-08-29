// Documentation Panel: Bar Metadata
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE_TS = `\\ts 3 4 | \\ts 4 4 | \\ts 6 8 | \\ts common`;

const SAMPLE_REPEATS = `\\ro 1.3 2.3 3.3 4.3 | 5.3 6.3 7.3 8.3 | \\rc 2 1.3 2.3 3.3 4.3 |
\\ro \\rc 3 1.3 2.3 3.3 4.3`;

const SAMPLE_ALT_ENDINGS = `\\ro 1.3 2.3 3.3 4.3 | \\ae (1 2 3) 5.3 6.3 7.3 8.3 | \\ae 4 \\rc 4 5.3 8.3 7.3 6.3`;

const SAMPLE_KEYS = `\\ks Cb | \\ks C | \\ks C# |
\\ks Aminor | \\ks Dmajor | \\ks Bminor`;

const SAMPLE_CLEF_OTTAVA = `\\clef G2 | \\clef F4 | \\clef C3 | \\clef C4 | \\clef N |
\\clef Treble | \\clef Bass | \\clef Tenor | \\clef Alto | \\clef Neutral |
\\clef F4 \\ottava 15ma | | \\ottava regular | | \\clef C3 \\ottava 8vb | |`;

const SAMPLE_TEMPO_IN_BARS = `.\n\\tempo 30 1.3 2.3 3.3 4.3 |\n\\tempo 80 1.3 2.3 3.3 4.3`;

const SAMPLE_TRIPLET_FEEL = `\\tf none 3.3*4 |\n\\tf triplet-16th 3.3*4 | \\tf triplet-8th 3.3*4 |\n\\tf dotted-16th 3.3*4 | \\tf dotted-8th 3.3*4 |\n\\tf scottish-16th 3.3*4 | \\tf scottish-8th 3.3*4 |\n\\tf no 1.1*4 |\n\\tf t16 1.1*4 | \\tf t8 1.1*4 |\n\\tf d16 1.1*4 | \\tf d8 1.1*4 |\n\\tf s16 1.1*4 | \\tf s8 1.1*4`;

const SAMPLE_ANACRUSIS = `\\ks D \\ts 24 16 \\ac r.16 6.3 7.3 9.3 7.3 6.3 | r.16 5.4 7.4 9.4 7.4 5.4 6.3.4{d} 9.6.16 10.6 12.6 10.6 9.6 14.6.4{d} r.16`;

const SAMPLE_SECTION = `\\section Intro\n1.1 1.1 1.1 1.1 | 1.1 1.1 1.1 1.1 |\n\\section "Chorus 01"\n1.1 1.1 1.1 1.1 |\n\\section S Solo\n1.1 1.1 1.1 1.1`;

const SAMPLE_DOUBLE_BAR = `\\db 3.3 3.3 3.3 3.3 | 1.1 2.1 3.1 4.1`;

const SAMPLE_SIMILE = `3.3*4 | \\simile simple | 3.3*4 | 4.3*4 | \\simile firstofdouble | \\simile secondofdouble`;

export default {
	id: 'bar-metadata',
	title: 'Bar Metadata',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Bar Metadata' });
		container.createEl('p', { text: 'Demonstrates time signatures, repeats and endings, key signatures, clef/ottava, tempo changes within bars, triplet feel, anacrusis, sections, double bar lines, simile marks, etc.' });

		const sections: Array<[string, string]> = [
			['Time Signatures', SAMPLE_TS],
			['Repeats', SAMPLE_REPEATS],
			['Alternate Endings', SAMPLE_ALT_ENDINGS],
			['Key Signatures', SAMPLE_KEYS],
			['Clef & Ottava', SAMPLE_CLEF_OTTAVA],
			['Tempo Changes in Bars', SAMPLE_TEMPO_IN_BARS],
			['Triplet Feel', SAMPLE_TRIPLET_FEEL],
			['Anacrusis', SAMPLE_ANACRUSIS],
			['Sections', SAMPLE_SECTION],
			['Double Bar', SAMPLE_DOUBLE_BAR],
			['Simile Marks', SAMPLE_SIMILE],
		];

		for (const [title, sample] of sections) {
			container.createEl('h4', { text: title });
			if (plugin) {
				const host = container.createDiv({ cls: 'doc-playground-host' });
				createAlphaTexPlayground(plugin, host, sample, {});
			}
		}

		if (!plugin) {
			container.createEl('div', { text: 'Plugin context missing, cannot render examples.' });
		}
	}
};



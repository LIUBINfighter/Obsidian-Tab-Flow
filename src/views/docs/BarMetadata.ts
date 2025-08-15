// 文档面板：Bar Metadata（小节元数据）
import type TabFlowPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

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
	title: 'Bar Metadata 小节元数据',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Bar Metadata（小节元数据）' });
		container.createEl('p', { text: '演示拍号、反复与结尾、调号、谱号/八度、小节内变速、三连感、弱起、分段、双小节线、Simile 等。' });

		const sections: Array<[string, string]> = [
			['拍号（Time Signatures）', SAMPLE_TS],
			['反复（Repeats）', SAMPLE_REPEATS],
			['可选结尾（Alternate Endings）', SAMPLE_ALT_ENDINGS],
			['调号（Key Signatures）', SAMPLE_KEYS],
			['谱号与八度（Clef & Ottava）', SAMPLE_CLEF_OTTAVA],
			['小节内速度变更（Tempo in Bars）', SAMPLE_TEMPO_IN_BARS],
			['三连感（Triplet Feel）', SAMPLE_TRIPLET_FEEL],
			['弱起（Anacrusis）', SAMPLE_ANACRUSIS],
			['分段（Sections）', SAMPLE_SECTION],
			['双小节线（Double Bar）', SAMPLE_DOUBLE_BAR],
			['Simile 标记', SAMPLE_SIMILE],
		];

		for (const [title, sample] of sections) {
			container.createEl('h4', { text: title });
			if (plugin) {
				const host = container.createDiv({ cls: 'doc-playground-host' });
				createAlphaTexPlayground(plugin, host, sample, {});
			}
		}

		if (!plugin) {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染示例。' });
		}
	}
};



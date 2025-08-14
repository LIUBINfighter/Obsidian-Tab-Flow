// 文档面板：Note Effects（音符效果）
import type MyPlugin from '../../main';
import { createAlphaTexPlayground } from '../../components/AlphaTexPlayground';

const SAMPLE_HARMONICS = `:8 3.3{nh} 3.3{ah} 3.3{ph} 3.3{th} 3.3{sh}`;

const SAMPLE_TRILL = `:4 3.3{tr 4 16} 3.3{tr 5 32} 3.3{tr 6 64}`;

const SAMPLE_VIBRATO = `3.3{v}`;

const SAMPLE_SLIDE = `3.3{sl} 4.3 3.3{ss} 4.3 | 3.3{sib} 3.3{sia} 3.3{sou} 3.3{sod} | 3.3{sib sou} 3.3{sib sod} 3.3{sia sod} 3.3{sia sou} | x.3{psd} 3.3 | x.3{psu} 3.3`;

const SAMPLE_HO_PO = `3.3{h} 4.3 4.3{h} 3.3 | 3.3{h} 4.3{h} 3.3{h} 4.3`;

const SAMPLE_LHT = `:16 15.1{h} 13.1{h} 12.1{h} 15.2{lht}`;

const SAMPLE_GHOST = `3.3{g}`;

const SAMPLE_DEAD = `x.3 3.3{x}`;

const SAMPLE_ACCENT = `3.3{ac} 3.3{hac} 3.3{ten}`;

const SAMPLE_STACCATO = `3.3{st}`;

const SAMPLE_PM = `3.3{pm} 3.3{pm} 3.3{pm} 3.3{pm}`;

const SAMPLE_LET_RING = `3.4{lr} 3.3{lr} 3.2{lr} 3.1{lr}`;

const SAMPLE_FINGERING = `:8 3.3{lf 1} 3.3{lf 2} 3.3{lf 3} 3.3{lf 4} 3.3{lf 5} (2.2{lf 4} 2.3{lf 3} 2.4{lf 2}) | :8 3.3{rf 1} 3.3{rf 2} 3.3{rf 3} 3.3{rf 4} 3.3{lf 5}`;

const SAMPLE_ORNAMENTS = `:1 C4{turn} | C4 {iturn} | C4 {umordent} | C4 {lmordent}`;

const SAMPLE_SHOW_STRINGS = `3.3{string} 3.4{string} 3.5{string}`;

const SAMPLE_BENDS = `3.3{b (0 4)} | 3.3{b (0 4 0 8)} |`;

const SAMPLE_BENDS_EXACT = `:1 3.3 {be (0 0 5 2 30 4)}`;

const SAMPLE_TIED_STRINGED = `3.3 -.3 | (1.1 3.2 2.3 0.4) (-.1 -.4)`;

const SAMPLE_TIED_NON_STRINGED = `\\tuning piano
.
:2 a4 - |
:2 a4 a4{-} |
:2 (a4 a3) (- a3) |
:2 (a4 a3) (a4 -) |
:2 (a4 a3) (a4{t} a3) |
:4 (a4 a3) (b2 b3) a4{t} a3{-}`;

const SAMPLE_INVISIBLE = `:8 3.3 (4.4{hide} 5.5)`;

const SAMPLE_SLUR = `(3.3 {slur s1} 4.4).4 7.3.8 8.3.8 10.3 {slur s1} .8`;

export default {
	id: 'note-effects',
	title: 'Note Effects 音符效果',
	render(container: HTMLElement, plugin?: MyPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Note Effects（音符效果）' });
		container.createEl('p', { text: '演示泛音、颤音/滑音/击勾弦、鬼音/闷音、重音/断奏、连音线、指法、装饰音、弯音、连音、可见性等。' });

		const sections: Array<[string, string]> = [
			['Harmonics（泛音）', SAMPLE_HARMONICS],
			['Trill（颤音）', SAMPLE_TRILL],
			['Vibrato（颤音指法）', SAMPLE_VIBRATO],
			['Slides（滑音）', SAMPLE_SLIDE],
			['Hammer-On / Pull-Off（击勾弦）', SAMPLE_HO_PO],
			['Left Hand Tapping', SAMPLE_LHT],
			['Ghost / Dead Notes', `${SAMPLE_GHOST} | ${SAMPLE_DEAD}`],
			['Accentuations / Staccato', `${SAMPLE_ACCENT} | ${SAMPLE_STACCATO}`],
			['Palm Mute / Let Ring', `${SAMPLE_PM} | ${SAMPLE_LET_RING}`],
			['Fingering（左右手指法）', SAMPLE_FINGERING],
			['Ornaments（装饰音）', SAMPLE_ORNAMENTS],
			['Show String Numbers（弦序号）', SAMPLE_SHOW_STRINGS],
			['Bends（弯音）', SAMPLE_BENDS],
			['Bends 精确（be）', SAMPLE_BENDS_EXACT],
			['Tied Notes（连音）- 弦乐', SAMPLE_TIED_STRINGED],
			['Tied Notes（连音）- 非弦乐', SAMPLE_TIED_NON_STRINGED],
			['Invisible Notes（隐藏音）', SAMPLE_INVISIBLE],
			['Slurs（连线）', SAMPLE_SLUR],
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



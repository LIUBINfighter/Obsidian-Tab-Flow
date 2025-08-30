// 文档面板：Beat Effects（节拍效果）
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE_SIMPLE = `// fade in/out, swell; vibrato; tap/slap/pop; dotted/double dotted; pick stroke; grace; tuplets; tremolo picking; crescendo/decrescendo
3.3{f} 3.3{fo} 3.3{vs} |
3.3{v} 3.3{vw} |
3.3{tt} 3.3{s} 3.3{p} |
3.3{d} 3.3{dd} |
3.3{su} 3.3{sd} |
3.3{gr ob} 3.3 3.3{gr} 3.3 |
3.3{tu 3} 3.3{tu 5} 3.3{tu 4 3} |
3.3{tp 8} 3.3{tp 16} 3.3{tp 32} |
3.3{cre} 3.3{cre} 3.3{dec} 3.3{dec}`;

const SAMPLE_DYNAMICS = `1.1.8{dy ppp} 1.1{dy pp} 1.1{dy p} 1.1{dy mp} 1.1{dy mf} 1.1{dy f} 1.1{dy ff} 1.1{dy fff}`;

const SAMPLE_TUPLET_RANGE = `:4{tu 3} 3.3 3.3 3.3 :8 3.3 3.3 3.3 3.3 |
:8{tu 3} 3.3 3.3 3.3 3.3.16 3.3.16 3.3.16 3.3.2{tu 1} 3.3.16{tu 1} 3.3.4 3.3.4 3.3.4`;

const SAMPLE_TREMOLO_WB = `3.3.1{tb (0 4 0 8)} | 3.3.1{tb (0 -4 0 -8)} |`;

const SAMPLE_TREMOLO_WB_EXACT = `3.3.1{tbe (0 0 5 4 30 8 60 0)}`;

const SAMPLE_BRUSH_ARP = `:2 (0.1 0.2 0.3 2.4 2.5 0.6){bd} (0.1 0.2 0.3 2.4 2.5 0.6){bu} |
(0.1 0.2 0.3 2.4 2.5 0.6){ad} (0.1 0.2 0.3 2.4 2.5 0.6){au} |
(0.1 0.2 0.3 2.4 2.5 0.6){bd 360} (0.1 0.2 0.3 2.4 2.5 0.6){bu 60}`;

const SAMPLE_CHORDS = `(1.1 3.2 5.3 3.4 1.5){ch "A#add9"} (1.1 3.2 5.3 3.4 1.5)*3 | (4.1 6.2 6.3 6.4 4.5){ch "C#"} (4.1 6.2 6.3 6.4 4.5)*3`;

const SAMPLE_TIMER = `\\tempo 120
.
3.3.4 { timer } 3.3.4*3 | \\\ro 3.3.4 { timer } 3.3.4*3 | 3.3.4 { timer } 3.3.4*3 | \\jump DaCapoAlFine 3.3.4 { timer } 3.3.4*3`;

const SAMPLE_SUSTAIN_WAH = `3.3{string} 3.3{spd} 3.3 3.3 {spu} | 3.3 3.3{waho} 3.3 3.3 {wahc}`;

const SAMPLE_BARRE_OTTAVA = `1.1 {barre 24} 2.1 {barre 24} 3.1 {barre 24} 4.1 | 1.1 {barre 4 half} 2.1 {barre 4 half} 3.1 {barre 4 half} 4.1 {barre 4 half} | 3.3.4{ ot 15ma } 3.3.4{ ot 8vb }`;

const SAMPLE_BEAMING = `:8 3.3{ beam invert } 3.3 | 3.1{ beam up } 3.1 | 3.6{ beam down } 3.6 | 3.3{ beam auto } 3.3 | 3.3{ beam split } 3.3 | 3.3 3.3 { beam merge } 3.3 3.3 | 3.3.16 {beam splitsecondary} 3.3`;

export default {
	id: 'beat-effects',
	title: 'Beat Effects 节拍效果',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Beat Effects（节拍效果）' });
		container.createEl('p', {
			text: '演示常见节拍效果、力度、连音/颤音拨、刷弦/分解和弦、计时器、延音/哇音踏板、八度、连线控制等。',
		});

		const sections: Array<[string, string]> = [
			['常见效果（概览）', SAMPLE_SIMPLE],
			['力度（Dynamics）', SAMPLE_DYNAMICS],
			['Tuplet 范围', SAMPLE_TUPLET_RANGE],
			['Tremolo / Whammy Bar', SAMPLE_TREMOLO_WB],
			['Whammy 精确模式', SAMPLE_TREMOLO_WB_EXACT],
			['刷弦/分解和弦', SAMPLE_BRUSH_ARP],
			['和弦标注（ch）', SAMPLE_CHORDS],
			['计时器（timer）', SAMPLE_TIMER],
			['延音与 Wah 踏板', SAMPLE_SUSTAIN_WAH],
			['Barré 与 Ottava', SAMPLE_BARRE_OTTAVA],
			['连线/分线（Beaming）', SAMPLE_BEAMING],
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
	},
};

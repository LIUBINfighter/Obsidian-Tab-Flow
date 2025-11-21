// Documentation Panel: Notes - Writing Notes
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

const SAMPLE_SINGLE_NOTES = `// Single notes and rests (multiple bars separated by |)
0.6.2 1.5.4 3.4.4 |
5.3.8 5.3.8 5.3.8 5.3.8 r.2`;

const SAMPLE_CHORDS = `// Chords: Group with parentheses for multiple notes in same beat, then specify duration
(0.3 0.4).4 (3.3 3.4).4 (5.3 5.4).4 r.8 (0.3 0.4).8 |
r.8 (3.3 3.4).8 r.8 (6.3 6.4).8 (5.3 5.4).4 r.4 |
(0.3 0.4).4 (3.3 3.4).4 (5.3 5.4).4 r.8 (3.3 3.4).8 |
r.8 (0.3 0.4).8`;

const SAMPLE_DURATION_RANGES = `// Use :duration to specify same duration for subsequent notes
// explicit ranges via :duration
:4 2.3 3.3 :8 3.3 4.3 3.3 4.3 |
// implicit ranges via beat duration
2.3.4 3.3 3.3.8 4.3 3.3 4.3`;

const SAMPLE_REPEAT_BEATS = `// Add repeat multiplier (*N) to a single beat
3.3*4 | 4.3*4`;

const SAMPLE_MULTIPLE_VOICES = `\\track "Piano"
  \\staff{score} \\tuning piano \\instrument acousticgrandpiano
      \\voice
          c4 d4 e4 f4 | c4 d4 e4 f4
      \\voice
          c3 d3 e3 f3 | c3 d3 e3 f3

\\track "Piano2"
  \\staff{score} \\tuning piano \\instrument acousticgrandpiano
      \\voice
          c4 d4 e4 f4 | c4 d4 e4 f4
      \\voice
          c3 d3 e3 f3`;

const SAMPLE_ACCIDENTALS = `\\track
  \\accidentals explicit
  C#4 Db4 C##4 Dbb4 |
  \\accidentals auto
  C#4 Db4 C##4 Dbb4 |
  C#4 { acc forceFlat } C4 { acc forceSharp } C4 { acc forceDoubleSharp } C4 { acc forceDoubleFlat }
\\track
  :4 2.2 { acc forceFlat } 5.3 { acc forceSharp } 5.3 { acc forceDoubleSharp } 5.3 { acc forceDoubleFlat }`;

export default {
	id: 'notes',
	title: 'Notes - writing notes',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Notes - writing notes' });
		container.createEl('p', {
			text: 'The examples below demonstrate how to write general notes in AlphaTex. Multiple bars are separated by vertical lines |. Each bar corresponds to a section on the score.',
		});

		// Single notes and rests
		container.createEl('h4', { text: 'Single notes and rests' });
		container.createEl('p', {
			text: 'Note format is fret.string.duration; rests use r instead of fret. Duration values: 1=whole note, 2=half note, 4=quarter note, 8=eighth note, and so on.',
		});
		if (plugin) {
			const host1 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host1, SAMPLE_SINGLE_NOTES);
		}

		// Chords
		container.createEl('h4', { text: 'Chords' });
		container.createEl('p', {
			text: 'Multiple notes in the same beat are grouped with parentheses: (fret.string fret.string ...).duration.',
		});
		if (plugin) {
			const host2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host2, SAMPLE_CHORDS, {});
		}

		// Duration ranges
		container.createEl('h4', { text: 'Duration ranges' });
		container.createEl('p', {
			text: 'Use :duration to start a duration range, subsequent notes share that duration; AlphaTex also remembers the last explicitly set duration.',
		});
		if (plugin) {
			const host3 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host3, SAMPLE_DURATION_RANGES, {});
		}

		// Repeat beats
		container.createEl('h4', { text: 'Repeat beats' });
		container.createEl('p', {
			text: 'Use *N after a beat to quickly repeat that beat N times.',
		});
		if (plugin) {
			const host4 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host4, SAMPLE_REPEAT_BEATS, {});
		}

		// Multiple voices
		container.createEl('h4', { text: 'Multiple voices' });
		container.createEl('p', {
			text: 'Use \\voice to start a new voice. Multiple independent voices can be written in parallel within the same track; AlphaTab will try to merge bars with different voice counts.',
		});
		if (plugin) {
			const host5 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host5, SAMPLE_MULTIPLE_VOICES, {});
		}

		// Accidentals
		container.createEl('h4', { text: 'Accidentals' });
		container.createEl('p', {
			text: 'Default (\\accidentals explicit) uses accidentals as written; can switch to \\accidentals auto. Accidentals can also be specified in note effects using acc (like forceSharp/forceFlat, etc.).',
		});
		if (plugin) {
			const host6 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host6, SAMPLE_ACCIDENTALS, {});
		}

		if (!plugin) {
			container.createEl('div', { text: 'Plugin context missing, cannot render examples.' });
		}
	},
};

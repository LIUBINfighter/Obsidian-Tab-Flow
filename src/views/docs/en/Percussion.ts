// Docs panel: Percussion
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// Minimal percussion example
const SAMPLE_PERC_ORIGINAL = `\\title "Percussion Basics"
\\instrument 25
.
\\track "Drums"
\\staff {score}
c#5.4 d4.4 c#5.4 d4.4 |
`;

// Comprehensive percussion example from the official docs
const SAMPLE_PERC_OFFICIAL = `\\track "Drums"
\\instrument percussion
\\tempo 120
\\clef neutral
\\articulation defaults
(KickHit RideBell).16 r KickHit KickHit (KickHit RideBell).16 r KickHit KickHit (KickHit RideBell).16 r KickHit KickHit (KickHit RideBell).16 r KickHit KickHit |
(KickHit HiHatOpen) KickHit KickHit KickHit (KickHit HiHatOpen) KickHit KickHit KickHit (KickHit SnareHit HiHatOpen) KickHit KickHit.32 KickHit KickHit.16 (KickHit HiHatOpen) KickHit KickHit KickHit |
(KickHit HiHatOpen).8{tu 3} KickHit{tu 3} KickHit{tu 3} (KickHit SnareHit HiHatOpen){tu 3} KickHit.16{tu 3} KickHit{tu 3} KickHit.8{tu 3} (KickHit HiHatOpen).8{tu 3} KickHit{tu 3} KickHit{tu 3} (KickHit SnareHit HiHatOpen).8{tu 3} KickHit{tu 3} KickHit{tu 3}
`;

const SAMPLE_ARTICULATION_CUSTOM = `\\track "Drums"
\\instrument percussion
\\tempo 120
\\clef neutral
// define the articulation here
\\articulation Kick 36
// use it as note values
Kick.4 Kick.8 Kick.8 Kick.4 Kick.4
`;

const SAMPLE_ARTICULATION_DEFAULTS = `\\track "Drums"
\\instrument percussion
\\tempo 120
\\clef neutral
\\articulation defaults
\\ts 2 4
("Kick (Hit)" "Hi-Hat (Open)") "Kick (Hit)" "Kick (Hit)" "Kick (Hit)"
(KickHit HiHatOpen) KickHit KickHit KickHit
`;

const list = [
	['Ride (choke)', 29, 'Ride choke hit'],
	['Cymbal (hit)', 30, 'Cymbal hit'],
	['Snare (side stick)', 31, 'Snare side stick'],
	['Snare (side stick) 2', 33, 'Snare side stick 2'],
	['Snare (hit)', 34, 'Snare hit'],
	['Kick (hit)', 35, 'Kick hit'],
	['Kick (hit) 2', 36, 'Kick hit 2'],
	['Snare (side stick) 3', 37, 'Snare side stick 3'],
	['Snare (hit) 2', 38, 'Snare hit 2'],
	['Hand Clap (hit)', 39, 'Hand clap hit'],
	['Snare (hit) 3', 40, 'Snare hit 3'],
	['Low Floor Tom (hit)', 41, 'Low floor tom hit'],
	['Hi-Hat (closed)', 42, 'Hi-hat closed'],
	['Very Low Tom (hit)', 43, 'Very low tom hit'],
	['Pedal Hi-Hat (hit)', 44, 'Pedal hi-hat hit'],
	['Low Tom (hit)', 45, 'Low tom hit'],
	['Hi-Hat (open)', 46, 'Hi-hat open'],
	['Mid Tom (hit)', 47, 'Mid tom hit'],
	['High Tom (hit)', 48, 'High tom hit'],
	['Crash high (hit)', 49, 'Crash high hit'],
	['High Floor Tom (hit)', 50, 'High floor tom hit'],
	['Ride (middle)', 51, 'Ride middle hit'],
	['China (hit)', 52, 'China hit'],
	['Ride (bell)', 53, 'Ride bell hit'],
	['Tambourine (hit)', 54, 'Tambourine hit'],
	['Splash (hit)', 55, 'Splash hit'],
	['Cowbell medium (hit)', 56, 'Cowbell medium hit'],
	['Crash medium (hit)', 57, 'Crash medium hit'],
	['Vibraslap (hit)', 58, 'Vibraslap hit'],
	['Ride (edge)', 59, 'Ride edge hit'],
	['Hand (hit)', 60, 'Hand hit'],
	['Hand (hit)', 61, 'Hand hit'],
	['Conga high (mute)', 62, 'Conga high mute'],
	['Conga high (hit)', 63, 'Conga high hit'],
	['Conga low (hit)', 64, 'Conga low hit'],
	['Timbale high (hit)', 65, 'Timbale high hit'],
	['Timbale low (hit)', 66, 'Timbale low hit'],
	['Agogo high (hit)', 67, 'Agogo high hit'],
	['Agogo low (hit)', 68, 'Agogo low hit'],
	['Cabasa (hit)', 69, 'Cabasa hit'],
	['Left Maraca (hit)', 70, 'Left maraca hit'],
	['Whistle high (hit)', 71, 'Whistle high hit'],
	['Whistle low (hit)', 72, 'Whistle low hit'],
	['Guiro (hit)', 73, 'Guiro hit'],
	['Guiro (scrap-return)', 74, 'Guiro scrap-return'],
	['Claves (hit)', 75, 'Claves hit'],
	['Woodblock high (hit)', 76, 'Woodblock high hit'],
	['Woodblock low (hit)', 77, 'Woodblock low hit'],
	['Cuica (mute)', 78, 'Cuica mute'],
	['Cuica (open)', 79, 'Cuica open'],
	['Triangle (mute)', 80, 'Triangle mute'],
	['Triangle (hit)', 81, 'Triangle hit'],
	['Shaker (hit)', 82, 'Shaker hit'],
	['Tinkle Bell (hit)', 83, 'Tinkle bell hit'],
	['Jingle Bell (hit)', 83, 'Jingle bell hit'],
	['Bell Tree (hit)', 84, 'Bell tree hit'],
	['Castanets (hit)', 85, 'Castanets hit'],
	['Surdo (hit)', 86, 'Surdo hit'],
	['Surdo (mute)', 87, 'Surdo mute'],
	['Snare (rim shot)', 91, 'Snare rim shot'],
	['Hi-Hat (half)', 92, 'Hi-hat half open'],
	['Ride (edge) 2', 93, 'Ride edge hit 2'],
	['Ride (choke) 2', 94, 'Ride choke hit 2'],
	['Splash (choke)', 95, 'Splash choke'],
	['China (choke)', 96, 'China choke'],
	['Crash high (choke)', 97, 'Crash high choke'],
	['Crash medium (choke)', 98, 'Crash medium choke'],
	['Cowbell low (hit)', 99, 'Cowbell low hit'],
	['Cowbell low (tip)', 100, 'Cowbell low tip'],
	['Cowbell medium (tip)', 101, 'Cowbell medium tip'],
	['Cowbell high (hit)', 102, 'Cowbell high hit'],
	['Cowbell high (tip)', 103, 'Cowbell high tip'],
	['Hand (mute)', 104, 'Hand mute'],
	['Hand (slap)', 105, 'Hand slap'],
	['Hand (mute) 2', 106, 'Hand mute 2'],
	['Hand (slap) 2', 107, 'Hand slap 2'],
	['Conga low (slap)', 108, 'Conga low slap'],
	['Conga low (mute)', 109, 'Conga low mute'],
	['Conga high (slap)', 110, 'Conga high slap'],
	['Tambourine (return)', 111, 'Tambourine return'],
	['Tambourine (roll)', 112, 'Tambourine roll'],
	['Tambourine (hand)', 113, 'Tambourine hand'],
	['Grancassa (hit)', 114, 'Grancassa hit'],
	['Piatti (hit)', 115, 'Piatti hit'],
	['Piatti (hand)', 116, 'Piatti hand'],
	['Cabasa (return)', 117, 'Cabasa return'],
	['Left Maraca (return)', 118, 'Left maraca return'],
	['Right Maraca (hit)', 119, 'Right maraca hit'],
	['Right Maraca (return)', 120, 'Right maraca return'],
	['Shaker (return)', 122, 'Shaker return'],
	['Bell Tree (return)', 123, 'Bell tree return'],
	['Golpe (thumb)', 124, 'Golpe thumb'],
	['Golpe (finger)', 125, 'Golpe finger'],
	['Ride (middle) 2', 126, 'Ride middle hit 2'],
	['Ride (bell) 2', 127, 'Ride bell hit 2'],
];

export default {
	id: 'percussion',
	title: 'Percussion',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Percussion' });

		// Minimal example
		container.createEl('p', {
			text: 'A minimal percussion example.',
		});

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PERC_ORIGINAL, {});
		}

		// Since badge
		const sinceBadge = container.createDiv({ cls: 'since-badge' });
		sinceBadge.createSpan({ text: 'Since version 1.4.0' });

		// Introduction
		container.createEl('p', {
			text: 'Since alphaTab 1.4, you can also write percussion (drum) tracks in alphaTab. To do so, the track must be set to \\instrument "percussion", after which notes can be added using articulation names or numbers.',
		});

		// Comprehensive official example
		if (plugin) {
			const hostOfficial = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, hostOfficial, SAMPLE_PERC_OFFICIAL, {});
		}

		// Instrument articulations section
		container.createEl('h4', { text: 'Instrument Articulations' });
		container.createEl('p', {
			text: 'AlphaTab comes with a set of default instrument articulations, derived from Guitar Pro 7. Each articulation has an internal number that can be used to reference it. To make writing more human-friendly, you can define custom articulation names via \\articulation name number.',
		});

		if (plugin) {
			const host2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host2, SAMPLE_ARTICULATION_CUSTOM, {});
		}

		container.createEl('p', {
			text: 'If you want to use all articulations, you can specify \\articulation defaults, which provides the entire articulation list with some default names.',
		});

		if (plugin) {
			const host3 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host3, SAMPLE_ARTICULATION_DEFAULTS, {});
		}

		// Articulation list section
		container.createEl('h4', { text: 'Articulation List' });
		container.createEl('p', {
			text: 'To actually get started, you need to know the list of built-in articulations. Refer to the table and examples below as a reference:',
		});

		// Create table
		const table = container.createEl('table', { cls: 'articulation-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Number' });
		headerRow.createEl('th', { text: 'Full Name' });
		headerRow.createEl('th', { text: 'Short Name' });
		headerRow.createEl('th', { text: 'Meaning' });

		const tbody = table.createEl('tbody');
		list.forEach((item) => {
			const row = tbody.createEl('tr');

			// Number cell (plain text)
			row.createEl('td', { text: item[1].toString() });

			// Full name cell with copy button
			const nameLongCell = row.createEl('td');
			const nameLongBtn = nameLongCell.createEl('button', {
				cls: 'copy-btn',
				text: item[0] as string,
				attr: { 'data-copy-text': item[0] as string },
			});
			nameLongBtn.addEventListener('click', () => {
				void navigator.clipboard.writeText(item[0] as string);
				nameLongBtn.textContent = 'Copied!';
				window.setTimeout(() => {
					nameLongBtn.textContent = item[0] as string;
				}, 1000);
			});

			// Short name cell with copy button
			const nameShortCell = row.createEl('td');
			const shortName = (item[0] as string).replace(/[^a-zA-Z0-9]/g, '');
			const nameShortBtn = nameShortCell.createEl('button', {
				cls: 'copy-btn',
				text: shortName,
				attr: { 'data-copy-text': shortName },
			});
			nameShortBtn.addEventListener('click', () => {
				void navigator.clipboard.writeText(shortName);
				nameShortBtn.textContent = 'Copied!';
				window.setTimeout(() => {
					nameShortBtn.textContent = shortName;
				}, 1000);
			});

			// Meaning cell (plain text)
			row.createEl('td', { text: item[2] as string });
		});

		if (!plugin) {
			container.createDiv({ text: 'Missing plugin context, cannot render examples.' });
		}
	},
};

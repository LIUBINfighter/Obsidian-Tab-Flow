// Documentation Panel: Percussion
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// Original simple percussion example
const SAMPLE_PERC_ORIGINAL = `\\title "Percussion Basics"
\\instrument 25
.
\\track "Drums"
\\staff {score}
c#5.4 d4.4 c#5.4 d4.4 |
`;

// Comprehensive percussion examples from official documentation
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
	['Ride (choke)', 29],
	['Cymbal (hit)', 30],
	['Snare (side stick)', 31],
	['Snare (side stick) 2', 33],
	['Snare (hit)', 34],
	['Kick (hit)', 35],
	['Kick (hit) 2', 36],
	['Snare (side stick) 3', 37],
	['Snare (hit) 2', 38],
	['Hand Clap (hit)', 39],
	['Snare (hit) 3', 40],
	['Low Floor Tom (hit)', 41],
	['Hi-Hat (closed)', 42],
	['Very Low Tom (hit)', 43],
	['Pedal Hi-Hat (hit)', 44],
	['Low Tom (hit)', 45],
	['Hi-Hat (open)', 46],
	['Mid Tom (hit)', 47],
	['High Tom (hit)', 48],
	['Crash high (hit)', 49],
	['High Floor Tom (hit)', 50],
	['Ride (middle)', 51],
	['China (hit)', 52],
	['Ride (bell)', 53],
	['Tambourine (hit)', 54],
	['Splash (hit)', 55],
	['Cowbell medium (hit)', 56],
	['Crash medium (hit)', 57],
	['Vibraslap (hit)', 58],
	['Ride (edge)', 59],
	['Hand (hit)', 60],
	['Hand (hit)', 61],
	['Conga high (mute)', 62],
	['Conga high (hit)', 63],
	['Conga low (hit)', 64],
	['Timbale high (hit)', 65],
	['Timbale low (hit)', 66],
	['Agogo high (hit)', 67],
	['Agogo low (hit)', 68],
	['Cabasa (hit)', 69],
	['Left Maraca (hit)', 70],
	['Whistle high (hit)', 71],
	['Whistle low (hit)', 72],
	['Guiro (hit)', 73],
	['Guiro (scrap-return)', 74],
	['Claves (hit)', 75],
	['Woodblock high (hit)', 76],
	['Woodblock low (hit)', 77],
	['Cuica (mute)', 78],
	['Cuica (open)', 79],
	['Triangle (mute)', 80],
	['Triangle (hit)', 81],
	['Shaker (hit)', 82],
	['Tinkle Bell (hit)', 83],
	['Jingle Bell (hit)', 83],
	['Bell Tree (hit)', 84],
	['Castanets (hit)', 85],
	['Surdo (hit)', 86],
	['Surdo (mute)', 87],
	['Snare (rim shot)', 91],
	['Hi-Hat (half)', 92],
	['Ride (edge) 2', 93],
	['Ride (choke) 2', 94],
	['Splash (choke)', 95],
	['China (choke)', 96],
	['Crash high (choke)', 97],
	['Crash medium (choke)', 98],
	['Cowbell low (hit)', 99],
	['Cowbell low (tip)', 100],
	['Cowbell medium (tip)', 101],
	['Cowbell high (hit)', 102],
	['Cowbell high (tip)', 103],
	['Hand (mute)', 104],
	['Hand (slap)', 105],
	['Hand (mute) 2', 106],
	['Hand (slap) 2', 107],
	['Conga low (slap)', 108],
	['Conga low (mute)', 109],
	['Conga high (slap)', 110],
	['Tambourine (return)', 111],
	['Tambourine (roll)', 112],
	['Tambourine (hand)', 113],
	['Grancassa (hit)', 114],
	['Piatti (hit)', 115],
	['Piatti (hand)', 116],
	['Cabasa (return)', 117],
	['Left Maraca (return)', 118],
	['Right Maraca (hit)', 119],
	['Right Maraca (return)', 120],
	['Shaker (return)', 122],
	['Bell Tree (return)', 123],
	['Golpe (thumb)', 124],
	['Golpe (finger)', 125],
	['Ride (middle) 2', 126],
	['Ride (bell) 2', 127],
];
// Original simple percussion example
const SAMPLE_PERC_ORIGINAL = `\\title "Percussion Basics"
\\instrument 25
.
\\track "Drums"
\\staff {score}
c#5.4 d4.4 c#5.4 d4.4 |
`;

// Comprehensive percussion examples from official documentation
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
	['Ride (choke)', 29],
	['Cymbal (hit)', 30],
	['Snare (side stick)', 31],
	['Snare (side stick) 2', 33],
	['Snare (hit)', 34],
	['Kick (hit)', 35],
	['Kick (hit) 2', 36],
	['Snare (side stick) 3', 37],
	['Snare (hit) 2', 38],
	['Hand Clap (hit)', 39],
	['Snare (hit) 3', 40],
	['Low Floor Tom (hit)', 41],
	['Hi-Hat (closed)', 42],
	['Very Low Tom (hit)', 43],
	['Pedal Hi-Hat (hit)', 44],
	['Low Tom (hit)', 45],
	['Hi-Hat (open)', 46],
	['Mid Tom (hit)', 47],
	['High Tom (hit)', 48],
	['Crash high (hit)', 49],
	['High Floor Tom (hit)', 50],
	['Ride (middle)', 51],
	['China (hit)', 52],
	['Ride (bell)', 53],
	['Tambourine (hit)', 54],
	['Splash (hit)', 55],
	['Cowbell medium (hit)', 56],
	['Crash medium (hit)', 57],
	['Vibraslap (hit)', 58],
	['Ride (edge)', 59],
	['Hand (hit)', 60],
	['Hand (hit)', 61],
	['Conga high (mute)', 62],
	['Conga high (hit)', 63],
	['Conga low (hit)', 64],
	['Timbale high (hit)', 65],
	['Timbale low (hit)', 66],
	['Agogo high (hit)', 67],
	['Agogo low (hit)', 68],
	['Cabasa (hit)', 69],
	['Left Maraca (hit)', 70],
	['Whistle high (hit)', 71],
	['Whistle low (hit)', 72],
	['Guiro (hit)', 73],
	['Guiro (scrap-return)', 74],
	['Claves (hit)', 75],
	['Woodblock high (hit)', 76],
	['Woodblock low (hit)', 77],
	['Cuica (mute)', 78],
	['Cuica (open)', 79],
	['Triangle (mute)', 80],
	['Triangle (hit)', 81],
	['Shaker (hit)', 82],
	['Tinkle Bell (hit)', 83],
	['Jingle Bell (hit)', 83],
	['Bell Tree (hit)', 84],
	['Castanets (hit)', 85],
	['Surdo (hit)', 86],
	['Surdo (mute)', 87],
	['Snare (rim shot)', 91],
	['Hi-Hat (half)', 92],
	['Ride (edge) 2', 93],
	['Ride (choke) 2', 94],
	['Splash (choke)', 95],
	['China (choke)', 96],
	['Crash high (choke)', 97],
	['Crash medium (choke)', 98],
	['Cowbell low (hit)', 99],
	['Cowbell low (tip)', 100],
	['Cowbell medium (tip)', 101],
	['Cowbell high (hit)', 102],
	['Cowbell high (tip)', 103],
	['Hand (mute)', 104],
	['Hand (slap)', 105],
	['Hand (mute) 2', 106],
	['Hand (slap) 2', 107],
	['Conga low (slap)', 108],
	['Conga low (mute)', 109],
	['Conga high (slap)', 110],
	['Tambourine (return)', 111],
	['Tambourine (roll)', 112],
	['Tambourine (hand)', 113],
	['Grancassa (hit)', 114],
	['Piatti (hit)', 115],
	['Piatti (hand)', 116],
	['Cabasa (return)', 117],
	['Left Maraca (return)', 118],
	['Right Maraca (hit)', 119],
	['Right Maraca (return)', 120],
	['Shaker (return)', 122],
	['Bell Tree (return)', 123],
	['Golpe (thumb)', 124],
	['Golpe (finger)', 125],
	['Ride (middle) 2', 126],
	['Ride (bell) 2', 127],
];

export default {
	id: 'percussion',
	title: 'Percussion',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Percussion' });

		// Original simple example

		// Original simple example
		container.createEl('p', {
			text: 'Demonstrates minimal percussion example (illustrative).',
			text: 'Demonstrates minimal percussion example (illustrative).',
		});

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PERC_ORIGINAL, {});
		}

		// Since badge
		const sinceBadge = container.createEl('div', { cls: 'since-badge' });
		sinceBadge.createEl('span', { text: 'Since 1.4.0' });

		// Introduction
		container.createEl('p', {
			text: 'Since alphaTab 1.4 you can also write percussion (drum) tracks in alphaTab. For this the \\instrument "percussion" has to be set for the track and then you can add notes via articulation names or numbers.',
		});

		// Official comprehensive example
		if (plugin) {
			const hostOfficial = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, hostOfficial, SAMPLE_PERC_OFFICIAL, {});
		}

		// Instrument Articulations section
		container.createEl('h4', { text: 'Instrument Articulations' });
		container.createEl('p', {
			text: 'alphaTab comes with a default set of instrument articulations derived from Guitar Pro 7. Each articulation has an internal number with which it can be referenced. To make writing more human friendly you can define custom articulation names via \\articulation Name Number',
		});

		if (plugin) {
			const host2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host2, SAMPLE_ARTICULATION_CUSTOM, {});
		}

		container.createEl('p', {
			text: 'If you simply want to use all articulations you can specify \\articulation defaults and the whole list of articulations with some default names will be provided.',
		});

		if (plugin) {
			const host3 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host3, SAMPLE_ARTICULATION_DEFAULTS, {});
		}

		// Articulation List section
		container.createEl('h4', { text: 'Articulation List' });
		container.createEl('p', {
			text: 'To actually get started you need to know the list of built-in articulations. Refer to this list below and the example as reference:',
		});

		// Create table
		const table = container.createEl('table', { cls: 'articulation-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Number' });
		headerRow.createEl('th', { text: 'Name Long' });
		headerRow.createEl('th', { text: 'Name Short' });

		const tbody = table.createEl('tbody');
		list.forEach((item) => {
			const row = tbody.createEl('tr');

			// Number cell as plain text
			row.createEl('td', { text: item[1].toString() });

			// Name Long cell with copy button
			const nameLongCell = row.createEl('td');
			const nameLongBtn = nameLongCell.createEl('button', {
				cls: 'copy-btn',
				text: item[0] as string,
				attr: { 'data-copy-text': item[0] as string },
			});
			nameLongBtn.addEventListener('click', () => {
				void navigator.clipboard.writeText(item[0] as string);
				nameLongBtn.textContent = 'Copied!';
				setTimeout(() => {
					nameLongBtn.textContent = item[0] as string;
				}, 1000);
			});

			// Name Short cell with copy button
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
				setTimeout(() => {
					nameShortBtn.textContent = shortName;
				}, 1000);
			});
		});

		if (!plugin) {
			container.createEl('div', { text: 'Plugin context missing, cannot render examples.' });
		}
	},
};

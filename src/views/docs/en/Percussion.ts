// 文档面板：Percussion（打击乐）
import type TabFlowPlugin from '../../../main';
import { createAlphaTexPlayground } from '../../../components/AlphaTexPlayground';

// 最初的简单打击乐示例
const SAMPLE_PERC_ORIGINAL = `\\title "Percussion Basics"
\\instrument 25
.
\\track "Drums"
\\staff {score}
c#5.4 d4.4 c#5.4 d4.4 |
`;

// 来自官方文档的综合打击乐示例
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
	['Ride (choke)', 29, '镲边闷击'],
	['Cymbal (hit)', 30, '镲击'],
	['Snare (side stick)', 31, '军鼓侧边'],
	['Snare (side stick) 2', 33, '军鼓侧边2'],
	['Snare (hit)', 34, '军鼓击'],
	['Kick (hit)', 35, '底鼓击'],
	['Kick (hit) 2', 36, '底鼓击2'],
	['Snare (side stick) 3', 37, '军鼓侧边3'],
	['Snare (hit) 2', 38, '军鼓击2'],
	['Hand Clap (hit)', 39, '拍手击'],
	['Snare (hit) 3', 40, '军鼓击3'],
	['Low Floor Tom (hit)', 41, '低音落地筒击'],
	['Hi-Hat (closed)', 42, '踩镲闭合'],
	['Very Low Tom (hit)', 43, '超低音筒击'],
	['Pedal Hi-Hat (hit)', 44, '踩镲踏板击'],
	['Low Tom (hit)', 45, '低音筒击'],
	['Hi-Hat (open)', 46, '踩镲开放'],
	['Mid Tom (hit)', 47, '中音筒击'],
	['High Tom (hit)', 48, '高音筒击'],
	['Crash high (hit)', 49, '高音碎音镲击'],
	['High Floor Tom (hit)', 50, '高音落地筒击'],
	['Ride (middle)', 51, '镲边中击'],
	['China (hit)', 52, '中国镲击'],
	['Ride (bell)', 53, '镲铃击'],
	['Tambourine (hit)', 54, '铃鼓击'],
	['Splash (hit)', 55, '水花镲击'],
	['Cowbell medium (hit)', 56, '中音牛铃击'],
	['Crash medium (hit)', 57, '中音碎音镲击'],
	['Vibraslap (hit)', 58, '颤音器击'],
	['Ride (edge)', 59, '镲边击'],
	['Hand (hit)', 60, '手击'],
	['Hand (hit)', 61, '手击'],
	['Conga high (mute)', 62, '康加鼓高音闷击'],
	['Conga high (hit)', 63, '康加鼓高音击'],
	['Conga low (hit)', 64, '康加鼓低音击'],
	['Timbale high (hit)', 65, '廷巴莱高音击'],
	['Timbale low (hit)', 66, '廷巴莱低音击'],
	['Agogo high (hit)', 67, '阿哥哥鼓高音击'],
	['Agogo low (hit)', 68, '阿哥哥鼓低音击'],
	['Cabasa (hit)', 69, '卡巴萨击'],
	['Left Maraca (hit)', 70, '左沙锤击'],
	['Whistle high (hit)', 71, '高音哨击'],
	['Whistle low (hit)', 72, '低音哨击'],
	['Guiro (hit)', 73, '刮瓜击'],
	['Guiro (scrap-return)', 74, '刮瓜回刮'],
	['Claves (hit)', 75, '双响筒击'],
	['Woodblock high (hit)', 76, '高音木鱼击'],
	['Woodblock low (hit)', 77, '低音木鱼击'],
	['Cuica (mute)', 78, '库依卡鼓闷击'],
	['Cuica (open)', 79, '库依卡鼓开放击'],
	['Triangle (mute)', 80, '三角铁闷击'],
	['Triangle (hit)', 81, '三角铁击'],
	['Shaker (hit)', 82, '沙锤击'],
	['Tinkle Bell (hit)', 83, '铃铛击'],
	['Jingle Bell (hit)', 83, '铃铛击'],
	['Bell Tree (hit)', 84, '铃树击'],
	['Castanets (hit)', 85, '响板击'],
	['Surdo (hit)', 86, '苏都鼓击'],
	['Surdo (mute)', 87, '苏都鼓闷击'],
	['Snare (rim shot)', 91, '军鼓边击'],
	['Hi-Hat (half)', 92, '踩镲半开'],
	['Ride (edge) 2', 93, '镲边击2'],
	['Ride (choke) 2', 94, '镲边闷击2'],
	['Splash (choke)', 95, '水花镲闷击'],
	['China (choke)', 96, '中国镲闷击'],
	['Crash high (choke)', 97, '高音碎音镲闷击'],
	['Crash medium (choke)', 98, '中音碎音镲闷击'],
	['Cowbell low (hit)', 99, '低音牛铃击'],
	['Cowbell low (tip)', 100, '低音牛铃尖击'],
	['Cowbell medium (tip)', 101, '中音牛铃尖击'],
	['Cowbell high (hit)', 102, '高音牛铃击'],
	['Cowbell high (tip)', 103, '高音牛铃尖击'],
	['Hand (mute)', 104, '手闷击'],
	['Hand (slap)', 105, '手拍击'],
	['Hand (mute) 2', 106, '手闷击2'],
	['Hand (slap) 2', 107, '手拍击2'],
	['Conga low (slap)', 108, '康加鼓低音拍击'],
	['Conga low (mute)', 109, '康加鼓低音闷击'],
	['Conga high (slap)', 110, '康加鼓高音拍击'],
	['Tambourine (return)', 111, '铃鼓回击'],
	['Tambourine (roll)', 112, '铃鼓滚奏'],
	['Tambourine (hand)', 113, '铃鼓手击'],
	['Grancassa (hit)', 114, '格兰卡萨击'],
	['Piatti (hit)', 115, '钹击'],
	['Piatti (hand)', 116, '钹手击'],
	['Cabasa (return)', 117, '卡巴萨回击'],
	['Left Maraca (return)', 118, '左沙锤回击'],
	['Right Maraca (hit)', 119, '右沙锤击'],
	['Right Maraca (return)', 120, '右沙锤回击'],
	['Shaker (return)', 122, '沙锤回击'],
	['Bell Tree (return)', 123, '铃树回击'],
	['Golpe (thumb)', 124, '戈尔佩拇指击'],
	['Golpe (finger)', 125, '戈尔佩手指击'],
	['Ride (middle) 2', 126, '镲边中击2'],
	['Ride (bell) 2', 127, '镲铃击2'],
];

export default {
	id: 'percussion',
	title: 'Percussion 打击乐',
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl('h3', { text: 'Percussion（打击乐）' });

		// 最初的简单示例
		container.createEl('p', {
			text: '演示最小打击乐谱例（示意）。',
		});

		if (plugin) {
			const host = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host, SAMPLE_PERC_ORIGINAL, {});
		}

		// Since badge
		const sinceBadge = container.createEl('div', { cls: 'since-badge' });
		sinceBadge.createEl('span', { text: '自 1.4.0 版本起' });

		// 介绍
		container.createEl('p', {
			text: '自 alphaTab 1.4 起，您也可以在 alphaTab 中编写打击乐（鼓）轨道。为此，轨道必须设置 \\instrument "percussion"，然后可以通过发音名称或数字添加音符。',
		});

		// 官方综合示例
		if (plugin) {
			const hostOfficial = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, hostOfficial, SAMPLE_PERC_OFFICIAL, {});
		}

		// 乐器发音部分
		container.createEl('h4', { text: '乐器发音' });
		container.createEl('p', {
			text: 'alphaTab 附带了一套默认的乐器发音集，源自 Guitar Pro 7。每个发音都有一个内部数字，可以通过该数字引用它。为了使编写更人性化，您可以通过 \\articulation Name Number 定义自定义发音名称',
		});

		if (plugin) {
			const host2 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host2, SAMPLE_ARTICULATION_CUSTOM, {});
		}

		container.createEl('p', {
			text: '如果您只想使用所有发音，您可以指定 \\articulation defaults，这样就会提供带有一些默认名称的整个发音列表。',
		});

		if (plugin) {
			const host3 = container.createDiv({ cls: 'doc-playground-host' });
			createAlphaTexPlayground(plugin, host3, SAMPLE_ARTICULATION_DEFAULTS, {});
		}

		// 发音列表部分
		container.createEl('h4', { text: '发音列表' });
		container.createEl('p', {
			text: '要实际开始使用，您需要知道内置发音的列表。请参考下面的列表和示例作为参考：',
		});

		// 创建表格
		const table = container.createEl('table', { cls: 'articulation-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '数字' });
		headerRow.createEl('th', { text: '全称' });
		headerRow.createEl('th', { text: '简称' });
		headerRow.createEl('th', { text: '含义' });

		const tbody = table.createEl('tbody');
		list.forEach((item) => {
			const row = tbody.createEl('tr');

			// 数字单元格为普通文本
			row.createEl('td', { text: item[1].toString() });

			// 全称单元格带复制按钮
			const nameLongCell = row.createEl('td');
			const nameLongBtn = nameLongCell.createEl('button', {
				cls: 'copy-btn',
				text: item[0] as string,
				attr: { 'data-copy-text': item[0] as string },
			});
			nameLongBtn.addEventListener('click', () => {
				void navigator.clipboard.writeText(item[0] as string);
				nameLongBtn.textContent = '已复制!';
				setTimeout(() => {
					nameLongBtn.textContent = item[0] as string;
				}, 1000);
			});

			// 简称单元格带复制按钮
			const nameShortCell = row.createEl('td');
			const shortName = (item[0] as string).replace(/[^a-zA-Z0-9]/g, '');
			const nameShortBtn = nameShortCell.createEl('button', {
				cls: 'copy-btn',
				text: shortName,
				attr: { 'data-copy-text': shortName },
			});
			nameShortBtn.addEventListener('click', () => {
				void navigator.clipboard.writeText(shortName);
				nameShortBtn.textContent = '已复制!';
				setTimeout(() => {
					nameShortBtn.textContent = shortName;
				}, 1000);
			});

			// 含义单元格为普通文本
			row.createEl('td', { text: item[2] as string });
		});

		if (!plugin) {
			container.createEl('div', { text: '缺少 plugin 上下文，无法渲染示例。' });
		}
	},
};

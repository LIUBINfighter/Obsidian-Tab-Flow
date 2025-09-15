export interface PlayBarComponentVisibility {
	playPause: boolean;
	stop: boolean;
	tracks: boolean;
	refresh: boolean;
	locateCursor: boolean;
	layoutToggle: boolean;
	exportMenu: boolean;
	toTop: boolean;
	toBottom: boolean;
	openSettings: boolean;
	metronome: boolean;
	countIn: boolean;
	speed: boolean;
	staveProfile: boolean;
	zoom: boolean;
	progressBar: boolean;
	scrollMode: boolean;
	audioPlayer: boolean;
}

export interface EditorBarComponentVisibility {
	playPause: boolean;
	stop: boolean;
	tracks: boolean;
	refresh: boolean;
	locateCursor: boolean;
	layoutToggle: boolean;
	exportMenu: boolean;
	toTop: boolean;
	toBottom: boolean;
	openSettings: boolean;
	metronome: boolean;
	countIn: boolean;
	speed: boolean;
	staveProfile: boolean;
	zoom: boolean;
	progressBar: boolean;
	scrollMode: boolean;
	audioPlayer: boolean;
}

export interface TabFlowSettings {
	mySetting: string;
	assetsDownloaded?: boolean;
	lastAssetsCheck?: number;
	simpleAssetCheck?: boolean;
	/** 开发者选项：显示 Debug Bar */
	showDebugBar?: boolean;
	/** 自动打开 AlphaTex 文件 */
	autoOpenAlphaTexFiles?: boolean;
	/** 滚动模式：continuous|offScreen|off */
	scrollMode?: 'continuous' | 'offScreen' | 'off';
	/** 播放栏配置 */
	playBar?: {
		components: PlayBarComponentVisibility;
		order?: string[];
	};
	/** 编辑器栏配置 */
	editorBar?: {
		components: EditorBarComponentVisibility;
		order?: string[];
	};
	/** 编辑器视图默认布局 */
	editorViewDefaultLayout?:
		| 'horizontal'
		| 'vertical'
		| 'horizontal-swapped'
		| 'vertical-swapped'
		| 'single-bar';
	/** 编辑器内部字体大小（CSS 单位），例如 '0.95rem' 或 '14px' */
	editorFontSize?: string;
	/** 编辑器底部留白，用于增加真实滚动高度，例如 '40vh' 或 '200px' */
	editorBottomGap?: string;
	/** 编辑器高亮开关：按名字启用/禁用特定高亮插件 */
	editorHighlights?: Record<string, boolean>;
	/** 分享卡片导出预设列表 */
	shareCardPresets?: ShareCardPresetV1[];
	/** 默认预设 ID */
	shareCardDefaultPresetId?: string;
	/** 上次使用的预设 ID */
	shareCardLastUsedPresetId?: string;
}

export interface ShareCardPresetV1 {
	id: string;
	name: string;
	version: 1;
	cardWidth: number;
	resolution: '1x' | '2x' | '3x';
	format: 'png' | 'jpg' | 'webp';
	disableLazy: boolean;
	exportBgMode: 'default' | 'auto' | 'custom';
	exportBgCustomColor?: string;
	showAuthor: boolean;
	authorName: string;
	authorRemark: string;
	showAvatar: boolean;
	avatarSource?: { type: 'data-url'; data: string } | null; // 预留其它类型: vault-file|url
	authorPosition: 'top' | 'bottom';
	authorBg: string;
	authorTextColor: string;
	authorFontSize: number;
	authorAlign?: 'left' | 'center' | 'right';
	createdAt: number;
	updatedAt: number;
	isDefault?: boolean; // 冗余标记，方便快速判断
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
	mySetting: 'default',
	simpleAssetCheck: false,
	assetsDownloaded: false,
	lastAssetsCheck: 0,
	showDebugBar: false,
	autoOpenAlphaTexFiles: false,
	/** 默认滚动模式：智能阈值翻页 */
	scrollMode: 'offScreen',
	playBar: {
		components: {
			playPause: true,
			stop: true,
			tracks: true,
			refresh: true,
			locateCursor: false,
			layoutToggle: true,
			exportMenu: true,
			toTop: false,
			toBottom: false,
			openSettings: true,
			metronome: true,
			countIn: true,
			speed: false,
			staveProfile: false,
			zoom: false,
			progressBar: true,
			scrollMode: false,
			audioPlayer: false,
		},
		order: [
			'progressBar',
			'playPause',
			'stop',
			'metronome',
			'countIn',
			'tracks',
			'refresh',
			'locateCursor',
			'layoutToggle',
			'exportMenu',
			'toTop',
			'toBottom',
			'openSettings',

			'speed',
			'staveProfile',
			'zoom',
			'scrollMode',
			'audioPlayer',
		],
	},
	editorBar: {
		components: {
			playPause: true,
			stop: true,
			tracks: false,
			refresh: true,
			locateCursor: false,
			layoutToggle: true,
			exportMenu: false,
			toTop: false,
			toBottom: false,
			openSettings: true,
			metronome: true,
			countIn: true,
			speed: false,
			staveProfile: false,
			zoom: false,
			progressBar: true,
			scrollMode: false,
			audioPlayer: false,
		},
		order: [
			'progressBar',
			'playPause',
			'stop',
			'metronome',
			'countIn',
			'tracks',
			'refresh',
			'locateCursor',
			'layoutToggle',
			'exportMenu',
			'toTop',
			'toBottom',
			'openSettings',
			'speed',
			'staveProfile',
			'zoom',
			'scrollMode',
			'audioPlayer',
		],
	},
	editorViewDefaultLayout: 'horizontal',
	editorFontSize: '0.95rem',
	editorBottomGap: '40vh',
	// 默认启用的一组编辑器高亮插件
	editorHighlights: {
		dot: true,
		bar: true,
		bracket: true,
		meta: true,
		comment: true,
		debug: false,
		whitespace: true,
		surrounded: false,
		duration: true,
		effect: true,
		tuning: true,
		boolean: true,
		chord: true,
	},
	// 运行时初始为空，首次加载时写入默认预设
	shareCardPresets: [],
};

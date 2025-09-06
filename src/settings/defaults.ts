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
	editorViewDefaultLayout?: 'horizontal' | 'vertical' | 'horizontal-swapped' | 'vertical-swapped' | 'single-bar';
	/** 编辑器内部字体大小（CSS 单位），例如 '0.95rem' 或 '14px' */
	editorFontSize?: string;
	/** 编辑器底部留白，用于增加真实滚动高度，例如 '40vh' 或 '200px' */
	editorBottomGap?: string;
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
};

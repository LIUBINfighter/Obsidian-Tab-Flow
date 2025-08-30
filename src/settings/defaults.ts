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
	/** 播放栏配置 */
	playBar?: {
		components: PlayBarComponentVisibility;
		order?: string[];
	};
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
	mySetting: 'default',
	simpleAssetCheck: false,
	assetsDownloaded: false,
	lastAssetsCheck: 0,
	showDebugBar: false,
	autoOpenAlphaTexFiles: false,
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
			'audioPlayer',
		],
	},
};

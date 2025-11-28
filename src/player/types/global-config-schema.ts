/**
 * Global Configuration Schema
 *
 * 全局配置（跨工作区共享）
 * 持久化方式：Plugin.saveData/loadData
 */

import * as alphaTab from '@coderline/alphatab';

// ========== Global AlphaTab Settings ==========
export interface GlobalAlphaTabSettings {
	core: {
		engine: string;
		useWorkers: boolean;
		logLevel: number;
		includeNoteBounds: boolean;
	};

	player: {
		enablePlayer: boolean;
		scrollSpeed: number;
		scrollMode: alphaTab.ScrollMode;
		scrollOffsetX: number;
		scrollOffsetY: number;
		enableCursor: boolean;
		enableAnimatedBeatCursor: boolean;
		playbackSpeed: number; // 播放速度 (0.5 ~ 2.0)
	};

	display: {
		scale: number;
		layoutMode: alphaTab.LayoutMode;
		barsPerRow: number;
		stretchForce: number;
		staveProfile: alphaTab.StaveProfile; // 谱表模式
	};
}

// ========== Global Player Extensions ==========
export interface GlobalPlayerExtensions {
	// 节拍器
	metronomeEnabled: boolean;
	metronomeVolume: number; // 0.0 ~ 1.0

	// 预备拍
	countInBars: number; // 0 = 不启用

	// 自动滚动开关
	autoScrollEnabled: boolean;

	// 循环播放
	isLooping: boolean;

	// 音量控制
	masterVolume: number; // 0.0 ~ 1.0
}

// ========== UI Config ==========
export interface UIConfig {
	theme: 'light' | 'dark' | 'auto';
	locale: 'en' | 'zh-CN' | 'ja' | 'de';

	// 默认展开的面板
	defaultOpenPanels: Array<'trackSelector' | 'settings' | 'syncEditor'>;

	// 紧凑模式
	compactMode: boolean;

	// 控制栏布局
	controlBarLayout: 'horizontal' | 'vertical';

	// ========== 进度条配置 ==========
	progressBar: {
		// 交互性配置
		enableInteraction: boolean; // 是否允许点击/拖拽跳转（区分操作模式和观看模式）
		enableDrag: boolean; // 是否允许拖拽（enableInteraction=true 时生效）
		enableClick: boolean; // 是否允许点击跳转（enableInteraction=true 时生效）

		// 尺寸配置
		minWidth: number; // 最小宽度（像素）
		maxWidth: number; // 最大宽度（像素，-1 表示无限制）
		height: number; // 进度条高度（像素）

		// 显示配置
		showHandle: boolean; // 是否显示拖拽手柄
		showTooltip: boolean; // 是否显示时间提示（悬停时）TODO: 待实现
		showTimestamp: boolean; // 是否在进度条上显示时间戳 TODO: 待实现

		// 行为配置
		smoothSeek: boolean; // 跳转时是否平滑过渡 TODO: 待实现
		updateInterval: number; // 进度更新间隔（毫秒）TODO: 待实现
	};
}

// ========== Complete Global Config ==========
export interface GlobalConfig {
	alphaTabSettings: GlobalAlphaTabSettings;
	playerExtensions: GlobalPlayerExtensions;
	uiConfig: UIConfig;
}

// ========== Default Global Config ==========
export function getDefaultGlobalConfig(): GlobalConfig {
	return {
		alphaTabSettings: {
			core: {
				engine: 'svg',
				useWorkers: true,
				logLevel: alphaTab.LogLevel.Warning,
				includeNoteBounds: false,
			},
			player: {
				enablePlayer: true,
				scrollSpeed: 300,
				scrollMode: alphaTab.ScrollMode.Continuous,
				scrollOffsetX: 0,
				scrollOffsetY: 0,
				enableCursor: true,
				enableAnimatedBeatCursor: true,
				playbackSpeed: 1.0, // 默认播放速度
			},
			display: {
				scale: 1.0,
				layoutMode: alphaTab.LayoutMode.Page,
				barsPerRow: -1,
				stretchForce: 1.0,
				staveProfile: alphaTab.StaveProfile.ScoreTab, // 默认五线谱+六线谱
			},
		},

		playerExtensions: {
			metronomeEnabled: false,
			metronomeVolume: 0.5,
			countInBars: 0,
			autoScrollEnabled: true,
			isLooping: false, // 默认不循环
			masterVolume: 1.0,
		},

		uiConfig: {
			theme: 'light',
			locale: 'zh-CN',
			defaultOpenPanels: [],
			compactMode: false,
			controlBarLayout: 'horizontal',

			// 进度条默认配置
			progressBar: {
				// 交互性：默认启用所有交互功能
				enableInteraction: true,
				enableDrag: true,
				enableClick: true,

				// 尺寸：默认最小 100px，最大无限制，高度 4px
				minWidth: 100,
				maxWidth: -1, // -1 = 无限制
				height: 4,

				// 显示：默认显示手柄
				showHandle: true,
				showTooltip: false, // TODO: 待实现悬停时间提示
				showTimestamp: false, // TODO: 待实现时间戳显示

				// 行为：默认直接跳转
				smoothSeek: false, // TODO: 待实现平滑跳转
				updateInterval: 100, // TODO: 待实现节流更新
			},
		},
	};
}

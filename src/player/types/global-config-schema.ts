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
	};

	display: {
		scale: number;
		layoutMode: alphaTab.LayoutMode;
		barsPerRow: number;
		stretchForce: number;
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
				engine: 'html5',
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
			},
			display: {
				scale: 1.0,
				layoutMode: alphaTab.LayoutMode.Page,
				barsPerRow: -1,
				stretchForce: 1.0,
			},
		},

		playerExtensions: {
			metronomeEnabled: false,
			metronomeVolume: 0.5,
			countInBars: 0,
			autoScrollEnabled: true,
			masterVolume: 1.0,
		},

		uiConfig: {
			theme: 'light',
			locale: 'zh-CN',
			defaultOpenPanels: [],
			compactMode: false,
			controlBarLayout: 'horizontal',
		},
	};
}

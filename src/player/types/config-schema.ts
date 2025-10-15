/**
 * AlphaTab Player Configuration Schema
 * Version: 1.0.0
 *
 * 四层配置架构：
 * 1. Score Config - 曲谱来源
 * 2. Player Config - alphaTab Settings 完整对象
 * 3. Player Extensions - 超集字段
 * 4. UI Config - UI 偏好
 *
 * Session State 不持久化，仅运行时存在
 */

import * as alphaTab from '@coderline/alphatab';

// ========== 1. Score Config (曲谱层) ==========
export interface ScoreSource {
	type: 'file' | 'url' | 'alphatex';
	content: string | null; // url字符串 / alphatex文本 / blob URL
	fileName?: string; // 原始文件名（显示用）
	lastModified?: number; // 时间戳
}

// ========== 2. Player Config (alphaTab Settings 完整对象) ==========
// 注意：这里使用 alphaTab.Settings 的结构
export interface AlphaTabSettingsConfig {
	core: {
		file: string | null;
		engine: string;
		useWorkers: boolean;
		logLevel: number;
		includeNoteBounds: boolean;
		scriptFile: string | null;
		fontDirectory: string | null;
	};

	player: {
		enablePlayer: boolean;
		scrollSpeed: number;
		scrollMode: alphaTab.ScrollMode;
		scrollOffsetX: number;
		scrollOffsetY: number;
		enableCursor: boolean;
		enableAnimatedBeatCursor: boolean;
		soundFont: string | null;
		scrollElement?: HTMLElement | string;
	};

	display: {
		scale: number;
		startBar: number;
		layoutMode: alphaTab.LayoutMode;
		barsPerRow: number | null;
		stretchForce: number;
		resources?: {
			mainGlyphColor?: string;
			secondaryGlyphColor?: string;
			staffLineColor?: string;
			barSeparatorColor?: string;
			barNumberColor?: string;
			scoreInfoColor?: string;
		};
	};
}

// ========== 3. Player Extensions (超集字段) ==========
export interface PlayerExtensions {
	// 节拍器
	metronomeEnabled: boolean;
	metronomeVolume: number; // 0.0 ~ 1.0

	// 预备拍
	countInBars: number; // 0 = 不启用

	// 自动滚动开关
	autoScrollEnabled: boolean;

	// AB 循环
	loopRange: {
		startBar: number; // 小节索引，1-based
		endBar: number;
	} | null;

	// 是否循环播放
	isLooping: boolean;

	// 音量控制
	masterVolume: number; // 0.0 ~ 1.0
}

// ========== 4. UI Config (UI 偏好层) ==========
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

// ========== 完整配置文件 ==========
export interface AlphaTabPlayerConfig {
	scoreSource: ScoreSource;
	alphaTabSettings: AlphaTabSettingsConfig;
	playerExtensions: PlayerExtensions;
	uiConfig: UIConfig;
}

// ========== 5. Session State (运行时状态，不持久化) ==========
export interface SessionState {
	// API 生命周期
	apiReady: boolean;
	scoreLoaded: boolean;
	renderState: 'idle' | 'rendering' | 'finished' | 'error';

	// 播放状态
	playbackState: 'idle' | 'playing' | 'paused' | 'stopped';
	positionMs: number;
	durationMs: number;
	currentBeat: {
		bar: number; // 1-based
		beat: number; // 1-based
		tick: number;
	} | null;

	// 音轨临时状态（不写入配置的覆盖）
	trackOverrides: Record<
		string,
		{
			soloOverride?: boolean;
			muteOverride?: boolean;
			volumeOverride?: number; // 0.0 ~ 1.0
		}
	>;

	// 错误状态
	error: {
		type: 'score-load' | 'api-init' | 'soundfont-load' | 'media-load' | null;
		message: string | null;
		timestamp: number | null;
	};
}

// ========== 默认配置 ==========
export function getDefaultConfig(): AlphaTabPlayerConfig {
	return {
		scoreSource: {
			type: 'url',
			content: null,
		},

		alphaTabSettings: {
			core: {
				file: null,
				engine: 'html5',
				useWorkers: true,
				logLevel: alphaTab.LogLevel.Warning,
				includeNoteBounds: false,
				scriptFile: null,
				fontDirectory: null,
			},
			player: {
				enablePlayer: true,
				scrollSpeed: 300,
				scrollMode: alphaTab.ScrollMode.Continuous,
				scrollOffsetX: 0,
				scrollOffsetY: 0,
				enableCursor: true,
				enableAnimatedBeatCursor: true,
				soundFont: null,
			},
			display: {
				scale: 1.0,
				startBar: 1,
				layoutMode: alphaTab.LayoutMode.Page,
				barsPerRow: null,
				stretchForce: 0.8,
			},
		},

		playerExtensions: {
			metronomeEnabled: false,
			metronomeVolume: 0.5,
			countInBars: 0,
			autoScrollEnabled: true,
			loopRange: null,
			isLooping: false,
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

// ========== 初始 Session State ==========
export function getInitialSessionState(): SessionState {
	return {
		apiReady: false,
		scoreLoaded: false,
		renderState: 'idle',
		playbackState: 'idle',
		positionMs: 0,
		durationMs: 0,
		currentBeat: null,
		trackOverrides: {},
		error: {
			type: null,
			message: null,
			timestamp: null,
		},
	};
}

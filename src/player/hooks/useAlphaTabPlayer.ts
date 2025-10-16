/**
 * useAlphaTabPlayer Hook
 *
 * 简化 AlphaTab API 的初始化和生命周期管理
 * 借鉴官方 playground 示例的设计模式
 *
 * @example
 * ```tsx
 * const api = useAlphaTabPlayer(containerRef.current, {
 *     file: scoreFile,
 *     tracks: [0, 1],
 *     scrollElement: viewportRef.current,
 *     layoutMode: LayoutMode.Page,
 *     playerMode: PlayerMode.EnabledSynthesizer
 * });
 *
 * // API 会在组件卸载时自动销毁
 * ```
 */

import { useEffect, useState } from 'react';
import type { AlphaTabApi } from '@coderline/alphatab';
import { LayoutMode, PlayerMode, ScrollMode, Settings, StaveProfile } from '@coderline/alphatab';

/**
 * AlphaTab 播放器配置选项
 */
export interface AlphaTabPlayerConfig {
	/** 初始曲谱文件（可选，仅支持 URL 字符串） */
	file?: string;

	/** 初始音轨索引（可选） */
	tracks?: number[];

	/** 滚动容器元素（可选） */
	scrollElement?: HTMLElement;

	/** 滚动模式 */
	scrollMode?: ScrollMode;

	/** 滚动偏移量 */
	scrollOffsetY?: number;

	/** 布局模式 */
	layoutMode?: LayoutMode;

	/** 五线谱配置 */
	staveProfile?: StaveProfile;

	/** 播放器模式 */
	playerMode?: PlayerMode;

	/** 渲染引擎 */
	engine?: 'svg' | 'skia' | 'html5';

	/** 是否启用延迟加载 */
	enableLazyLoading?: boolean;

	/** 是否显示音符编号 */
	showNoteNumbers?: boolean;

	/** 是否显示琴弦编号 */
	showStringNumbers?: boolean;

	/** 是否显示节拍器 */
	showMetronome?: boolean;
}

/**
 * 创建 AlphaTab Settings 对象
 */
function createAlphaTabSettings(config: AlphaTabPlayerConfig): Settings {
	const settings = new Settings();

	// Core 配置
	settings.core.engine = config.engine ?? 'svg';
	settings.core.enableLazyLoading = config.enableLazyLoading ?? true;

	if (config.file) {
		settings.core.file = config.file;
	}

	if (config.tracks) {
		settings.core.tracks = config.tracks;
	}

	// Display 配置
	settings.display.layoutMode = config.layoutMode ?? LayoutMode.Page;

	if (config.staveProfile !== undefined) {
		settings.display.staveProfile = config.staveProfile;
	}

	// Player 配置
	settings.player.playerMode = config.playerMode ?? PlayerMode.EnabledSynthesizer;

	if (config.scrollElement) {
		settings.player.scrollElement = config.scrollElement;
	}

	settings.player.scrollMode = config.scrollMode ?? ScrollMode.Continuous;
	settings.player.scrollOffsetY = config.scrollOffsetY ?? -10;

	// Notation 配置
	if (config.showNoteNumbers !== undefined) {
		settings.notation.notationMode = config.showNoteNumbers
			? 1 // NotationMode.GuitarPro
			: 0; // NotationMode.SongBook
	}

	return settings;
}

/**
 * AlphaTab 播放器 Hook
 *
 * 自动管理 AlphaTab API 的生命周期：
 * - 在 container 挂载时创建 API
 * - 在组件卸载时销毁 API
 * - 配置变更时自动更新
 *
 * @param container - AlphaTab 渲染容器
 * @param config - 播放器配置
 * @returns AlphaTab API 实例（未初始化时为 null）
 */
export function useAlphaTabPlayer(
	container: HTMLElement | null,
	config: AlphaTabPlayerConfig
): AlphaTabApi | null {
	const [api, setApi] = useState<AlphaTabApi | null>(null);

	// 初始化 AlphaTab API
	useEffect(() => {
		if (!container) {
			return;
		}

		console.log('[useAlphaTabPlayer] 初始化 AlphaTab API', {
			container,
			config,
		});

		try {
			const settings = createAlphaTabSettings(config);

			// 动态导入 AlphaTab（避免 SSR 问题）
			import('@coderline/alphatab').then(({ AlphaTabApi }) => {
				const newApi = new AlphaTabApi(container, settings);
				setApi(newApi);

				console.log('[useAlphaTabPlayer] AlphaTab API 创建成功', newApi);
			});
		} catch (error) {
			console.error('[useAlphaTabPlayer] AlphaTab API 创建失败', error);
		}

		// 清理函数：销毁 API
		return () => {
			if (api) {
				console.log('[useAlphaTabPlayer] 销毁 AlphaTab API');
				api.destroy();
			}
		};
	}, [container]); // 仅在 container 变化时重新创建

	// 配置变更时更新设置（不重新创建 API）
	useEffect(() => {
		if (!api) {
			return;
		}

		console.log('[useAlphaTabPlayer] 更新 AlphaTab 配置', config);

		// 更新可变配置
		let needsUpdate = false;

		if (
			config.layoutMode !== undefined &&
			api.settings.display.layoutMode !== config.layoutMode
		) {
			api.settings.display.layoutMode = config.layoutMode;
			needsUpdate = true;
		}

		if (
			config.staveProfile !== undefined &&
			api.settings.display.staveProfile !== config.staveProfile
		) {
			api.settings.display.staveProfile = config.staveProfile;
			needsUpdate = true;
		}

		if (
			config.scrollMode !== undefined &&
			api.settings.player.scrollMode !== config.scrollMode
		) {
			api.settings.player.scrollMode = config.scrollMode;
			needsUpdate = true;
		}

		if (
			config.scrollOffsetY !== undefined &&
			api.settings.player.scrollOffsetY !== config.scrollOffsetY
		) {
			api.settings.player.scrollOffsetY = config.scrollOffsetY;
			needsUpdate = true;
		}

		if (
			config.playerMode !== undefined &&
			api.settings.player.playerMode !== config.playerMode
		) {
			api.settings.player.playerMode = config.playerMode;
			needsUpdate = true;
		}

		// 批量更新配置（避免多次调用 updateSettings）
		if (needsUpdate) {
			console.log('[useAlphaTabPlayer] 应用配置更新');
			api.updateSettings();
		}
	}, [
		api,
		config.layoutMode,
		config.staveProfile,
		config.scrollMode,
		config.scrollOffsetY,
		config.playerMode,
	]);

	return api;
}

/**
 * 简化版 Hook：仅初始化，不自动更新配置
 *
 * @example
 * ```tsx
 * const api = useAlphaTabPlayerSimple(containerRef.current, (settings) => {
 *     settings.core.file = '/files/score.gp';
 *     settings.display.layoutMode = LayoutMode.Page;
 *     settings.player.scrollElement = viewportRef.current;
 * });
 * ```
 */
export function useAlphaTabPlayerSimple(
	container: HTMLElement | null,
	configure: (settings: Settings) => void
): AlphaTabApi | null {
	const [api, setApi] = useState<AlphaTabApi | null>(null);

	useEffect(() => {
		if (!container) {
			return;
		}

		import('@coderline/alphatab').then(({ AlphaTabApi, Settings }) => {
			const settings = new Settings();
			configure(settings);

			const newApi = new AlphaTabApi(container, settings);
			setApi(newApi);
		});

		return () => {
			if (api) {
				api.destroy();
			}
		};
	}, [container]);

	return api;
}

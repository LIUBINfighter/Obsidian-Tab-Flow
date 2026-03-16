/**
 * Global Configuration Store
 *
 * 使用 ObsidianPluginStorageAdapter 管理跨工作区的全局配置
 * 数据持久化到 plugin.saveData / loadData (data.json)
 */

import * as alphaTab from '@coderline/alphatab';
import { create } from 'zustand';
import { storageAdapter } from './middleware/storageAdapter';
import type { GlobalConfig } from '../types/global-config-schema';
import { getDefaultGlobalConfig } from '../types/global-config-schema';
import type { ObsidianPluginStorageAdapter } from '../storage/adapters/ObsidianPluginStorageAdapter';
import { toFiniteClampedNumber, toFiniteNumber } from '../../utils/numberUtils';

// Store state interface
interface GlobalConfigState extends GlobalConfig {
	// Actions
	updateAlphaTabSettings: (settings: Partial<GlobalConfig['alphaTabSettings']>) => void;
	updatePlayerExtensions: (extensions: Partial<GlobalConfig['playerExtensions']>) => void;
	updateUIConfig: (config: Partial<GlobalConfig['uiConfig']>) => void;
	resetToDefaults: () => void;

	// Storage adapter (injected)
	_adapter?: ObsidianPluginStorageAdapter;
}

const STORAGE_KEY = 'global-config';
const CURRENT_VERSION = 3;

function normalizeEnumValue<T extends number>(
	value: unknown,
	validValues: readonly T[],
	fallback: T
): T {
	return typeof value === 'number' && validValues.includes(value as T) ? (value as T) : fallback;
}

function normalizeBarsPerRow(value: unknown): number {
	const numericValue = Math.trunc(toFiniteNumber(value, -1));
	if (numericValue === -1) {
		return -1;
	}

	return numericValue >= 1 ? numericValue : -1;
}

function normalizeAlphaTabSettings(
	current: GlobalConfig['alphaTabSettings'],
	update: Partial<GlobalConfig['alphaTabSettings']>
): GlobalConfig['alphaTabSettings'] {
	const nextCore = { ...current.core, ...update.core };
	const nextPlayer = { ...current.player, ...update.player };
	const nextDisplay = { ...current.display, ...update.display };

	return {
		core: {
			...nextCore,
			useWorkers:
				typeof nextCore.useWorkers === 'boolean'
					? nextCore.useWorkers
					: current.core.useWorkers,
		},
		player: {
			...nextPlayer,
			scrollMode: normalizeEnumValue(
				nextPlayer.scrollMode,
				Object.values(alphaTab.ScrollMode).filter(
					(value): value is alphaTab.ScrollMode => typeof value === 'number'
				),
				current.player.scrollMode
			),
			scrollSpeed: Math.max(
				0,
				toFiniteNumber(nextPlayer.scrollSpeed, current.player.scrollSpeed)
			),
			scrollOffsetX: toFiniteNumber(nextPlayer.scrollOffsetX, current.player.scrollOffsetX),
			scrollOffsetY: toFiniteNumber(nextPlayer.scrollOffsetY, current.player.scrollOffsetY),
		},
		display: {
			...nextDisplay,
			scale: toFiniteClampedNumber(nextDisplay.scale, current.display.scale, 0.5, 2),
			layoutMode: normalizeEnumValue(
				nextDisplay.layoutMode,
				Object.values(alphaTab.LayoutMode).filter(
					(value): value is alphaTab.LayoutMode => typeof value === 'number'
				),
				current.display.layoutMode
			),
			staveProfile: normalizeEnumValue(
				nextDisplay.staveProfile,
				Object.values(alphaTab.StaveProfile).filter(
					(value): value is alphaTab.StaveProfile => typeof value === 'number'
				),
				current.display.staveProfile
			),
			barsPerRow: normalizeBarsPerRow(nextDisplay.barsPerRow),
			stretchForce: toFiniteClampedNumber(
				nextDisplay.stretchForce,
				current.display.stretchForce,
				0.25,
				2
			),
		},
	};
}

/**
 * 创建全局配置 store 的工厂函数
 *
 * @param adapter - ObsidianPluginStorageAdapter 实例
 */
export const createGlobalConfigStore = (adapter: ObsidianPluginStorageAdapter) => {
	return create<GlobalConfigState>()(
		storageAdapter(
			adapter,
			{
				name: STORAGE_KEY,
				version: CURRENT_VERSION,
				// 迁移函数（未来版本变更时使用）
				migrate: (persistedState: GlobalConfigState, version: number) => {
					console.debug(
						'[GlobalConfigStore] Migrating from version',
						version,
						'to',
						CURRENT_VERSION
					);

					const defaults = getDefaultGlobalConfig();
					return {
						...defaults,
						...persistedState,
						alphaTabSettings: normalizeAlphaTabSettings(
							defaults.alphaTabSettings,
							persistedState.alphaTabSettings ?? {}
						),
						playerExtensions: {
							...defaults.playerExtensions,
							...persistedState.playerExtensions,
						},
						uiConfig: {
							...defaults.uiConfig,
							...persistedState.uiConfig,
						},
					};
				},
			},
			(set, get) => ({
				// 初始状态（默认值）
				...getDefaultGlobalConfig(),

				// Actions
				updateAlphaTabSettings: (settings) =>
					set((state) => ({
						alphaTabSettings: normalizeAlphaTabSettings(
							state.alphaTabSettings,
							settings
						),
					})),

				updatePlayerExtensions: (extensions) =>
					set((state) => ({
						playerExtensions: { ...state.playerExtensions, ...extensions },
					})),

				updateUIConfig: (config) =>
					set((state) => ({
						uiConfig: { ...state.uiConfig, ...config },
					})),

				resetToDefaults: () => {
					const defaults = getDefaultGlobalConfig();
					set({
						alphaTabSettings: defaults.alphaTabSettings,
						playerExtensions: defaults.playerExtensions,
						uiConfig: defaults.uiConfig,
					});
				},

				// Injected adapter
				_adapter: adapter,
			})
		)
	);
};

export type GlobalConfigStore = ReturnType<typeof createGlobalConfigStore>;

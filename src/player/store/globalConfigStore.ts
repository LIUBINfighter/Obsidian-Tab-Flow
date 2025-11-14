/**
 * Global Configuration Store
 *
 * 使用 ObsidianPluginStorageAdapter 管理跨工作区的全局配置
 * 数据持久化到 plugin.saveData / loadData (data.json)
 */

import { create } from 'zustand';
import { storageAdapter } from './middleware/storageAdapter';
import type { GlobalConfig } from '../types/global-config-schema';
import { getDefaultGlobalConfig } from '../types/global-config-schema';
import type { ObsidianPluginStorageAdapter } from '../storage/adapters/ObsidianPluginStorageAdapter';

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
const CURRENT_VERSION = 1;

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
				migrate: (persistedState: Partial<GlobalConfigState>, version: number) => {
					console.log(
						'[GlobalConfigStore] Migrating from version',
						version,
						'to',
						CURRENT_VERSION
					);

					// Version 1 无需迁移
					if (version === 0) {
						// 从旧版本迁移（如果有）
						return { ...getDefaultGlobalConfig(), ...persistedState };
					}

					return persistedState as GlobalConfigState;
				},
			},
			(set, get) => ({
				// 初始状态（默认值）
				...getDefaultGlobalConfig(),

				// Actions
				updateAlphaTabSettings: (settings) =>
					set((state) => ({
						alphaTabSettings: { ...state.alphaTabSettings, ...settings },
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

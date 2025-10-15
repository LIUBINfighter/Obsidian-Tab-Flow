/**
 * Config Store - 配置文件的持久化存储
 * 
 * 职责：
 * 1. 持久化到 localStorage
 * 2. 提供配置的读取和更新接口
 * 3. 作为配置的唯一真相源（Single Source of Truth）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlphaTabPlayerConfig, ScoreSource, PlayerExtensions, UIConfig } from '../types/config-schema';
import { getDefaultConfig } from '../types/config-schema';

interface ConfigStore {
	// State
	config: AlphaTabPlayerConfig;

	// Actions
	loadConfig: () => void;
	updateConfig: (updater: (draft: AlphaTabPlayerConfig) => void) => void;
	resetConfig: () => void;

	// 便捷方法（语法糖）
	updateScoreSource: (partial: Partial<ScoreSource>) => void;
	updateAlphaTabSettings: (path: string, value: any) => void;
	updatePlayerExtensions: (partial: Partial<PlayerExtensions>) => void;
	updateUIConfig: (partial: Partial<UIConfig>) => void;
}

export const useConfigStore = create<ConfigStore>()(
	persist(
		(set, get) => ({
			config: getDefaultConfig(),

			loadConfig: () => {
				// localStorage 加载由 persist 中间件自动处理
				const config = get().config;
				console.log('[ConfigStore] Config loaded:', config);
			},

			updateConfig: (updater) => {
				const newConfig = JSON.parse(JSON.stringify(get().config));
				updater(newConfig);
				set({ config: newConfig });
			},

			resetConfig: () => {
				set({ config: getDefaultConfig() });
			},

			// 便捷方法
			updateScoreSource: (partial) => {
				set((state) => ({
					config: {
						...state.config,
						scoreSource: { ...state.config.scoreSource, ...partial },
					},
				}));
			},

			updateAlphaTabSettings: (path, value) => {
				set((state) => {
					const newConfig = JSON.parse(JSON.stringify(state.config));
					const keys = path.split('.');
					let target: any = newConfig.alphaTabSettings;
					for (let i = 0; i < keys.length - 1; i++) {
						target = target[keys[i]];
					}
					target[keys[keys.length - 1]] = value;
					return { config: newConfig };
				});
			},

			updatePlayerExtensions: (partial) => {
				set((state) => ({
					config: {
						...state.config,
						playerExtensions: { ...state.config.playerExtensions, ...partial },
					},
				}));
			},

			updateUIConfig: (partial) => {
				set((state) => ({
					config: {
						...state.config,
						uiConfig: { ...state.config.uiConfig, ...partial },
					},
				}));
			},
		}),
		{
			name: 'alphatab-player-config',
			version: 1,
		}
	)
);

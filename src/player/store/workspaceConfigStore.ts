/**
 * Workspace Session Configuration Store
 *
 * 使用 ObsidianWorkspaceStorageAdapter 管理工作区会话配置
 * 数据持久化到 view.getState / setState (workspace.json)
 * 标签页关闭时自动清除
 */

import { create } from 'zustand';
import { storageAdapter } from './middleware/storageAdapter';
import type { WorkspaceSessionConfig } from '../types/workspace-config-schema';
import { getDefaultWorkspaceSessionConfig } from '../types/workspace-config-schema';
import type { ObsidianWorkspaceStorageAdapter } from '../storage/adapters/ObsidianWorkspaceStorageAdapter';

// Store state interface
interface WorkspaceConfigState extends WorkspaceSessionConfig {
	// Actions
	setScoreSource: (source: WorkspaceSessionConfig['scoreSource']) => void;
	updatePlayerState: (state: Partial<WorkspaceSessionConfig['sessionPlayerState']>) => void;
	setLoopRange: (range: { startBar: number; endBar: number } | null) => void;
	toggleLooping: () => void;
	resetToDefaults: () => void;

	// Storage adapter (injected)
	_adapter?: ObsidianWorkspaceStorageAdapter;
}

const STORAGE_KEY = 'workspace-session-config';
const CURRENT_VERSION = 1;

/**
 * 创建工作区会话配置 store 的工厂函数
 *
 * @param adapter - ObsidianWorkspaceStorageAdapter 实例
 */
export const createWorkspaceConfigStore = (adapter: ObsidianWorkspaceStorageAdapter) => {
	return create<WorkspaceConfigState>()(
		storageAdapter(
			adapter,
			{
				name: STORAGE_KEY,
				version: CURRENT_VERSION,
				// 迁移函数（未来版本变更时使用）
				migrate: (persistedState: any, version: number) => {
					console.log(
						'[WorkspaceConfigStore] Migrating from version',
						version,
						'to',
						CURRENT_VERSION
					);

					// Version 1 无需迁移
					if (version === 0) {
						// 从旧版本迁移（如果有）
						return { ...getDefaultWorkspaceSessionConfig(), ...persistedState };
					}

					return persistedState as WorkspaceConfigState;
				},
			},
			(set, get) => ({
				// 初始状态（默认值）
				...getDefaultWorkspaceSessionConfig(),

				// Actions
				setScoreSource: (source) => set({ scoreSource: source }),

				updatePlayerState: (state) =>
					set((prev) => ({
						sessionPlayerState: { ...prev.sessionPlayerState, ...state },
					})),

				setLoopRange: (range) =>
					set((prev) => ({
						sessionPlayerState: {
							...prev.sessionPlayerState,
							loopRange: range,
						},
					})),

				toggleLooping: () =>
					set((prev) => ({
						sessionPlayerState: {
							...prev.sessionPlayerState,
							isLooping: !prev.sessionPlayerState.isLooping,
						},
					})),

				resetToDefaults: () => {
					const defaults = getDefaultWorkspaceSessionConfig();
					set({
						scoreSource: defaults.scoreSource,
						sessionPlayerState: defaults.sessionPlayerState,
					});
				},

				// Injected adapter
				_adapter: adapter,
			})
		)
	);
};

export type WorkspaceConfigStore = ReturnType<typeof createWorkspaceConfigStore>;

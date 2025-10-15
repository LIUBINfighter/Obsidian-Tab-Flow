/**
 * Storage Adapter Middleware for Zustand
 * 
 * 自定义 middleware，使用存储适配器替代 zustand/persist
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

export interface StorageAdapterOptions {
	name: string; // 存储键名
	version?: number; // 版本号
	migrate?: (persistedState: any, version: number) => any; // 迁移函数
}

type StorageAdapterMiddleware = <
	T,
	Mps extends [StoreMutatorIdentifier, unknown][] = [],
	Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
	adapter: IStorageAdapter,
	options: StorageAdapterOptions,
	config: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, Mcs>;

type StorageAdapterImpl = <T>(
	adapter: IStorageAdapter,
	options: StorageAdapterOptions,
	config: StateCreator<T, [], []>
) => StateCreator<T, [], []>;

const storageAdapterImpl: StorageAdapterImpl = (adapter, options, config) => (set, get, api) => {
	const { name, version = 1, migrate } = options;

	// 存储版本信息的键
	const versionKey = `${name}-version`;

	// 初始化状态
	const store = config(
		(args) => {
			set(args);
			// 状态变化时保存
			saveState();
		},
		get,
		api
	);

	// 保存状态到适配器
	const saveState = async () => {
		try {
			const state = get();
			await adapter.save(name, state);
			await adapter.save(versionKey, version);
		} catch (error) {
			console.error('[StorageAdapter] Save failed:', error);
		}
	};

	// 从适配器加载状态
	const loadState = async () => {
		try {
			const persistedVersion = await adapter.load<number>(versionKey);
			let persistedState = await adapter.load<any>(name);

			if (!persistedState) {
				console.log('[StorageAdapter] No persisted state found for:', name);
				return;
			}

			// 版本迁移
			if (migrate && persistedVersion !== null && persistedVersion < version) {
				console.log(
					`[StorageAdapter] Migrating ${name} from version ${persistedVersion} to ${version}`
				);
				persistedState = migrate(persistedState, persistedVersion);
			}

			// 合并状态
			set(persistedState);
			console.log('[StorageAdapter] State loaded for:', name);
		} catch (error) {
			console.error('[StorageAdapter] Load failed:', error);
		}
	};

	// 异步加载初始状态
	loadState();

	return store;
};

export const storageAdapter = storageAdapterImpl as unknown as StorageAdapterMiddleware;

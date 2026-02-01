/**
 * Storage Adapter Middleware for Zustand
 *
 * 自定义 middleware，使用存储适配器替代 zustand/persist
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

export interface StorageAdapterOptions<TState> {
	name: string; // 存储键名
	version?: number; // 版本号
	migrate?: (persistedState: TState, version: number) => TState; // 迁移函数
}

type StorageAdapterMiddleware = <
	T,
	Mps extends [StoreMutatorIdentifier, unknown][] = [],
	Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
	adapter: IStorageAdapter,
	options: StorageAdapterOptions<T>,
	config: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, Mcs>;

const storageAdapterImpl = <
	T,
	Mps extends [StoreMutatorIdentifier, unknown][] = [],
	Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
	adapter: IStorageAdapter,
	options: StorageAdapterOptions<T>,
	config: StateCreator<T, Mps, Mcs>
): StateCreator<T, Mps, Mcs> => {
	return (set, get, api) => {
		const { name, version = 1, migrate } = options;
		const versionKey = `${name}-version`;

		const saveState = async () => {
			try {
				const state = get();
				await adapter.save(name, state);
				await adapter.save(versionKey, version);
			} catch (error) {
				console.error('[StorageAdapter] Save failed:', error);
			}
		};

		const store = config(set, get, api);
		api.subscribe(() => {
			void saveState();
		});

		const loadState = async () => {
			try {
				const persistedVersion = await adapter.load<number>(versionKey);
				const persistedState = await adapter.load<T | null>(name);

				if (!persistedState) {
					console.log('[StorageAdapter] No persisted state found for:', name);
					return;
				}

				let activeState: T = persistedState;

				if (migrate && persistedVersion !== null && persistedVersion < version) {
					console.log(
						`[StorageAdapter] Migrating ${name} from version ${persistedVersion} to ${version}`
					);
					activeState = migrate(activeState, persistedVersion);
				}

				set(activeState, true);
				console.log('[StorageAdapter] State loaded for:', name);
			} catch (error) {
				console.error('[StorageAdapter] Load failed:', error);
			}
		};

		void loadState();

		return store;
	};
};

export const storageAdapter = storageAdapterImpl as unknown as StorageAdapterMiddleware;

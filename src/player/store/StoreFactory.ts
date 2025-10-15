/**
 * Store Factory
 * 
 * 统一管理所有 store 的创建和销毁
 * 集成存储适配器，支持多实例隔离
 */

import { ObsidianPluginStorageAdapter } from '../storage/adapters/ObsidianPluginStorageAdapter';
import { ObsidianWorkspaceStorageAdapter } from '../storage/adapters/ObsidianWorkspaceStorageAdapter';
import { createGlobalConfigStore, type GlobalConfigStore } from './globalConfigStore';
import { createWorkspaceConfigStore, type WorkspaceConfigStore } from './workspaceConfigStore';
import { createRuntimeStore, type RuntimeStore } from './runtimeStore';
import { createUIStore, type UIStore } from './uiStore';
import type TabFlowPlugin from '../../main';
import type { ItemView } from 'obsidian';
import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Store 集合
 */
export interface StoreCollection {
	// 全局配置 store（Plugin 级别，跨工作区）
	globalConfig: GlobalConfigStore;
	
	// 工作区配置 store（View 级别，标签页特定）
	workspaceConfig: WorkspaceConfigStore;
	
	// 运行时状态 store（View 级别，不持久化）
	runtime: UseBoundStore<StoreApi<RuntimeStore>>;
	
	// UI 状态 store（View 级别，不持久化）
	ui: UseBoundStore<StoreApi<UIStore>>;
	
	// 存储适配器
	adapters: {
		plugin: ObsidianPluginStorageAdapter;
		workspace: ObsidianWorkspaceStorageAdapter;
	};
}

/**
 * Store Factory 类
 * 
 * 职责：
 * 1. 创建所有 store 实例
 * 2. 注入依赖（Plugin、View）
 * 3. 管理生命周期（销毁时清理）
 */
export class StoreFactory {
	private plugin: TabFlowPlugin;
	
	constructor(plugin: TabFlowPlugin) {
		this.plugin = plugin;
	}
	
	/**
	 * 为 View 创建完整的 store 集合
	 * 
	 * @param view - Obsidian ItemView 实例
	 * @returns Store 集合
	 */
	createStores(view: ItemView): StoreCollection {
		console.log('[StoreFactory] Creating stores for view:', view.getViewType());
		
		// 1. 创建存储适配器
		const pluginAdapter = new ObsidianPluginStorageAdapter(this.plugin);
		const workspaceAdapter = new ObsidianWorkspaceStorageAdapter();
		
		// 2. 注入 View 回调到 workspace adapter
		workspaceAdapter.setCallbacks({
			getViewState: () => view.getState(),
			setViewState: async (state: any, result: any) => {
				// @ts-ignore - Obsidian View setState signature varies
				await view.setState(state, result);
			},
		});
		
		// 3. 创建 stores
		const globalConfig = createGlobalConfigStore(pluginAdapter);
		const workspaceConfig = createWorkspaceConfigStore(workspaceAdapter);
		const runtime = createRuntimeStore();
		const ui = createUIStore();
		
		return {
			globalConfig,
			workspaceConfig,
			runtime,
			ui,
			adapters: {
				plugin: pluginAdapter,
				workspace: workspaceAdapter,
			},
		};
	}
	
	/**
	 * 销毁 store 集合
	 * 
	 * @param stores - Store 集合
	 */
	destroyStores(stores: StoreCollection): void {
		console.log('[StoreFactory] Destroying stores');
		
		// 1. 清除 workspace adapter 的回调
		stores.adapters.workspace.clearCallbacks();
		
		// 2. 清除所有 store 的订阅（Zustand stores 会自动清理）
		// 注意：Zustand 不需要手动 destroy，但可以清除订阅
		
		// 3. 清理完成
		console.log('[StoreFactory] Stores destroyed');
	}
}

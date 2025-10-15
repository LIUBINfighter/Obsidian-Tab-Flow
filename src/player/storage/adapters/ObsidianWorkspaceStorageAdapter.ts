/**
 * Obsidian Workspace Storage Adapter
 *
 * 使用 Obsidian View 的 getState/setState API
 * 用于工作区会话配置（工作区特定，标签页关闭即清除）
 */

import type { IStorageAdapter } from '../IStorageAdapter';

export interface WorkspaceStorageCallbacks {
	getViewState: () => any;
	setViewState: (state: any, result: any) => Promise<void>;
}

export class ObsidianWorkspaceStorageAdapter implements IStorageAdapter {
	private callbacks: WorkspaceStorageCallbacks | null = null;

	/**
	 * 注入 View 的回调函数
	 * 需要在 View 创建后调用
	 */
	setCallbacks(callbacks: WorkspaceStorageCallbacks): void {
		this.callbacks = callbacks;
		console.log('[WorkspaceStorage] Callbacks registered');
	}

	/**
	 * 清除回调（View 销毁时调用）
	 */
	clearCallbacks(): void {
		this.callbacks = null;
		console.log('[WorkspaceStorage] Callbacks cleared');
	}

	async save<T>(key: string, data: T): Promise<void> {
		if (!this.callbacks) {
			console.warn('[WorkspaceStorage] Save skipped - callbacks not registered:', key);
			return;
		}

		try {
			const current = this.callbacks.getViewState() || {};
			current[key] = data;
			await this.callbacks.setViewState(current, {});
			console.log('[WorkspaceStorage] Saved to workspace:', key);
		} catch (error) {
			console.error('[WorkspaceStorage] Save failed:', key, error);
			throw error;
		}
	}

	async load<T>(key: string): Promise<T | null> {
		if (!this.callbacks) {
			console.warn('[WorkspaceStorage] Load skipped - callbacks not registered:', key);
			return null;
		}

		try {
			const state = this.callbacks.getViewState();
			const value = state?.[key] ?? null;
			console.log(
				'[WorkspaceStorage] Loaded from workspace:',
				key,
				value ? 'found' : 'not found'
			);
			return value;
		} catch (error) {
			console.error('[WorkspaceStorage] Load failed:', key, error);
			return null;
		}
	}

	async remove(key: string): Promise<void> {
		if (!this.callbacks) {
			console.warn('[WorkspaceStorage] Remove skipped - callbacks not registered:', key);
			return;
		}

		try {
			const current = this.callbacks.getViewState() || {};
			delete current[key];
			await this.callbacks.setViewState(current, {});
			console.log('[WorkspaceStorage] Removed from workspace:', key);
		} catch (error) {
			console.error('[WorkspaceStorage] Remove failed:', key, error);
			throw error;
		}
	}

	async clear(): Promise<void> {
		if (!this.callbacks) {
			console.warn('[WorkspaceStorage] Clear skipped - callbacks not registered');
			return;
		}

		try {
			await this.callbacks.setViewState({}, {});
			console.log('[WorkspaceStorage] Workspace state cleared');
		} catch (error) {
			console.error('[WorkspaceStorage] Clear failed:', error);
			throw error;
		}
	}
}

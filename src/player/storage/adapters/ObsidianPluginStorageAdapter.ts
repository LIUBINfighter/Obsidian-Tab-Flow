/**
 * Obsidian Plugin Storage Adapter
 *
 * 使用 Obsidian Plugin 的 saveData/loadData API
 * 用于全局配置（跨工作区共享）
 */

import type { Plugin } from 'obsidian';
import type { IStorageAdapter } from '../IStorageAdapter';
import { debugLog } from '../../../utils/logger';

export class ObsidianPluginStorageAdapter implements IStorageAdapter {
	constructor(private plugin: Plugin) {}

	async save<T>(key: string, data: T): Promise<void> {
		try {
			const current: Record<string, unknown> =
				((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
			current[key] = data;
			await this.plugin.saveData(current);
			debugLog('[PluginStorage] Saved:', key);
		} catch (error) {
			console.error('[PluginStorage] Save failed:', key, error);
			throw error;
		}
	}

	async load<T>(key: string): Promise<T | null> {
		try {
			const data = (await this.plugin.loadData()) as Record<string, unknown> | null;
			const value = data?.[key] ?? null;
			debugLog('[PluginStorage] Loaded:', key, value ? 'found' : 'not found');
			return value as T | null;
		} catch (error) {
			console.error('[PluginStorage] Load failed:', key, error);
			return null;
		}
	}

	async remove(key: string): Promise<void> {
		try {
			const current: Record<string, unknown> =
				((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
			delete current[key];
			await this.plugin.saveData(current);
			debugLog('[PluginStorage] Removed:', key);
		} catch (error) {
			console.error('[PluginStorage] Remove failed:', key, error);
			throw error;
		}
	}

	async clear(): Promise<void> {
		try {
			await this.plugin.saveData({});
			debugLog('[PluginStorage] Cleared all data');
		} catch (error) {
			console.error('[PluginStorage] Clear failed:', error);
			throw error;
		}
	}
}

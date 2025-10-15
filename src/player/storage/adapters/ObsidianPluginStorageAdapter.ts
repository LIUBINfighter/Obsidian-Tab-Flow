/**
 * Obsidian Plugin Storage Adapter
 *
 * 使用 Obsidian Plugin 的 saveData/loadData API
 * 用于全局配置（跨工作区共享）
 */

import type { Plugin } from 'obsidian';
import type { IStorageAdapter } from '../IStorageAdapter';

export class ObsidianPluginStorageAdapter implements IStorageAdapter {
	constructor(private plugin: Plugin) {}

	async save<T>(key: string, data: T): Promise<void> {
		try {
			const current = (await this.plugin.loadData()) || {};
			current[key] = data;
			await this.plugin.saveData(current);
			console.log('[PluginStorage] Saved:', key);
		} catch (error) {
			console.error('[PluginStorage] Save failed:', key, error);
			throw error;
		}
	}

	async load<T>(key: string): Promise<T | null> {
		try {
			const data = await this.plugin.loadData();
			const value = data?.[key] ?? null;
			console.log('[PluginStorage] Loaded:', key, value ? 'found' : 'not found');
			return value;
		} catch (error) {
			console.error('[PluginStorage] Load failed:', key, error);
			return null;
		}
	}

	async remove(key: string): Promise<void> {
		try {
			const current = (await this.plugin.loadData()) || {};
			delete current[key];
			await this.plugin.saveData(current);
			console.log('[PluginStorage] Removed:', key);
		} catch (error) {
			console.error('[PluginStorage] Remove failed:', key, error);
			throw error;
		}
	}

	async clear(): Promise<void> {
		try {
			await this.plugin.saveData({});
			console.log('[PluginStorage] Cleared all data');
		} catch (error) {
			console.error('[PluginStorage] Clear failed:', error);
			throw error;
		}
	}
}

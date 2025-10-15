/**
 * Storage Adapter Interface
 *
 * 存储适配器接口，用于抽象不同的持久化实现
 * 支持迁移到其他平台（适配器模式）
 */

export interface IStorageAdapter {
	/**
	 * 保存数据
	 * @param key 存储键
	 * @param data 要保存的数据
	 */
	save<T>(key: string, data: T): Promise<void>;

	/**
	 * 加载数据
	 * @param key 存储键
	 * @returns 加载的数据，不存在时返回 null
	 */
	load<T>(key: string): Promise<T | null>;

	/**
	 * 删除数据
	 * @param key 存储键
	 */
	remove(key: string): Promise<void>;

	/**
	 * 清空所有数据（可选）
	 */
	clear?(): Promise<void>;
}

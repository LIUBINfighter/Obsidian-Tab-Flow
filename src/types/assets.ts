export interface AssetStatus {
	file: string; // 文件名（不含路径）
	exists: boolean; // 是否存在
	path: string; // vault 相对路径 (.obsidian/plugins/...)
	size?: number; // 读取到的大小（字节，可选）
}

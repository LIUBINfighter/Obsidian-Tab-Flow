import React from 'react';
import { RefreshCcw } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface RefreshButtonProps {
	controller: PlayerController;
}

/**
 * RefreshButton - 刷新播放器按钮
 * 重新构建 AlphaTab API（用于调试或配置问题时）
 */
export const RefreshButton: React.FC<RefreshButtonProps> = ({ controller }) => {
	const uiStore = controller.getUIStore();

	const handleRefresh = async () => {
		try {
			uiStore.getState().showToast('info', '正在重新加载播放器...', 2000);

			// 调用 PlayerController 的 public 方法
			await controller.rebuildApi();

			uiStore.getState().showToast('success', '播放器已重新加载', 2000);
		} catch (error) {
			console.error('[RefreshButton] 重新加载失败:', error);
			uiStore
				.getState()
				.showToast('error', '重新加载失败: ' + (error as Error).message, 3000);
		}
	};

	return (
		<button
			className="play-bar-button"
			onClick={handleRefresh}
			aria-label="Refresh Player"
			title="重新加载播放器"
		>
			<RefreshCcw size={16} />
			<span className="play-bar-button-text">刷新</span>
		</button>
	);
};

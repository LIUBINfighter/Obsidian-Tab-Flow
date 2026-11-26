import React from 'react';
import { RefreshCcw } from 'lucide-react';
import type { PlayerController } from '../PlayerController';
import { t } from '../../i18n';

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
			uiStore.getState().showToast('info', t('refresh.rebuilding'), 2000);

			// 调用 PlayerController 的 public 方法
			await controller.rebuildApi();

			uiStore.getState().showToast('success', t('refresh.reloaded'), 2000);
		} catch (error) {
			console.error('[RefreshButton] reload failed:', error);
			uiStore
				.getState()
				.showToast('error', t('refresh.failed', { error: (error as Error).message }), 3000);
		}
	};

	return (
		<button
			type="button"
			className="play-bar-button"
			onClick={() => {
				void handleRefresh();
			}}
			aria-label={t('navigation.refreshPlayer')}
			title={t('refresh.title')}
		>
			<RefreshCcw size={16} />
			<span className="play-bar-button-text">{t('refresh.button')}</span>
		</button>
	);
};

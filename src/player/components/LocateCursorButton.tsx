import React from 'react';
import { Crosshair } from 'lucide-react';
import type { PlayerController } from '../PlayerController';
import { t } from '../../i18n';

interface LocateCursorButtonProps {
	controller: PlayerController;
}

/**
 * LocateCursorButton - 定位到当前播放光标
 * 将视图滚动到当前播放位置
 */
export const LocateCursorButton: React.FC<LocateCursorButtonProps> = ({ controller }) => {
	const handleLocate = () => {
		try {
			controller.scrollToCursor();
		} catch (error) {
			console.error('[LocateCursorButton] 定位光标失败:', error);
		}
	};

	return (
		<button
			className="play-bar-button"
			onClick={handleLocate}
			aria-label="Locate cursor"
			title={t('navigation.locateCursor')}
		>
			<Crosshair size={16} />
			<span className="play-bar-button-text">{t('navigation.locateCursor')}</span>
		</button>
	);
};

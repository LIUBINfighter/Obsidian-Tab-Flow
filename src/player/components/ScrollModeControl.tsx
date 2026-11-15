import React, { useState } from 'react';
import { Scroll } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import type { PlayerController } from '../PlayerController';
import { t } from '../../i18n';

interface ScrollModeControlProps {
	controller: PlayerController;
}

/**
 * ScrollModeControl - 滚动模式控制
 * 连续滚动、超出屏幕时滚动、关闭滚动
 */
export const ScrollModeControl: React.FC<ScrollModeControlProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	const scrollModes = [
		{ name: t('settings.scrollModeOptions.continuous'), value: alphaTab.ScrollMode.Continuous },
		{ name: t('settings.scrollModeOptions.offScreen'), value: alphaTab.ScrollMode.OffScreen },
		{ name: t('settings.scrollModeOptions.off'), value: alphaTab.ScrollMode.Off },
	];

	// 从 globalConfig 读取初始滚动模式
	const initialMode = globalConfig((s) => s.alphaTabSettings.player.scrollMode);
	const [currentMode, setCurrentMode] = useState<alphaTab.ScrollMode>(initialMode);

	const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const mode = parseInt(e.target.value);
		setCurrentMode(mode);

		// 更新全局配置（持久化）
		globalConfig.getState().updateAlphaTabSettings({
			player: { ...globalConfig.getState().alphaTabSettings.player, scrollMode: mode },
		});

		// 同步到 API
		controller.setScrollMode(mode);
	};

	return (
		<div className="play-bar-control">
			<Scroll size={16} className="play-bar-control-icon" />
			<select
				className="play-bar-control-select"
				value={currentMode}
				onChange={handleModeChange}
				aria-label="Scroll mode"
				title={t('settings.scrollModeTitle')}
			>
				{scrollModes.map(({ name, value }) => (
					<option key={value} value={value}>
						{name}
					</option>
				))}
			</select>
		</div>
	);
};

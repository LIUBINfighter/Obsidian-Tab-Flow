import React, { useState } from 'react';
import { Scroll } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import type { PlayerController } from '../PlayerController';

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
		{ name: '连续滚动', value: alphaTab.ScrollMode.Continuous },
		{ name: '超出时滚动', value: alphaTab.ScrollMode.OffScreen },
		{ name: '关闭滚动', value: alphaTab.ScrollMode.Off },
	];

	// 从 globalConfig 读取初始滚动模式
	const initialMode = globalConfig((s) => s.alphaTabSettings.player.scrollMode);
	const [currentMode, setCurrentMode] = useState<alphaTab.ScrollMode>(initialMode);

	const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const mode = parseInt(e.target.value) as alphaTab.ScrollMode;
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
				aria-label="Scroll Mode"
				title="滚动模式"
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

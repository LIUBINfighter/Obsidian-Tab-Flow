import React, { useState } from 'react';
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
	const scrollModes = [
		{ name: '连续滚动', value: alphaTab.ScrollMode.Continuous },
		{ name: '超出时滚动', value: alphaTab.ScrollMode.OffScreen },
		{ name: '关闭滚动', value: alphaTab.ScrollMode.Off },
	];

	const [currentMode, setCurrentMode] = useState<alphaTab.ScrollMode>(
		alphaTab.ScrollMode.Continuous
	);

	const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const mode = parseInt(e.target.value) as alphaTab.ScrollMode;
		setCurrentMode(mode);
		controller.setScrollMode(mode);
	};

	return (
		<div className="play-bar-scroll">
			<label className="scroll-label">滚动:</label>
			<select
				className="scroll-select"
				value={currentMode}
				onChange={handleModeChange}
				aria-label="Scroll Mode"
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

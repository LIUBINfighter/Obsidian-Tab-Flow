import React from 'react';
import type { PlayerController } from '../PlayerController';

interface MetronomeToggleProps {
	controller: PlayerController;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
}

/**
 * MetronomeToggle - 节拍器开关
 * 显示节拍器图标,支持开关切换
 */
export const MetronomeToggle: React.FC<MetronomeToggleProps> = ({
	controller,
	enabled,
	onToggle,
}) => {
	const handleToggle = () => {
		const newState = !enabled;
		onToggle(newState);

		// 通过 controller 设置节拍器
		controller.setMetronome(newState);
	};

	return (
		<div className="play-bar-metronome">
			<label className="metronome-label">节拍器:</label>
			<input
				type="checkbox"
				checked={enabled}
				onChange={handleToggle}
				aria-label="Metronome"
				title="Toggle Metronome"
			/>
		</div>
	);
};

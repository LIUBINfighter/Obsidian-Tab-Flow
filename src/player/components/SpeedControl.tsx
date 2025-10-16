import React, { useState } from 'react';
import type { PlayerController } from '../PlayerController';

interface SpeedControlProps {
	controller: PlayerController;
}

/**
 * SpeedControl - 播放速度控制
 * 6档速度选择: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x
 * 内部管理状态以保持 UI 同步
 */
export const SpeedControl: React.FC<SpeedControlProps> = ({ controller }) => {
	const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

	// 内部状态管理当前速度
	const [currentSpeed, setCurrentSpeed] = useState(1.0);

	const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const speed = parseFloat(e.target.value);
		if (!isNaN(speed)) {
			// 更新内部状态
			setCurrentSpeed(speed);
			// 更新播放器速度
			controller.setPlaybackSpeed(speed);
		}
	};

	return (
		<div className="play-bar-speed">
			<label className="speed-label">速度:</label>
			<select
				className="speed-select"
				value={currentSpeed}
				onChange={handleSpeedChange}
				aria-label="Playback Speed"
			>
				{speeds.map((speed) => (
					<option key={speed} value={speed}>
						{speed}x
					</option>
				))}
			</select>
		</div>
	);
};

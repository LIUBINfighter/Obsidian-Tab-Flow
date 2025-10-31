import React, { useState } from 'react';
import { Gauge } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface SpeedControlProps {
	controller: PlayerController;
}

/**
 * SpeedControl - 播放速度控制
 * 支持 0.5x ~ 2.0x 速度调整
 */
export const SpeedControl: React.FC<SpeedControlProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	const speedOptions = [
		{ label: '0.5x', value: 0.5 },
		{ label: '0.75x', value: 0.75 },
		{ label: '1.0x', value: 1.0 },
		{ label: '1.25x', value: 1.25 },
		{ label: '1.5x', value: 1.5 },
		{ label: '2.0x', value: 2.0 },
	];

	// 从 globalConfig 读取初始速度
	const initialSpeed = globalConfig((s) => s.alphaTabSettings.player.playbackSpeed);
	const [speed, setSpeed] = useState(initialSpeed);

	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newSpeed = parseFloat(e.target.value);
		if (!isNaN(newSpeed)) {
			setSpeed(newSpeed);

			// 更新全局配置（持久化）
			globalConfig.getState().updateAlphaTabSettings({
				player: {
					...globalConfig.getState().alphaTabSettings.player,
					playbackSpeed: newSpeed,
				},
			});

			// 同步到 API
			controller.setPlaybackSpeed(newSpeed);
		}
	};

	return (
		<div className="play-bar-control">
			<Gauge size={16} className="play-bar-control-icon" />
			<select
				className="play-bar-control-select"
				value={speed}
				onChange={handleChange}
				aria-label="Playback Speed"
				title="播放速度"
			>
				{speedOptions.map(({ label, value }) => (
					<option key={value} value={value}>
						{label}
					</option>
				))}
			</select>
		</div>
	);
};

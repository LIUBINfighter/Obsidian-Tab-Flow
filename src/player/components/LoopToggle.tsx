import React, { useState } from 'react';
import { Repeat } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface LoopToggleProps {
	controller: PlayerController;
}

/**
 * LoopToggle - 循环播放开关
 */
export const LoopToggle: React.FC<LoopToggleProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	// 从 globalConfig 读取初始循环状态
	const initialLooping = globalConfig((s) => s.playerExtensions.isLooping);
	const [enabled, setEnabled] = useState(initialLooping);

	const handleToggle = () => {
		const newState = !enabled;
		setEnabled(newState);

		// 更新全局配置（持久化）
		globalConfig.getState().updatePlayerExtensions({
			isLooping: newState,
		});

		// 同步到 API
		controller.setLooping(newState);
	};

	return (
		<button
			className={`play-bar-button ${enabled ? 'active' : ''}`}
			onClick={handleToggle}
			aria-label="Loop Playback"
			title="Toggle Loop"
		>
			<Repeat size={16} />
			<span className="play-bar-button-text">循环</span>
		</button>
	);
};

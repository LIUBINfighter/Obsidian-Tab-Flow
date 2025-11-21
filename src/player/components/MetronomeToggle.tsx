import React, { useState } from 'react';
import { Music2 } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface MetronomeToggleProps {
	controller: PlayerController;
}

/**
 * MetronomeToggle - 节拍器开关
 * 显示节拍器图标,支持开关切换
 */
export const MetronomeToggle: React.FC<MetronomeToggleProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	// 从 globalConfig 读取初始节拍器状态
	const initialEnabled = globalConfig((s) => s.playerExtensions.metronomeEnabled);
	const [enabled, setEnabled] = useState(initialEnabled);

	const handleToggle = () => {
		const newState = !enabled;
		setEnabled(newState);

		// 更新全局配置（持久化）
		globalConfig.getState().updatePlayerExtensions({
			metronomeEnabled: newState,
		});

		// 通过 controller 设置节拍器
		controller.setMetronome(newState);
	};

	return (
		<button
			className={`play-bar-button ${enabled ? 'active' : ''}`}
			onClick={handleToggle}
			aria-label="Metronome"
			title="Toggle Metronome"
		>
			<Music2 size={16} />
			<span className="play-bar-button-text">节拍器</span>
		</button>
	);
};

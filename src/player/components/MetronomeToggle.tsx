import React from 'react';
import { Music2 } from 'lucide-react';
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

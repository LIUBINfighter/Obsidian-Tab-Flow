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
	const [enabled, setEnabled] = useState(false);

	const handleToggle = () => {
		const newState = !enabled;
		setEnabled(newState);
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

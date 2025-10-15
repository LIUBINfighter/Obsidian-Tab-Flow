import React, { useState } from 'react';
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
		<div className="play-bar-loop">
			<label className="loop-label">循环:</label>
			<input
				type="checkbox"
				checked={enabled}
				onChange={handleToggle}
				aria-label="Loop Playback"
				title="Toggle Loop"
			/>
		</div>
	);
};

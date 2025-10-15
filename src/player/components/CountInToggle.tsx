import React from 'react';
import type { PlayerController } from '../PlayerController';

interface CountInToggleProps {
	controller: PlayerController;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
}

/**
 * CountInToggle - 预备拍开关
 */
export const CountInToggle: React.FC<CountInToggleProps> = ({
	controller,
	enabled,
	onToggle,
}) => {
	const handleToggle = () => {
		const newState = !enabled;
		onToggle(newState);
		controller.setCountIn(newState);
	};

	return (
		<div className="play-bar-countin">
			<label className="countin-label">预备拍:</label>
			<input
				type="checkbox"
				checked={enabled}
				onChange={handleToggle}
				aria-label="Count In"
				title="Toggle Count In"
			/>
		</div>
	);
};

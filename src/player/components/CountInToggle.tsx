import React from 'react';
import { Timer } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface CountInToggleProps {
	controller: PlayerController;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
}

/**
 * CountInToggle - 预备拍开关
 */
export const CountInToggle: React.FC<CountInToggleProps> = ({ controller, enabled, onToggle }) => {
	const handleToggle = () => {
		const newState = !enabled;
		onToggle(newState);
		controller.setCountIn(newState);
	};

	return (
		<button
			className={`play-bar-button ${enabled ? 'active' : ''}`}
			onClick={handleToggle}
			aria-label="Count In"
			title="Toggle Count In"
		>
			<Timer size={16} />
			<span className="play-bar-button-text">预备拍</span>
		</button>
	);
};

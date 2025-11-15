/**
 * SettingsToggle - 设置面板切换按钮
 */

import React from 'react';
import { Palette } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface SettingsToggleProps {
	controller: PlayerController;
	onClick: () => void;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({ controller, onClick }) => {
	const uiStore = controller.getUIStore();
	const isOpen = uiStore((s) => s.panels.settingsPanel);

	return (
		<button
			type="button"
			className={`play-bar-button settings-toggle-button ${isOpen ? 'active' : ''}`}
			onClick={onClick}
			title="Settings & Debug"
			aria-label="Settings"
		>
			<Palette size={16} />
			<span className="play-bar-button-text">Settings</span>
		</button>
	);
};

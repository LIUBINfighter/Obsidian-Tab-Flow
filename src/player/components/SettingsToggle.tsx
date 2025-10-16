/**
 * SettingsToggle - 设置面板切换按钮
 */

import React from 'react';
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
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<circle cx="12" cy="12" r="3" />
				<path d="M12 1v6m0 6v6m0-18a9 9 0 0 1 9 9m-18 0a9 9 0 0 1 9-9m9 9a9 9 0 0 1-9 9m0-18a9 9 0 0 0-9 9m18 0a9 9 0 0 0-9-9" />
				<path d="M19.07 4.93 17 7m-10 10-2.07 2.07M4.93 4.93 7 7m10 10 2.07 2.07" />
			</svg>
			<span className="play-bar-button-text">Settings</span>
		</button>
	);
};

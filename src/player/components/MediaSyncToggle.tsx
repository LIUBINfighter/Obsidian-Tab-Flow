/**
 * MediaSyncToggle - 媒体同步面板切换按钮
 */

import React from 'react';
import { Music } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface MediaSyncToggleProps {
	controller: PlayerController;
	onClick: () => void;
}

export const MediaSyncToggle: React.FC<MediaSyncToggleProps> = ({ controller, onClick }) => {
	const uiStore = controller.getUIStore();
	const isOpen = uiStore((s) => s.panels.mediaSyncPanel);

	return (
		<button
			type="button"
			className={`play-bar-button media-sync-toggle-button ${isOpen ? 'active' : ''}`}
			onClick={onClick}
			title="媒体同步"
			aria-label="Media Sync"
		>
			<Music size={16} />
			<span className="play-bar-button-text">MediaSync</span>
		</button>
	);
};

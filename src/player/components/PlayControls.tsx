import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface PlayControlsProps {
	controller: PlayerController;
	isPlaying: boolean;
	canPlay: boolean;
}

/**
 * PlayControls - 播放控制按钮组
 * 包含: 播放/暂停、停止
 */
export const PlayControls: React.FC<PlayControlsProps> = ({ controller, isPlaying, canPlay }) => {
	const handlePlayPause = () => {
		if (!canPlay) {
			console.warn('[PlayControls] Cannot play - score not loaded');
			return;
		}
		controller.playPause();
	};

	const handleStop = () => {
		if (!canPlay) {
			console.warn('[PlayControls] Cannot stop - score not loaded');
			return;
		}
		controller.stop();
	};

	return (
		<div className="play-bar-controls">
			{/* 播放/暂停按钮 */}
			<button
				className={`play-bar-button play-pause-btn ${isPlaying ? 'playing' : ''}`}
				onClick={handlePlayPause}
				disabled={!canPlay}
				aria-label={isPlaying ? 'Pause' : 'Play'}
				title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
			>
				{isPlaying ? <Pause size={20} /> : <Play size={20} />}
			</button>

			{/* 停止按钮 */}
			<button
				className="play-bar-button stop-btn"
				onClick={handleStop}
				disabled={!canPlay}
				aria-label="Stop"
				title="Stop"
			>
				<Square size={20} />
			</button>
		</div>
	);
};

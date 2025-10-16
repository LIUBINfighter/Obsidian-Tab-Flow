import React from 'react';
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
				{isPlaying ? (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
				) : (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<polygon points="5 3 19 12 5 21 5 3" />
					</svg>
				)}
			</button>

			{/* 停止按钮 */}
			<button
				className="play-bar-button stop-btn"
				onClick={handleStop}
				disabled={!canPlay}
				aria-label="Stop"
				title="Stop"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<rect x="5" y="5" width="14" height="14" />
				</svg>
			</button>
		</div>
	);
};

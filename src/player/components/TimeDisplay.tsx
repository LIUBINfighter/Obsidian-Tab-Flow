import React from 'react';

interface TimeDisplayProps {
	currentMs: number;
	totalMs: number;
}

/**
 * TimeDisplay - 时间显示组件
 * 显示: 当前时间 / 总时长 (mm:ss 格式)
 */
export const TimeDisplay: React.FC<TimeDisplayProps> = ({ currentMs, totalMs }) => {
	// 格式化时间: ms -> mm:ss
	const formatTime = (ms: number): string => {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	return (
		<div className="play-bar-time">
			<span className="time-current">{formatTime(currentMs)}</span>
			<span className="time-separator">/</span>
			<span className="time-total">{formatTime(totalMs)}</span>
		</div>
	);
};

import React, { useRef, useState, useCallback } from 'react';
import type { PlayerController } from '../PlayerController';

interface ProgressBarProps {
	controller: PlayerController;
	currentMs: number;
	totalMs: number;
}

/**
 * ProgressBar - 播放进度条 (React 版本)
 * 功能:
 * - 显示播放进度
 * - 支持点击跳转
 * - 支持拖拽跳转
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ controller, currentMs, totalMs }) => {
	const barRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	// 计算进度百分比
	const progress = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

	// 处理进度条交互 (点击/拖拽)
	const handleProgressInteraction = useCallback(
		(e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
			if (!barRef.current || totalMs <= 0) return;

			const rect = barRef.current.getBoundingClientRect();
			const clickX = (e as MouseEvent).clientX - rect.left;
			const percentage = Math.max(0, Math.min(1, clickX / rect.width));
			const targetMs = percentage * totalMs;

			// 通过 controller 跳转
			controller.seek(Math.floor(targetMs));
		},
		[controller, totalMs]
	);

	// 鼠标按下
	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		handleProgressInteraction(e);
		setIsDragging(true);
		e.preventDefault();
	};

	// 鼠标移动 (拖拽中)
	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (isDragging) {
				handleProgressInteraction(e);
			}
		},
		[isDragging, handleProgressInteraction]
	);

	// 鼠标释放
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// 注册/注销全局事件
	React.useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	return (
		<div
			ref={barRef}
			className={`progress-bar-container ${isDragging ? 'dragging' : ''}`}
			onMouseDown={handleMouseDown}
		>
			<div className="progress-bar">
				<div className="progress-fill" style={{ width: `${progress}%` }} />
				<div className="progress-handle" style={{ left: `${progress}%` }} />
			</div>
		</div>
	);
};

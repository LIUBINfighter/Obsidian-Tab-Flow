import React, { useEffect, useRef } from 'react';
import { useRuntimeStore } from '../store/runtimeStore';
import { useUIStore } from '../store/uiStore';
import type { PlayerController } from '../PlayerController';

interface TablatureViewProps {
	controller: PlayerController;
}

export const TablatureView: React.FC<TablatureViewProps> = ({ controller }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	
	// 订阅 runtime state
	const apiReady = useRuntimeStore((s) => s.apiReady);
	const scoreLoaded = useRuntimeStore((s) => s.scoreLoaded);
	const renderState = useRuntimeStore((s) => s.renderState);
	const error = useRuntimeStore((s) => s.error);
	
	// 订阅 UI state
	const loading = useUIStore((s) => s.loading);

	useEffect(() => {
		if (!containerRef.current) return;

		console.log('[TablatureView] Initializing PlayerController');
		controller.init(containerRef.current);

		// 清理函数
		return () => {
			console.log('[TablatureView] Destroying PlayerController');
			controller.destroy();
		};
	}, [controller]);

	// 调试输出
	useEffect(() => {
		console.log('[TablatureView] State:', {
			apiReady,
			scoreLoaded,
			renderState,
			error,
			loading,
		});
	}, [apiReady, scoreLoaded, renderState, error, loading]);

	return (
		<div className="tablature-view">
			{/* Loading Indicator */}
			{loading.isLoading && (
				<div className="loading-overlay">
					<div className="loading-message">{loading.message}</div>
					{loading.progress !== undefined && (
						<div className="loading-progress">
							<div
								className="loading-progress-bar"
								style={{ width: `${loading.progress}%` }}
							/>
						</div>
					)}
				</div>
			)}

			{/* Error Display */}
			{error.type && error.message && (
				<div className="error-overlay">
					<div className="error-message">
						<strong>Error ({error.type}):</strong> {error.message}
					</div>
				</div>
			)}

			{/* AlphaTab Container */}
			<div
				ref={containerRef}
				className="alphatab-container"
				style={{
					width: '100%',
					height: '100%',
					overflow: 'auto',
				}}
			/>
		</div>
	);
};

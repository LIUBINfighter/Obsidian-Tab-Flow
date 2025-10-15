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
		<div 
			className="tablature-view"
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			{/* Loading Indicator */}
			{loading.isLoading && (
				<div 
					className="loading-overlay"
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: 'var(--background-primary)',
						zIndex: 1000,
					}}
				>
					<div className="loading-message" style={{ marginBottom: '10px' }}>
						{loading.message}
					</div>
					{loading.progress !== undefined && (
						<div 
							className="loading-progress"
							style={{
								width: '200px',
								height: '4px',
								backgroundColor: 'var(--background-modifier-border)',
								borderRadius: '2px',
								overflow: 'hidden',
							}}
						>
							<div
								className="loading-progress-bar"
								style={{ 
									width: `${loading.progress}%`,
									height: '100%',
									backgroundColor: 'var(--interactive-accent)',
									transition: 'width 0.3s ease',
								}}
							/>
						</div>
					)}
				</div>
			)}

			{/* Error Display */}
			{error.type && error.message && (
				<div 
					className="error-overlay"
					style={{
						position: 'absolute',
						top: '20px',
						left: '50%',
						transform: 'translateX(-50%)',
						maxWidth: '80%',
						padding: '10px 20px',
						backgroundColor: 'var(--background-modifier-error)',
						border: '1px solid var(--background-modifier-error-border)',
						borderRadius: '4px',
						zIndex: 999,
					}}
				>
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
					position: 'relative',
				}}
			/>
		</div>
	);
};

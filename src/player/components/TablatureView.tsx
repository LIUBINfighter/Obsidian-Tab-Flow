import React, { useEffect, useRef } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { usePlayerStore } from '../store/playerStore';

interface TablatureViewProps {
	resources: {
		bravuraUri: string;
		alphaTabWorkerUri: string;
		soundFontUri: string;
	};
}

export const TablatureView: React.FC<TablatureViewProps> = ({ resources }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { setApi, setTracks, setScoreTitle, setDuration } = usePlayerStore();

	useEffect(() => {
		if (!containerRef.current) return;

		// 创建 alphaTab API 实例，使用最简单的配置
		const settings: alphaTab.Settings = new alphaTab.Settings();
		settings.core.engine = 'html5';
		settings.core.logLevel = alphaTab.LogLevel.Warning;
		settings.core.useWorkers = true;
		settings.core.scriptFile = resources.alphaTabWorkerUri;
		settings.core.fontDirectory = resources.bravuraUri;
		
		// 播放器设置
		settings.player.enablePlayer = true;
		settings.player.enableCursor = true;
		settings.player.enableUserInteraction = true;
		settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
		settings.player.soundFont = resources.soundFontUri;
		settings.player.scrollOffsetY = 0;

		// 创建 API
		const newApi = new alphaTab.AlphaTabApi(containerRef.current, settings);
		
		// 监听乐谱加载完成事件
		newApi.scoreLoaded.on((score: alphaTab.model.Score) => {
			if (score) {
				setScoreTitle(score.title || 'Untitled');
				setTracks(score.tracks);
				// 计算总时长
				const duration = (score as any).duration || 0;
				setDuration(duration);
			}
		});
		
		// 监听播放位置变化
		newApi.playerPositionChanged.on((args: alphaTab.synth.PositionChangedEventArgs) => {
			const currentTime = args.currentTime || 0;
			usePlayerStore.getState().setCurrentTime(currentTime);
		});
		
		// 监听播放状态变化
		newApi.playerStateChanged.on((args: alphaTab.synth.PlayerStateChangedEventArgs) => {
			const isPlaying = args.state === alphaTab.synth.PlayerState.Playing;
			usePlayerStore.getState().setIsPlaying(isPlaying);
		});

		setApi(newApi);

		// 清理函数
		return () => {
			try {
				newApi.destroy();
			} catch (error) {
				console.error('[TablatureView] Error destroying AlphaTab API:', error);
			}
			setApi(null);
		};
	}, [resources, setApi, setTracks, setScoreTitle, setDuration]);

	return (
		<div 
			ref={containerRef} 
			className="alphatab-container"
			style={{ 
				width: '100%', 
				height: '100%',
				overflow: 'auto'
			}}
		/>
	);
};

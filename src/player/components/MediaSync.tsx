/**
 * MediaSync - 外部媒体同步面板
 *
 * 支持与 Audio/Video/YouTube 同步播放
 */

import React, { useState, useRef, useEffect } from 'react';
import type { PlayerController } from '../PlayerController';
import { MediaType, type MediaState } from '../types/media-sync';
import { MediaSyncService } from '../services/MediaSyncService';

interface MediaSyncProps {
	controller: PlayerController;
	isOpen: boolean;
}

/**
 * 提取 YouTube 视频 ID
 */
function extractYouTubeVideoId(input: string): string | null {
	if (!input) return null;

	// 已经是 11 位 ID
	if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
		return input;
	}

	// 标准 URL: https://www.youtube.com/watch?v=VIDEO_ID
	const standardMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
	if (standardMatch) {
		return standardMatch[1];
	}

	// 短链接: https://youtu.be/VIDEO_ID
	const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
	if (shortMatch) {
		return shortMatch[1];
	}

	// 嵌入链接: https://www.youtube.com/embed/VIDEO_ID
	const embedMatch = input.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
	if (embedMatch) {
		return embedMatch[1];
	}

	return null;
}

export const MediaSync: React.FC<MediaSyncProps> = ({ controller, isOpen }) => {
	const runtimeStore = controller.getRuntimeStore();
	const api = runtimeStore((s) => s.alphaTabApi);

	// 媒体状态
	const [mediaState, setMediaState] = useState<MediaState>({ type: MediaType.Synth });

	// 媒体服务
	const mediaSyncService = useRef<MediaSyncService | null>(null);

	// 媒体元素引用
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	// URL 输入
	const [audioUrl, setAudioUrl] = useState('');
	const [videoUrl, setVideoUrl] = useState('');
	const [youtubeInput, setYoutubeInput] = useState('');

	// 初始化媒体服务
	useEffect(() => {
		if (api) {
			mediaSyncService.current = new MediaSyncService(api);
		}

		return () => {
			mediaSyncService.current?.destroy();
		};
	}, [api]);

	// 处理媒体类型切换
	const switchToSynth = () => {
		mediaSyncService.current?.unbind();
		setMediaState({ type: MediaType.Synth });
	};

	const switchToAudio = () => {
		if (!audioUrl) return;

		setMediaState({ type: MediaType.Audio, url: audioUrl });
	};

	const switchToVideo = () => {
		if (!videoUrl) return;

		setMediaState({ type: MediaType.Video, url: videoUrl });
	};

	const switchToYouTube = () => {
		const videoId = extractYouTubeVideoId(youtubeInput);
		if (!videoId) return;

		const url = `https://www.youtube.com/embed/${videoId}`;
		setMediaState({ type: MediaType.YouTube, videoId, url });
	};

	// 处理音频加载
	useEffect(() => {
		if (mediaState.type === MediaType.Audio && audioRef.current && mediaSyncService.current) {
			const element = audioRef.current;
			const onLoadedMetadata = () => {
				mediaSyncService.current?.bind(element, { debug: true });
			};

			if (element.readyState >= 1) {
				// HAVE_METADATA
				mediaSyncService.current.bind(element, { debug: true });
			} else {
				element.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
			}

			return () => {
				element.removeEventListener('loadedmetadata', onLoadedMetadata);
			};
		}
	}, [mediaState]);

	// 处理视频加载
	useEffect(() => {
		if (mediaState.type === MediaType.Video && videoRef.current && mediaSyncService.current) {
			const element = videoRef.current;
			const onLoadedMetadata = () => {
				mediaSyncService.current?.bind(element, { debug: true });
			};

			if (element.readyState >= 1) {
				mediaSyncService.current.bind(element, { debug: true });
			} else {
				element.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
			}

			return () => {
				element.removeEventListener('loadedmetadata', onLoadedMetadata);
			};
		}
	}, [mediaState]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="media-sync-panel">
			{/* 工具栏 */}
			<div className="media-sync-toolbar">
				<div className="media-sync-toolbar-left">
					{/* 媒体类型选择按钮 */}
					<button
						className={`media-sync-btn ${mediaState.type === MediaType.Synth ? 'active' : ''}`}
						onClick={switchToSynth}
						title="使用内置合成器"
					>
						<svg
							className="svg-icon"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M9 18V5l12-2v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="16" r="3" />
						</svg>
						<span>合成器</span>
					</button>

					<button
						className={`media-sync-btn ${mediaState.type === MediaType.Audio ? 'active' : ''}`}
						onClick={switchToAudio}
						disabled={!audioUrl}
						title="加载音频文件"
					>
						<svg
							className="svg-icon"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M9 18V5l12-2v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="16" r="3" />
						</svg>
						<span>音频</span>
					</button>

					<button
						className={`media-sync-btn ${mediaState.type === MediaType.Video ? 'active' : ''}`}
						onClick={switchToVideo}
						disabled={!videoUrl}
						title="加载视频文件"
					>
						<svg
							className="svg-icon"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
							<line x1="7" y1="2" x2="7" y2="22" />
							<line x1="17" y1="2" x2="17" y2="22" />
							<line x1="2" y1="12" x2="22" y2="12" />
							<line x1="2" y1="7" x2="7" y2="7" />
							<line x1="2" y1="17" x2="7" y2="17" />
							<line x1="17" y1="17" x2="22" y2="17" />
							<line x1="17" y1="7" x2="22" y2="7" />
						</svg>
						<span>视频</span>
					</button>

					<button
						className={`media-sync-btn ${mediaState.type === MediaType.YouTube ? 'active' : ''}`}
						onClick={switchToYouTube}
						disabled={!extractYouTubeVideoId(youtubeInput)}
						title="加载 YouTube 视频"
					>
						<svg
							className="svg-icon"
							viewBox="0 0 24 24"
							fill="currentColor"
							stroke="none"
						>
							<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
						</svg>
						<span>YouTube</span>
					</button>
				</div>

				<div className="media-sync-toolbar-right">
					<span className="media-sync-status">
						{mediaState.type === MediaType.Synth && '当前: 内置合成器'}
						{mediaState.type === MediaType.Audio && '当前: 音频同步'}
						{mediaState.type === MediaType.Video && '当前: 视频同步'}
						{mediaState.type === MediaType.YouTube && '当前: YouTube 同步'}
					</span>
				</div>
			</div>

			{/* 内容区域 */}
			<div className="media-sync-content">
				{/* 合成器模式 - 无额外内容 */}
				{mediaState.type === MediaType.Synth && (
					<div className="media-sync-info">
						<p>使用 AlphaTab 内置合成器播放</p>
					</div>
				)}

				{/* 音频输入 */}
				{(mediaState.type === MediaType.Synth || mediaState.type === MediaType.Audio) && (
					<div className="media-sync-input-group">
						<label>音频文件 URL：</label>
						<div className="media-sync-input-row">
							<input
								type="text"
								value={audioUrl}
								onChange={(e) => setAudioUrl(e.target.value)}
								placeholder="https://example.com/audio.mp3"
								className="media-sync-input"
							/>
							<button
								className="media-sync-load-btn"
								onClick={switchToAudio}
								disabled={!audioUrl}
							>
								加载
							</button>
						</div>
					</div>
				)}

				{/* 视频输入 */}
				{(mediaState.type === MediaType.Synth || mediaState.type === MediaType.Video) && (
					<div className="media-sync-input-group">
						<label>视频文件 URL：</label>
						<div className="media-sync-input-row">
							<input
								type="text"
								value={videoUrl}
								onChange={(e) => setVideoUrl(e.target.value)}
								placeholder="https://example.com/video.mp4"
								className="media-sync-input"
							/>
							<button
								className="media-sync-load-btn"
								onClick={switchToVideo}
								disabled={!videoUrl}
							>
								加载
							</button>
						</div>
					</div>
				)}

				{/* YouTube 输入 */}
				{(mediaState.type === MediaType.Synth || mediaState.type === MediaType.YouTube) && (
					<div className="media-sync-input-group">
						<label>YouTube 视频 URL 或 ID：</label>
						<div className="media-sync-input-row">
							<input
								type="text"
								value={youtubeInput}
								onChange={(e) => setYoutubeInput(e.target.value)}
								placeholder="https://www.youtube.com/watch?v=... 或 dQw4w9WgXcQ"
								className="media-sync-input"
							/>
							<button
								className="media-sync-load-btn"
								onClick={switchToYouTube}
								disabled={!extractYouTubeVideoId(youtubeInput)}
							>
								加载
							</button>
						</div>
					</div>
				)}

				{/* 音频播放器 */}
				{mediaState.type === MediaType.Audio && (
					<div className="media-sync-player">
						<audio
							ref={audioRef}
							src={mediaState.url}
							controls
							style={{ width: '100%' }}
						/>
					</div>
				)}

				{/* 视频播放器 */}
				{mediaState.type === MediaType.Video && (
					<div className="media-sync-player">
						<video
							ref={videoRef}
							src={mediaState.url}
							controls
							style={{ width: '100%', maxHeight: '400px' }}
						/>
					</div>
				)}

				{/* YouTube 播放器 */}
				{mediaState.type === MediaType.YouTube && (
					<div className="media-sync-player">
						<iframe
							src={mediaState.url}
							style={{ width: '100%', height: '400px', border: 'none' }}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						/>
					</div>
				)}
			</div>
		</div>
	);
};

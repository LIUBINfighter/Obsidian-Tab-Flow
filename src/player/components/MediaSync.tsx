/**
 * MediaSync - 外部媒体同步面板
 *
 * 支持与 Audio/Video/YouTube 同步播放
 * 支持三种同步模式：双向、媒体为主、曲谱为主
 */

import React, { useState, useRef, useEffect } from 'react';
import { Music, Film, Youtube } from 'lucide-react';
import type { App, TFile } from 'obsidian';
import type { PlayerController } from '../PlayerController';
import { MediaType, type MediaState } from '../types/media-sync';
import { MediaSyncService } from '../services/MediaSyncService';
import { MediaFileSuggestModal } from './MediaFileSuggestModal';
import { SyncMode } from '../types/sync-mode';
import { MediaSyncEditor } from './MediaSyncEditor';
import type { SyncPointInfo } from '../types/sync-point';
import { createDefaultSyncPointInfo } from '../types/sync-point';

interface MediaSyncProps {
	controller: PlayerController;
	app: App;
	isOpen: boolean;
	onClose?: () => void;
}

/**
 * 仅允许安全音频 URL: http(s):// 或 file://
 */
function isValidAudioUrl(url: string): boolean {
	// Accept HTTP(S) and local file URLs only
	return /^(https?:\/\/|file:\/\/)/.test(url.trim());
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

export const MediaSync: React.FC<MediaSyncProps> = ({ controller, app, isOpen, onClose }) => {
	const runtimeStore = controller.getRuntimeStore();
	const api = runtimeStore((s) => s.alphaTabApi);

	// 媒体状态
	const [mediaState, setMediaState] = useState<MediaState>({ type: MediaType.Synth });

	// 同步模式
	const [syncMode, setSyncMode] = useState<SyncMode>(SyncMode.Bidirectional);

	// 性能优化：更新间隔（官方推荐 50ms）
	const [updateInterval, setUpdateInterval] = useState<number>(50);

	// 同步点编辑器标签页管理
	const [activeTab, setActiveTab] = useState<'basic' | 'editor'>('basic');

	// 同步点信息
	const [syncPointInfo, setSyncPointInfo] = useState<SyncPointInfo>(createDefaultSyncPointInfo());

	// 当前播放时间
	const [playbackTime, setPlaybackTime] = useState<number>(0);

	// Refs	// 媒体服务
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

	// 同步模式变化时更新服务
	useEffect(() => {
		if (mediaSyncService.current) {
			mediaSyncService.current.setSyncMode(syncMode);
		}
	}, [syncMode]);

	// 更新间隔变化时更新服务
	useEffect(() => {
		if (mediaSyncService.current) {
			mediaSyncService.current.setUpdateInterval(updateInterval);
		}
	}, [updateInterval]);

	// 打开文件选择 Modal
	const openFileSelectModal = () => {
		new MediaFileSuggestModal(app, async (file: TFile) => {
			try {
				// 读取文件并创建 Blob URL
				const arrayBuffer = await app.vault.readBinary(file);
				const blob = new Blob([arrayBuffer]);
				const url = URL.createObjectURL(blob);

				// 根据文件类型加载
				const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(
					file.extension.toLowerCase()
				);

				if (isAudio) {
					setAudioUrl(url);
					setMediaState({ type: MediaType.Audio, url });
				} else {
					setVideoUrl(url);
					setMediaState({ type: MediaType.Video, url });
				}
			} catch (error) {
				console.error('[MediaSync] Failed to load file:', error);
			}
		}).open();
	};

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

	return (
		<div className={`media-sync-panel ${isOpen ? 'media-sync-open' : ''}`}>
			{/* 工具栏 */}
			<div className="media-sync-toolbar">
				<div className="media-sync-toolbar-left">
					{/* 媒体类型选择按钮 */}
					<button
						className={`media-sync-btn ${mediaState.type === MediaType.Synth ? 'active' : ''}`}
						onClick={switchToSynth}
						title="使用内置合成器"
					>
						<Music size={16} />
						<span>合成器</span>
					</button>

					<button
						className={`media-sync-btn ${mediaState.type === MediaType.Audio ? 'active' : ''}`}
						onClick={switchToAudio}
						disabled={!audioUrl}
						title="加载音频文件"
					>
						<Music size={16} />
						<span>音频</span>
					</button>

					<button
						className={`media-sync-btn ${mediaState.type === MediaType.Video ? 'active' : ''}`}
						onClick={switchToVideo}
						disabled={!videoUrl}
						title="加载视频文件"
					>
						<Film size={16} />
						<span>视频</span>
					</button>

					<button
						className={`media-sync-btn ${mediaState.type === MediaType.YouTube ? 'active' : ''}`}
						onClick={switchToYouTube}
						disabled={!extractYouTubeVideoId(youtubeInput)}
						title="加载 YouTube 视频"
					>
						<Youtube size={16} />
						<span>YouTube</span>
					</button>
				</div>

				<div className="media-sync-toolbar-right">
					{/* 同步模式选择器 */}
					{mediaState.type !== MediaType.Synth && (
						<>
							<select
								className="media-sync-mode-select"
								value={syncMode}
								onChange={(e) => setSyncMode(e.target.value as SyncMode)}
								title="选择同步模式"
							>
								<option value={SyncMode.Bidirectional}>⇄ 双向同步</option>
								<option value={SyncMode.MediaMaster}>▶ 媒体为主</option>
								<option value={SyncMode.ScoreMaster}>♪ 曲谱为主</option>
							</select>

							{/* 性能优化：更新频率控制 */}
							<select
								className="media-sync-throttle-select"
								value={updateInterval}
								onChange={(e) => setUpdateInterval(Number(e.target.value))}
								title="光标更新频率（官方推荐 50ms）"
							>
								<option value={16}>🚀 60fps (16ms)</option>
								<option value={33}>⚡ 30fps (33ms)</option>
								<option value={50}>✅ 20fps (50ms) 推荐</option>
								<option value={100}>📱 10fps (100ms) 省电</option>
							</select>
						</>
					)}

					<span className="media-sync-status">
						{mediaState.type === MediaType.Synth && '当前: 内置合成器'}
						{mediaState.type === MediaType.Audio && '当前: 音频同步'}
						{mediaState.type === MediaType.Video && '当前: 视频同步'}
						{mediaState.type === MediaType.YouTube && '当前: YouTube 同步'}
					</span>

					{/* 关闭按钮 */}
					{onClose && (
						<button
							className="media-sync-close-btn"
							onClick={onClose}
							title="关闭媒体同步面板"
							aria-label="Close media sync panel"
						>
							✕
						</button>
					)}
				</div>
			</div>

			{/* 内容区域 - 标签页 */}
			<div className="media-sync-tabs-wrapper">
				{/* 标签页头 */}
				<div className="media-sync-tabs-header">
					<button
						className={`media-sync-tab ${activeTab === 'basic' ? 'active' : ''}`}
						onClick={() => setActiveTab('basic')}
					>
						基础设置
					</button>
					{mediaState.type !== MediaType.Synth && (
						<button
							className={`media-sync-tab ${activeTab === 'editor' ? 'active' : ''}`}
							onClick={() => setActiveTab('editor')}
						>
							同步编辑器
						</button>
					)}
				</div>

				{/* 标签页内容 */}
				<div className="media-sync-tabs-content">
					{/* 基础设置标签页 */}
					{activeTab === 'basic' && (
						<div className="media-sync-content">
							{/* Vault 文件选择按钮 */}
							{(mediaState.type === MediaType.Synth ||
								mediaState.type === MediaType.Audio ||
								mediaState.type === MediaType.Video) && (
								<div className="media-sync-input-group">
									<label>从 Vault 中选择：</label>
									<button
										className="media-sync-load-btn"
										onClick={openFileSelectModal}
									>
										选择媒体文件...
									</button>
								</div>
							)}

							{/* 音频输入 */}
							{(mediaState.type === MediaType.Synth ||
								mediaState.type === MediaType.Audio) && (
								<div className="media-sync-input-group">
									<label>音频文件 URL：</label>
									<div className="media-sync-input-row">
										<input
											type="text"
											value={audioUrl}
											onChange={(e) => {
												const val = e.target.value;
												if (isValidAudioUrl(val)) setAudioUrl(val);
											}}
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
							{(mediaState.type === MediaType.Synth ||
								mediaState.type === MediaType.Video) && (
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
							{(mediaState.type === MediaType.Synth ||
								mediaState.type === MediaType.YouTube) && (
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
										onTimeUpdate={(e) => {
											setPlaybackTime(e.currentTarget.currentTime * 1000);
										}}
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
										onTimeUpdate={(e) => {
											setPlaybackTime(e.currentTarget.currentTime * 1000);
										}}
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
					)}

					{/* 同步编辑器标签页 */}
					{activeTab === 'editor' && mediaState.type !== MediaType.Synth && (
						<div
							style={{
								width: '100%',
								height: '400px',
								overflow: 'hidden',
							}}
						>
							<MediaSyncEditor
								syncPointInfo={syncPointInfo}
								onSyncPointInfoChanged={(info) => {
									setSyncPointInfo(info);
								}}
								playbackTime={playbackTime}
								onPlaybackTimeChange={(time) => {
									setPlaybackTime(time);
									// 同步媒体播放位置
									if (audioRef.current) {
										audioRef.current.currentTime = time / 1000;
									} else if (videoRef.current) {
										videoRef.current.currentTime = time / 1000;
									}
								}}
								width={800}
								height={400}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

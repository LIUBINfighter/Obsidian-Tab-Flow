/**
 * 音轨控制组件
 *
 * 借鉴官方 playground 示例，提供音轨级别的控制：
 * - 音轨选择（显示/隐藏）
 * - Solo/Mute 控制
 * - 音量调节
 * - 移调（完全移调和音频移调）
 * - 五线谱显示选项
 */

import type * as AlphaTab from '@coderline/alphatab';
import React, { useState } from 'react';
import { StaffItem } from './StaffItem';

/**
 * 音轨控制项属性
 */
export interface TrackItemProps {
	/** AlphaTab API 实例 */
	api: AlphaTab.AlphaTabApi;

	/** 音轨数据 */
	track: AlphaTab.model.Track;

	/** 是否已选中（显示中） */
	isSelected: boolean;

	/** 音轨选择变化回调（可选） */
	onSelectionChange?: (track: AlphaTab.model.Track, selected: boolean) => void;
}

/**
 * 音轨控制组件
 */
export const TrackItem: React.FC<TrackItemProps> = ({
	api,
	track,
	isSelected,
	onSelectionChange,
}) => {
	// ========== 状态管理 ==========

	// Mute 状态
	const [isMute, setMute] = useState(track.playbackInfo.isMute);

	// Solo 状态
	const [isSolo, setSolo] = useState(track.playbackInfo.isSolo);

	// 音量
	const [volume, setVolume] = useState(track.playbackInfo.volume);

	// 音频移调（仅影响播放）
	const [transposeAudio, setTransposeAudio] = useState<number>(0);

	// 完全移调（影响播放和显示）
	const [transposeFull, setTransposeFull] = useState<number>(0);

	// ========== 事件处理 ==========

	/**
	 * 切换 Mute 状态
	 */
	const handleMuteToggle = () => {
		const newMute = !isMute;
		setMute(newMute);
		track.playbackInfo.isMute = newMute;
		api.changeTrackMute([track], newMute);
	};

	/**
	 * 切换 Solo 状态
	 */
	const handleSoloToggle = () => {
		const newSolo = !isSolo;
		setSolo(newSolo);
		track.playbackInfo.isSolo = newSolo;
		api.changeTrackSolo([track], newSolo);
	};

	/**
	 * 音量调节
	 */
	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newVolume = e.target.valueAsNumber;
		setVolume(newVolume);
		// 计算相对音量变化
		api.changeTrackVolume([track], newVolume / track.playbackInfo.volume);
	};

	/**
	 * 音轨选择切换
	 */
	const handleTrackSelect = (selected: boolean) => {
		let newTracks: AlphaTab.model.Track[];

		if (selected) {
			// 添加音轨
			newTracks = [...api.tracks, track];
		} else {
			// 移除音轨
			newTracks = api.tracks.filter((t) => t !== track);

			// 至少保留一个音轨
			if (newTracks.length === 0) {
				return;
			}
		}

		// 按索引排序
		newTracks.sort((a, b) => a.index - b.index);

		// 重新渲染
		api.renderTracks(newTracks);

		// 触发回调
		onSelectionChange?.(track, selected);
	};

	/**
	 * 音频移调
	 */
	const handleTransposeAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTranspose = e.target.valueAsNumber;
		setTransposeAudio(newTranspose);
		api.changeTrackTranspositionPitch([track], newTranspose);
	};

	/**
	 * 完全移调
	 */
	const handleTransposeFullChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTranspose = e.target.valueAsNumber;
		setTransposeFull(newTranspose);

		// 更新设置中的移调音高
		const pitches = api.settings.notation.transpositionPitches;
		while (pitches.length < track.index + 1) {
			pitches.push(0);
		}
		pitches[track.index] = newTranspose;

		api.updateSettings();
		api.render();
	};

	// ========== 渲染 ==========

	return (
		<div className="tabflow-track-item" data-track-index={track.index}>
			{/* 音轨基本信息和控制 */}
			<div className="tabflow-track-header">
				<div className="tabflow-track-info">
					<input
						type="checkbox"
						id={`tabflow-track-${track.index}`}
						className="tabflow-track-checkbox"
						checked={isSelected}
						onChange={(e) => handleTrackSelect(e.target.checked)}
					/>
					<label
						htmlFor={`tabflow-track-${track.index}`}
						className="tabflow-track-name"
						title={track.name}
					>
						{track.name}
					</label>
				</div>

				<div className="tabflow-track-controls">
					{/* Solo 按钮 */}
					<button
						type="button"
						className={`tabflow-btn tabflow-btn-icon ${isSolo ? 'is-active' : ''}`}
						onClick={handleSoloToggle}
						aria-label="Solo"
						title="Solo - 独奏此音轨"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
							<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
						</svg>
					</button>

					{/* Mute 按钮 */}
					<button
						type="button"
						className={`tabflow-btn tabflow-btn-icon ${isMute ? 'is-muted' : ''}`}
						onClick={handleMuteToggle}
						aria-label="Mute"
						title="Mute - 静音此音轨"
					>
						{isMute ? (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M11 5L6 9H2v6h4l5 4V5z"></path>
								<line x1="23" y1="9" x2="17" y2="15"></line>
								<line x1="17" y1="9" x2="23" y2="15"></line>
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
							</svg>
						)}
					</button>
				</div>
			</div>

			{/* 音量控制 */}
			<div className="tabflow-track-setting">
				<label className="tabflow-setting-label">音量</label>
				<div className="tabflow-setting-control">
					<input
						type="range"
						className="tabflow-slider"
						min="0"
						max="16"
						step="0.1"
						value={volume}
						onChange={handleVolumeChange}
						onClick={(e) => e.stopPropagation()}
					/>
					<span className="tabflow-setting-value">
						{Math.round((volume * 100) / 16)}%
					</span>
				</div>
			</div>

			{/* 完全移调 */}
			<div className="tabflow-track-setting">
				<label
					className="tabflow-setting-label"
					title="完全移调 - 同时影响音频播放和乐谱显示"
				>
					完全移调
				</label>
				<div className="tabflow-setting-control">
					<input
						type="range"
						className="tabflow-slider"
						min="-12"
						max="12"
						step="1"
						value={transposeFull}
						onChange={handleTransposeFullChange}
						onClick={(e) => e.stopPropagation()}
					/>
					<span className="tabflow-setting-value">
						{transposeFull > 0 ? '+' : ''}
						{transposeFull}
					</span>
				</div>
			</div>

			{/* 音频移调 */}
			<div className="tabflow-track-setting">
				<label
					className="tabflow-setting-label"
					title="音频移调 - 仅影响音频播放，不改变乐谱显示"
				>
					音频移调
				</label>
				<div className="tabflow-setting-control">
					<input
						type="range"
						className="tabflow-slider"
						min="-12"
						max="12"
						step="1"
						value={transposeAudio}
						onChange={handleTransposeAudioChange}
						onClick={(e) => e.stopPropagation()}
					/>
					<span className="tabflow-setting-value">
						{transposeAudio > 0 ? '+' : ''}
						{transposeAudio}
					</span>
				</div>
			</div>

			{/* 五线谱显示选项 */}
			{track.staves.map((staff) => (
				<StaffItem key={staff.index} api={api} staff={staff} />
			))}
		</div>
	);
};

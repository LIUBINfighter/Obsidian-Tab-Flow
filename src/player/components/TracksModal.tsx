/**
 * 音轨选择器模态框
 *
 * 借鉴官方 playground 示例，提供音轨管理界面：
 * - 显示所有可用音轨
 * - 支持音轨选择/取消选择
 * - 集成 TrackItem 和 StaffItem 组件
 */

import type * as AlphaTab from '@coderline/alphatab';
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAlphaTabEvent } from '../hooks';
import { TrackItem } from './TrackItem';
import type { PlayerController } from '../PlayerController';

/**
 * 音轨选择器属性
 */
export interface TracksModalProps {
	/** AlphaTab API 实例 */
	api: AlphaTab.AlphaTabApi;

	/** PlayerController 实例 */
	controller: PlayerController;

	/** 是否打开 */
	isOpen: boolean;

	/** 关闭回调 */
	onClose: () => void;
}

/**
 * 音轨选择器模态框组件
 */
export const TracksModal: React.FC<TracksModalProps> = ({ api, controller, isOpen, onClose }) => {
	// ========== 状态管理 ==========

	// 当前曲谱
	const [score, setScore] = useState(api.score);

	// 已选中的音轨（使用 Map 便于快速查找）
	const [selectedTracks, setSelectedTracks] = useState<Map<number, AlphaTab.model.Track>>(
		new Map()
	);

	// ========== 事件监听 ==========

	/**
	 * 监听渲染开始事件，更新已选中的音轨
	 */
	useAlphaTabEvent(api, 'renderStarted', () => {
		const newSelectedTracks = new Map<number, AlphaTab.model.Track>();

		for (const track of api.tracks) {
			newSelectedTracks.set(track.index, track);
		}

		setSelectedTracks(newSelectedTracks);
	});

	/**
	 * 监听曲谱加载事件，更新曲谱状态
	 */
	useAlphaTabEvent<AlphaTab.model.Score>(api, 'scoreLoaded', (loadedScore) => {
		setScore(loadedScore);
	});

	// ========== 副作用 ==========

	/**
	 * 同步 API 的 score 到组件状态
	 */
	useEffect(() => {
		if (api.score) {
			setScore(api.score);
		}
	}, [api.score]);

	/**
	 * 初始化已选中的音轨
	 */
	useEffect(() => {
		const initialSelectedTracks = new Map<number, AlphaTab.model.Track>();

		for (const track of api.tracks) {
			initialSelectedTracks.set(track.index, track);
		}

		setSelectedTracks(initialSelectedTracks);
	}, [api.tracks]);

	// ========== 事件处理 ==========

	/**
	 * 处理音轨选择变化
	 */
	const handleTrackSelectionChange = (track: AlphaTab.model.Track, selected: boolean) => {
		console.log('[TracksModal] 音轨选择变化', {
			track: track.name,
			index: track.index,
			selected,
		});
	};

	/**
	 * 全选音轨
	 */
	const selectAllTracks = () => {
		if (!score) return;

		const allTracks = score.tracks.slice().sort((a, b) => a.index - b.index);
		api.renderTracks(allTracks);
	};

	/**
	 * 取消全选（保留第一个音轨）
	 */
	const deselectAllTracks = () => {
		if (!score || score.tracks.length === 0) return;

		// 只渲染第一个音轨
		api.renderTracks([score.tracks[0]]);
	};

	// ========== 渲染 ==========

	if (!score) {
		return null;
	}

	return (
		<div
			className={`tabflow-tracks-modal ${isOpen ? 'is-open' : ''}`}
			onClick={(e) => {
				// 点击背景关闭
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
		>
			<div className="tabflow-tracks-panel">
				{/* 头部 */}
				<div className="tabflow-tracks-header">
					<h3 className="tabflow-tracks-title">音轨管理</h3>

					<div className="tabflow-tracks-actions">
						{/* 全选按钮 */}
						<button
							type="button"
							className="tabflow-btn tabflow-btn-sm"
							onClick={selectAllTracks}
							title="选择所有音轨"
						>
							全选
						</button>

						{/* 取消全选按钮 */}
						<button
							type="button"
							className="tabflow-btn tabflow-btn-sm"
							onClick={deselectAllTracks}
							title="仅保留第一个音轨"
						>
							清空
						</button>

						{/* 关闭按钮 */}
						<button
							type="button"
							className="tabflow-btn tabflow-btn-icon"
							onClick={onClose}
							aria-label="关闭"
							title="关闭音轨管理"
						>
							<X size={16} />
						</button>
					</div>
				</div>

				{/* 音轨列表 */}
				<div className="tabflow-tracks-list">
					{score.tracks.length === 0 ? (
						<div className="tabflow-tracks-empty">
							<p>当前曲谱没有可用音轨</p>
						</div>
					) : (
						score.tracks.map((track) => (
							<TrackItem
								key={track.index}
								api={api}
								controller={controller}
								track={track}
								isSelected={selectedTracks.has(track.index)}
								onSelectionChange={handleTrackSelectionChange}
							/>
						))
					)}
				</div>

				{/* 底部信息 */}
				<div className="tabflow-tracks-footer">
					<span className="tabflow-tracks-info">
						已选中 {selectedTracks.size} / {score.tracks.length} 个音轨
					</span>
				</div>
			</div>
		</div>
	);
};

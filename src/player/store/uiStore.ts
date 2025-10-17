/**
 * UI Store - UI 临时状态（非持久化）
 *
 * 职责：
 * 1. 管理 UI 面板的显示/隐藏状态
 * 2. 管理加载状态和进度提示
 * 3. 管理 Toast 通知
 * 4. 不持久化到 localStorage
 *
 * 架构更新：使用工厂模式支持多实例（多标签页隔离）
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';

export interface ToastMessage {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error';
	message: string;
	duration?: number; // ms，默认 3000
}

export interface UIStore {
	// State
	panels: {
		tracksPanel: boolean;
		settingsPanel: boolean;
		debugBar: boolean;
		exportModal: boolean;
		shareCardModal: boolean;
		mediaSyncPanel: boolean;
	};
	loading: {
		isLoading: boolean;
		message: string;
		progress?: number; // 0-100
	};
	toasts: ToastMessage[];

	// Actions - Panel Management
	togglePanel: (panel: keyof UIStore['panels']) => void;
	showPanel: (panel: keyof UIStore['panels']) => void;
	hidePanel: (panel: keyof UIStore['panels']) => void;
	hideAllPanels: () => void;

	// Actions - Loading State
	setLoading: (isLoading: boolean, message?: string, progress?: number) => void;

	// Actions - Toast Management
	showToast: (type: ToastMessage['type'], message: string, duration?: number) => void;
	removeToast: (id: string) => void;
	clearToasts: () => void;

	// Actions - Reset
	reset: () => void;
}

/**
 * 工厂函数：创建独立的 UIStore 实例
 * 每个 PlayerController 应该创建自己的 store 实例，避免多标签页状态冲突
 */
export function createUIStore(): UseBoundStore<StoreApi<UIStore>> {
	return create<UIStore>((set, get) => ({
		// Initial State
		panels: {
			tracksPanel: false,
			settingsPanel: false,
			debugBar: false,
			exportModal: false,
			shareCardModal: false,
			mediaSyncPanel: false,
		},
		loading: {
			isLoading: false,
			message: '',
		},
		toasts: [],

		// Panel Management
		togglePanel: (panel) => {
			set((state) => ({
				panels: {
					...state.panels,
					[panel]: !state.panels[panel],
				},
			}));
		},

		showPanel: (panel) => {
			set((state) => ({
				panels: {
					...state.panels,
					[panel]: true,
				},
			}));
		},

		hidePanel: (panel) => {
			set((state) => ({
				panels: {
					...state.panels,
					[panel]: false,
				},
			}));
		},

		hideAllPanels: () => {
			set({
				panels: {
					tracksPanel: false,
					settingsPanel: false,
					debugBar: false,
					exportModal: false,
					shareCardModal: false,
					mediaSyncPanel: false,
				},
			});
		},

		// Loading State
		setLoading: (isLoading, message = '', progress) => {
			set({
				loading: {
					isLoading,
					message,
					progress,
				},
			});
		},

		// Toast Management
		showToast: (type, message, duration = 3000) => {
			const id = `toast-${Date.now()}-${Math.random()}`;
			const toast: ToastMessage = { id, type, message, duration };

			set((state) => ({
				toasts: [...state.toasts, toast],
			}));

			// 自动移除
			if (duration > 0) {
				setTimeout(() => {
					get().removeToast(id);
				}, duration);
			}
		},

		removeToast: (id) => {
			set((state) => ({
				toasts: state.toasts.filter((t) => t.id !== id),
			}));
		},

		clearToasts: () => {
			set({ toasts: [] });
		},

		reset: () => {
			set({
				panels: {
					tracksPanel: false,
					settingsPanel: false,
					debugBar: false,
					exportModal: false,
					shareCardModal: false,
					mediaSyncPanel: false,
				},
				loading: {
					isLoading: false,
					message: '',
				},
				toasts: [],
			});
		},
	}));
}

// 保留全局单例用于向后兼容（旧代码/组件可能依赖）
// 新代码应使用 createUIStore() 工厂函数
export const useUIStore = createUIStore();

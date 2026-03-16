/**
 * Settings Panel - 调试和配置面板
 *
 * 参考 AlphaTab 官方 Playground 实现
 * 支持完整的 AlphaTab Settings 配置和插件扩展设置
 */

import React, { createContext, useContext, useEffect, useId, useState } from 'react';
import { Notice } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import type { PlayerController } from '../PlayerController';
import {
	exportConfigToJSON,
	importConfigFromJSON,
	copyConfigToClipboard,
} from '../utils/settingsUtils';
import type {
	GlobalAlphaTabSettings,
	GlobalPlayerExtensions,
	UIConfig,
} from '../types/global-config-schema';

// ========== Context ==========

interface SettingsContextProps {
	controller: PlayerController;
	onSettingsUpdated: () => void;
}

const SettingsContext = createContext<SettingsContextProps>(null!);

// ========== Type Definitions ==========

type TypeScriptEnum = { [key: number | string]: number | string };
type Indexable = Record<string, unknown>;

type ValueAccessor = {
	getValue: (context: SettingsContextProps) => unknown;
	setValue: (context: SettingsContextProps, value: unknown) => void;
};

type ControlProps = ValueAccessor & { inputId: string };

type ButtonGroupButtonSchema = { label: string; value: unknown };

type ButtonGroupSchema = { type: 'button-group'; buttons: ButtonGroupButtonSchema[] };
type NumberInputSchema = { type: 'number-input'; min?: number; max?: number; step?: number };
type BooleanToggleSchema = { type: 'boolean-toggle' };
type NumberRangeSchema = { type: 'number-range'; min: number; max: number; step: number };
type EnumDropDownSchema = { type: 'enum-dropdown'; enumType: TypeScriptEnum };
type TextInputSchema = { type: 'text-input'; placeholder?: string };

type SettingSchema = {
	label: string;
	control:
		| ButtonGroupSchema
		| EnumDropDownSchema
		| NumberRangeSchema
		| NumberInputSchema
		| BooleanToggleSchema
		| TextInputSchema;
	prepareValue?(value: unknown): unknown;
} & ValueAccessor;

type SettingsGroupSchema = { title: string; settings: SettingSchema[] };

type UpdateSettingsOptions = {
	prepareValue?: (value: unknown) => unknown;
	afterUpdate?: (context: SettingsContextProps) => void;
	callRender?: boolean;
	callUpdateSettings?: boolean;
};

type ImportedConfig = {
	alphaTabSettings?: Partial<GlobalAlphaTabSettings> & {
		display?: Partial<GlobalAlphaTabSettings['display']> & { barsPerRow?: number | null };
	};
	playerExtensions?: Partial<GlobalPlayerExtensions>;
	uiConfig?: Partial<UIConfig>;
};

// ========== Helper Functions ==========

function updateApiSettings(
	context: SettingsContextProps,
	update: (api: alphaTab.AlphaTabApi) => void,
	options?: UpdateSettingsOptions
) {
	const api = context.controller.getRuntimeStore().getState().alphaTabApi;
	if (!api) {
		console.warn('[SettingsPanel] API not ready');
		return;
	}

	update(api);

	if (options?.callUpdateSettings ?? true) {
		api.updateSettings();
	}
	if (options?.callRender ?? true) {
		api.render();
	}
	context.onSettingsUpdated();
	options?.afterUpdate?.(context);
}

function useSettingsContext(): SettingsContextProps {
	const context = useContext(SettingsContext);
	if (!context) {
		throw new Error('[SettingsPanel] Missing settings context');
	}
	return context;
}

function toNumberValue(value: unknown, fallback = 0): number {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function toBooleanValue(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

// ========== Factory for Accessors ==========

function isPollutingKey(key: string) {
	return key === '__proto__' || key === 'constructor';
}

const factory = {
	// AlphaTab Settings 访问器
	settingAccessors(setting: string, updateOptions?: UpdateSettingsOptions) {
		const parts = setting.split('.');
		return {
			getValue(context: SettingsContextProps) {
				const api = context.controller.getRuntimeStore().getState().alphaTabApi;
				if (!api) return null;

				let obj: Indexable = api.settings as unknown as Indexable;
				for (let i = 0; i < parts.length - 1; i++) {
					const key = parts[i];
					if (isPollutingKey(key)) {
						return undefined;
					}
					const next = obj[key];
					if (!next || typeof next !== 'object') {
						return undefined;
					}
					obj = next as Indexable;
				}
				const lastKey = parts[parts.length - 1];
				if (isPollutingKey(lastKey)) {
					return undefined;
				}
				return obj[lastKey];
			},
			setValue(context: SettingsContextProps, value: unknown) {
				updateApiSettings(
					context,
					(api) => {
						let obj: Indexable = api.settings as unknown as Indexable;
						for (let i = 0; i < parts.length - 1; i++) {
							const key = parts[i];
							if (isPollutingKey(key)) {
								return; // Prevent polluting property chain
							}
							const next = obj[key];
							if (!next || typeof next !== 'object') {
								return;
							}
							obj = next as Indexable;
						}
						const lastKey = parts[parts.length - 1];
						if (isPollutingKey(lastKey)) {
							return; // Prevent polluting the final property
						}
						if (updateOptions?.prepareValue) {
							value = updateOptions.prepareValue(value);
						}
						obj[lastKey] = value;
					},
					updateOptions
				);
			},
		};
	},

	// AlphaTab API 直接属性访问器
	apiAccessors<P extends keyof alphaTab.AlphaTabApi>(property: P) {
		return {
			getValue(context: SettingsContextProps) {
				const api = context.controller.getRuntimeStore().getState().alphaTabApi;
				return api ? api[property] : null;
			},
			setValue(context: SettingsContextProps, value: alphaTab.AlphaTabApi[P]) {
				const api = context.controller.getRuntimeStore().getState().alphaTabApi;
				if (api) {
					api[property] = value;
					context.onSettingsUpdated();
				}
			},
		};
	},

	// Config Store 访问器（持久化配置）
	// 注意：现在使用 GlobalConfig store 而不是旧的 configStore
	configAccessors(path: string, updateOptions?: UpdateSettingsOptions) {
		const parts = path.split('.');
		return {
			getValue(context: SettingsContextProps) {
				const globalConfig = context.controller.getGlobalConfigStore().getState();
				let obj: unknown = globalConfig;
				for (const part of parts) {
					if (!obj || typeof obj !== 'object') {
						return undefined;
					}
					obj = (obj as Indexable)[part];
				}
				return obj;
			},
			setValue(context: SettingsContextProps, value: unknown) {
				if (updateOptions?.prepareValue) {
					value = updateOptions.prepareValue(value);
				}

				// 根据路径更新相应的配置
				if (parts[0] === 'alphaTabSettings') {
					// 更新 alphaTabSettings
					const settingPath = parts.slice(1);
					const currentSettings = context.controller
						.getGlobalConfigStore()
						.getState().alphaTabSettings;
					const updatedSettings = JSON.parse(JSON.stringify(currentSettings));

					let target: Indexable = updatedSettings as unknown as Indexable;
					for (let i = 0; i < settingPath.length - 1; i++) {
						const next = target[settingPath[i]];
						if (!next || typeof next !== 'object') {
							return;
						}
						target = next as Indexable;
					}
					target[settingPath[settingPath.length - 1]] = value;

					context.controller
						.getGlobalConfigStore()
						.getState()
						.updateAlphaTabSettings(updatedSettings);
				} else if (parts[0] === 'playerExtensions') {
					// 更新 playerExtensions
					const extensionKey = parts[1];
					context.controller
						.getGlobalConfigStore()
						.getState()
						.updatePlayerExtensions({
							[extensionKey]: value,
						});
				} else if (parts[0] === 'uiConfig') {
					// 更新 uiConfig
					const uiKey = parts[1];
					context.controller
						.getGlobalConfigStore()
						.getState()
						.updateUIConfig({
							[uiKey]: value,
						});
				}

				context.onSettingsUpdated();
				updateOptions?.afterUpdate?.(context);
			},
		};
	},

	// Factory Methods
	numberRange(
		label: string,
		setting: string,
		min: number,
		max: number,
		step: number,
		updateOptions?: UpdateSettingsOptions
	): SettingSchema {
		return {
			label,
			...factory.settingAccessors(setting, updateOptions),
			control: { type: 'number-range', min, max, step },
		};
	},

	numberInput(
		label: string,
		setting: string,
		min?: number,
		max?: number,
		step?: number,
		updateOptions?: UpdateSettingsOptions
	): SettingSchema {
		return {
			label,
			...factory.settingAccessors(setting, updateOptions),
			control: { type: 'number-input', min, max, step },
		};
	},

	toggle(label: string, setting: string, updateOptions?: UpdateSettingsOptions): SettingSchema {
		return {
			label,
			...factory.settingAccessors(setting, updateOptions),
			control: { type: 'boolean-toggle' },
		};
	},

	enumDropDown(
		label: string,
		setting: string,
		enumType: TypeScriptEnum,
		updateOptions?: UpdateSettingsOptions
	): SettingSchema {
		return {
			label,
			...factory.settingAccessors(setting, updateOptions),
			control: { type: 'enum-dropdown', enumType },
		};
	},

	buttonGroup(
		label: string,
		setting: string,
		buttons: [string, unknown][],
		updateOptions?: UpdateSettingsOptions
	): SettingSchema {
		return {
			label,
			...factory.settingAccessors(setting, updateOptions),
			control: {
				type: 'button-group',
				buttons: buttons.map((b) => ({ label: b[0], value: b[1] })),
			},
		};
	},
};

// ========== Settings Schema ==========

function buildSettingsGroups(): SettingsGroupSchema[] {
	const noRerender: UpdateSettingsOptions = {
		callRender: false,
		callUpdateSettings: true,
	};

	return [
		{
			title: 'Display ▸ General',
			settings: [
				factory.buttonGroup('Render Engine', 'core.engine', [
					['SVG (Recommended)', 'svg'],
					['HTML5 (Not Stable)', 'html5'],
				]),
				factory.numberRange('Scale', 'display.scale', 0.25, 2, 0.25),
				factory.numberRange('Stretch Force', 'display.stretchForce', 0.25, 2, 0.25),
				factory.enumDropDown('Layout Mode', 'display.layoutMode', alphaTab.LayoutMode),
				{
					label: 'Bars Per Row',
					...factory.settingAccessors('display.barsPerRow', {
						prepareValue(value: number) {
							// -1 表示自动，转换 UI 值
							return value < 0 ? -1 : value;
						},
					}),
					control: { type: 'number-range', min: -1, max: 20, step: 1 },
				},
				factory.numberInput('Start Bar', 'display.startBar', 1, undefined, 1),
				factory.numberInput('Bar Count', 'display.barCount', -1, undefined, 1),
			],
		},
		{
			title: 'Display ▸ Stave Profile',
			settings: [
				{
					label: 'Stave Profile',
					getValue(context: SettingsContextProps) {
						const api = context.controller.getRuntimeStore().getState().alphaTabApi;
						return (
							api?.settings?.display?.staveProfile ?? alphaTab.StaveProfile.Default
						);
					},
					setValue(context: SettingsContextProps, value: alphaTab.StaveProfile) {
						context.controller.setStaveProfile(value);
						context.onSettingsUpdated();
					},
					control: { type: 'enum-dropdown', enumType: alphaTab.StaveProfile },
				},
			],
		},
		{
			title: 'Player ▸ Playback',
			settings: [
				{
					label: 'Master Volume',
					...factory.apiAccessors('masterVolume'),
					control: { type: 'number-range', min: 0, max: 1, step: 0.1 },
				},
				{
					label: 'Metronome Volume',
					...factory.apiAccessors('metronomeVolume'),
					control: { type: 'number-range', min: 0, max: 1, step: 0.1 },
				},
				{
					label: 'Count-In Volume',
					...factory.apiAccessors('countInVolume'),
					control: { type: 'number-range', min: 0, max: 1, step: 0.1 },
				},
				{
					label: 'Playback Speed',
					...factory.apiAccessors('playbackSpeed'),
					control: { type: 'number-range', min: 0.25, max: 2, step: 0.25 },
				},
				{
					label: 'Looping',
					...factory.apiAccessors('isLooping'),
					control: { type: 'boolean-toggle' },
				},
			],
		},
		{
			title: 'Player ▸ Cursor & Scroll',
			settings: [
				factory.toggle('Show Cursor', 'player.enableCursor', noRerender),
				factory.toggle(
					'Animated Beat Cursor',
					'player.enableAnimatedBeatCursor',
					noRerender
				),
				factory.enumDropDown(
					'Scroll Mode',
					'player.scrollMode',
					alphaTab.ScrollMode,
					noRerender
				),
				factory.numberInput(
					'Scroll Speed (ms)',
					'player.scrollSpeed',
					0,
					undefined,
					100,
					noRerender
				),
				factory.numberInput(
					'Scroll Offset X',
					'player.scrollOffsetX',
					undefined,
					undefined,
					10,
					noRerender
				),
				factory.numberInput(
					'Scroll Offset Y',
					'player.scrollOffsetY',
					undefined,
					undefined,
					10,
					noRerender
				),
			],
		},
		{
			title: 'Player ▸ Advanced',
			settings: [
				factory.enumDropDown(
					'Player Mode',
					'player.playerMode',
					alphaTab.PlayerMode,
					noRerender
				),
				factory.toggle(
					'Enable User Interaction',
					'player.enableUserInteraction',
					noRerender
				),
			],
		},
		{
			title: 'Core ▸ Engine',
			settings: [
				factory.toggle('Use Workers', 'core.useWorkers', noRerender),
				factory.toggle('Include Note Bounds', 'core.includeNoteBounds', noRerender),
				factory.enumDropDown('Log Level', 'core.logLevel', alphaTab.LogLevel, noRerender),
			],
		},
	];
}

// ========== Control Components ==========

const EnumDropDown: React.FC<EnumDropDownSchema & ControlProps> = ({
	enumType,
	inputId,
	getValue,
	setValue,
}) => {
	const context = useSettingsContext();
	const enumValues: { value: number; label: string }[] = [];

	for (const value of Object.values(enumType)) {
		if (typeof value === 'string') {
			const key = toNumberValue(enumType[value]);
			enumValues.push({ value: key, label: value });
		}
	}

	const currentValue = toNumberValue(getValue(context));

	return (
		<select
			id={inputId}
			className="settings-select"
			value={currentValue}
			onChange={(e) => setValue(context, Number.parseInt(e.target.value))}
		>
			{enumValues.map((v) => (
				<option key={v.value} value={v.value}>
					{v.label}
				</option>
			))}
		</select>
	);
};

const NumberRange: React.FC<NumberRangeSchema & ControlProps> = ({
	min,
	max,
	step,
	inputId,
	getValue,
	setValue,
}) => {
	const context = useSettingsContext();
	const value = toNumberValue(getValue(context));
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	return (
		<div className="settings-range-wrapper">
			<input
				type="range"
				id={inputId}
				className="settings-range"
				min={min}
				max={max}
				step={step}
				value={localValue}
				onChange={(e) => {
					const newValue = e.target.valueAsNumber;
					setLocalValue(newValue);
					setValue(context, newValue);
				}}
			/>
			<span className="settings-range-value">{localValue.toFixed(2)}</span>
		</div>
	);
};

const NumberInput: React.FC<NumberInputSchema & ControlProps> = ({
	min,
	max,
	step,
	inputId,
	getValue,
	setValue,
}) => {
	const context = useSettingsContext();
	const value = toNumberValue(getValue(context));

	return (
		<input
			type="number"
			id={inputId}
			className="settings-number"
			min={min}
			max={max}
			step={step}
			value={value}
			onChange={(e) => setValue(context, e.target.valueAsNumber)}
		/>
	);
};

const BooleanToggle: React.FC<BooleanToggleSchema & ControlProps> = ({
	inputId,
	getValue,
	setValue,
}) => {
	const context = useSettingsContext();
	const value = toBooleanValue(getValue(context));

	return (
		<label className="settings-toggle">
			<input
				id={inputId}
				type="checkbox"
				checked={value}
				onChange={(e) => setValue(context, e.target.checked)}
			/>
			<span className="settings-toggle-slider" />
		</label>
	);
};

const ButtonGroupButton: React.FC<ButtonGroupButtonSchema & ControlProps> = ({
	label,
	value,
	getValue,
	setValue,
}) => {
	const context = useSettingsContext();
	const currentValue = getValue(context);
	const isActive = currentValue === value;

	return (
		<button
			type="button"
			className={`settings-button ${isActive ? 'settings-button-active' : ''}`}
			onClick={() => setValue(context, value)}
		>
			{label}
		</button>
	);
};

const ButtonGroup: React.FC<ButtonGroupSchema & ControlProps> = ({
	inputId,
	buttons,
	getValue,
	setValue,
}) => {
	return (
		<div className="settings-button-group">
			{buttons.map((b) => (
				<ButtonGroupButton
					key={b.label}
					inputId={inputId}
					{...b}
					getValue={getValue}
					setValue={setValue}
				/>
			))}
		</div>
	);
};

// ========== Setting Item ==========

const Setting: React.FC<SettingSchema> = ({ label, control, getValue, setValue }) => {
	const id = useId();

	const renderControl = () => {
		switch (control.type) {
			case 'button-group':
				return (
					<ButtonGroup
						inputId={id}
						{...control}
						getValue={getValue}
						setValue={setValue}
					/>
				);
			case 'enum-dropdown':
				return (
					<EnumDropDown
						inputId={id}
						{...control}
						getValue={getValue}
						setValue={setValue}
					/>
				);
			case 'number-range':
				return (
					<NumberRange
						inputId={id}
						{...control}
						getValue={getValue}
						setValue={setValue}
					/>
				);
			case 'number-input':
				return (
					<NumberInput
						inputId={id}
						{...control}
						getValue={getValue}
						setValue={setValue}
					/>
				);
			case 'boolean-toggle':
				return (
					<BooleanToggle
						inputId={id}
						{...control}
						getValue={getValue}
						setValue={setValue}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="settings-item">
			<label className="settings-item-label" htmlFor={id}>
				{label}
			</label>
			<div className="settings-item-control">{renderControl()}</div>
		</div>
	);
};

// ========== Settings Group ==========

const SettingsGroup: React.FC<SettingsGroupSchema> = ({ title, settings }) => {
	const [isCollapsed, setIsCollapsed] = useState(false);

	return (
		<div className="settings-group">
			<h4 className="settings-group-title" onClick={() => setIsCollapsed(!isCollapsed)}>
				<span className={`settings-group-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
				{title}
			</h4>
			{!isCollapsed && (
				<div className="settings-group-content">
					{settings.map((s) => (
						<Setting key={s.label} {...s} />
					))}
				</div>
			)}
		</div>
	);
};

// ========== Main Component ==========

export interface SettingsPanelProps {
	controller: PlayerController;
	isOpen: boolean;
	onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ controller, isOpen, onClose }) => {
	const [settingsVersion, setSettingsVersion] = useState(0);
	const settingsGroups = buildSettingsGroups();

	const runtimeStore = controller.getRuntimeStore();
	const api = runtimeStore((s) => s.alphaTabApi);

	if (!api) {
		return null;
	}

	return (
		<SettingsContext.Provider
			value={{
				controller,
				onSettingsUpdated() {
					setSettingsVersion((v) => v + 1);
				},
			}}
		>
			<div
				className={`settings-panel ${isOpen ? 'settings-panel-open' : ''}`}
				data-version={settingsVersion}
			>
				{/* Header */}
				<div className="settings-panel-header">
					<h3>Settings & Debug</h3>
					<button
						type="button"
						className="settings-panel-close"
						onClick={onClose}
						aria-label="Close settings"
					>
						✕
					</button>
				</div>

				{/* Content */}
				<div className="settings-panel-content">
					{settingsGroups.map((g) => (
						<SettingsGroup key={g.title} {...g} />
					))}
				</div>

				{/* Footer - Tools */}
				<div className="settings-panel-footer">
					<div className="settings-tools">
						<button
							type="button"
							className="settings-tool-button"
							onClick={() => {
								if (api) {
									console.debug('[Settings] Current API Settings:', api.settings);
									console.debug(
										'[Settings] Current Global Config:',
										controller.getGlobalConfigStore().getState()
									);
									console.debug(
										'[Settings] Current Workspace Config:',
										controller.getWorkspaceConfigStore().getState()
									);
								}
							}}
						>
							Log Current Settings
						</button>
						<button
							type="button"
							className="settings-tool-button"
							onClick={() => {
								void (async () => {
									const globalConfig = controller
										.getGlobalConfigStore()
										.getState();
									// 临时转换为旧格式以兼容工具函数
									const legacyConfig = {
										scoreSource: controller.getWorkspaceConfigStore().getState()
											.scoreSource,
										alphaTabSettings: globalConfig.alphaTabSettings,
										playerExtensions: globalConfig.playerExtensions,
										uiConfig: globalConfig.uiConfig,
									};
									const success = await copyConfigToClipboard(legacyConfig);
									if (success) {
										new Notice('Configuration copied to clipboard!');
									} else {
										new Notice('Failed to copy configuration');
									}
								})();
							}}
						>
							Copy Config to Clipboard
						</button>
						<button
							type="button"
							className="settings-tool-button"
							onClick={() => {
								const globalConfig = controller.getGlobalConfigStore().getState();
								// 临时转换为旧格式以兼容工具函数
								const legacyConfig = {
									scoreSource: controller.getWorkspaceConfigStore().getState()
										.scoreSource,
									alphaTabSettings: globalConfig.alphaTabSettings,
									playerExtensions: globalConfig.playerExtensions,
									uiConfig: globalConfig.uiConfig,
								};
								exportConfigToJSON(legacyConfig);
							}}
						>
							Export Config as JSON
						</button>
						<button
							type="button"
							className="settings-tool-button"
							onClick={() => {
								void (async () => {
									const rawConfig = await importConfigFromJSON();
									if (rawConfig) {
										const config = rawConfig as ImportedConfig;
										// 导入配置需要更新 globalConfig
										const store = controller.getGlobalConfigStore().getState();
										if (config.alphaTabSettings) {
											// 转换类型：处理 barsPerRow null -> -1
											const settings = { ...config.alphaTabSettings };
											if (settings.display?.barsPerRow === null) {
												settings.display.barsPerRow = -1;
											}
											store.updateAlphaTabSettings(settings);
										}
										if (config.playerExtensions) {
											store.updatePlayerExtensions(config.playerExtensions);
										}
										if (config.uiConfig) {
											store.updateUIConfig(config.uiConfig);
										}
										new Notice('Configuration imported! Reloading...');
										window.location.reload();
									}
								})();
							}}
						>
							Import Config from JSON
						</button>
						<button
							type="button"
							className="settings-tool-button settings-tool-button-danger"
							onClick={() => {
								new Notice(
									'Reset all settings to defaults? This will reload the page.',
									5000
								);
								controller.getGlobalConfigStore().getState().resetToDefaults();
								window.location.reload();
							}}
						>
							Reset to Defaults
						</button>
						<h4></h4>
						<h4>_</h4>
						{/* 我也没办法，就这样先顶上吧 */}
					</div>
				</div>
			</div>
		</SettingsContext.Provider>
	);
};

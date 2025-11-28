# 🐛 音轨配置持久化问题分析报告

## 问题描述

**现象**：每次打开之前配置过的曲谱时，音轨的 mute/solo/volume 设置都恢复为默认值，而不是保持用户上次的配置。

**预期行为**：音轨配置应该与曲谱绑定，每次打开同一个曲谱时应该恢复用户上次的设置。

---

## 🔍 根本原因

### 1. 当前架构问题

**位置**：`src/player/types/config-schema.ts`

```typescript
// ========== 5. Session State (运行时状态，不持久化) ==========
export interface SessionState {
	// ...

	// ❌ 问题：音轨状态在 SessionState 中，不会被持久化
	trackOverrides: Record<
		string,
		{
			soloOverride?: boolean;
			muteOverride?: boolean;
			volumeOverride?: number;
		}
	>;
}
```

**问题**：

- `trackOverrides` 在 `SessionState` 中
- `SessionState` **不持久化**（仅运行时存在）
- 每次打开文件都会重置为空对象 `{}`

### 2. 组件实现问题

**位置**：`src/player/components/TrackItem.tsx`

```typescript
// ❌ 音轨状态只保存在组件本地 state
const [isMute, setMute] = useState(track.playbackInfo.isMute);
const [isSolo, setSolo] = useState(track.playbackInfo.isSolo);
const [volume, setVolume] = useState(track.playbackInfo.volume);

// ❌ 修改后直接调用 API，没有持久化到配置
const handleMuteToggle = () => {
	const newMute = !isMute;
	setMute(newMute);
	track.playbackInfo.isMute = newMute;
	api.changeTrackMute([track], newMute); // 只影响当前会话
};
```

**问题**：

- 音轨状态只在组件内部维护
- 修改后没有同步到任何 store
- 页面刷新或重新打开文件后丢失

---

## ✅ 修复方案

### 方案选择

**推荐方案**：将音轨配置保存到 **WorkspaceSessionConfig**（与曲谱绑定）

**理由**：

1. ✅ 音轨配置是**文件特定**的（不同曲谱的音轨配置不同）
2. ✅ 应该持久化（用户期望配置被保存）
3. ✅ 应该随标签页保存/恢复（符合 Obsidian 行为）

---

## 🔧 实施步骤

### 步骤 1：扩展 WorkspaceSessionConfig Schema

**文件**：`src/player/types/workspace-config-schema.ts`

```typescript
// ========== Track Configuration ==========
export interface TrackConfig {
	trackIndex: number;
	isMute?: boolean;
	isSolo?: boolean;
	volume?: number; // 0-16 (AlphaTab 音量范围)
	transposeAudio?: number; // 音频移调 (半音)
	transposeFull?: number; // 完全移调 (半音)
}

// ========== Session-specific Player State ==========
export interface SessionPlayerState {
	// AB 循环（文件特定）
	loopRange: {
		startBar: number;
		endBar: number;
	} | null;

	// 是否循环播放（会话临时）
	isLooping: boolean;

	// 当前小节位置（可选，用于恢复播放位置）
	startBar?: number;

	// ✅ 新增：音轨配置（文件特定）
	trackConfigs: TrackConfig[];
}
```

**默认值**：

```typescript
export function getDefaultWorkspaceSessionConfig(): WorkspaceSessionConfig {
	return {
		scoreSource: {
			type: 'url',
			content: null,
		},
		sessionPlayerState: {
			loopRange: null,
			isLooping: false,
			trackConfigs: [], // ✅ 默认空数组
		},
	};
}
```

---

### 步骤 2：添加 WorkspaceConfigStore Actions

**文件**：`src/player/store/workspaceConfigStore.ts`

```typescript
interface WorkspaceConfigState extends WorkspaceSessionConfig {
	// Actions
	setScoreSource: (source: WorkspaceSessionConfig['scoreSource']) => void;
	updatePlayerState: (state: Partial<WorkspaceSessionConfig['sessionPlayerState']>) => void;
	setLoopRange: (range: { startBar: number; endBar: number } | null) => void;
	toggleLooping: () => void;

	// ✅ 新增：音轨配置管理
	updateTrackConfig: (trackIndex: number, config: Partial<TrackConfig>) => void;
	getTrackConfig: (trackIndex: number) => TrackConfig | undefined;
	resetTrackConfigs: () => void;

	resetToDefaults: () => void;
	_adapter?: ObsidianWorkspaceStorageAdapter;
}
```

**实现**：

```typescript
// ✅ 更新音轨配置
updateTrackConfig: (trackIndex, config) =>
  set((prev) => {
    const existingConfigs = prev.sessionPlayerState.trackConfigs || [];
    const existingIndex = existingConfigs.findIndex(
      (tc) => tc.trackIndex === trackIndex
    );

    let newConfigs: TrackConfig[];
    if (existingIndex >= 0) {
      // 更新现有配置
      newConfigs = [...existingConfigs];
      newConfigs[existingIndex] = {
        ...newConfigs[existingIndex],
        ...config,
      };
    } else {
      // 添加新配置
      newConfigs = [
        ...existingConfigs,
        { trackIndex, ...config },
      ];
    }

    return {
      sessionPlayerState: {
        ...prev.sessionPlayerState,
        trackConfigs: newConfigs,
      },
    };
  }),

// ✅ 获取音轨配置
getTrackConfig: (trackIndex) => {
  const state = get();
  return state.sessionPlayerState.trackConfigs?.find(
    (tc) => tc.trackIndex === trackIndex
  );
},

// ✅ 重置所有音轨配置
resetTrackConfigs: () =>
  set((prev) => ({
    sessionPlayerState: {
      ...prev.sessionPlayerState,
      trackConfigs: [],
    },
  })),
```

---

### 步骤 3：修改 TrackItem 组件集成配置

**文件**：`src/player/components/TrackItem.tsx`

```typescript
export const TrackItem: React.FC<TrackItemProps> = ({
	api,
	track,
	isSelected,
	onSelectionChange,
	controller, // ✅ 新增：需要传入 controller
}) => {
	// ✅ 获取 workspace config store
	const workspaceConfig = controller.getWorkspaceConfigStore();

	// ✅ 从配置中读取初始值
	const savedConfig = workspaceConfig.getState().getTrackConfig(track.index);

	// 状态管理（使用配置作为初始值）
	const [isMute, setMute] = useState(savedConfig?.isMute ?? track.playbackInfo.isMute);
	const [isSolo, setSolo] = useState(savedConfig?.isSolo ?? track.playbackInfo.isSolo);
	const [volume, setVolume] = useState(savedConfig?.volume ?? track.playbackInfo.volume);
	const [transposeAudio, setTransposeAudio] = useState(savedConfig?.transposeAudio ?? 0);
	const [transposeFull, setTransposeFull] = useState(savedConfig?.transposeFull ?? 0);

	// ✅ 修改事件处理，同步到配置
	const handleMuteToggle = () => {
		const newMute = !isMute;
		setMute(newMute);
		track.playbackInfo.isMute = newMute;
		api.changeTrackMute([track], newMute);

		// ✅ 持久化到配置
		workspaceConfig.getState().updateTrackConfig(track.index, {
			trackIndex: track.index,
			isMute: newMute,
		});
	};

	const handleSoloToggle = () => {
		const newSolo = !isSolo;
		setSolo(newSolo);
		track.playbackInfo.isSolo = newSolo;
		api.changeTrackSolo([track], newSolo);

		// ✅ 持久化到配置
		workspaceConfig.getState().updateTrackConfig(track.index, {
			trackIndex: track.index,
			isSolo: newSolo,
		});
	};

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newVolume = e.target.valueAsNumber;
		setVolume(newVolume);
		api.changeTrackVolume([track], newVolume / track.playbackInfo.volume);

		// ✅ 持久化到配置
		workspaceConfig.getState().updateTrackConfig(track.index, {
			trackIndex: track.index,
			volume: newVolume,
		});
	};

	// ... 其他处理函数类似
};
```

---

### 步骤 4：在 PlayerController 中恢复音轨配置

**文件**：`src/player/PlayerController.ts`

在 `scoreLoaded` 事件处理中添加配置恢复逻辑：

```typescript
// 在 bindApiEvents() 中
this.api.scoreLoaded.on((score) => {
  this.stores.runtime.getState().setScoreLoaded(true);
  this.stores.runtime.getState().setDuration(score.masterBars.length * 1000);

  // ✅ 恢复音轨配置
  this.restoreTrackConfigs(score);
});

// ✅ 新增方法：恢复音轨配置
private restoreTrackConfigs(score: alphaTab.model.Score): void {
  const workspaceConfig = this.stores.workspaceConfig.getState();
  const savedConfigs = workspaceConfig.sessionPlayerState.trackConfigs || [];

  if (savedConfigs.length === 0) {
    console.log('[PlayerController] No saved track configs to restore');
    return;
  }

  console.log('[PlayerController] Restoring track configs:', savedConfigs);

  for (const config of savedConfigs) {
    const track = score.tracks.find(t => t.index === config.trackIndex);
    if (!track) continue;

    // 恢复 mute/solo/volume
    if (config.isMute !== undefined) {
      track.playbackInfo.isMute = config.isMute;
      this.api?.changeTrackMute([track], config.isMute);
    }

    if (config.isSolo !== undefined) {
      track.playbackInfo.isSolo = config.isSolo;
      this.api?.changeTrackSolo([track], config.isSolo);
    }

    if (config.volume !== undefined) {
      const volumeRatio = config.volume / track.playbackInfo.volume;
      this.api?.changeTrackVolume([track], volumeRatio);
    }

    // 恢复移调
    if (config.transposeAudio !== undefined) {
      this.api?.changeTrackTranspositionPitch([track], config.transposeAudio);
    }

    if (config.transposeFull !== undefined) {
      const pitches = this.api?.settings.notation.transpositionPitches || [];
      while (pitches.length < track.index + 1) {
        pitches.push(0);
      }
      pitches[track.index] = config.transposeFull;
    }
  }

  // 应用移调设置
  if (this.api) {
    this.api.updateSettings();
  }
}
```

---

### 步骤 5：更新 TracksPanel 传递 controller

**文件**：`src/player/components/TracksPanel.tsx`

```typescript
export const TracksPanel: React.FC<TracksPanelProps> = ({
  controller,
  isOpen,
  onClose
}) => {
  // ...

  return (
    <div className={`tracks-panel ${isOpen ? 'tracks-panel-open' : ''}`}>
      {/* ... */}
      <div className="tracks-panel-content">
        {score.tracks.map((track) => (
          <TrackItem
            key={track.index}
            api={api}
            track={track}
            isSelected={selectedTracks.has(track.index)}
            onSelectionChange={handleTrackSelectionChange}
            controller={controller} // ✅ 传递 controller
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 🧪 测试验证

### 测试步骤

1. **保存配置测试**

    ```typescript
    // 1. 打开一个曲谱
    // 2. 修改音轨设置（mute 某个音轨）
    // 3. 关闭标签页
    // 4. 重新打开同一曲谱
    // ✅ 预期：音轨仍然是 mute 状态
    ```

2. **多曲谱隔离测试**

    ```typescript
    // 1. 打开曲谱 A，设置 track 0 为 mute
    // 2. 打开曲谱 B，不修改任何设置
    // 3. 切回曲谱 A
    // ✅ 预期：A 的 track 0 仍是 mute
    // ✅ 预期：B 的音轨使用默认设置
    ```

3. **持久化验证**
    ```typescript
    // 检查 workspace.json 中是否保存了配置
    // 路径：.obsidian/workspace.json
    // 查找：state.trackConfigs
    ```

---

## 📊 影响范围

### 修改文件

- ✅ `src/player/types/workspace-config-schema.ts` - 添加 `TrackConfig` 接口
- ✅ `src/player/store/workspaceConfigStore.ts` - 添加音轨配置管理 actions
- ✅ `src/player/components/TrackItem.tsx` - 集成配置读取和保存
- ✅ `src/player/components/TracksPanel.tsx` - 传递 controller
- ✅ `src/player/PlayerController.ts` - 添加配置恢复逻辑

### 兼容性

- ✅ 向后兼容：旧版本没有 `trackConfigs` 字段时使用默认值（空数组）
- ✅ 迁移逻辑：不需要特殊迁移，自动使用默认值

---

## 🎯 优先级

**P0 - 高优先级**

**理由**：

1. 影响核心用户体验（配置丢失）
2. 用户明确期望配置被保存
3. 当前行为与用户预期不符（bug）

---

## 📝 总结

### 当前问题

- ❌ 音轨配置保存在 `SessionState`（不持久化）
- ❌ 组件只使用本地 state
- ❌ 没有配置恢复逻辑

### 修复后

- ✅ 音轨配置保存在 `WorkspaceSessionConfig`（持久化到 workspace.json）
- ✅ 组件从配置读取初始值
- ✅ 修改后立即同步到配置
- ✅ 打开曲谱时自动恢复配置

### 预期效果

用户修改音轨配置后：

- ✅ 关闭标签页再打开 → 配置保持
- ✅ 重启 Obsidian → 配置保持
- ✅ 不同曲谱配置独立
- ✅ 符合用户直觉

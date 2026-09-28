# GoWherer Code Wiki

> 本文档为 GoWherer 项目的结构化代码知识库，覆盖项目整体架构、主要模块职责、关键类与函数说明、依赖关系以及项目运行方式。
> 生成日期：2026-07-30

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [整体架构](#4-整体架构)
5. [路由与导航](#5-路由与导航)
6. [数据模型（types）](#6-数据模型types)
7. [数据持久化层（lib）](#7-数据持久化层lib)
8. [后台定位追踪](#8-后台定位追踪)
9. [轨迹处理（track-utils）](#9-轨迹处理track-utils)
10. [媒体与备份](#10-媒体与备份)
11. [地理编码与坐标转换](#11-地理编码与坐标转换)
12. [国际化（i18n）](#12-国际化i18n)
13. [主题系统](#13-主题系统)
14. [模板系统](#14-模板系统)
15. [日志与隐私](#15-日志与隐私)
16. [关键组件（components）](#16-关键组件components)
17. [自定义 Hooks](#17-自定义-hooks)
18. [Config Plugin（plugins）](#18-config-pluginplugins)
19. [依赖关系](#19-依赖关系)
20. [构建与运行](#20-构建与运行)
21. [附录：存储键汇总](#21-附录存储键汇总)

---

## 1. 项目概览

**GoWherer** 是一款基于 Expo React Native 的旅程记录与回顾应用，专注于"快速记录、清晰回顾、可分享输出"。用户可创建旅程（travel 出行 / commute 通勤），在时间线上添加文字、位置、照片、视频、音频条目，并通过后台 GPS 持续录制轨迹，最终生成统计卡片与 PDF 导出。

**核心能力：**

- 旅程开始/结束流程，时间线条目（文字、定位、图片、视频、音频）
- 相机拍照与相册导入，音频录制与播放
- 后台 GPS 轨迹录制（基于高德 SDK），含轨迹平滑与抽稀
- 反向地理编码（高德 Web API / 系统回退），WGS84 ↔ GCJ-02 坐标转换
- 旅程历史与统计（距离、时长、平均速度、定位点数）
- 路线可视化（原生高德地图 + Web 文本回退）
- 高德 POI 选点页面
- PDF 导出（含路线 SVG 预览图与统计）
- 旅程模板（出发/到达/休息/打卡，按出行/通勤模式）
- 中英双语，系统/手动语言与主题切换
- 数据备份与恢复，媒体文件迁移
- 本地日志系统，触感反馈

---

## 2. 技术栈

| 维度 | 选型 |
|------|------|
| 框架 | Expo SDK 55、React Native 0.83.6、React 19.2.0 |
| 语言 | TypeScript 5.9（strict 模式） |
| 路由 | expo-router（基于文件的路由） |
| 状态 | React Context + 自定义 Hooks（无 Redux） |
| 持久化 | @react-native-async-storage/async-storage |
| 地图 | expo-gaode-map（高德 SDK 封装）、react-native-maps |
| 后台任务 | expo-gaode-map 原生模块（非 expo-task-manager 直接调用） |
| 媒体 | expo-audio、expo-video、expo-image、expo-image-picker |
| 国际化 | expo-localization + 自实现轻量 i18n |
| 导出 | expo-print、expo-sharing |
| 构建 | EAS Build、GitHub Actions |
| 代码规范 | ESLint（eslint-config-expo） |
| 实验特性 | typedRoutes、React Compiler |

完整依赖见 [package.json](file:///d:/Dev/mobile/expo/gowherer/package.json)。

---

## 3. 目录结构

```
gowherer/
├── app/                      # Expo Router 路由（页面）
│   ├── (tabs)/               # 标签页分组
│   │   ├── _layout.tsx       # 标签栏布局
│   │   ├── index.tsx         # 旅程页（创建/记录）
│   │   ├── explore.tsx       # 历史与回顾页
│   │   └── settings.tsx      # 设置页
│   ├── _layout.tsx           # 根布局（Provider 注入）
│   ├── modal.tsx             # 模态页（模板遗留）
│   ├── location-picker.tsx   # 高德地图选点页
│   ├── permissions.tsx       # 权限状态页
│   └── licenses.tsx          # 开源许可页
├── components/               # UI 组件
│   ├── ui/                   # 基础 UI（icon-symbol、collapsible）
│   ├── track-map.tsx         # 原生高德轨迹地图
│   ├── track-map.web.tsx     # Web 地图回退
│   ├── amap-place-picker.tsx # 高德选点组件（遗留）
│   ├── active-journey-card.tsx
│   ├── journey-create-card.tsx
│   ├── timeline-list.tsx
│   ├── audio-player.tsx
│   ├── media-viewers.tsx
│   ├── media-preview-modal.tsx
│   ├── template-modal.tsx
│   └── ...                   # haptic-tab、theme-toggle 等
├── hooks/                    # 自定义 Hooks
│   ├── use-journeys.ts
│   ├── use-location-tracking.ts
│   ├── locale-preference.tsx
│   ├── theme-preference.tsx
│   ├── use-color-scheme.ts(.web)
│   ├── use-material-theme.ts
│   └── use-theme-color.ts
├── lib/                      # 业务/工具模块
│   ├── journey-storage.ts    # 持久化 + 数据规范化
│   ├── journey-repository.ts # 旅程变更操作（串行队列）
│   ├── storage-keys.ts       # 存储键注册表
│   ├── pending-location.ts   # 跨页面定位传递
│   ├── background-location.ts# 后台 GPS 追踪
│   ├── current-location.ts   # 当前定位工具
│   ├── track-utils.ts        # 轨迹平滑/抽稀/距离
│   ├── reverse-geocode.ts    # 反向地理编码 + 坐标转换
│   ├── media-storage.ts      # 媒体持久化目录
│   ├── media-migration.ts    # 媒体缓存迁移
│   ├── data-backup.ts        # 全量备份/恢复
│   ├── i18n.ts               # i18n 核心
│   ├── local-log.ts          # 本地日志
│   ├── amap-privacy.ts       # 高德隐私合规
│   ├── template-storage-i18n.ts
│   └── template-storage.ts   # 遗留模板存储
├── types/                    # 类型定义
│   ├── journey.ts
│   └── template.ts
├── constants/
│   └── theme.ts              # 主题色与字体
├── locales/                  # 翻译字典
│   ├── en.ts
│   └── zh.ts
├── plugins/                  # Expo Config Plugin
│   ├── with-android-abi-splits.js
│   └── with-android-pointer-tagging.js
├── scripts/                  # 构建辅助脚本
│   ├── generate-icons.js
│   ├── generate-licenses.js
│   └── reset-project.js
├── assets/                   # 图片、图标、licenses.json
├── docs/                     # 项目文档
├── .github/workflows/        # CI（eas-build、android-build）
├── app.config.ts             # Expo 应用配置
├── eas.json                  # EAS 构建配置
├── tsconfig.json
└── package.json
```

---

## 4. 整体架构

### 4.1 分层架构

GoWherer 采用清晰的分层结构，遵循"页面只做编排，UI 拆到 components，业务逻辑拆到 hooks/lib"的约定（见 [CLAUDE.md](file:///d:/Dev/mobile/expo/gowherer/CLAUDE.md)）。

```
┌──────────────────────────────────────────────────────────┐
│  app/  路由层（Expo Router 文件路由）                       │
│  ─ 负责页面编排、路由跳转、聚焦副作用                        │
├──────────────────────────────────────────────────────────┤
│  hooks/  状态与业务封装层                                   │
│  ─ useJourneys / useLocationTracking / locale / theme     │
│  ─ Provider 注入 Context（语言、主题）                       │
├──────────────────────────────────────────────────────────┤
│  components/  表现层                                       │
│  ─ 纯展示/交互组件，通过 props 接收数据与回调                 │
│  ─ 自行通过 useColorScheme() / useI18n() 处理主题与文案      │
├──────────────────────────────────────────────────────────┤
│  lib/  基础能力层（无 React 依赖）                          │
│  ─ 持久化 / 后台定位 / 轨迹处理 / 地理编码 / 媒体 / i18n     │
├──────────────────────────────────────────────────────────┤
│  types/  数据模型                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Provider 嵌套

根布局 [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) 按以下顺序包裹 Provider：

```
LocalePreferenceProvider
└── ThemePreferenceProvider
    └── ThemeProvider (React Navigation Dark/DefaultTheme)
        └── Stack (expo-router)
```

文件顶部以副作用导入 `@/lib/amap-privacy`（模块加载即触发高德隐私合规）与 `@/lib/background-location`（注册副作用）。

### 4.3 关键数据流

**旅程录制主流程：**

```
用户创建旅程 (JourneyScreen)
  → useJourneys().addJourney
  → journey-repository.createJourney → AsyncStorage 写入

开启轨迹追踪
  → useLocationTracking.handleTrackingChange(true)
  → background-location.startLocationTracking(journeyId)
  → ExpoGaodeMapModule.start() + addLocationListener
  → 每次 fix → appendTrackLocation → 写入独立 batch key
  → 每 15s setInterval → syncBufferedTrackLocations → 追加到 journey.trackLocations

添加时间线条目
  → 拍照/录像/录音 → media-storage.persistTimelineMedia
  → useJourneys().addEntry → journey-repository.insertJourneyEntry

结束旅程
  → stopLocationTracking + syncBufferedTrackLocations 最终刷新
  → useJourneys().completeJourney → markJourneyCompleted
```

**写入串行化：** 所有旅程变更经 `journey-repository.enqueueJourneyMutation` 排入 Promise 链，避免 15 秒轨迹刷新与用户条目保存产生读-改-写竞态。

---

## 5. 路由与导航

入口为 `expo-router/entry`（见 [package.json](file:///d:/Dev/mobile/expo/gowherer/package.json) `main` 字段），采用基于文件的路由。

### 5.1 根布局 [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx)

- `unstable_settings = { anchor: "(tabs)" }`：以 `(tabs)` 为初始路由
- `RootNavigator` 依据 `useColorScheme()` 切换 React Navigation 的 `DarkTheme`/`DefaultTheme`
- Stack 声明两个 Screen：`(tabs)`（无 header）与 `modal`（模态展示）

### 5.2 标签布局 [app/(tabs)/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/_layout.tsx)

三个标签页，均 `headerShown: false`，自定义 `HapticTab` 提供触感反馈，图标采用"药丸"高亮样式：

| Tab | 文案 key | 图标 | 职责 |
|-----|----------|------|------|
| `index` | `tabs.journey` | `map.fill` | 创建/记录当前旅程 |
| `explore` | `tabs.explore` | `paperplane.fill` | 历史、回顾、PDF 导出 |
| `settings` | `tabs.settings` | `gearshape.fill` | 主题、语言、备份、关于 |

### 5.3 其他路由

- [app/modal.tsx](file:///d:/Dev/mobile/expo/gowherer/app/modal.tsx)：模板遗留模态页，未被业务使用
- [app/location-picker.tsx](file:///d:/Dev/mobile/expo/gowherer/app/location-picker.tsx)：全屏高德选点页。接收 `initial` 搜索参数（JSON `{latitude, longitude, placeName}`），点击地图/POI 选点，反向地理编码后通过 `setPendingLocation` 写入并 `router.back()`；用 `mapVisible` + 120ms 延迟卸载原生地图视图以规避回退崩溃
- [app/permissions.tsx](file:///d:/Dev/mobile/expo/gowherer/app/permissions.tsx)：展示定位/后台定位/相册/相机权限实时状态，提供跳转系统设置按钮
- [app/licenses.tsx](file:///d:/Dev/mobile/expo/gowherer/app/licenses.tsx)：分页（每页 40）展示应用自身 MIT 许可与依赖许可（数据来自构建时生成的 `assets/licenses.json`）

---

## 6. 数据模型（types）

### [types/journey.ts](file:///d:/Dev/mobile/expo/gowherer/types/journey.ts)

核心数据类型，贯穿整个应用：

```ts
type JourneyStatus = 'active' | 'completed';
type MediaType = 'photo' | 'video' | 'audio';
type JourneyKind = 'travel' | 'commute';

type TimelineLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  placeName?: string;
  capturedAt?: string;
  source?: 'manual' | 'tracking';
  coordSystem?: 'wgs84' | 'gcj02'; // 坐标系标记
};

type TimelineMedia = {
  id: string;
  type: MediaType;
  uri: string;
  thumbnailUri?: string;
};

type TimelineEntry = {
  id: string;
  createdAt: string;
  text: string;
  location?: TimelineLocation;
  media: TimelineMedia[];
  tags: string[];
};

type Journey = {
  id: string;
  title: string;
  kind: JourneyKind;
  createdAt: string;
  endedAt?: string;
  status: JourneyStatus;
  tags: string[];
  entries: TimelineEntry[];
  trackLocations: TimelineLocation[]; // 持续录制的 GPS 轨迹点
};
```

**坐标系标记 `coordSystem`：** 高德 SDK 产出 GCJ-02；手动选点保存为 WGS-84。遗留无标记数据由 `journey-storage.resolveCoordSystem` 按 `2026-07-05` 截止日期推断。

### [types/template.ts](file:///d:/Dev/mobile/expo/gowherer/types/template.ts)

```ts
type EntryTemplate = { id: string; label: string; text: string; tags: string[] };
type EntryTemplateConfig = Record<JourneyKind, EntryTemplate[]>;
```

---

## 7. 数据持久化层（lib）

### 7.1 [lib/storage-keys.ts](file:///d:/Dev/mobile/expo/gowherer/lib/storage-keys.ts) — 存储键注册表

集中管理 AsyncStorage 键名，避免散落：

- `JOURNEY_STORAGE_KEY = 'gowherer:journeys:v1'`
- `LOCALE_PREFERENCE_KEY = 'gowherer:locale-preference:v1'`
- `THEME_PREFERENCE_KEY = 'gowherer:theme-preference:v1'`
- `getEntryTemplateStorageKey(locale)` → `'gowherer:entry-templates:v1:{locale}'`（按语言隔离模板）

### 7.2 [lib/journey-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/journey-storage.ts) — 持久化与规范化

负责 AsyncStorage 读写与数据健壮性处理。

| 函数 | 职责 |
|------|------|
| `resolveCoordSystem(rawCoordSystem, journeyCreatedAt)` | 解析坐标系；无标记时按 `2026-07-05` 截止日期推断 gcj02/wgs84 |
| `normalizeTags(tags)` | 标签去重、trim、过滤空值 |
| `normalizeMediaItem(media)` | 校验 `id`/`uri`，强制 `type` 为合法枚举 |
| `normalizeJourneyList(raw)` | 顶层规范化：`kind`、标签、条目位置/媒体、轨迹点，补全 `coordSystem` |
| `loadJourneys()` | 读取 `JOURNEY_STORAGE_KEY`，解析并规范化，失败返回 `[]` |
| `saveJourneys(journeys)` | JSON 序列化写入 |

**关键常量：** `GCJ02_MIGRATION_CUTOFF_MS = Date.parse("2026-07-05T00:00:00+08:00")` — 高德 SDK 迁移时间分界。

### 7.3 [lib/journey-repository.ts](file:///d:/Dev/mobile/expo/gowherer/lib/journey-repository.ts) — 变更操作

通过 Promise 链串行化所有写操作，杜绝并发读-改-写竞态。

| 函数 | 职责 |
|------|------|
| `createId(prefix)` | 生成 `${prefix}-${timestamp}-${random6}` |
| `enqueueJourneyMutation(mutator)` | 私有；将"加载→变更→保存"任务串入 `writeQueue` |
| `createJourney(title, kind, tags)` | 新建 `active` 旅程并置顶 |
| `markJourneyCompleted(journeyId)` | 标记完成，写入 `endedAt` |
| `insertJourneyEntry(journeyId, entry)` | 追加时间线条目 |
| `replaceJourneyEntry(journeyId, entry)` | 按 `entry.id` 替换 |
| `deleteJourneyEntry(journeyId, entryId)` | 按 id 删除条目 |
| `appendJourneyTrackLocations(journeyId, locations)` | 追加轨迹点；空数组短路返回 |
| `overwriteJourneys(journeys)` | 全量替换（用于导入/迁移） |
| `deleteJourney(journeyId)` | 按 id 删除旅程 |

### 7.4 [lib/pending-location.ts](file:///d:/Dev/mobile/expo/gowherer/lib/pending-location.ts) — 跨页面定位传递

用于选点页 → 旅程页的位置回传（避免通过路由参数传递大对象）：

- `setPendingLocation(location)`：写入私有 key `'gowherer:pending-location:v1'`
- `consumePendingLocation()`：读取、删除、规范化后返回 `TimelineLocation | null`

---

## 8. 后台定位追踪

### 8.1 [lib/background-location.ts](file:///d:/Dev/mobile/expo/gowherer/lib/background-location.ts) — 原生桥接

通过 `expo-gaode-map` 的原生模块 `ExpoGaodeMapModule` 驱动后台定位（**不直接使用 `expo-task-manager`**）。

**关键常量：**

- `MAX_COLLECTION_ACCURACY_METERS = 100`：丢弃精度劣于 100m 的点
- `TRACKING_JOURNEY_ID_KEY = 'gowherer:tracking:journey-id:v1'`：当前追踪的旅程 id
- `TRACKING_BATCH_PREFIX = 'gowherer:tracking:batch:v1'`：每次定位一个独立 batch key，避免并发写冲突

**关键函数：**

| 函数 | 职责 |
|------|------|
| `appendTrackLocation(location)` | 私有；将高德 `Coordinates` 转 `TimelineLocation`，精度超限丢弃，否则写入独立 batch key `[location]` |
| `isBackgroundLocationTrackingAvailable()` | Web 返回 false，其余 true |
| `isLocationTrackingActive()` | 返回 `ExpoGaodeMapModule.isStarted()` |
| `startLocationTracking(journeyId, options)` | 持久化 journeyId；`setAllowsBackgroundLocationUpdates(true)` + `start()`；挂载 `addLocationListener` 回调到 `appendTrackLocation` |
| `stopLocationTracking()` | 停止原生模块、移除监听、清空 journeyId key |
| `syncBufferedTrackLocations(journeyId)` | 刷新：枚举该旅程所有 batch key，`multiGet` 解析后 `appendJourneyTrackLocations`，再 `multiRemove`；返回刷新点数 |

### 8.2 [hooks/use-location-tracking.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-location-tracking.ts) — `useLocationTracking(activeJourney, onRefreshJourneys)`

将原生追踪能力接入 React 状态。

- **状态：** `locationTracking`（开关）、`trackingBusy`
- **journeyId 变化时：** 刷新缓冲点、读取原生活动状态、必要时触发 UI 刷新（支持重启后恢复）
- **追踪激活期间：** 每 15 秒 `setInterval` 调用 `syncBufferedTrackLocations` 并按需刷新
- **`handleTrackingChange(nextValue)`：**
  - 关闭：`stopLocationTracking` + 最终刷新 + 刷新 UI
  - 开启：检查可用性 → 请求前台/后台定位权限（拒绝时弹本地化提示）→ `startLocationTracking`（传入 i18n 通知文案）
  - 异常经 `logLocalError('JourneyScreen', ...)` 记录

---

## 9. 轨迹处理（track-utils）

### [lib/track-utils.ts](file:///d:/Dev/mobile/expo/gowherer/lib/track-utils.ts)

提供轨迹点的校验、平滑、抽稀与统计，是渲染与导出的基础。

**常量：** `MAX_TRACKING_ACCURACY_METERS=100`、`MAX_TRACKING_SPEED_KMH=180`、`MIN_TRACKING_DISTANCE_METERS=3`、`MAX_NEIGHBOR_DISTANCE_METERS=500`

| 函数 | 职责 |
|------|------|
| `normalizeTrackLocation(location)` | 校验经纬度范围与有限性，规范化 `capturedAt`/`source`/`coordSystem`/`accuracy`/`placeName`；非法返回 `null` |
| `sanitizeTrackLocations(locations)` | 批量规范化并过滤 null |
| `haversineKm(a, b)` | 球面大圆距离（公里） |
| `smoothTrackLocations(locations)` | 卡尔曼式平滑：用纬度余弦修正米→度方差，`DEFAULT_ACCURACY=15m`、`PROCESS_NOISE=3m`，逐点更新 `kalmanGain = estVar/(estVar+measVar)`；保留元数据 |
| `prepareTrackRouteLocations(locations)` | 按 `capturedAt` 排序后过滤：精度>100m（仅 tracking）、距离<3m、瞬移>500m、速度>180km/h |
| `calculateTrackDistanceKm(locations)` | 连续点 `haversineKm` 累加 |
| `simplifyTrackLocations(locations, maxPoints=200)` | Douglas-Peucker 抽稀；epsilon 由平均段距离推导（最小 0.0005km），递归后倍增 epsilon 直至点数达标 |

内部辅助：`sortLocationsByCapturedAt`、`mergeLocationMeta`、`perpendicularDistanceKm`、`douglasPeucker`。

---

## 10. 媒体与备份

### 10.1 [lib/media-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/media-storage.ts) — 媒体持久化目录

将媒体从临时缓存迁移到应用管理的目录 `documentDirectory/gowherer-media/`。

| 函数 | 职责 |
|------|------|
| `getMediaDirectoryUri()` | 返回媒体目录 URI |
| `getFileExtension(uri, type)` | 推断扩展名，缺省 video→mp4、audio→m4a、photo→jpg |
| `buildManagedMediaUri(id, type, sourceUri)` | 构造受管理 URI |
| `ensureMediaDirectory()` | 确保目录存在 |
| `isManagedMediaUri(uri)` | 判断是否已受管理 |
| `persistMediaItem(media)` | 已受管理直接返回；否则 `copyAsync` 到受管理 URI，缩略图以 `${id}-thumb` 后缀一并复制 |
| `persistTimelineMedia(mediaItems)` | 批量 `Promise.all` |

### 10.2 [lib/media-migration.ts](file:///d:/Dev/mobile/expo/gowherer/lib/media-migration.ts) — 一次性缓存迁移

将旧版 `cacheDirectory/ImagePicker/` 媒体迁移到新目录。

| 函数 | 职责 |
|------|------|
| `getMediaMigrationStats()` | 返回 `{ hasOldMedia, oldFileCount }` |
| `migrateMediaFiles(journeys)` | 扫描条目媒体中含 `/cache/ImagePicker/` 的 URI，`moveAsync` 到 `${NEW_MEDIA_DIR}${type}-media-${id}.${ext}`，返回 `{ success, migratedCount, failedCount, updatedJourneys, errors }` |
| `cleanupOldMediaCache()` | 删除旧缓存目录残留文件 |

扩展名映射：photo→jpeg、video→mp4、audio→m4a。

### 10.3 [lib/data-backup.ts](file:///d:/Dev/mobile/expo/gowherer/lib/data-backup.ts) — 全量备份/恢复

**备份结构 `AppBackupV1`：**

```ts
{
  version: 1,
  exportedAt: string,
  app: { slug, version },
  preferences: { locale, theme },
  journeys: Journey[],
  entryTemplates: { zh: EntryTemplateConfig, en: EntryTemplateConfig }
}
```

| 函数 | 职责 |
|------|------|
| `buildAppBackup(appVersion)` | 汇总旅程、语言/主题偏好、中英文模板（缺失回退默认并规范化） |
| `writeBackupToFile(backup)` | 写入 `cacheDirectory`/`documentDirectory`，文件名 `gowherer-backup-{timestamp}.json` |
| `serializeBackup` / `parseBackupString` | JSON 往返；版本校验（`version !== 1` 抛错） + 偏好合法性校验 |
| `importBackup(backup)` | `Promise.all` 写入旅程、中英文模板、语言与主题偏好；返回导入的偏好供 UI 更新 |

---

## 11. 地理编码与坐标转换

### [lib/reverse-geocode.ts](file:///d:/Dev/mobile/expo/gowherer/lib/reverse-geocode.ts)

**类型：** `ReverseGeocodeProvider = 'system'|'amap'`、`CoordinateType = 'wgs84'|'gcj02'`、`NearbyPlace`

**配置读取：** `getGeocodingConfig()` 从 `Constants.expoConfig.extra.geocoding` 读取 `provider` 与 `amapWebKey`（由 `app.config.ts` 注入），默认 `amap`。

**坐标转换（中国偏移）：**

- 常量 `EARTH_A = 6378245.0`、`EARTH_EE = 0.00669342162296594323`
- `isOutOfChina(lat, lng)`：边界框判定
- `transformLat(x, y)` / `transformLng(x, y)`：标准高德多项式 + 正弦变换
- `wgs84ToGcj02(lat, lng)`：境外返回原值，否则变换
- `gcj02ToWgs84(lat, lng)`：近似逆变换 `2*gcj02 - wgs84ToGcj02(input)`
- 公开导出：`toGcj02(lat, lng)`、`toWgs84(lat, lng)`

**反向地理编码：**

| 函数 | 职责 |
|------|------|
| `reverseGeocodeWithSystem(lat, lng)` | 调 `expo-gaode-map` 的 `reGeocode`，返回 `formattedAddress` |
| `reverseGeocodeWithAmap(lat, lng, key, coordinateType)` | 必要时 WGS84→GCJ02，请求 `restapi.amap.com/v3/geocode/regeo`，校验 `status==='1'`，经 `formatAmapPlaceName` 组合地址 |
| `reverseGeocodePlaceName(lat, lng, options?)` | 顶层入口；amap + key 时优先高德，空结果/异常回退系统；dev 模式日志 |

**周边搜索：**

- `queryNearbyPlaces(lat, lng, radius=1200, options?)`：需 amap + key（否则抛错）；坐标转 GCJ02 后请求 `place/around`，半径 clamp 到 [200, 5000]，返回 `NearbyPlace[]`

---

## 12. 国际化（i18n）

### 12.1 [lib/i18n.ts](file:///d:/Dev/mobile/expo/gowherer/lib/i18n.ts)

自实现的轻量 i18n，无第三方依赖。

| 函数 | 职责 |
|------|------|
| `getLocaleFromString(raw)` | `zh` 开头返回 `zh`，否则 `en` |
| `getSystemLocale()` | 经 `expo-localization.getLocales()` 多级回退（`languageCode`→`languageTag`→`locale`→`Intl`） |
| `resolveTranslation(dict, key)` | 点路径查找（如 `tabs.journey`） |
| `interpolate(template, params)` | 替换 `{key}` 占位符 |
| `createTranslator(locale)` | 返回 `t(key, params?)`，按当前语言→英文→原始 key 回退 |
| `getTemplateDefaults(locale)` | 抽取语言字典的 `templates` 段，作为默认模板 |

翻译字典：[locales/en.ts](file:///d:/Dev/mobile/expo/gowherer/locales/en.ts) 与 [locales/zh.ts](file:///d:/Dev/mobile/expo/gowherer/locales/zh.ts)，顶层 key 含 `tabs`、`settings`、`journey`、`review`、`common`、`duration`、`trackMap`、`amapPicker`、`mapPicker`、`templates`。

### 12.2 [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx)

- `LocalePreferenceProvider`：持有 `preference`（默认 `'system'`）与 `systemLocale`，挂载时读取存储偏好，订阅系统语言变化（防御性可选），解析 `resolvedLocale`，memo 化 `t = createTranslator(resolvedLocale)`，偏好变更同步存储
- `useLocalePreference()`：Provider 外抛错
- `useI18n()`：返回 `{ locale, preference, setPreference, t }`

---

## 13. 主题系统

### 13.1 [constants/theme.ts](file:///d:/Dev/mobile/expo/gowherer/constants/theme.ts)

- `ThemeColors`：17 个 token（`bg`、`surface`、`fg` 紫色强调 `#6442d6`/`#c8b3fd`、`muted`、`border`、`accent`、`accentSecondary` 绿 `#16a34a`、`fgOn`、`textPrimary/Secondary/Tertiary`、`success/warn/danger/teal`、`tabBg`）
- 导出 `Colors = { light, dark }`、`ColorScheme`、`getThemeColors(scheme)`
- `Fonts`：按平台 `Platform.select` 字体栈

### 13.2 [hooks/theme-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/theme-preference.tsx)

- `ThemePreferenceProvider`：存储 `preference: 'light'|'dark'|'system'` 到 `THEME_PREFERENCE_KEY`，用 RN 的 `useColorScheme` 取系统值，计算 `resolvedTheme`，提供 `setPreference(next)` 与 `toggleTheme()`（基于当前 resolved 翻转）
- `useOptionalThemePreference()`：返回 context 或 `null`
- `useThemePreference()`：Provider 外抛错

### 13.3 [hooks/use-color-scheme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-color-scheme.ts)

`useColorScheme()`：在 Provider 内返回 `themePreference.resolvedTheme`，否则回退 RN 原生 hook（或 `'light'`）。**全应用统一的 scheme 读取入口。** 存在 `.web.tsx` 变体。

### 13.4 [hooks/use-material-theme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-material-theme.ts)

`useMaterialTheme()`：调 `useColorScheme()`，派生 `colors = getThemeColors(scheme)`，memo 化构建 `StyleSheet`（含 `page`、`card`、`textPrimary/Secondary/Tertiary`、`sectionHeader`、`input`、`btnPrimary/Secondary`、`chip`、`divider`、`row` 等预设），返回 `{ colors, isDark, scheme, styles }`。

**串联：** 根布局挂 `ThemePreferenceProvider` → 其值经 `useColorScheme()` 流向 `RootNavigator`、标签布局、各页面/组件；同时 `useMaterialTheme()` 提供统一样式表。

---

## 14. 模板系统

### 14.1 [lib/template-storage-i18n.ts](file:///d:/Dev/mobile/expo/gowherer/lib/template-storage-i18n.ts)（当前生效实现）

按语言隔离存储模板，键名经 `getEntryTemplateStorageKey(locale)` 生成。

| 函数 | 职责 |
|------|------|
| `normalizeTemplateItem(item)` | 校验 `id`/`label`/`text`，标签去重 trim |
| `normalizeTemplateList(raw, kind, fallback)` | 非数组或归一化后为空则返回 `fallback[kind]` |
| `normalizeTemplateConfig(raw, fallback)` | 对 travel/commute 应用上述 |
| `getDefaultEntryTemplateConfig(locale)` | 委托 `getTemplateDefaults(locale)`（读语言字典 `templates` 段） |
| `loadEntryTemplateConfig(locale)` | 读取并按语言默认值规范化；缺失返回默认 |
| `saveEntryTemplateConfig(locale, config)` | 序列化写入 |

**默认模板（每种语言各 4 个/类型）：**

- travel：`travel-departure`（出发）、`travel-arrival`（到达）、`travel-rest`（休息）、`travel-checkin`（打卡）
- commute：`commute-departure`、`commute-arrival`、`commute-rest`、`commute-checkin`

### 14.2 [lib/template-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/template-storage.ts)（遗留）

非 i18n 版本，使用单一 key `'gowherer:entry-templates:v1'` 与硬编码中文默认值。运行时未被使用，仅保留参考。

---

## 15. 日志与隐私

### 15.1 [lib/local-log.ts](file:///d:/Dev/mobile/expo/gowherer/lib/local-log.ts)

本地文件日志，写入 `documentDirectory/gowherer-debug.log`。

| 函数 | 职责 |
|------|------|
| `stringifyData(data)` | `JSON.stringify`，失败回退 `String` |
| `appendLine(line)` | `writeAsStringAsync` 追加写，失败回退覆写 |
| `logLocalInfo(tag, message, data?)` | 格式 `[ISO] [INFO] [tag] message \| data`，`console.log` + 追加 |
| `logLocalError(tag, error, data?)` | 提取 `message`/`stack`，格式 `[ISO] [ERROR] [tag] {...} \| data`，`console.error` + 追加 |
| `getLocalLogFileUri()` | 返回日志文件 URI（供错误提示引导用户） |
| `initLocalLogFile()` | 写入初始化行；由 `useJourneys()` 挂载时调用 |

### 15.2 [lib/amap-privacy.ts](file:///d:/Dev/mobile/expo/gowherer/lib/amap-privacy.ts)

满足高德 SDK 隐私合规要求。

- `PRIVACY_VERSION = '2026-03-13'`
- `ensureAmapPrivacyReady()`：Web 空操作；否则检查 `ExpoGaodeMapModule.getPrivacyStatus()`，未就绪则 `setPrivacyConfig({ hasShow, hasContainsPrivacy, hasAgree, privacyVersion })`；错误静默捕获
- **模块加载即自动调用**（根布局副作用导入）

---

## 16. 关键组件（components）

| 组件 | 文件 | 职责 |
|------|------|------|
| `TrackMap` | [components/track-map.tsx](file:///d:/Dev/mobile/expo/gowherer/components/track-map.tsx) | 原生高德轨迹地图。对 `routeLocations`/`markerLocations` 经 `sanitizeTrackLocations` 后用 `toAmapCoordinate`（gcj02 直返，否则 `toGcj02`）转换，`getAmapZoom` 算缩放，绘制青色 `Polyline`（`#0f766e`，宽 4）与起/中/止 `Marker`；无点返回 `null` |
| `TrackMap` (web) | [components/track-map.web.tsx](file:///d:/Dev/mobile/expo/gowherer/components/track-map.web.tsx) | Web 回退：文本摘要框（起止坐标 + 标记数） |
| `AMapPlacePicker` | [components/amap-place-picker.tsx](file:///d:/Dev/mobile/expo/gowherer/components/amap-place-picker.tsx) | 模态式高德选点（遗留，已被 `app/location-picker.tsx` 页面取代） |
| `ActiveJourneyCard` | [components/active-journey-card.tsx](file:///d:/Dev/mobile/expo/gowherer/components/active-journey-card.tsx) | 活动旅程大卡片：hero（标题/类型/日期/条目数/结束按钮/追踪开关+点数）+ 条目编辑器（模板 chip、文本/标签、草稿位置、草稿媒体横滑、定位/相册/拍照/录像/录音按钮、保存/取消） |
| `JourneyCreateCard` | [components/journey-create-card.tsx](file:///d:/Dev/mobile/expo/gowherer/components/journey-create-card.tsx) | 新建旅程表单：travel/commute 选择、标题、标签、快捷标签 chip、"开始旅程"主按钮（标题为空禁用） |
| `TimelineList` | [components/timeline-list.tsx](file:///d:/Dev/mobile/expo/gowherer/components/timeline-list.tsx) | 时间线列表：彩色圆点（`TONE_COLORS` 循环紫/绿/黄/青），条目卡片含文本/标签/位置行/编辑删除/媒体横滑 |
| `AudioPlayer` | [components/audio-player.tsx](file:///d:/Dev/mobile/expo/gowherer/components/audio-player.tsx) | 基于 `expo-audio` 的播放/暂停按钮，结尾自动回 0 |
| `MediaVideoCover` / `PreviewVideo` | [components/media-viewers.tsx](file:///d:/Dev/mobile/expo/gowherer/components/media-viewers.tsx) | 基于 `expo-video`：封面（静音无控件 cover）/ 预览（自动播放含控件 contain） |
| `MediaPreviewModal` | [components/media-preview-modal.tsx](file:///d:/Dev/mobile/expo/gowherer/components/media-preview-modal.tsx) | 全屏暗色 Modal 媒体预览 |
| `TemplateModal` | [components/template-modal.tsx](file:///d:/Dev/mobile/expo/gowherer/components/template-modal.tsx) | 模板管理：列表（编辑/删除）+ 编辑区 + 保存/清空 + 恢复默认（带确认）；强制每类至少 1 个 |
| `HapticTab` | [components/haptic-tab.tsx](file:///d:/Dev/mobile/expo/gowherer/components/haptic-tab.tsx) | 自定义 Tab 按钮，触发触感反馈 |
| `IconSymbol` | [components/ui/icon-symbol.tsx](file:///d:/Dev/mobile/expo/gowherer/components/ui/icon-symbol.tsx) | 跨平台符号图标（iOS 用 SF Symbols） |
| `ThemeToggle` | [components/theme-toggle.tsx](file:///d:/Dev/mobile/expo/gowherer/components/theme-toggle.tsx) | 主题切换控件 |

---

## 17. 自定义 Hooks

### [hooks/use-journeys.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-journeys.ts) — `useJourneys()`

活动旅程页的状态唯一来源。挂载时 `initLocalLogFile()` + `loadJourneys()`。

**暴露：**

| 成员 | 说明 |
|------|------|
| `journeys: Journey[]` | 全量列表 |
| `setJourneys` | 原始 setter（少用） |
| `loading: boolean` | 加载态 |
| `updateJourneys(next)` | 全量替换（`overwriteJourneys`） |
| `addJourney(title, kind, tags)` | 新建（`createJourney`） |
| `completeJourney(id)` | 标记完成（`markJourneyCompleted`） |
| `addEntry(journeyId, entry)` | 追加条目 |
| `updateEntry(journeyId, entry)` | 替换条目 |
| `removeEntry(journeyId, entryId)` | 删除条目 |
| `refreshJourneys()` | 重新读取（后台轨迹刷新后调用） |
| `activeJourney` | memo：`journeys.find(j => j.status === 'active')`，至多 1 个 |
| `completedJourneysCount` | 已完成计数 |

### [hooks/use-location-tracking.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-location-tracking.ts)

见 [第 8 节](#8-后台定位追踪)。

### 其他 Hooks

- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx)：见 [第 12 节](#12-国际化i18n)
- [hooks/theme-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/theme-preference.tsx)、[hooks/use-color-scheme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-color-scheme.ts)、[hooks/use-material-theme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-material-theme.ts)：见 [第 13 节](#13-主题系统)
- [hooks/use-theme-color.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-theme-color.ts)：按 scheme 取色辅助 hook

---

## 18. Config Plugin（plugins）

### [plugins/with-android-abi-splits.js](file:///d:/Dev/mobile/expo/gowherer/plugins/with-android-abi-splits.js)

通过 `withAppBuildGradle` 改写 `android/app/build.gradle`：

- 注入 `import com.android.Build.OutputFile`
- 添加 `enableSeparateBuildPerCPUArchitecture` 标志与 `reactNativeArchitectures()`（默认 `armeabi-v7a, arm64-v8a, x86, x86_64`）
- 在 `packagingOptions` 前插入 `splits { abi { ... universalApk true ... } }`
- 在 `android {}` 末尾插入 `applicationVariants.all` 按 ABI 改写 versionCode（`armeabi-v7a:1, arm64-v8a:2, x86:3, x86_64:4`）
- 所有注入以 `// @gowherer-abi-splits` 标记保证幂等

**效果：** 按 ABI 产出独立 APK（各自 versionCode）+ 通用 APK，减小包体。

### [plugins/with-android-pointer-tagging.js](file:///d:/Dev/mobile/expo/gowherer/plugins/with-android-pointer-tagging.js)

`withAndroidManifest` 插件，在 `<application>` 设置 `android:allowNativeHeapPointerTagging='false'`，禁用 ARMv9 MTE 指针标记，规避部分原生库（地图/SDK）误读 tagged pointer 的兼容问题。

两者均在 [app.config.ts](file:///d:/Dev/mobile/expo/gowherer/app.config.ts) 的 `plugins` 中引用。

---

## 19. 依赖关系

### 19.1 内部模块依赖图（核心路径）

```
app/(tabs)/index.tsx (JourneyScreen)
├── hooks/use-journeys ── lib/journey-repository ── lib/journey-storage ── lib/storage-keys
├── hooks/use-location-tracking ── lib/background-location
│        ├── lib/current-location
│        ├── lib/journey-repository (appendJourneyTrackLocations)
│        └── lib/local-log
├── components/active-journey-card / journey-create-card / timeline-list / template-modal / media-preview-modal
├── lib/template-storage-i18n ── lib/i18n ── locales/{en,zh}
├── lib/media-storage
├── lib/pending-location
└── hooks/locale-preference (useI18n)

app/(tabs)/explore.tsx (JourneyHistoryScreen)
├── lib/journey-storage (loadJourneys)
├── lib/journey-repository (deleteJourney)
├── lib/track-utils (统计/距离)
├── components/track-map
├── lib/reverse-geocode (toGcj02 渲染转换)
├── expo-print / expo-sharing (PDF 导出)
└── hooks/locale-preference

app/(tabs)/settings.tsx
├── lib/data-backup ── lib/journey-storage + lib/template-storage-i18n + lib/storage-keys
├── lib/media-migration
├── hooks/theme-preference / locale-preference
└── expo-document-picker / expo-sharing

app/location-picker.tsx
├── lib/current-location (getBestCurrentTimelineLocation)
├── lib/reverse-geocode (queryNearbyPlaces, reverseGeocodePlaceName)
└── lib/pending-location (setPendingLocation)
```

### 19.2 外部依赖（运行时关键）

| 依赖 | 用途 |
|------|------|
| `expo-gaode-map` | 高德地图 SDK（地图、定位、后台定位、POI、反向地理） |
| `react-native-maps` | 地图组件（部分场景） |
| `@react-native-async-storage/async-storage` | 本地键值持久化 |
| `expo-router` / `@react-navigation/*` | 文件路由与底部标签导航 |
| `expo-audio` / `expo-video` / `expo-image` | 音视频与图片 |
| `expo-image-picker` | 相册/相机 |
| `expo-location` | 定位（部分工具） |
| `expo-localization` | 系统语言检测 |
| `expo-print` / `expo-sharing` | PDF 导出与分享 |
| `expo-document-picker` | 备份文件导入 |
| `expo-file-system` | 文件操作（媒体迁移、日志、备份） |
| `expo-haptics` | 触感反馈 |
| `expo-status-bar` / `expo-splash-screen` / `expo-system-ui` | 系统级 UI |
| `expo-constants` | 读取 `app.config.ts` 的 `extra`（地理编码配置） |
| `react-native-reanimated` / `react-native-gesture-handler` / `react-native-worklets` | 动画与手势 |
| `react-native-safe-area-context` / `react-native-screens` | 安全区与屏幕管理 |
| `react-native-web` | Web 平台支持 |

### 19.3 Dev 依赖

- `typescript ~5.9.2`、`@types/react`
- `eslint ^9.25` + `eslint-config-expo`
- `license-checker`（生成 `assets/licenses.json`）

---

## 20. 构建与运行

### 20.1 环境要求

- Node.js 20+
- npm
- Expo 环境（Android/iOS/Web）
- **高德 SDK 原生功能需 Custom Dev Client 或 EAS Build，Expo Go 不可用**

### 20.2 安装与运行

```bash
npm install          # 安装依赖
npm run start        # 启动 Expo dev server
# 或指定平台
npm run android
npm run ios
npm run web
```

`prestart`/`preandroid`/`preios`/`preweb` 钩子会自动执行 `npm run licenses:generate` 生成 `assets/licenses.json`。

### 20.3 npm scripts（见 [package.json](file:///d:/Dev/mobile/expo/gowherer/package.json)）

| 脚本 | 说明 |
|------|------|
| `start` | `expo start` |
| `android` / `ios` / `web` | `expo run:<platform>` |
| `android:debug` / `android:release` / `android:bundle` | Gradle 本地构建 |
| `lint` | `expo lint` |
| `licenses:generate` | 生成依赖许可 JSON |
| `reset-project` | 重置 starter 布局 |

### 20.4 环境变量（[app.config.ts](file:///d:/Dev/mobile/expo/gowherer/app.config.ts)）

| 变量 | 用途 | 必填 |
|------|------|------|
| `EAS_PROJECT_ID` | EAS 项目绑定（`extra.eas.projectId`），缺省回退默认 id | 否 |
| `APP_VERSION` | 构建时设置 `expo.version`，默认 `1.0.0` | 否 |
| `EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER` | 反向地理提供方 `amap`/`system`，默认 `amap` | 否 |
| `EXPO_PUBLIC_AMAP_WEB_KEY` | 高德反向地理 Web API key（provider=amap 时必填） | 条件必填 |
| `AMAP_ANDROID_API_KEY` | 高德 Android 原生 SDK key（选点器），缺省回退 `app.config.ts` 默认 | Android 必填 |

> 安全提示：`EXPO_PUBLIC_*` 会打包到客户端，应视为非敏感 publishable key，并在提供方侧做包名/SHA1/域名限制。

### 20.5 EAS Build 与 CI

- 配置文件：[eas.json](file:///d:/Dev/mobile/expo/gowherer/eas.json)、CI 工作流 [.github/workflows/eas-build.yml](file:///d:/Dev/mobile/expo/gowherer/.github/workflows/eas-build.yml)
- GitHub Actions 手动触发（`platform`: android/ios/all，`profile`: preview/production）
- 版本号：`expo.version` 由 workflow input `app_version` 设置，CI 写入 `.env` 的 `APP_VERSION` 后触发 `eas build`
- 构建号：`android.versionCode`/`ios.buildNumber` 经 EAS 远程版本自增（preview/production 均生效）
- 产物：存 EAS、上传为 workflow artifact、发布到 GitHub Releases；tag 格式 `eas-build-<profile>-<run_number>`；可选 `release_notes`
- Android CI 已知问题：未配置 keystore 时非交互构建会报 `Generating a new Keystore is not supported in --non-interactive mode`，需先本地交互式 `npx eas-cli@latest login` + `credentials -p android`

### 20.6 高德坐标系说明

provider 为 `amap` 时，应用将 `expo-location` 的 WGS84 坐标转换为 GCJ-02 后再调用高德反向地理。**该转换仅对中国大陆坐标生效，境外使用原值。**

---

## 21. 附录：存储键汇总

| 键 | 定义位置 | 用途 |
|----|----------|------|
| `gowherer:journeys:v1` | `storage-keys.ts` | 旅程全量数据 |
| `gowherer:locale-preference:v1` | `storage-keys.ts` | 语言偏好 |
| `gowherer:theme-preference:v1` | `storage-keys.ts` | 主题偏好 |
| `gowherer:entry-templates:v1:{locale}` | `storage-keys.ts` | 按语言隔离的模板 |
| `gowherer:entry-templates:v1` | `template-storage.ts`（遗留，未用） | 旧版无语言隔离模板 |
| `gowherer:pending-location:v1` | `pending-location.ts` | 选点页跨页面位置传递 |
| `gowherer:tracking:journey-id:v1` | `background-location.ts` | 当前追踪的旅程 id |
| `gowherer:tracking:batch:v1:{journeyId}:{timestamp}:{random}` | `background-location.ts` | 每次定位一个独立 batch key |

**文件资源：**

- 媒体目录：`documentDirectory/gowherer-media/`
- 日志文件：`documentDirectory/gowherer-debug.log`
- 备份文件：`cacheDirectory`/`documentDirectory` 下 `gowherer-backup-{timestamp}.json`
- 许可文件：`assets/licenses.json`（构建时生成）

---

## 横切关注点速记

- **坐标系纪律：** 每个 `TimelineLocation` 携带可选 `coordSystem`。高德 SDK 产出 GCJ-02；手动选点存 WGS-84。`track-map.tsx` 与 `reverse-geocode.ts` 仅在需要时做 WGS84→GCJ02 转换；遗留无标记数据由 `resolveCoordSystem` 按 `2026-07-05` 截止日期回填。
- **写入串行化：** 所有旅程变更经 `enqueueJourneyMutation` 的 Promise 链，防止 15 秒轨迹刷新与用户条目保存产生读-改-写竞态。
- **副作用导入：** 根布局以 `@/lib/amap-privacy`、`@/lib/background-location` 作副作用导入，确保高德隐私合规与原生模块注册在应用启动即完成。
- **页面编排约定：** `app/` 下页面只做编排，UI 拆 `components/`，业务逻辑拆 `hooks/` 与 `lib/`；异步事件处理器内 fire-and-forget 用 `void`；副作用用 `active` 标志避免卸载后更新（见 [CLAUDE.md](file:///d:/Dev/mobile/expo/gowherer/CLAUDE.md)）。

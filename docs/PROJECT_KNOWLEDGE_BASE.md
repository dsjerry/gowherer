# GoWherer Project Knowledge Base

Last updated: 2026-03-18

Related docs:

- `docs/ONBOARDING.md`
- `docs/TROUBLESHOOTING.md`
- `docs/KNOWLEDGE_POINTS.md`
- `docs/PROJECT_STATE.md`

## 1. 项目定位

GoWherer 是一个基于 Expo + React Native 的旅程时间线应用，核心目标是：

- 快速记录（文本/标签/定位/媒体）
- 清晰回顾（地图、统计、筛选）
- 便捷导出（PDF）

主要场景是旅行与通勤两类 Journey。

## 2. 技术栈与运行形态

### 2.1 核心栈

- Expo SDK 55
- React Native 0.83.2
- React 19.2.0
- Expo Router（路由）
- AsyncStorage（本地持久化）
- `expo-image-picker`（相机/相册）
- `expo-audio`（录音/音频播放）
- `expo-location`（定位）
- `expo-video`（视频预览）
- `expo-print` + `expo-sharing`（PDF）
- `react-native-maps`（原生轨迹地图）
- `react-native-amap3d`（Android 高德 SDK 选点）

### 2.2 运行容器规则

- `Expo Go`：不能使用第三方原生模块（例如 `react-native-amap3d`）。
- `Dev Client` / EAS 构建包：可使用高德 SDK 等原生模块。
- 当前 `package.json` 脚本里：
  - `npm run android` -> `expo run:android`
  - `npm run ios` -> `expo run:ios`
  表示本地开发已偏向“带原生工程”调试路径。

## 3. 代码结构地图

### 3.1 页面与路由

- `app/_layout.tsx`：Root Stack，注入主题 Provider。
- `app/(tabs)/_layout.tsx`：底部 Tab（旅程 / 回顾）。
- `app/(tabs)/index.tsx`：进行中旅程的创建与记录。
- `app/(tabs)/explore.tsx`：已完成旅程的回顾与导出。
- `app/modal.tsx`：模板模态页（Expo 初始结构遗留，业务相关性低）。

### 3.2 业务库

- `lib/journey-storage.ts`：Journey 存储与数据归一化。
- `lib/template-storage.ts`：模板存储与默认模板。
- `lib/reverse-geocode.ts`：逆地理编码（AMap/system + fallback + 坐标转换）。
- `lib/track-utils.ts`：轨迹平滑与距离计算。
- `lib/local-log.ts`：本地调试日志落盘。

### 3.3 组件

- `components/track-map.tsx`：原生地图轨迹显示。
- `components/track-map.web.tsx`：Web 简化轨迹兜底。
- `components/amap-place-picker.tsx`：Android 高德 SDK 选点弹窗。
- `components/theme-toggle.tsx`：浅色/深色切换。

### 3.4 类型

- `types/journey.ts`：Journey/Entry/Media/Location 核心模型。
- `types/template.ts`：模板模型。

## 4. 核心数据模型

`types/journey.ts` 定义关键实体：

- `Journey`
  - `status`: `active | completed`
  - `kind`: `travel | commute`
  - `entries`: 时间线条目数组
- `TimelineEntry`
  - `text`, `tags`, `location`, `media`
- `TimelineLocation`
  - `latitude`, `longitude`, `accuracy?`, `placeName?`
- `TimelineMedia`
  - `type`: `photo | video | audio`
  - `uri`, `thumbnailUri?`

模板模型：

- `EntryTemplate`：`id/label/text/tags`
- `EntryTemplateConfig`：按 JourneyKind 分组的模板集合

## 5. 本地持久化策略

### 5.1 存储 Key

- Journey：`gowherer:journeys:v1`
- 模板：`gowherer:entry-templates:v1`
- 主题：`gowherer:theme-preference:v1`

### 5.2 归一化策略

- 标签统一 trim + 去重。
- media 类型现支持 `photo/video/audio`，不合法项过滤。
- 模板读取失败回退默认配置。
- Journey 读取失败回退空数组。

## 6. 功能链路（旅程页）

文件：`app/(tabs)/index.tsx`

### 6.1 旅程生命周期

1. 创建旅程（标题 + 类型 + 标签）
2. 写入 active Journey
3. 持续添加/编辑/删除条目
4. 结束旅程 -> status 变为 completed

### 6.2 条目编辑能力

- 文案输入
- 标签输入（中英文逗号/换行分割去重）
- 媒体：
  - 相册导入（图片/视频）
  - 相机拍照/拍视频
  - 音频录制：
    - 请求麦克风权限
    - 使用 `expo-audio` 高质量预设开始/停止录音
    - 停止后将录音文件作为 `audio` 媒体附加到当前草稿
- 定位：
  - `添加定位` 进入高德地图选点（Android）
  - 支持移除定位

### 6.3 媒体预览与播放

- 图片：缩略图预览 + 大图查看
- 视频：封面/内嵌播放器预览
- 音频：
  - 草稿区显示音频卡片，可删除
  - 已保存条目显示音频播放卡片
  - 点击后在播放/暂停间切换；播放结束后再次点击会从头开始

### 6.4 模板体系

- 按 Journey 类型显示模板快捷按钮。
- 模板可管理：
  - 新增/编辑/删除
  - 恢复当前类型默认模板

## 7. 功能链路（回顾页）

文件：`app/(tabs)/explore.tsx`

### 7.1 筛选与检索

- 按旅程类型筛选（全部/旅行/通勤）
- 按关键词搜索（标题/文案/地点/标签）
- 按标签筛选（旅程级 + 条目级标签汇总）

### 7.2 统计与轨迹

- 总里程、总时长、均速、定位点数
- 轨迹地图：
  - Native：`react-native-maps`
  - Web：文本化兜底
- 轨迹先走平滑算法后再展示/计算

### 7.3 PDF 导出

- HTML 模板 + 内联样式生成
- 包含封面（标题、时间、标签、统计、轨迹 SVG）
- 逐条目明细输出
- Native 端优先分享 PDF，Web 端直接打印

## 8. 逆地理编码设计

文件：`lib/reverse-geocode.ts`

### 8.1 Provider

- `amap`：高德 Web API `/v3/geocode/regeo`
- `system`：`Location.reverseGeocodeAsync`

### 8.2 选择与兜底

- 由 `extra.geocoding.provider` 决定主 provider。
- 若 `amap` 失败或返回空地址，自动 fallback 到 `system`。

### 8.3 坐标体系

- AMap 请求前进行 `WGS84 -> GCJ-02` 转换。
- 仅中国大陆范围转换，海外坐标保持原值。

## 9. Android 高德 SDK 选点模块

文件：`components/amap-place-picker.tsx`

### 9.1 功能

- 地图点击选点
- POI 点击选点
- 逆地理编码回填地点名，可手工修改

### 9.2 稳定性处理

- SDK 初始化异常捕获
- 坐标有效性校验（防 `NaN/Infinity`）
- 确认选点按钮防重复触发
- 确认流程先 `mapSuspended`，延迟后执行回填和关闭

### 9.3 运行约束

- 仅 Android 可用。
- 需 Dev Client/EAS 构建包；Expo Go 不支持。

## 10. 主题系统

文件：

- `hooks/theme-preference.tsx`
- `hooks/use-color-scheme.ts`
- `components/theme-toggle.tsx`

要点：

- 主题偏好支持：`light/dark/system`
- 偏好持久化到 AsyncStorage
- 全局 `ThemePreferenceProvider` + `ThemeProvider` 联动

## 11. 配置与环境变量

文件：`app.config.ts`

### 11.1 构建时关键变量

- `APP_VERSION` -> `expo.version`
- `EAS_PROJECT_ID` -> `extra.eas.projectId`
- `EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER`
- `EXPO_PUBLIC_AMAP_WEB_KEY`
- `AMAP_ANDROID_API_KEY` -> `extra.amap.androidApiKey`

### 11.2 App 标识

- Android: `com.dsjerry.gowherer`
- iOS: `com.dsjerry.gowherer`

## 12. EAS 与 CI/CD

文件：

- `eas.json`
- `.github/workflows/eas-build.yml`

### 12.1 EAS 版本策略

- `appVersionSource: remote`
- `preview/production` 均启用 `autoIncrement`

### 12.2 Workflow 关键流程

1. 参数输入：platform/profile/app_version
2. 校验配置与密钥
3. 将 `app_version` 注入 `.env` 为 `APP_VERSION`
4. `expo config` 校验解析版本
5. 触发 `eas build --non-interactive --wait --json`
6. 下载构建产物到 `dist/`
7. 上传 workflow artifacts
8. 发布 GitHub Release

### 12.3 安装包扩展名保障

- 优先 `applicationArchiveUrl`
- 解析 `Content-Disposition` 文件名扩展名
- 平台兜底（Android: apk/aab；iOS: ipa）

## 13. 本地调试日志

文件：`lib/local-log.ts`

- 日志文件：`${FileSystem.documentDirectory}gowherer-debug.log`
- 格式：时间戳 + 级别 + tag + payload
- 适合追踪 JS 业务异常
- 注意：native crash 时日志可能来不及写入完整信息

## 14. Native Crash 排查基线

1. 清空日志：`adb logcat -c`
2. 抓 crash buffer：`adb logcat -b crash -v threadtime`
3. 复现后提取：
   - `FATAL EXCEPTION`
   - `F DEBUG Cmdline: com.dsjerry.gowherer`
   - `backtrace`

结论优先级：

- 有 `backtrace`：优先按 native 栈定位
- 只有系统噪音：继续收窄过滤并重抓

## 15. Android 构建环境知识点

- `JAVA_HOME` 必须是 JDK 根目录，不是 `.../bin`
- `java.exe` 可执行路径不等于 `JAVA_HOME`
- 可通过 `javac` 路径反推 JDK 根目录

## 16. 脚本与资产体系

### 16.1 图标生成脚本

文件：`scripts/generate-icons.js`

- 纯 Node 生成多风格图标变体（horizon/trail/metro/terra）
- 输出到 `assets/images/variants/*`

### 16.2 项目重置脚本

文件：`scripts/reset-project.js`

- Expo 模板重置用途，业务逻辑无直接依赖

## 17. 维护建议

- 文档维护入口：
  - `docs/PROJECT_STATE.md`（状态快照）
  - `docs/KNOWLEDGE_POINTS.md`（精简知识点）
  - 本文档（全量知识库）
- Git 现状说明：
  - 最近历史中还没有单独的音频功能提交。
  - 音频功能当前位于本地工作区变更中，后续如果提交，建议使用单独的 `feat(audio): ...` 记录，便于追溯。
- 每次引入原生依赖后，优先验证：
  - Dev Client 可用性
  - CI 构建可重复性
  - Release 产物可安装性

# React / React Native / Expo 实战学习路线

> 基于 GoWherer 项目代码的真实学习材料。每个知识点都对应项目中可打开、可读、可改的真实文件。
> 学习方法：**读代码 → 理解概念 → 做练习 → 回到项目验证**。完成全部 4 阶段后，你应能独立构建一个类似复杂度的 Expo RN 应用。
> 生成日期：2026-07-30

---

## 总览：4 阶段路线图

| 阶段 | 主题 | 目标 | 对应项目模块 |
|------|------|------|--------------|
| 一 | React 核心心智模型 | 掌握组件、Hooks、Context、渲染机制 | hooks/、app/、components/ |
| 二 | React Native 跨平台组件 | 掌握 RN 基础组件、导航、平台适配、原生模块 | components/、app/(tabs)/、track-map.* |
| 三 | Expo 工程化 | 掌握配置、路由、插件、构建、CI | app.config.ts、plugins/、.github/ |
| 四 | 综合实战模式 | 掌握状态架构、持久化、后台任务、i18n/主题 | lib/、hooks/ 全量 |

每个知识点格式：
- **概念**：要掌握什么
- **看哪里**：项目中对应的代码位置（可点击）
- **练习**：动手任务，巩固理解

---

# 阶段一：React 核心心智模型

## 1.1 JSX 与函数组件

**概念：** JSX 是 JS 的语法扩展，编译后是 `React.createElement` 调用。函数组件是接收 props 返回 JSX 的纯函数。

**看哪里：**
- [components/hello-wave.tsx](file:///d:/Dev/mobile/expo/gowherer/components/hello-wave.tsx) — 最简单的函数组件
- [components/themed-text.tsx](file:///d:/Dev/mobile/expo/gowherer/components/themed-text.tsx) — props 透传与 children

**练习：** 在 `components/` 下新建 `my-label.tsx`，写一个接收 `text` props 并返回带样式文本的组件，在 `app/(tabs)/index.tsx` 顶部渲染它。

---

## 1.2 Props 与 State

**概念：** props 是父→子的只读数据；state 是组件内部的可变数据，变更会触发重渲染。

**看哪里：**
- [components/journey-create-card.tsx](file:///d:/Dev/mobile/expo/gowherer/components/journey-create-card.tsx) — 大量 props 回调（`onCreate`、`onCancel`）+ 内部 state（标题、标签输入）
- [app/(tabs)/index.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/index.tsx) — `JourneyScreen` 持有 draft 文本/媒体/位置等 state，向下传给 `ActiveJourneyCard`

**练习：** 给 `JourneyCreateCard` 增加一个"清空"按钮，点击后重置标题与标签 state。观察 state 变更如何触发输入框清空。

---

## 1.3 Hooks 全家桶

这是 React 的核心，本项目覆盖了所有常用 Hooks。

### useState

**概念：** 声明局部状态，返回 `[value, setter]`。

**看哪里：**
- [hooks/use-journeys.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-journeys.ts#L16-L17) — `useState<Journey[]>([])` 与 `useState(true)`（loading）

**练习：** 在 `useJourneys` 中新增一个 `lastUpdatedAt` state，每次 `addJourney` 后更新为当前时间。

### useEffect

**概念：** 副作用钩子，处理订阅、数据获取、定时器。依赖数组控制执行时机。

**看哪里（重点学"active 标志"防卸载后更新）：**
```ts
// hooks/use-journeys.ts
useEffect(() => {
  let active = true;
  (async () => {
    await initLocalLogFile();
    const stored = await loadJourneys();
    if (!active) return;          // 组件已卸载则放弃
    setJourneys(stored);
    setLoading(false);
  })();
  return () => { active = false; };
}, []);
```
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx#L22-L46) — 两个 useEffect：一个加载存储偏好，一个订阅系统语言变化并清理订阅

**练习：** 解释为什么 `loadJourneys` 后要检查 `active`。然后故意去掉 `active` 判断，在快速切换 tab 时观察控制台是否报"can't perform state update on unmounted component"警告。

### useMemo

**概念：** 缓存昂贵计算结果，仅依赖变更时重算。

**看哪里：**
- [hooks/use-journeys.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-journeys.ts#L68-L76) — `activeJourney` 与 `completedJourneysCount` 都用 `useMemo` 派生
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx#L55-L65) — `t` 与 `value` 都 memo 化，避免 Provider 每次渲染都创建新对象导致子组件全量重渲染

**练习：** 在 `explore.tsx` 里给"标签 chip 列表"加 `useMemo`，仅当 journeys 变化时重算。

### useRef

**概念：** 跨渲染保留可变值，**不触发重渲染**；也用于引用 DOM/原生实例。

**看哪里：**
- [hooks/use-location-tracking.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-location-tracking.ts) — `onRefreshJourneysRef` 用 ref 持有最新回调，避免 effect 依赖抖动
- [app/location-picker.tsx](file:///d:/Dev/mobile/expo/gowherer/app/location-picker.tsx) — `selectionRequestIdRef` 用 ref 标记请求 id，作废过期回调

**练习：** 解释为什么 `onRefreshJourneys` 要放 ref 而不是放 effect 依赖数组。把 ref 改成普通依赖会怎样？

### useCallback

**概念：** 缓存函数引用，传给子组件时避免子组件因新函数引用重渲染。

**看哪里：**
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx#L50-L53) — `setPreference` 用 `useCallback` 包裹

**练习：** 在 `useJourneys` 里把 `addJourney` 等异步函数改用 `useCallback` 包裹，思考是否有必要（提示：这些函数只在 `JourneyScreen` 里用，传给子组件时才有意义）。

### useContext

**概念：** 跨层级传值，避免 prop drilling。

**看哪里：**
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx#L74-L80) — `useLocalePreference` 调 `useContext`，Provider 外抛错
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) — Provider 嵌套：`LocalePreferenceProvider` → `ThemePreferenceProvider` → `ThemeProvider`

**练习：** 仿照 `LocalePreferenceProvider`，新建一个 `NetworkProvider`，用 Context 暴露 `isOnline` 状态（基于 `NetInfo`），在任意组件 `useNetwork()` 读取。

---

## 1.4 自定义 Hook

**概念：** 把状态逻辑抽成可复用函数，约定名以 `use` 开头。

**看哪里（本项目最值得学的两个 Hook）：**
- [hooks/use-journeys.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-journeys.ts) — 把"加载 + 增删改 + 派生"封装成一个 Hook，页面只调一个 `useJourneys()` 就拿到全部状态与动作。这是无 Redux 状态管理的经典写法。
- [hooks/use-location-tracking.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-location-tracking.ts) — 把原生模块 + 定时器 + 权限请求封装成 `useLocationTracking(activeJourney, onRefresh)`

**练习：** 把 `explore.tsx` 里的"搜索 + 过滤 + 统计"逻辑抽成一个 `useJourneyHistory()` 自定义 Hook，让页面组件变薄。

---

## 1.5 列表与 key

**概念：** 渲染数组要用 `key` 帮助 React diff；RN 中 `FlatList` 是虚拟化列表。

**看哪里：**
- [components/timeline-list.tsx](file:///d:/Dev/mobile/expo/gowherer/components/timeline-list.tsx) — 时间线条目列表
- [app/licenses.tsx](file:///d:/Dev/mobile/expo/gowherer/app/licenses.tsx) — `FlatList` + `onEndReached` 分页，每页 40 条

**练习：** 在 `licenses.tsx` 里把 `key` 从数组 index 改成依赖名，思考为什么 index 作 key 在有增删时会有问题。

---

## 1.6 渲染与性能

**概念：** React 重渲染机制、memo、依赖数组对性能的影响。

**看哪里：**
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx#L57-L65) — `value` 用 `useMemo` 包裹，否则 Provider 每次渲染创建新对象，所有 `useContext` 消费者全量重渲染
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) — React Compiler 实验性开启（`app.config.ts` 的 `experiments.reactCompiler`）

**练习：** 故意把 `LocalePreferenceProvider` 的 `value` 改成内联对象 `{ preference, resolvedLocale, setPreference, t }`，用 React DevTools Profiler 观察子组件重渲染次数变化。

---

# 阶段二：React Native 跨平台组件

## 2.1 核心组件

**概念：** RN 不是 HTML，核心组件是 `View`/`Text`/`TextInput`/`Image`/`ScrollView`/`FlatList`/`Modal` 等，映射到原生平台控件。

**看哪里：**
| 组件 | 文件 |
|------|------|
| `View` / `Text` | 几乎所有 components/ |
| `TextInput` | [components/journey-create-card.tsx](file:///d:/Dev/mobile/expo/gowherer/components/journey-create-card.tsx) |
| `FlatList` | [app/licenses.tsx](file:///d:/Dev/mobile/expo/gowherer/app/licenses.tsx)（分页）、[components/timeline-list.tsx](file:///d:/Dev/mobile/expo/gowherer/components/timeline-list.tsx) |
| `Modal` | [components/media-preview-modal.tsx](file:///d:/Dev/mobile/expo/gowherer/components/media-preview-modal.tsx)、[components/template-modal.tsx](file:///d:/Dev/mobile/expo/gowherer/components/template-modal.tsx) |
| `Image` | [components/media-viewers.tsx](file:///d:/Dev/mobile/expo/gowherer/components/media-viewers.tsx)（用 `expo-image`） |
| `StatusBar` | [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx)（`expo-status-bar`） |

**练习：** 用 `FlatList` 实现一个横向滚动的"标签云"，每项是一个 `chip`，点击切换选中态。

---

## 2.2 StyleSheet 与样式

**概念：** RN 用 `StyleSheet.create` 创建样式表，样式是 JS 对象不是 CSS。支持 Flexbox 布局。

**看哪里：**
- [app/(tabs)/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/_layout.tsx#L18-L40) — tab 栏的内联样式（height、paddingBottom、borderTop）
- [hooks/use-material-theme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-material-theme.ts) — memo 化构建 `StyleSheet`，根据主题返回不同样式

**练习：** 给 `JourneyCreateCard` 加一个深色模式专用样式分支，用 `useMaterialTheme()` 取 `styles`。

---

## 2.3 平台适配

**概念：** RN 通过 `Platform.OS`、`Platform.select`、文件后缀 `.ios.tsx`/`.android.tsx`/`.web.tsx` 做平台分支。

**看哪里（本项目三个真实案例）：**
- [components/ui/icon-symbol.tsx](file:///d:/Dev/mobile/expo/gowherer/components/ui/icon-symbol.tsx) 与 [components/ui/icon-symbol.ios.tsx](file:///d:/Dev/mobile/expo/gowherer/components/ui/icon-symbol.ios.tsx) — iOS 用 SF Symbols，其他平台用 MaterialIcons
- [hooks/use-color-scheme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-color-scheme.ts) 与 [hooks/use-color-scheme.web.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-color-scheme.web.ts) — Web 单独实现
- [components/track-map.tsx](file:///d:/Dev/mobile/expo/gowherer/components/track-map.tsx) 与 [components/track-map.web.tsx](file:///d:/Dev/mobile/expo/gowherer/components/track-map.web.tsx) — 原生用高德 MapView，Web 回退到文本摘要
- [constants/theme.ts](file:///d:/Dev/mobile/expo/gowherer/constants/theme.ts) — `Fonts` 用 `Platform.select` 选不同字体栈

**练习：** 新建 `components/my-component.ios.tsx` 与 `components/my-component.tsx`，iOS 版用毛玻璃效果（`BlurView`），其他平台用纯色背景。导入时无需写后缀，打包器自动选。

---

## 2.4 SafeArea 与系统 UI

**概念：** 刘海屏、状态栏、底部 home indicator 区域要用 `react-native-safe-area-context` 包裹。

**看哪里：**
- 项目依赖 `react-native-safe-area-context`、`react-native-screens`、`expo-status-bar`、`expo-splash-screen`、`expo-system-ui`
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) — `StatusBar style` 跟随主题

**练习：** 在 `JourneyScreen` 顶部用 `useSafeAreaInsets()` 给内容加顶部 padding，避免被状态栏遮挡。

---

## 2.5 导航：expo-router + react-navigation

**概念：** expo-router 是基于文件的路由（类似 Next.js），底层用 react-navigation。文件名即路由，`_layout.tsx` 是嵌套布局，`(tabs)` 是路由分组（括号不出现在 URL）。

**看哪里：**
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) — 根 Stack，`unstable_settings.anchor` 设初始路由
- [app/(tabs)/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/_layout.tsx) — 底部 Tab 导航
- [app/location-picker.tsx](file:///d:/Dev/mobile/expo/gowherer/app/location-picker.tsx) — 用 `router.back()`、`useLocalSearchParams` 读参数
- [app/(tabs)/index.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/index.tsx) — 用 `router.push('/location-picker')` 跳转

**练习：** 新建 `app/(tabs)/profile.tsx` 第 4 个 tab，并在 `(tabs)/_layout.tsx` 注册它。再新建 `app/journey-detail.tsx` 作为模态详情页，从 explore 页跳转过去。

---

## 2.6 原生模块与桥接

**概念：** RN 通过原生模块调用平台能力（相机、定位、传感器）。Expo 把常用原生能力封装成 `expo-*` 模块，JS 侧调用的就是这些模块导出的函数。

**看哪里（本项目用了大量 Expo 模块，对照学）：**
| 能力 | 模块 | 项目位置 |
|------|------|----------|
| 定位/后台定位 | `expo-gaode-map`（高德封装）、`expo-location` | [lib/background-location.ts](file:///d:/Dev/mobile/expo/gowherer/lib/background-location.ts)、[lib/current-location.ts](file:///d:/Dev/mobile/expo/gowherer/lib/current-location.ts) |
| 相册/相机 | `expo-image-picker` | [app/(tabs)/index.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/index.tsx) |
| 音频录制/播放 | `expo-audio` | [components/audio-player.tsx](file:///d:/Dev/mobile/expo/gowherer/components/audio-player.tsx)、`app/(tabs)/index.tsx` |
| 视频 | `expo-video` | [components/media-viewers.tsx](file:///d:/Dev/mobile/expo/gowherer/components/media-viewers.tsx) |
| 图片 | `expo-image` | [components/media-preview-modal.tsx](file:///d:/Dev/mobile/expo/gowherer/components/media-preview-modal.tsx) |
| 文件系统 | `expo-file-system` | [lib/media-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/media-storage.ts)、[lib/local-log.ts](file:///d:/Dev/mobile/expo/gowherer/lib/local-log.ts) |
| 持久化 | `@react-native-async-storage/async-storage` | [lib/journey-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/journey-storage.ts) |
| 触感 | `expo-haptics` | [components/haptic-tab.tsx](file:///d:/Dev/mobile/expo/gowherer/components/haptic-tab.tsx) |
| 打印/分享 | `expo-print`、`expo-sharing` | [app/(tabs)/explore.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/explore.tsx)（PDF 导出） |
| 文件选择 | `expo-document-picker` | [app/(tabs)/settings.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/settings.tsx)（备份导入） |

**练习：** 仿照 `lib/local-log.ts`，用 `expo-file-system` 写一个 `lib/config-store.ts`，把一个 JSON 配置读写到 `documentDirectory`。

---

## 2.7 动画与手势

**概念：** `react-native-reanimated` 做高性能动画（跑在 UI 线程），`react-native-gesture-handler` 做手势识别，`react-native-worklets` 是 reanimated 的底层。

**看哪里：**
- [components/hello-wave.tsx](file:///d:/Dev/mobile/expo/gowherer/components/hello-wave.tsx) — 用 `useAnimatedStyle` + `withRepeat`/`withSequence` 做波浪动画
- [components/parallax-scroll-view.tsx](file:///d:/Dev/mobile/expo/gowherer/components/parallax-scroll-view.tsx) — 滚动视差
- [components/haptic-tab.tsx](file:///d:/Dev/mobile/expo/gowherer/components/haptic-tab.tsx) — 触感反馈
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) 顶部 `import "react-native-reanimated"` 必须在最早加载

**练习：** 给 `ActiveJourneyCard` 的"结束旅程"按钮加一个按压缩放动画（`withSpring`），按下时缩小到 0.95。

---

# 阶段三：Expo 工程化

## 3.1 app.config.ts 配置

**概念：** `app.config.ts`（或 `app.json`）是 Expo 应用的核心配置：name、version、icon、splash、permissions、plugins、extra 等。TS 版本可读环境变量动态生成。

**看哪里：**
- [app.config.ts](file:///d:/Dev/mobile/expo/gowherer/app.config.ts) — 完整示例：读 `EAS_PROJECT_ID`/`APP_VERSION`/`AMAP_ANDROID_API_KEY`/`EXPO_PUBLIC_AMAP_WEB_KEY`，配置 android adaptive icon、splash dark mode、plugins、`extra.geocoding`

**练习：** 在 `app.config.ts` 加一个 `EXPO_PUBLIC_APP_ENV` 环境变量（`dev`/`prod`），在应用图标右上角角标显示环境名（提示：用 `expo-image` 渲染叠加层）。

---

## 3.2 expo-router 文件路由

**概念：** 文件即路由。`app/` 目录结构映射 URL。`_layout.tsx` 控制嵌套路由的容器，`(group)` 不进 URL，`[id]` 是动态参数，`+not-found` 是 404。

**看哪里：**
- [app/](file:///d:/Dev/mobile/expo/gowherer/app/) 整个目录结构
- `app.config.ts` 里 `experiments.typedRoutes: true` — 开启类型化路由（`router.push('/location-picker')` 会有类型检查）
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx#L16-L18) — `unstable_settings.anchor` 设初始路由

**练习：** 新建 `app/journey/[id].tsx`，实现按 id 查看旅程详情。用 `useLocalSearchParams()` 取 id，从 `loadJourneys()` 找对应数据。

---

## 3.3 Config Plugin

**概念：** Config Plugin 是 Expo 在 prebuild 时改写原生工程（android/ios 目录）的 JS 函数。`withAndroidManifest` 改 manifest，`withAppBuildGradle` 改 gradle，`withInfoPlist` 改 iOS plist。

**看哪里（本项目两个真实插件，非常适合学习）：**
- [plugins/with-android-pointer-tagging.js](file:///d:/Dev/mobile/expo/gowherer/plugins/with-android-pointer-tagging.js) — 最简单的 manifest 修改插件，用 `withAndroidManifest` 给 `<application>` 加属性
- [plugins/with-android-abi-splits.js](file:///d:/Dev/mobile/expo/gowherer/plugins/with-android-abi-splits.js) — 复杂的 gradle 修改插件，用 `withAppBuildGradle` 注入 `splits`、`applicationVariants.all`，并用 `// @gowherer-abi-splits` 标记做幂等
- [app.config.ts](file:///d:/Dev/mobile/expo/gowherer/app.config.ts#L70-L71) — 插件以字符串路径引用

**练习：** 写一个 `with-android-app-name-suffix.js` 插件，在 debug 构建时把应用名改成 `gowherer [DEV]`（提示：改 `android:label`）。

---

## 3.4 Prebuild 与 Bare vs Managed

**概念：**
- **Managed workflow**：不提交 `android/`/`ios/` 目录，Exprebuild 时根据 app.config 动态生成
- **Bare workflow**：提交原生目录，直接用 gradle/Xcode 构建
- **Prebuild**：`npx expo prebuild` 把 app.config + plugins 转成原生工程

**看哪里：**
- 项目根目录无 `android/`/`ios/`（Managed）— 见 [.gitignore](file:///d:/Dev/mobile/expo/gowherer/.gitignore) 与 [docs/KNOWLEDGE_POINTS.md](file:///d:/Dev/mobile/expo/gowherer/docs/KNOWLEDGE_POINTS.md) 第 8 条
- [package.json](file:///d:/Dev/mobile/expo/gowherer/package.json) 的 `android:debug`/`android:release` 脚本假设本地已 prebuild（`cd android && gradlew ...`）

**练习：** 运行 `npx expo prebuild --platform android`，观察生成的 `android/app/src/main/AndroidManifest.xml` 是否包含你的 plugin 改动。然后 `git clean -fdx android/` 清掉。

---

## 3.5 EAS Build 与 CI

**概念：** EAS Build 是 Expo 云端构建服务。`eas.json` 定义构建 profile（development/preview/production），GitHub Actions 可手动触发。

**看哪里：**
- [eas.json](file:///d:/Dev/mobile/expo/gowherer/eas.json)
- [.github/workflows/eas-build.yml](file:///d:/Dev/mobile/expo/gowherer/.github/workflows/eas-build.yml) — 手动 dispatch，支持 `platform`（android/ios/all）与 `profile`（preview/production），用 `EXPO_TOKEN` 触发云端构建，产物上传为 artifact + GitHub Release
- [docs/KNOWLEDGE_POINTS.md](file:///d:/Dev/mobile/expo/gowherer/docs/KNOWLEDGE_POINTS.md) 第 5、6 条 — 版本号与产物扩展名的踩坑

**练习：** 在本地运行 `eas build --platform android --profile preview --local`（本地构建而非云端），对比与云端构建的产物路径。

---

## 3.6 环境变量

**概念：** Expo 区分两类：
- `EXPO_PUBLIC_*`：构建时内联到客户端 JS bundle，可被 `process.env.EXPO_PUBLIC_*` 读取
- 普通 env：只在 `app.config.ts` 构建时可用，不进 bundle

**看哪里：**
- [app.config.ts](file:///d:/Dev/mobile/expo/gowherer/app.config.ts) — 读 `process.env.AMAP_ANDROID_API_KEY`（仅构建时）与 `process.env.EXPO_PUBLIC_AMAP_WEB_KEY`（运行时）
- [lib/reverse-geocode.ts](file:///d:/Dev/mobile/expo/gowherer/lib/reverse-geocode.ts) — 通过 `Constants.expoConfig.extra.geocoding.amapWebKey` 读取（而非直接 `process.env`，因为只有 app.config 里的 extra 才能运行时拿到）

**关键理解：** 为什么 `amapWebKey` 要先在 app.config 写进 `extra`，再在 lib 里通过 `Constants.expoConfig.extra` 读取，而不是直接 `process.env.EXPO_PUBLIC_AMAP_WEB_KEY`？答案：两者其实都行，但走 `extra` 更显式、可被 app.config 校验/兜底。

**练习：** 加一个 `EXPO_PUBLIC_ENABLE_ANALYTICS` 开关，在 `app.config.ts` 写进 `extra`，在 `useJourneys` 挂载时按开关决定是否打日志。

---

# 阶段四：综合实战模式

这一阶段不学新 API，而是学**如何用前三阶段的知识组合出真实功能**。每个模式都是项目里已验证的工程实践。

## 4.1 无 Redux 状态管理：Provider + 自定义 Hook

**模式：** 全局偏好用 Provider + Context（语言、主题），业务数据用自定义 Hook 封装（旅程 CRUD）。两层职责分离。

**看哪里：**
- [app/_layout.tsx](file:///d:/Dev/mobile/expo/gowherer/app/_layout.tsx) — Provider 嵌套
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx) — Context + Provider + hook 三件套
- [hooks/use-journeys.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-journeys.ts) — 业务 Hook，封装 load/mutate/derive

**练习：** 设计一个 `useTemplateConfig()` Hook + `TemplateProvider`，让任意组件能读/改模板而不必每次手动 `loadEntryTemplateConfig(locale)`。

---

## 4.2 持久化与写入串行化

**模式：** AsyncStorage 是 KV 存储，多写并发会读-改-写竞态。用 Promise 链把所有写操作排队。

**看哪里（这是本项目最值得学的工程技巧）：**
```ts
// lib/journey-repository.ts
let writeQueue = Promise.resolve(undefined);

async function enqueueJourneyMutation(mutator) {
  const run = async () => {
    const current = await loadJourneys();
    const next = mutator(current);
    await saveJourneys(next);
    return next;
  };
  const nextRun = writeQueue.then(run, run);  // 串到队列尾
  writeQueue = nextRun.then(() => undefined, () => undefined);
  return nextRun;
}
```
- [lib/journey-repository.ts](file:///d:/Dev/mobile/expo/gowherer/lib/journey-repository.ts) — 完整实现，所有 8 个变更函数都走 `enqueueJourneyMutation`

**为什么重要：** 15 秒一次的轨迹刷新会和用户保存条目并发，没有串行化会出现丢数据。

**练习：** 写一个 `CounterStore`，提供 `increment`/`decrement`/`reset`，用串行队列保证连续调用不丢更新。

---

## 4.3 后台任务与缓冲刷新

**模式：** 后台定位不能每次 fix 都触发 React 重渲染，否则卡顿。方案：原生回调写入独立 batch key → 定时器每 15 秒批量 flush 到旅程数据 → 触发一次重渲染。

**看哪里：**
- [lib/background-location.ts](file:///d:/Dev/mobile/expo/gowherer/lib/background-location.ts) — `appendTrackLocation` 写 batch key，`syncBufferedTrackLocations` 批量 flush
- [hooks/use-location-tracking.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-location-tracking.ts) — 15 秒 `setInterval` 调 sync

**练习：** 把这个模式套用到"实时上传日志"场景：JS 侧调 `logLocalInfo` 写本地缓冲，每 30 秒批量上传到服务器（mock 一个 `uploadLogs`）。

---

## 4.4 自实现 i18n（无第三方）

**模式：** 不用 i18next，自己写：翻译字典 + 点路径查找 + 占位符插值 + 系统语言检测 + 偏好持久化 + Context 暴露。

**看哪里（完整链路）：**
- [lib/i18n.ts](file:///d:/Dev/mobile/expo/gowherer/lib/i18n.ts) — `createTranslator`/`resolveTranslation`/`interpolate`/`getSystemLocale`
- [locales/zh.ts](file:///d:/Dev/mobile/expo/gowherer/locales/zh.ts)、[locales/en.ts](file:///d:/Dev/mobile/expo/gowherer/locales/en.ts) — 字典
- [hooks/locale-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/locale-preference.tsx) — Context 集成
- 任意组件 `const { t } = useI18n(); <Text>{t('tabs.journey')}</Text>`

**练习：** 加一个日语 `locales/ja.ts`，让 `getSystemLocale` 识别 `ja`，并在设置页加"日语"选项。

---

## 4.5 主题系统：scheme + tokens + memoized StyleSheet

**模式：** 三层：
1. `constants/theme.ts` 定义 light/dark token
2. `theme-preference.tsx` 持久化偏好 + 解析最终 scheme
3. `use-material-theme.ts` 根据scheme memo 化构建 StyleSheet

**看哪里：**
- [constants/theme.ts](file:///d:/Dev/mobile/expo/gowherer/constants/theme.ts) — `Colors`、`getThemeColors`
- [hooks/theme-preference.tsx](file:///d:/Dev/mobile/expo/gowherer/hooks/theme-preference.tsx) — `useThemePreference`/`toggleTheme`
- [hooks/use-color-scheme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-color-scheme.ts) — 统一 scheme 读取入口
- [hooks/use-material-theme.ts](file:///d:/Dev/mobile/expo/gowherer/hooks/use-material-theme.ts) — `useMaterialTheme()` 返回 `{ colors, isDark, scheme, styles }`

**练习：** 加第三个主题"高对比度"，扩展 `Colors` 与 `getThemeColors`，在设置页加切换按钮。

---

## 4.6 坐标系转换（领域知识 + 工程边界）

**模式：** 中国大陆用 GCJ-02（高德/腾讯），国际用 WGS-84（GPS）。每个坐标点带 `coordSystem` 标记，渲染/反查时按需转换。遗留数据用日期分界推断。

**看哪里：**
- [types/journey.ts](file:///d:/Dev/mobile/expo/gowherer/types/journey.ts) — `TimelineLocation.coordSystem` 字段
- [lib/reverse-geocode.ts](file:///d:/Dev/mobile/expo/gowherer/lib/reverse-geocode.ts) — `wgs84ToGcj02`/`gcj02ToWgs84`/`isOutOfChina`
- [lib/journey-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/journey-storage.ts) — `resolveCoordSystem` 按日期推断遗留数据
- [components/track-map.tsx](file:///d:/Dev/mobile/expo/gowherer/components/track-map.tsx) — 渲染前转换

**练习：** 在 `explore.tsx` 的统计卡片上加一行"坐标系：GCJ-02 / WGS-84"，按旅程的 `coordSystem` 显示。

---

## 4.7 跨页面数据传递

**模式：** 选点页 → 旅程页要回传一个 location 对象，不想走路由参数（URL 有长度/序列化限制）。方案：用 AsyncStorage 做"一次性信箱"，写后 `router.back()`，目标页聚焦时 `consume`。

**看哪里：**
- [lib/pending-location.ts](file:///d:/Dev/mobile/expo/gowherer/lib/pending-location.ts) — `setPendingLocation`/`consumePendingLocation`
- [app/location-picker.tsx](file:///d:/Dev/mobile/expo/gowherer/app/location-picker.tsx) — 写入方
- [app/(tabs)/index.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/index.tsx) — 用 `useFocusEffect` 读取消费

**练习：** 仿照这个模式，实现"在 explore 页点'编辑标签'→ 跳到 tag-editor 页 → 选完返回 explore 页应用"。

---

## 4.8 数据健壮性与向后兼容

**模式：** 持久化数据可能来自旧版本，格式会变。所有读取都走 `normalize`，补全缺失字段、强制类型、回填推断值。新增字段时旧数据无标记，用日期/版本分界推断。

**看哪里：**
- [lib/journey-storage.ts](file:///d:/Dev/mobile/expo/gowherer/lib/journey-storage.ts) — `normalizeJourneyList`/`normalizeTags`/`normalizeMediaItem`/`resolveCoordSystem`
- [lib/template-storage-i18n.ts](file:///d:/Dev/mobile/expo/gowherer/lib/template-storage-i18n.ts) — `normalizeTemplateConfig`，缺失时回退默认

**练习：** 给 `Journey` 加一个 `notes: string` 字段，在 `normalizeJourneyList` 里给旧数据补 `notes: ''`，确保旧用户升级不崩。

---

## 4.9 全量备份与恢复

**模式：** 备份 = 收集所有 AsyncStorage 键 + 文件目录 → JSON → 写文件 → 分享。恢复 = 反向。

**看哪里：**
- [lib/data-backup.ts](file:///d:/Dev/mobile/expo/gowherer/lib/data-backup.ts) — `buildAppBackup`/`writeBackupToFile`/`parseBackupString`/`importBackup`
- [app/(tabs)/settings.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/settings.tsx) — UI 编排：`DocumentPicker` → `parseBackupString` → `importBackup`

**练习：** 给备份加版本号 `version: 2`，新增 `exportedFromDevice: string` 字段，并在 `parseBackupString` 里做 v1→v2 兼容。

---

## 4.10 PDF 导出（HTML → Print）

**模式：** RN 没有直接的 PDF API，但 `expo-print` 接受 HTML 字符串生成 PDF，`expo-sharing` 分享。轨迹用 SVG 内嵌到 HTML。

**看哪里：**
- [app/(tabs)/explore.tsx](file:///d:/Dev/mobile/expo/gowherer/app/(tabs)/explore.tsx) — `journeyToHtml`（含封面、统计、SVG 轨迹、base64 图片）+ `Print.printToFileAsync` + `Sharing.shareAsync`

**练习：** 给 PDF 加一个"封面图"——用 `expo-image` 生成一张旅程首图，base64 内嵌到 HTML 顶部。

---

# 学习节奏建议

| 时间 | 任务 |
|------|------|
| 第 1 周 | 阶段一：把项目跑起来，通读 `hooks/` 全部文件，做 1.1-1.6 练习 |
| 第 2 周 | 阶段二：通读 `components/` 与 `app/`，做 2.1-2.7 练习 |
| 第 3 周 | 阶段三：通读 `app.config.ts`/`plugins/`/`.github/`，做 3.1-3.6 练习 |
| 第 4 周 | 阶段四：通读 `lib/` 全量，做 4.1-4.10 练习，**并尝试给项目提一个 PR** |

---

# 检验清单：达到熟练的标志

完成下列每项说明你已掌握对应能力：

**React**
- [ ] 能解释为什么 `useEffect` 要写依赖数组，以及"active 标志"防卸载后更新的原理
- [ ] 能解释为什么 Context value 要 `useMemo`，否则消费者全量重渲染
- [ ] 能从零写一个像 `useJourneys` 这样的业务 Hook

**React Native**
- [ ] 能解释 `.web.tsx` 与 `Platform.select` 的差异，知道何时用哪个
- [ ] 能用 `FlatList` 实现分页列表
- [ ] 能解释为什么 `react-native-reanimated` 要在根布局最早导入

**Expo**
- [ ] 能写一个 Config Plugin 改 `AndroidManifest.xml`
- [ ] 能解释 `EXPO_PUBLIC_*` 与普通 env 的区别，以及为什么 `amapWebKey` 要走 `extra`
- [ ] 能配置一个 GitHub Actions EAS 构建工作流
- [ ] 能解释 Managed 与 Bare workflow 的差异，以及 prebuild 做了什么

**综合**
- [ ] 能独立设计一个"后台采集 → 缓冲 → 定时 flush"的架构
- [ ] 能给持久化数据设计 normalize + 向后兼容方案
- [ ] 能不依赖第三方库自实现 i18n 与主题系统

---

# 配套阅读

- Expo 官方文档（CLAUDE.md 指定）：https://docs.expo.dev/llms-full.txt
- React 官方文档：https://react.dev
- React Navigation：https://reactnavigation.org/docs
- expo-router：https://docs.expo.dev/router/introduction
- EAS Build：https://docs.expo.dev/eas
- Config Plugin：https://docs.expo.dev/modules/config-plugin-and-native-module
- 项目内已有文档：
  - [docs/CODE_WIKI.md](file:///d:/Dev/mobile/expo/gowherer/docs/CODE_WIKI.md) — 完整代码知识库
  - [docs/KNOWLEDGE_POINTS.md](file:///d:/Dev/mobile/expo/gowherer/docs/KNOWLEDGE_POINTS.md) — 项目排障要点
  - [docs/ONBOARDING.md](file:///d:/Dev/mobile/expo/gowherer/docs/ONBOARDING.md) — 入门
  - [docs/TROUBLESHOOTING.md](file:///d:/Dev/mobile/expo/gowherer/docs/TROUBLESHOOTING.md) — 排障

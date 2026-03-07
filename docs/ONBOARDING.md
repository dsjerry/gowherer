# GoWherer Onboarding (Beginner)

Last updated: 2026-03-07

## 1. 你将得到什么

按本指南完成后，你可以：

- 在本机跑起项目
- 在 Android 真机验证高德地图选点
- 触发一次 GitHub Actions EAS 构建
- 看懂本项目主要代码入口

## 2. 前置环境

- Node.js 18+
- npm
- JDK 17（`JAVA_HOME` 指向 JDK 根目录，不是 `.../bin`）
- Android Studio（建议，含 SDK/adb）

快速验证：

```bash
node -v
npm -v
java -version
javac -version
adb devices
```

## 3. 安装与启动

```bash
npm install
npm run lint
```

## 4. 运行方式选择（关键）

### 4.1 Web（功能演示）

```bash
npm run web
```

适合看 UI 与基础流程，但不适合验证原生地图/高德 SDK。

### 4.2 Android（推荐）

```bash
npm run android
```

说明：

- 当前脚本是 `expo run:android`，会走原生 Android 构建。
- 高德 SDK 相关功能需要 Dev Client/自定义包，Expo Go 不支持。

## 5. 环境变量（最少集）

可在本地 `.env` 配置：

```env
EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER=amap
EXPO_PUBLIC_AMAP_WEB_KEY=你的高德WebKey
AMAP_ANDROID_API_KEY=你的高德AndroidKey
APP_VERSION=1.0.0
```

说明：

- `EXPO_PUBLIC_*` 会进入客户端包，属于可公开配置。
- `AMAP_ANDROID_API_KEY` 用于原生高德 SDK 选点。
- `APP_VERSION` 决定安装后展示版本号。

## 6. 新手优先看的代码

1. `app/(tabs)/index.tsx`：新增旅程、写记录、选点、媒体、模板
2. `app/(tabs)/explore.tsx`：回顾、筛选、统计、PDF 导出
3. `lib/journey-storage.ts`：本地存储
4. `lib/reverse-geocode.ts`：地理编码 + fallback
5. `components/amap-place-picker.tsx`：Android 地图选点
6. `.github/workflows/eas-build.yml`：CI 构建与发布

## 7. 一次完整手动验证流程

1. 启动 App，创建一条旅程（旅行/通勤任意）。
2. 点击“添加定位”，在地图上点选并确认。
3. 添加 1 张照片或 1 段视频。
4. 写一条文本并保存条目。
5. 结束旅程，切到“回顾”页。
6. 验证统计卡、轨迹地图、筛选与搜索。
7. 点 PDF 图标尝试导出。

## 8. CI 构建最短路径（GitHub Actions）

手动触发 workflow `EAS Build`：

- `platform`: `android`
- `profile`: `preview`
- `app_version`: `1.0.x`

构建成功后检查：

- workflow artifact 是否为 `apk/aab/ipa`（非 `.bin`）
- GitHub Release 是否有可安装产物
- 安装后版本号是否与 `app_version` 一致

## 9. 遇错先看哪里

- Java/Gradle 报错：先查 `JAVA_HOME` 与 JDK 17
- 选点闪退：用 `adb logcat -b crash -v threadtime` 抓 native 栈
- 版本号不一致：看 CI 日志里 `Resolved expo.version before EAS build`
- Release 是 `.bin`：看 workflow 下载产物步骤是否解析了 `Content-Disposition`

## 10. 相关文档

- `docs/PROJECT_KNOWLEDGE_BASE.md`（全量知识库）
- `docs/KNOWLEDGE_POINTS.md`（精简知识点）
- `docs/TROUBLESHOOTING.md`（故障速查）

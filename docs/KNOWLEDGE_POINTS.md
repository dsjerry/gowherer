# GoWherer Knowledge Points

Last updated: 2026-04-11

See also: `docs/PROJECT_KNOWLEDGE_BASE.md` for full project-level coverage.
Beginner docs: `docs/ONBOARDING.md`, `docs/TROUBLESHOOTING.md`.

## 1. Expo 运行容器与原生模块

- `Expo Go` 不能使用第三方原生模块（例如 `react-native-amap3d`）。
- 需要使用 `Dev Client` 或 `EAS Build` 安装包来验证原生 SDK 功能。
- `npm run android` 可以用于快速验证，但前提是设备运行的是 Dev Client/自定义包，不是 Expo Go。

## 2. 高德 SDK 选点能力（Android）

- 入口策略：`添加定位` 直接进入地图选点。
- 选点来源：地图点击 + POI 点击。
- 选点确认后回填 `draftLocation`（经纬度 + 可编辑地点名）。
- Key 配置：
  - `app.config.ts` 中支持 `AMAP_ANDROID_API_KEY`。
  - 运行时通过 `extra.amap.androidApiKey` 读取。

## 3. 选点闪退排查要点

- 症状：点击“确认选点”后 App 直接退到桌面，通常是 native crash，不是 JS 报错。
- 识别信号：`logcat` 出现 `F DEBUG` + `Cmdline: com.dsjerry.gowherer`。
- 正确抓栈方式：
  - `adb logcat -c`
  - `adb logcat -b crash -v threadtime`
  - 复现后查看 `*** *** ***` 和 `backtrace` 段。

## 4. 本地日志机制（JS 层）

- 日志文件：`${FileSystem.documentDirectory}gowherer-debug.log`
- 目的：记录选点流程、逆地理编码、确认回填等关键路径错误。
- 注意：
  - native 直接崩溃时，JS 日志可能来不及写入。
  - Android 真机一般需要 `adb shell run-as <package>` 才能读取应用私有目录。

## 5. EAS 构建版本号常见误区

- `appVersionSource: remote` 只负责 build number（`versionCode`/`buildNumber`）自动递增。
- 手机显示版本来自 `expo.version`（由 `APP_VERSION` 控制）。
- 解决方案：
  - CI 在触发 `eas build` 前把 `app_version` 写入项目 `.env` 的 `APP_VERSION`。
  - 构建前用 `npx expo config --type public --json` 校验解析结果。

## 6. GitHub Action 下载产物为 `.bin` 的处理

- 问题来源：仅按 URL 后缀猜扩展名不可靠。
- 修复策略：
  - 优先使用 `applicationArchiveUrl`。
  - 解析 `Content-Disposition` 的文件名扩展名。
  - 平台兜底：Android -> `apk/aab`（结合 `eas.json` buildType），iOS -> `ipa`。

## 7. Android 本地构建环境（JAVA_HOME）

- `JAVA_HOME` 必须指向 JDK 根目录，不是 `.../bin`。
- 例如：
  - 正确：`C:\Program Files\...\jdk-17.x.x`
  - 错误：`D:\Install\Java\bin`
- `java.exe` 可执行文件路径不等于 JDK 根目录；应以 `javac` 所在路径反推 `JAVA_HOME`。

## 8. `android/` 目录是否提交

- 当前项目建议默认不提交 prebuild 生成的 `android/` 目录（Managed 工作流）。
- 只有在长期维护 Bare 原生改动时，才建议纳入版本管理。

## 9. 本仓库已落地的关键修复（近期）

- AMap 选点功能接入与定位入口统一。
- 选点确认流程增加异常防护与时序保护。
- 本地日志能力（`gowherer-debug.log`）落地。
- CI 版本注入修复（确保 `app_version` 真正进云端构建）。
- CI 产物下载逻辑修复（避免 Release 产物被保存为 `.bin`）。

## 10. 持续定位功能要点

- 开关位于当前旅程卡片标题下方，开启后后台持续记录 GPS。
- `Location.watchPositionAsync` 参数：`accuracy=Highest`，`timeInterval=5000`，`distanceInterval=5`。
- 点位先写 ref，组件渲染时批量写入 `Journey.trackLocations` 并持久化。
- 旧版旅程数据读取时自动补空数组，无需手动迁移。
- 轨迹数据存储在 `Journey.trackLocations`，可对接 `TrackMap` 组件渲染路线。

## 11. 5分钟排障 Checklist

1. 先确认运行容器：必须是 Dev Client/EAS 安装包，不是 Expo Go。
2. 先确认 Java 环境：`java -version`、`javac -version`，`JAVA_HOME` 指向 JDK 根目录。
3. 复现前清日志：`adb logcat -c`。
4. 抓崩溃栈：`adb logcat -b crash -v threadtime`，复现后找 `FATAL EXCEPTION` 或 `F DEBUG Cmdline`。
5. 若是版本号不一致：检查 CI 日志里 `Resolved expo.version before EAS build` 是否等于输入 `app_version`。
6. 若 Release 产物是 `.bin`：检查 workflow 是否使用 `applicationArchiveUrl` + `Content-Disposition` 扩展名解析。
7. 若是选点闪退：优先看 native 崩溃栈，再核对是否在确认后先卸载地图视图再关闭弹窗。

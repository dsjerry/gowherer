# GoWherer Troubleshooting

Last updated: 2026-03-08

## 1. Android 构建报错：JAVA_HOME is set to an invalid directory

症状：

- `JAVA_HOME is set to an invalid directory`
- 路径常见是 `.../Java/bin`

根因：

- `JAVA_HOME` 指到了 `bin`，不是 JDK 根目录。

修复：

1. 找到 JDK 17 根目录（例如 `C:\Program Files\Java\jdk-17.x.x`）。
2. 设置 `JAVA_HOME` 为该目录，不带 `\bin`。
3. 重新开终端后验证：

```bash
java -version
javac -version
```

## 2. Expo 扫码能跑，但高德 SDK 功能不可用

症状：

- 地图选点功能不可用，或直接提示 SDK 不可用。

根因：

- 使用了 Expo Go。Expo Go 不包含第三方原生模块。

修复：

- 使用 Dev Client 或 EAS 构建安装包运行，不用 Expo Go。

## 3. 点击“确认选点”后应用直接退出

症状：

- 无 JS 红屏，直接回桌面。
- `logcat` 可能出现 `F DEBUG Cmdline: com.dsjerry.gowherer`。

根因：

- 大概率 native 层崩溃（AMap 原生视图生命周期/时序）。

修复：

1. 先抓崩溃栈：

```bash
adb logcat -c
adb logcat -b crash -v threadtime
```

2. 复现后提取 `*** *** ***` 与 `backtrace` 段。
3. 对照当前项目已做防护：
   - 坐标有效性校验
   - 确认流程防重复
   - 确认时先 `mapSuspended`，延迟后回填与关闭

## 4. 本地日志文件看不到

症状：

- 预期有 `gowherer-debug.log`，但在文件管理器找不到。

根因：

- 文件在应用私有目录，普通文件管理器不可直接访问。
- 若是 native crash，JS 日志可能来不及刷盘。

修复：

```bash
adb shell run-as com.dsjerry.gowherer ls -la files
adb shell run-as com.dsjerry.gowherer cat files/gowherer-debug.log
```

## 5. Action 里输入 app_version=1.0.2，但安装后仍显示 1.0.0

症状：

- EAS 页面看到版本值变化，但手机安装后版本没变。

根因：

- 云端构建阶段没有读到 `APP_VERSION`。

修复：

- Workflow 在 `eas build` 前写 `.env` 的 `APP_VERSION`。
- 构建前执行 `expo config` 校验解析版本。

本项目已包含该修复。

## 6. GitHub Release 产物是 `.bin`，不是安装包

症状：

- Release 附件扩展名是 `.bin`。

根因：

- 仅根据 URL 后缀猜扩展名不可靠。

修复：

- 优先 `applicationArchiveUrl`。
- 从响应头 `Content-Disposition` 解析真实文件名扩展名。
- 按平台兜底：Android `apk/aab`，iOS `ipa`。

本项目已包含该修复。

## 7. Android CI 首次构建失败（keystore）

症状：

- `Generating a new Keystore is not supported in --non-interactive mode`

根因：

- EAS 上还没有 Android keystore，CI 是非交互模式。

修复（一次性）：

```bash
npx eas-cli@latest login
npx eas-cli@latest credentials -p android
```

然后重跑 GitHub Action。

## 8. `npm run android` 还是失败

优先排查顺序：

1. `JAVA_HOME` 是否正确（JDK 根目录）
2. `adb devices` 是否看到手机
3. 是否安装了 Android SDK / build-tools
4. 项目是否完成 `npm install`
5. 是否有旧缓存（可尝试 `./gradlew clean`）

## 9. 诊断命令速查

```bash
# Java 环境
java -version
javac -version

# 设备连接
adb devices

# 崩溃日志
adb logcat -c
adb logcat -b crash -v threadtime

# 应用私有日志
adb shell run-as com.dsjerry.gowherer ls -la files
adb shell run-as com.dsjerry.gowherer cat files/gowherer-debug.log
```

## 10. 切到“回顾”Tab 闪退：`API key not found`

症状：

- `AndroidRuntime: FATAL EXCEPTION: androidmapsapi-*`
- `java.lang.IllegalStateException: API key not found ... com.google.android.geo.API_KEY`

根因：

- Android 回顾页走了 `react-native-maps`（Google Maps）路径，但未配置 Google Maps API Key。

修复（本项目已落地）：

- Android 轨迹地图改为 `react-native-amap3d` 渲染（iOS/Web 继续用 `react-native-maps`）。

## 11. 非 JS 异常：`expected Array, got a null`

症状：

- `UnexpectedNativeTypeException: expected Array, got a null`
- 通常发生在切换 Tab 或地图组件重渲染阶段

根因：

- AMap 某些桥接参数在新架构下对 `null` 敏感（例如 marker 自定义 children/update 命令链）。

修复（本项目已落地）：

- 避免在 AMap marker 上使用 children 自定义 View。
- 轨迹 marker 改为 `icon` 资源方式。
- 关键数组参数显式传值（如 `Polyline.colors={[]}`）。

## 12. AMap 原生崩溃：`Pointer tag ... was truncated` / `GLThread ... SIGABRT`

症状：

- `F libc: Pointer tag ... was truncated`
- `Fatal signal 6 (SIGABRT) ... GLThread ...`

根因：

- Android 16/部分 ROM + 地图 native 渲染线程兼容问题（非 JS 层）。

修复（本项目已落地）：

- 在 `AndroidManifest.xml` 的 `<application>` 增加：
  - `android:allowNativeHeapPointerTagging="false"`

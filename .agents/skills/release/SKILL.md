---
name: release
description: 发布 GoWherer Android 新版本：同步版本号、打 v* tag 触发 release workflow 出签名 APK/AAB 并发布到 GitHub Release，以及手动重跑、排查发布失败。当用户要求发布新版本、出包、打 tag、更新版本号、发 Release 时使用。
---

# GoWherer 发布流程

## 触发规则（.github/workflows）

- **push main / dev** → `ci.yml`：lint + debug 构建（产物仅为 workflow artifact，14 天保留，不发 Release）。
- **push tag `v*`** → `release.yml`：从 tag 名解析版本号（`v1.0.8` → `1.0.8`），prebuild + 签名构建 universal APK + AAB，发布到 GitHub Release `v1.0.8`。
- **workflow_dispatch** → `release.yml` 手动重跑：可选 build_type（all/universal/split/单架构/aab）、app_version（不带 tag 时用它，缺省取 package.json version）、release_notes。
- PR → `ci.yml` 的 lint 检查。

## 发布步骤（标准流程）

1. **版本号三处同步**（发版前手动改好并提交）：
   - `package.json` 的 `version`（如 `1.0.8`）；
   - `app.config.ts` 的 `android.versionCode`（整数，**必须比上一版大**，如 `1003` → `1004`；覆盖安装靠它判定升级）；
   - tag 名 `v1.0.8` 会覆盖 `expo.version`（workflow 内通过 `APP_VERSION` 环境变量注入），所以 `app.config.ts` 里的 `appVersion` 兜底值不改也不影响本次发布。
2. **提交并推送**：`git push origin main`。
3. **打 tag 并推送**：
   ```bash
   git tag v1.0.8
   git push origin v1.0.8
   ```
4. **等待 release.yml 跑完**（约 15-25 分钟）：prebuild → 签名构建 universal APK + AAB → 发布 GitHub Release `v1.0.8`，产物命名 `gowherer-universal-v1.0.8.apk`、`gowherer-v1.0.8.aab`。
5. **验收**：Actions 全绿；Releases 页产物齐全、体积正常；下载 APK 安装冒烟（覆盖安装旧版本应成功）。

可用 `gh run list --workflow=release.yml` / `gh run watch` 跟踪进度。

## 必需的 GitHub Secrets / Variables

| 名称 | 类型 | 用途 |
|------|------|------|
| `AMAP_ANDROID_API_KEY` | secret | 高德原生 SDK Key（写入 manifest） |
| `EXPO_PUBLIC_AMAP_WEB_KEY` | secret | 附近地点/搜索/逆地理 |
| `EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER` | variable | 逆地理 provider（默认 amap） |
| `ANDROID_KEYSTORE_BASE64` | secret | 发布签名 keystore（base64） |
| `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` / `ANDROID_STORE_PASSWORD` | secret | 签名密钥信息 |

缺 keystore 时构建仍会成功，但产物是 debug 签名——**发版前确认 secrets 齐全**。

## 排查

- **构建失败在 setup-android / "Failed to find package 'tools'"**：已通过移除 `Setup Android SDK` 步骤修复（运行器预装 SDK）。若历史分支/workflow 复现，检查是否回退了该修复。
- **覆盖安装失败 `INSTALL_FAILED_VERSION_DOWNGRADE`**：versionCode 没有递增，回到步骤 1。
- **debug 构建在小米/HyperOS 上弹"应用兼容性/16KB 对齐"警告**：OEM 对可调试应用的提示，属正常噪音；正式签名包无此问题。
- **Release 已存在**：`gh release create` 失败会被 `|| true` 吞掉，随后 `gh release upload --clobber` 仍会覆盖产物；重跑安全。
- **搜索/附近地点为空**：确认 `EXPO_PUBLIC_AMAP_WEB_KEY` secret 存在且 provider 为 amap（见 `lib/reverse-geocode.ts`）。

## 用户要求"出个测试包"时

用 `workflow_dispatch` 触发 `release.yml`，build_type 选 `universal`，**不要打 tag**（避免占用正式版本号）；Release 会以 package.json 版本号创建，注意之后手动删除该 Release 或告知用户。

# GoWherer

[English README](./README.md)

GoWherer 是一个基于 Expo React Native 的旅程时间线应用（出行/通勤场景），目标是让记录更快、回顾更清晰、导出更实用。

## 功能概览

- 旅程开始/结束流程
- 时间线条目（文字、位置、照片、视频）
- 相机拍摄与媒体库导入
- 条目编辑/删除
- 按类型筛选旅程历史
- 反向地理编码（经纬度转地点名）
- 旅程/条目标签与关键词/标签筛选
- 旅程统计卡片：
  - 总距离
  - 总时长
  - 平均速度
  - 定位点数量
- 路线可视化（原生地图 + Web 兜底）
- PDF 导出（含路线预览图与统计信息）
- 手动浅色/深色主题切换（本地持久化）

## 技术栈

- Expo SDK 55
- React Native 0.83.2
- React 19.2.0
- Expo Router
- AsyncStorage
- `expo-image-picker`、`expo-location`、`expo-video`、`expo-print`、`expo-sharing`
- `react-native-maps`

## 快速开始

### 环境要求

- Node.js 18+
- npm
- 可运行 Expo 的 Android/iOS/Web 环境

### 安装依赖

```bash
npm install
```

### 启动项目

```bash
npm run start
```

也可以按平台启动：

```bash
npm run android
npm run ios
npm run web
```

## 常用脚本

- `npm run start`：启动 Expo 开发服务
- `npm run android`：运行到 Android 目标
- `npm run ios`：运行到 iOS 目标
- `npm run web`：运行 Web 目标
- `npm run lint`：执行代码检查
- `npm run reset-project`：重置初始模板结构

## 项目结构

- `app/(tabs)/index.tsx`：进行中的旅程创建与管理
- `app/(tabs)/explore.tsx`：历史回顾、总结与 PDF 导出
- `lib/journey-storage.ts`：本地存储逻辑
- `types/journey.ts`：核心数据类型
- `components/track-map.tsx`：原生路线地图
- `components/track-map.web.tsx`：Web 路线地图兜底
- `.github/workflows/eas-build.yml`：EAS 构建工作流
- `app.config.ts`：Expo 应用配置

## EAS 构建与 CI

项目已配置 GitHub Actions 手动触发 EAS 构建（`platform`: `android`/`ios`/`all`，`profile`: `preview`/`production`）。

需要的 GitHub Secrets：

- `EXPO_TOKEN`
- `EAS_PROJECT_ID`

### Android CI 已知问题

若 Android keystore 尚未在 EAS 侧初始化，非交互模式构建会失败，典型报错：

`Generating a new Keystore is not supported in --non-interactive mode`

请先在本地交互式执行一次：

```bash
npx eas-cli@latest login
npx eas-cli@latest credentials -p android
```

完成后重新触发 GitHub Action。

## 路线图

- P1：
  - 智能路线分析（停留点/分段总结）
  - GPS 轨迹去噪与平滑
  - 时间线模板条目
  - PDF 模板与封面自定义
  - 旅程分享卡片生成
- P2：
  - 云同步
  - 跨设备恢复与浏览
  - 协作模式
  - 坐标脱敏等隐私控制
  - 地理围栏提醒与可选后台自动记录

## 许可证

MIT License，见 [LICENSE](./LICENSE)。

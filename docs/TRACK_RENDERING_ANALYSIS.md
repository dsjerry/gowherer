# 轨迹渲染"线变直"问题分析记录

> 创建日期：2026-05-07
> 关联 commit：`948aaba` (feat: harden journey tracking and media persistence)
> 测试数据：`gowherer-backup-2026-05-07_07-22-52-183Z.json`

## 1. 现象

持续定位（continuous tracking）一直在采点，但回顾页面绘制出来的轨迹折线是一条**接近直线**的形状，没有体现真实路径的弯曲。

## 2. 数据样本（journey-1777945120455-n5wlr2）

| 项目 | 值 |
|---|---|
| trackLocations 总数 | 1644 |
| 含 `capturedAt` | 0 / 1644 |
| 含 `source: 'tracking'` | 0 / 1644 |
| 精度范围 | 3-40m（平均 9m，全部 < 100m） |
| 起点 | 阳江 (21.79°N, 111.64°E) |
| 终点 | 广州 (23.13°N, 113.38°E) |
| 起末直线距离 | ~200 km |
| 累计轨迹距离 | 271 km |
| 相邻点距离 > 1km 的"瞬移" | **10 处** |
| 最大相邻跳跃 | **36 km** |

## 3. 根本原因（多重叠加）

### 3.1 旧数据缺失 `capturedAt` / `source` 字段

`source: 'tracking'` 和 `capturedAt: new Date(item.timestamp).toISOString()` 字段是 commit `948aaba` 才在 `lib/background-location.ts` 的 `appendTrackLocations` 里加入的。在此之前采集的轨迹都没有这两个字段。

### 3.2 速度过滤完全失效

`lib/track-utils.ts` 中 `prepareTrackRouteLocations` 的速度过滤分支：

```ts
if (previous.capturedAt && location.capturedAt) {
  const speedKmh = distanceKm / durationHours;
  if (speedKmh > MAX_TRACKING_SPEED_KMH) continue;
}
```

**条件依赖 `capturedAt`**。旧数据没有此字段 → 整个速度过滤分支跳过 → 36km 的瞬移点全部"安全通过"。

### 3.3 排序也不可靠

`sortLocationsByCapturedAt` 在 `capturedAt` 缺失时 `return 0`，依赖数组原始顺序。如果跨 App 重启，AsyncStorage batch 的 flatMap 顺序可能与真实时序不一致。

### 3.4 地图自动缩放压平视觉曲线

`MapView.initialRegion` 包含全部点。当起点-终点跨 200km 时，地图自动 zoom 到广东省级别，每像素代表数百米，**城市内的轨迹弯折在屏幕上就被压成一条直线**。

## 4. 新数据是否会自动正常？

### ✅ 已修复

`948aaba` 之后采集的数据：
- 排序正确（按 `capturedAt`）
- 速度过滤生效（>180km/h 自动剔除）
- 36km 瞬移这种典型 GPS 抖动会被过滤

### ⚠️ 仍存在的边界情况

| 情况 | 描述 | 是否被现有过滤拦截 |
|---|---|---|
| A. 低速大跳跃 | GPS 漂到 5km 外停留 5min 后回来，速度 = 60km/h | ❌ 通过速度过滤 |
| B. App 被杀后跨长时间恢复 | 杀进程 3h 后在 300km 外重启，速度 100km/h | ❌ 通过速度过滤 |
| C. 跨城市真实长途 | 200km 跨城出行，地图被迫缩到全省 | ✅ 是真实数据但视觉像直线 |

## 5. 建议优化

### 5.1 补一道纯距离的瞬移过滤（兜底）

在 `lib/track-utils.ts` 的 `prepareTrackRouteLocations` 内，距离判断后追加：

```ts
const MAX_NEIGHBOR_DISTANCE_METERS = 500;

if (distanceKm * 1000 > MAX_NEIGHBOR_DISTANCE_METERS) {
  continue; // 距离突变 → 视为瞬移，直接丢弃
}
```

**作用**：与时间无关，能覆盖情况 A/B，对真实长途行进无影响（合理移动相邻点不会一下跳 500m）。

### 5.2 解决双重平滑

`getJourneyTrackLocations`（`app/(tabs)/explore.tsx`）已对数据 `smoothTrackLocations` 一次，`TrackMap` 内部又平滑一次。建议二选一。

### 5.3 旧数据迁移（可选）

对历史 journey 的 `trackLocations` 做一次性迁移，按相邻距离阈值清理瞬移点；或纯 UI 层在渲染时套用 5.1 的过滤即可（推荐，无须迁移）。

## 6. 排查清单

下次出现"线变直"时：

1. 用以下脚本检查目标 journey 数据特征：
   ```bash
   node -e "const d=require('./backup.json'); const j=(d.data?.journeys||d.journeys).find(x=>x.id==='<id>'); const tl=j.trackLocations; console.log('points:',tl.length,'capturedAt:',tl.filter(p=>p.capturedAt).length); ..."
   ```
2. 重点看：
   - 有无 `capturedAt`（无 → 旧数据问题）
   - 相邻点最大距离（>1km → 瞬移问题）
   - 起终点直线距离（>50km → 地图缩放压平视觉）
   - 精度统计（>100m 占比，会被精度过滤）

## 7. 相关文件

- `lib/track-utils.ts` —— 过滤、排序、平滑核心逻辑
- `lib/background-location.ts` —— 后台 GPS 任务，写入 `capturedAt` / `source`
- `lib/journey-repository.ts` —— `appendJourneyTrackLocations` 持久化入口
- `app/(tabs)/explore.tsx` —— `getJourneyTrackLocations`（折线源）/ `getJourneyTrackMapMarkerLocations`（标记源）
- `components/track-map.tsx` —— `TrackMap` 渲染组件（含双重平滑问题）

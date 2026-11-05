# City Walk 功能计划与技术资料

更新日期：2026-11-03  
状态：Phase 1–4 的 MVP 已在客户端实现（见第 15 节「实现状态」），后端代理尚未建立

## 1. 目标与建议

为 GoWherer 增加 City Walk 城市漫步功能：用户选择起点、可用时长和兴趣主题，AI 从高德返回的真实地点中编排一条步行路线；高德负责计算每一段真实步行路径，App 展示地图、途经点、距离和预计时间。用户确认后可以保存方案，或开始一段普通 GoWherer 旅程。

可行性高，建议先做小范围 MVP：

- 一次推荐 3–6 个途经点。
- 支持当前位置/地图选点作为起点、时长、兴趣主题、步行节奏和是否回到起点。
- 只使用高德返回的地点 ID、名称和坐标；AI 只能选择和排序这些地点，不能编造 POI 或坐标。
- 使用高德步行路径 API 计算起点到第一站、站点之间和最后一站的路线。
- 地图路线与地点详情可查看，用户确认后保存或开始旅程。

核心原则：**AI 负责“去哪儿、按什么顺序、为什么”；地图服务负责“真实地点、坐标和怎么走”。**

## 2. 当前项目基础

项目已有不少可复用能力：

| 能力 | 当前实现 | City Walk 可复用方式 |
| --- | --- | --- |
| 原生地图与路线绘制 | `expo-gaode-map`；`components/track-map.tsx` 使用 Marker、Polyline | 在地图上展示规划路线及途经点；建议给地图组件增加路线点覆盖物/可交互配置 |
| 当前位置与定位权限 | `lib/current-location.ts`、`lib/background-location.ts` | 获取起点、确认用户授权；不要默认在后台持续定位 |
| POI 搜索、附近搜索、逆地理编码 | `lib/reverse-geocode.ts` | 现有 `queryNearbyPlaces`、`searchPlaces` 可作 API adapter 的行为参考 |
| 坐标转换 | `lib/reverse-geocode.ts` 提供 WGS-84 与 GCJ-02 转换 | 高德 Web Service 请求和地图展示统一使用 GCJ-02；保存普通旅程定位时遵循现有 WGS-84 约定 |
| AI 配置与调用 | `ai`、`@ai-sdk/openai-compatible`；`lib/ai-settings.ts`、`lib/ai-review.ts` | 复用用户配置的供应商、模型和 API Key；增加结构化路线生成调用 |
| 旅程和时间线 | `types/journey.ts`、`lib/journey-repository.ts`、`lib/journey-storage.ts` | “开始漫步”后创建标准旅行旅程，用户抵达途经点时继续添加真实时间线记录 |

当前仓库是 Expo/React Native 客户端；`package.json` 中没有后端框架，仓库内也没有 City Walk API 服务。现有 AI 请求由客户端使用 AI SDK 发起，AI Key 存在本机 AsyncStorage。当前 `EXPO_PUBLIC_AMAP_WEB_KEY` 会进入客户端构建，不应把它当作新 City Walk 服务的私密服务器密钥。

## 3. Skill、MCP Server 与 App Runtime 的区别

这三者不是同一层：

1. **仓库 `.agents/skills/expo-gaode-map/` Skill** 是给开发 Agent 使用的集成说明，不会随 App 打包，也不能在用户点击按钮时作为运行时服务调用。
2. **高德官方 MCP Server** 是地图工具服务，文档列出地点搜索、步行规划等能力，提供云端 Streamable HTTP 和 Node.js 接入方式。App 需要通过自己的后端/MCP Client 调用，不要把 MCP Key 放进客户端。
3. **高德 Web Service REST API** 是普通 HTTP API。City Walk 的固定流程可以由后端直接调用 REST API；这通常比让移动端维护 MCP 连接更容易控制错误、限流、缓存和返回格式。

推荐先实现一个窄范围的 GoWherer 后端适配层，内部直接调用高德 POI 与步行路线 API；MCP 可以作为未来的工具适配选项，不是 MVP 的前置条件。

## 4. 推荐架构

### 4.1 MVP：客户端 BYOK + 服务端地图代理

此方案保留目前“用户自行配置模型供应商/API Key”的产品方式，同时不把高德 Web Service Key 暴露给 App。

```text
Expo App
  ├─ 读取当前位置/地图选起点、时长与兴趣偏好
  ├─ 调用 GoWherer Map API：搜索真实 POI 候选
  ├─ 用现有 AI SDK + 用户配置模型，从候选 POI 中选择并排序
  ├─ 校验 AI 结果中的 POI ID 均来自候选集
  ├─ 调用 GoWherer Map API：计算每段步行路线
  └─ 展示路线和途经点；保存方案/开始旅程

GoWherer Map API（后端）
  ├─ 持有 AMAP_WEB_SERVICE_KEY
  ├─ 调用高德周边/关键词 POI API
  ├─ 调用高德步行路径规划 API
  ├─ 校验输入、限流、超时、缓存、错误映射
  └─ 返回客户端需要的最小结构化字段
```

客户端只把起点、兴趣和高德候选 POI 信息发送给用户选定的模型；不发送完整历史旅程或媒体。高德 API Key 留在后端。模型 Key 继续由当前 App 配置管理，并直接发往用户选择的模型服务，不经过地图代理。

AI 供应商能力不完全一致，因此应提供降级策略：结构化输出/工具调用可用时使用结构化 Schema；否则要求模型输出受限 JSON 并严格解析。解析失败或 POI ID 不在候选集时，不展示模型生成的坐标，提示重试或显示非 AI 的候选地点。

### 4.2 后续选项：服务端统一编排 AI

若后续需要账号、跨设备同步、集中计费/限额、稳定的工具调用或服务端 MCP，再把 AI 调用也移到服务端。届时需要明确模型 Key 方案：

- 服务端统一托管模型 Key；或
- 用户 BYOK Key 通过 TLS 仅为单次请求临时传入，服务端不得持久化或写日志。

自定义 OpenAI-compatible Base URL 不能直接信任并由服务器任意请求，否则有 SSRF 风险。应限制协议、阻止 localhost/私网地址并做好 DNS/IP 校验；更简单的 MVP 是只允许内置供应商。

## 5. 用户流程与页面

### 5.1 入口与设置

- 在旅程首页的创建入口附近增加“City Walk / 城市漫步”入口，不取代普通旅行/通勤创建。
- City Walk 配置页提供：起点、预计时长、兴趣主题、步行节奏、路线形状（单程/环线）和可选终点。
- 起点可用当前位置、地图选点或地点搜索；所有定位请求遵守现有权限提示，不在未授权时后台定位。

### 5.2 生成中

- 显示当前阶段，例如“正在寻找附近地点”“正在安排步行顺序”“正在计算路线”。
- 提供取消操作和超时提示。
- 失败时区分定位权限、网络、高德 API、模型配置、模型输出校验错误；保留用户输入以便重试。

### 5.3 路线预览

- 顶部为路线地图，按序号标出途经点并绘制路线。
- 下方为路线概览：总距离、纯步行时间、预计总时长（含停留）。
- 途经点卡片显示名称、类别、地址/到达顺序、建议停留时间和 AI 推荐理由；每一条信息都必须来自高德数据或被明确标记为 AI 生成的说明。
- 提供“换一站/重新规划/保存方案/开始漫步”操作；不满意时可调整偏好后重试。

### 5.4 与 GoWherer 旅程的关系

规划路线不能写入 `Journey.trackLocations`：该字段表示实际 GPS 轨迹，不是预定路线。

建议新增独立 `CityWalkPlan` 本地记录。用户点“开始漫步”时，再通过现有 journey repository 创建一条 `travel` 旅程；用户到达某站时可把该地点带入普通时间线记录。计划中的路线与实际轨迹应在 UI/数据中明确区分。

## 6. API 草案

接口路径仅为建议，需在实现时与实际后端规范对齐。

### 6.1 搜索候选地点

`POST /v1/city-walk/candidates`

请求：

```json
{
  "origin": {
    "latitude": 31.2304,
    "longitude": 121.4737,
    "coordinateSystem": "gcj02"
  },
  "radiusMeters": 2500,
  "interests": ["architecture", "coffee", "park"],
  "maxCandidates": 30
}
```

响应只返回必需字段：

```json
{
  "requestId": "cwreq_...",
  "candidates": [
    {
      "poiId": "高德 POI ID",
      "name": "地点名称",
      "category": "景点/咖啡",
      "address": "地址",
      "latitude": 31.231,
      "longitude": 121.475,
      "coordinateSystem": "gcj02",
      "distanceFromOriginMeters": 320
    }
  ]
}
```

POI 的分类筛选应映射到高德 POI 类型码/关键词，而不是仅靠 AI 自由搜索。候选数应有上限，避免把过多地址和文本送给模型。

### 6.2 计算路线各段

`POST /v1/city-walk/routes`

请求：

```json
{
  "requestId": "cwreq_...",
  "stopPoiIds": ["poi_1", "poi_2", "poi_3"],
  "returnToOrigin": true
}
```

`requestId` 绑定上一步返回的起点和候选 POI；服务端短时缓存候选结果，并按 `poiId` 解析坐标。这样客户端/模型不能用任意坐标要求服务端计算路线。请求超时或缓存过期时返回可重试错误。

响应建议包含：

```json
{
  "legs": [
    {
      "fromPoiId": null,
      "toPoiId": "poi_1",
      "distanceMeters": 640,
      "durationSeconds": 480,
      "polyline": [
        { "latitude": 31.2304, "longitude": 121.4737, "coordinateSystem": "gcj02" }
      ],
      "steps": []
    }
  ],
  "totalDistanceMeters": 2480,
  "walkingDurationSeconds": 1860
}
```

产品层预计时长应区分“步行时间”和“含停留时间的总时长”。高德步行规划返回的路线时间不能代表游客停留时间。

### 6.3 AI 规划输出

建议采用可校验的 JSON 结构，而非直接渲染自由文本：

```json
{
  "title": "街巷与咖啡的一小时漫步",
  "stops": [
    {
      "poiId": "poi_1",
      "order": 1,
      "suggestedStayMinutes": 20,
      "reason": "从候选 POI 中选择的简短理由"
    }
  ],
  "routeStyle": "mostly-shaded"
}
```

`poiId` 必须全部存在于本次高德候选集中；`order` 连续且不重复；站点数、停留时长和总时长须由服务端/客户端 Schema 校验。不要将 AI 输出中的坐标直接用于地图或路线请求。

## 7. 推荐规划算法

1. 收集起点、时长、兴趣类别、步行节奏、单程/环线偏好。
2. 服务端向高德按兴趣类别分组搜索周边 POI，合并、去重并移除无坐标/无 ID/距离明显超限的候选。
3. 初步筛选适合步行距离的 POI，并确保候选类型多样；可在服务端按距离排序和限数。
4. AI 仅从候选 POI ID 中选择和排序，并给出标题、每站停留时间及推荐理由。
5. 校验模型输出：未知/重复 ID、超出停靠点上限、非法时长均拒绝或纠正，不允许 AI 自造地址。
6. 按顺序逐段调用高德步行规划，组合实际路线几何和距离/时间。
7. 超出用户时长/距离预算时，进行一次有限重排/缩减；仍不满足则明确告知用户并让其选择缩短路线或放宽预算。
8. 对无候选、单段失败、部分路线失败、超时和限额错误提供明确降级信息；不要生成看似真实但未经路网计算的路线。

MVP 可以使用简单的邻近候选筛选和 AI 排序，不需要一开始实现复杂的旅行商/路径优化算法。每增加一个途经点通常意味着额外步行路段请求，需要限制站点数、加超时和缓存，并确认开发者账号的接口权限、配额和计费规则。

## 8. 数据存储建议

新增独立类型，不扩用 `trackLocations`：

```ts
type CityWalkCoordinate = {
  latitude: number;
  longitude: number;
  coordinateSystem: 'gcj02';
};

type CityWalkPlan = {
  id: string;
  createdAt: string;
  title: string;
  origin: CityWalkCoordinate & { label?: string };
  stops: Array<{
    poi: NearbyPlace;
    order: number;
    suggestedStayMinutes: number;
    reason: string;
  }>;
  legs: Array<{
    fromPoiId?: string;
    toPoiId: string;
    distanceMeters: number;
    durationSeconds: number;
    polyline: CityWalkCoordinate[];
  }>;
  totalDistanceMeters: number;
  walkingDurationSeconds: number;
  estimatedTotalMinutes: number;
  preferences: CityWalkPreferences;
  linkedJourneyId?: string;
};
```

MVP 可在 App 本地单独保存少量近期方案；数据增长或需跨设备同步时再评估 SQLite/后端持久化。启动为 GoWherer 旅程后，用 `linkedJourneyId` 建立关联；删除旅程时应清除/解除关联。规划折线使用 GCJ-02 并显式标注坐标系，避免与当前实际 GPS 轨迹混淆。

## 9. 安全、隐私与可靠性

- 高德 Android 原生地图 Key 和 Web Service Key 是不同用途；不要复用或把服务器 Web Service Key 放在 `EXPO_PUBLIC_*` 中。
- 当前 `EXPO_PUBLIC_AMAP_WEB_KEY` 在客户端可见；City Walk 新的 Web Service Key 应单独配置在后端环境变量。对 Key 配置来源 IP/服务权限/配额限制，并在日志中脱敏。
- 每次生成前说明会使用当前位置/起点请求附近地点；仅发送完成规划所需的最少数据，不上传历史旅程、媒体和无关标签。
- 模型只拿到用户偏好和限量 POI 候选；将 POI 文本视为不可信数据，不执行候选描述里的指令。
- API 增加请求超时、按用户/IP 限流、候选数/路线站点数上限、重复请求缓存和稳定错误码。
- AI 失败时可以显示地图候选列表供用户手动选择；路线 API 失败时不可把直线连线伪装成可走路线。
- 如果后端接收 BYOK 配置，Key 只用于该请求、不得持久化或记录；自定义 Base URL 需要防 SSRF 校验。MVP 不建议把用户自定义服务器地址直接交给后端任意 fetch。

## 10. 分阶段实现计划

### Phase 0：产品与账号确认

- 确认首版只支持中国大陆城市，还是希望支持海外步行数据。
- 确认路线形式：单程/环线、默认时长、兴趣分类、最多站点数。
- 确认高德 Web Service Key 的服务开通、配额与预算。
- 选择后端部署位置；当前 Expo 仓库没有可见的后端运行时。
- 决定 AI 首版采用客户端现有 BYOK，还是迁移到服务端统一调用。

### Phase 1：高德后端代理

- 建立候选 POI 搜索和步行路线两个接口。
- 约定请求/响应类型、坐标系、限流、超时和脱敏日志。
- 使用 fixture/mock 覆盖 AMap HTTP 响应解析和错误分支。

### Phase 2：AI 生成与校验

- 新增 City Walk 配置类型、Schema、生成提示词和结果校验。
- AI 只选择候选 POI ID；结构化输出失败时提供重试/手工选择。
- 做可重复的单元测试，覆盖未知 ID、重复站点、预算超限和空路线。

### Phase 3：App 交互与地图预览

- 增加入口、偏好表单、生成状态、路线预览和失败恢复 UI。
- 使用高德 MapView 展示 polyline 与途经点序号。
- 页面首屏先展示路线地图和总览，站点列表可滚动。
- 支持删除/替换一个站点后重新计算关联路线段。

### Phase 4：保存与旅程衔接

- 持久化 CityWalkPlan，并支持重开已保存方案。
- “开始漫步”创建标准 `travel` Journey，途经点抵达时写入普通时间线条目。
- 计划路线与用户实际 GPS 轨迹分开存储、分开显示。

### Phase 5：质量与发布

- 真机验证定位权限、网络切换、长路线地图渲染、底部/地图手势冲突。
- 检查 AMap key 限额、超时、错误提示、日志脱敏。
- 在 AI 不可用/无网络时验证手工地点选择和重试流程。
- 之后再考虑营业时间、天气、用户常去地点、复杂路线优化与 MCP 后端适配。

## 11. 验收标准

- 推荐的每个 POI 都有高德 POI ID 和有效 GCJ-02 坐标。
- 每个路线段都来自高德步行路径规划，能够显示 polyline、距离和步行时间。
- AI 不能输出候选集之外的站点，也不能将文本输出伪装成坐标数据。
- 总时间明确区分步行与停留；预算不符时有可理解的提示和调整方式。
- 未授权定位时可手动选点；拒绝定位或网络失败不会卡死页面。
- 用户确认后可保存方案；启动旅程不会把预定路线误存为实际 GPS 轨迹。
- 客户端包和日志中没有 City Walk 后端 AMap Web Service Key。

## 12. 当前待确认决策

| 决策 | 推荐默认值 | 影响 |
| --- | --- | --- |
| 首版地区 | 中国大陆 | 决定 POI 类别、坐标和服务可用性 |
| 默认时长 | 90 分钟 | 影响搜索半径、站点数和候选筛选 |
| 站点上限 | 5 个 | 控制路线质量与高德调用次数 |
| 起点 | 当前位置，可改地图点 | 需要前台定位权限和手动回退 |
| 路线形状 | 默认环线，可切单程 | 环线需要额外计算回起点路段 |
| AI Key | MVP 沿用客户端 BYOK | 地图 Key 仍必须由后端保护 |
| 高德接入 | 后端直接 REST | 工具接口更可控；后续可以适配 MCP |
| 计划持久化 | 本地独立 CityWalkPlan | 避免 Journey 数据库迁移和混淆规划/实际轨迹 |

## 13. 资料与代码入口

### 高德官方资料

- [高德 Web 服务 API：步行路径规划](https://lbs.amap.com/api/webservice/guide/api/direction/)  
  步行接口：`https://restapi.amap.com/v3/direction/walking`；起终点坐标使用经度在前、纬度在后。官方文档说明步行规划支持 100km 以内路线。实际权限、配额及返回字段以申请账号当前文档为准。
- [高德 Web 服务 API：地点搜索/周边搜索](https://lbs.amap.com/api/webservice/guide/api/search/)  
  周边搜索接口：`https://restapi.amap.com/v3/place/around`；需 Web Service Key，可按坐标、关键字/类型、半径和排序等参数查询。
- [高德 MCP Server 概述](https://developer.amap.com/api/mcp-server/summary)
- [高德 MCP Server 快速接入](https://developer.amap.com/api/mcp-server/gettingstarted)  
  官方 MCP Server 提供云端 Streamable HTTP 和本地 Node.js 接入方式；服务端/Agent 可调用地点搜索和步行路径规划类工具。
- [Vercel AI SDK：结构化输出](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)  
  用 Schema 约束行程计划输出，再由应用侧校验 POI ID 白名单。

### 项目内资料

- `.agents/skills/expo-gaode-map/SKILL.md`：本地开发 Agent 的地图接入技能说明，不是 App Runtime 服务。
- `app.config.ts`：Expo 高德插件、原生 Key 与 Geocoding 配置。
- `lib/reverse-geocode.ts`：现有高德反向地理编码、周边 POI/地点搜索和坐标转换。
- `components/track-map.tsx`：原生高德地图 Marker/Polyline 渲染。
- `lib/ai-review.ts`、`lib/ai-settings.ts`：客户端 AI SDK 和 BYOK 配置实现参考。
- `types/journey.ts`、`lib/journey-repository.ts`：现有旅程、记录数据与持久化流程。

## 14. 结论

City Walk 的客户端地图基础和附近 POI 搜索已有可复用实现；主要新增工作是安全的地图 API 服务层、AI 对 POI 候选的结构化编排、逐段步行路线校验和路线预览/保存交互。建议先做“服务端高德代理 + 客户端 BYOK AI + 候选 POI 白名单校验”的 MVP；不要把 Agent Skill 文件打进 App，也不要把新的高德 Web Service Key 暴露给客户端。

## 15. 实现状态（2026-11-03）

### 15.1 已实现（客户端 MVP）

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 数据类型 | `types/city-walk.ts` | `CityWalkPlan` / `CityWalkStop` / `CityWalkLeg` / `CityWalkCandidate` / 偏好与错误码；路线坐标统一 `gcj02` |
| 地图服务适配层 | `lib/city-walk-service.ts` | 兴趣 → 高德 POI 类型码/关键词映射、周边搜索、去重与半径过滤、`/v3/direction/walking` 逐段步行路线、超时与错误分类；配置 `EXPO_PUBLIC_CITY_WALK_API_BASE_URL` 后改走后端代理 |
| AI 编排与校验 | `lib/city-walk-planner.ts` | 中文/英文提示词、`generateObject` + `jsonSchema` 结构化输出（失败退回纯 JSON 文本解析）、poiId 白名单校验、去重/站点上限/停留时长修正、生成后按预算裁剪站点 |
| 本地持久化 | `lib/city-walk-storage.ts` | `gowherer:city-walk-plans:v1`，最多 20 条；读取时逐字段归一化，损坏数据自动丢弃 |
| 业务 Hook | `hooks/use-city-walk.ts`、`hooks/use-place-search.ts` | 生成阶段状态机（找地点 → 排序 → 算路线）、取消/超时、删站重算、保存、开始漫步、地点搜索防抖 |
| 界面 | `app/city-walk.tsx`、`components/city-walk-*.tsx` | 偏好表单（起点/时长/兴趣/节奏/环线或单程）、生成进度、地图预览 + 途经点、站点卡片、已保存方案列表 |
| 入口 | `app/(tabs)/index.tsx` + `components/city-walk-entry-card.tsx` | 旅程首页「创建旅程」入口上方的城市漫步入口 |
| 起点选点 | `app/location-picker.tsx`、`lib/pending-location.ts` | 选点页新增 `target=city-walk`、`initialSys=gcj02` 通道，与旅程条目草稿的一次性交接互不干扰 |
| 旅程关联 | `lib/journey-repository.ts` | 「开始漫步」创建 `travel` 旅程并写入 `linkedJourneyId`；删除旅程时自动解除方案关联 |

关键约束的落实：

- AI 只看到 `poiId | 名称 | 类别 | 地址 | 距起点`，输出中的坐标一律忽略；未知/重复 `poiId` 直接判定为无效输出。
- 每段路线全部来自高德步行规划；任一段失败即整体失败，不会用直线冒充可走路线。
- 总时长 = 纯步行时间（高德）+ 建议停留时间，UI 分开显示。
- 超出时长预算时按前缀裁剪尾部站点并提示；用户仍可删站或放宽时长。
- 计划路线（`CityWalkPlan.legs`）与真实 GPS 轨迹（`Journey.trackLocations`）完全分离。

### 15.2 与本文档的偏差

1. **高德调用目前在客户端**（`lib/city-walk-service.ts` 直连 `restapi.amap.com`），沿用仓库已有的 `EXPO_PUBLIC_AMAP_WEB_KEY`；仓库内没有可部署的后端运行时，先保证功能可用。
   适配层已按第 6 节接口形状抽象：配置 `EXPO_PUBLIC_CITY_WALK_API_BASE_URL` 后即改调 `POST /v1/city-walk/candidates` 与 `POST /v1/city-walk/routes`，届时后端持有 Web Service Key，客户端无需改动业务代码。
2. **MVP 暂不支持自定义终点**：路线形状为「环线（回到起点）」或「单程」，与第 12 节推荐默认值一致。
3. **未引入单元测试框架**：仓库当前没有测试运行时（`package.json` 无 test 脚本、CI 无测试步骤），因此第 10 节 Phase 2 要求的用例尚未落地，纯函数（`validateCityWalkPlanDraft`、预算裁剪、`city-walk-storage` 归一化）已按可测试方式拆分。

### 15.3 待办

- 建立带测试运行时的用例集（候选校验、未知 poiId、重复站点、预算裁剪、空路线）。
- 部署后端代理并切换 `EXPO_PUBLIC_CITY_WALK_API_BASE_URL`，从客户端构建中移除对 Web Service Key 的依赖。
- 途经点抵达时一键写入普通时间线条目；旅程详情页展示关联的 City Walk 方案。
- iOS 真机验证（当前 iOS 高德 Key 仍为占位值）；长路线地图渲染与手势冲突回归。
- 如需服务端统一编排 AI、跨设备同步或 MCP 适配，再评估第 4.2 节方案。


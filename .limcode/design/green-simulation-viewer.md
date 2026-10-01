# 小手机格林推演只读页面方案

## 1. 目标与边界

- 在小手机中新增一个系统 App「格林推演」，只读展示 shujuku 格林推演（world simulation）的当前世界状态。
- 只读：不写回任何 `_qrf_world_*` 字段，不调用数据库内部函数，也不触发推演。
- 数据库没有对外接口，所以直接读取 SillyTavern 聊天数组。字段格式变化由小手机自己承担，读取失败时显示降级提示，不报错。
- 第一版不做：partial 草稿栏目、Agent 会话记录（`_agent_chat`）、推演材料（`_agent_materials`）、用户要求清单、待修复条目的编辑。

## 2. 数据来源（已核实）

推演账本的权威数据在各个 assistant 楼层的 `_qrf_world_simulation_state` 中，需要从第一层叠加到最后一层（`simulation-ledger-fold.ts:508`）。

### 2.1 楼层字段结构

```
message._qrf_world_simulation_state = {
  schemaVersion: 1,
  entries: {
    [bucketKey]: { anchor: { chatIdentity, messageIndex, messageId, messageKey, swipeId, contentDigest }, value, updatedAt }
  }
}
```

- `bucketKey = sha256(chatIdentity \n messageKey \n swipeId \n contentDigest)`（`simulation-store.ts:811-813`）
- `messageKey = "<typeof messageId>:<messageId>"`，其中 messageId 取 `message.message_id`，缺失时用楼层下标；`swipeId` 取 `message.swipe_id`，缺失时为 `'0'`（`simulation-store.ts:827-836`）
- `value` 有两种形态：
  - 完整账本 `WorldSimulationLedger_ACU`：判定条件是 `schemaVersion` 为整数且不是帧
  - 账本帧 `{ schemaVersion: 2, checkpoint?, checkpointPartials?, deltas: Delta[] }`（`simulation-ledger-fold.ts:44, 73-79`）

### 2.2 叠加规则（`simulation-ledger-fold.ts:423-436, 508-578`）

- 遇到完整账本或带 `checkpoint` 的帧时，重置为该基线。
- 依次应用 `deltas`：
  - 数组模块 `dimensions/seeds/actors/chronicle/rumors` 按 `id` upsert 和 remove，`chronicleOverview` 按 `fingerprint`。
  - `clock/player/guidance/materialCompletion/pendingFixes` 整体替换。
  - `revision` 取 delta 的值。
- `fieldUpserts` 是逐栏写入，用于 partial 草稿。第一版忽略，只展示完整账本。

### 2.3 编年史归档

`_qrf_world_simulation_chronicle_archive` 采用相同的分桶和帧结构，帧形态为 `{ schemaVersion: 2, checkpoint?: { records }, deltas: [{ seq, records }] }`。记录结构是 `{ archiveRef, day, summary, fingerprints, relatedIds, sourceChronicleIds }`（`agent-model.ts:87-98`）。总览行通过 `chronicleOverview[].archiveRef` 关联到这里。

### 2.4 账本内容（`model.ts:62-145`）

| 模块 | 关键字段 | 防剧透相关 |
|---|---|---|
| clock | day、slot、storyTime、precision | 无 |
| dimensions | name、kind(pressure/growth)、value、trend、rationale | 无 |
| seeds | title、status、level、catalyst、actorIds、location、expiresAtDay、missedOutcome、exposePolicy | `visibility` |
| actors | name、location、life、goals、resources、constraints、knownFacts、currentAction、longTermAction、experiences(≤30) | `visibility` |
| chronicle | at、summary、relatedIds、missedNote | missedNote 属于幕后信息 |
| chronicleOverview | day、oneLine、archiveRef | 无 |
| rumors | fact、originDay、earliestRevealDay、channels、status(latent/ripe/revealed/dead) | `status` 和 `earliestRevealDay` |
| player | location、regionVisits、contact(open/secluded) | 无 |
| guidance | signals[{ text, voice }]、excludedFacts | 无 |
| materialCompletion | state(complete_changed/complete_no_change/partial/failed) | 无 |

## 3. 关键设计决策

### D1：swipe 匹配不计算 sha256

数据库用同步 sha256 计算 bucketKey，小手机仓库里只有异步实现 `sha256Text`（`modules/qq-v2/resources/content-hash.js:69`）。不过每个 entry 都存有一份 anchor，小手机可以遍历 `entries`，按以下条件匹配：

- `anchor.messageKey === 当前 messageKey`
- `anchor.swipeId === 当前 swipeId`

这样匹配不需要哈希，也不依赖 `chatIdentity` 的计算方式。

代价：数据库还会校验 `contentDigest`，楼层正文被编辑后，数据库会把该楼视为没有数据，小手机仍会读到。只读展示可以接受这个差异。如果同一 messageKey 加 swipeId 命中多个 entry，取 `updatedAt` 最大的那个。

### D2：只读、容错

- 单层楼结构损坏时，跳过该楼并记一条诊断，继续往后叠加。数据库在这种情况下会直接拒绝加载，小手机的处理更宽松。
- 整体读不出数据时，显示「当前聊天没有格林推演数据」。
- 字段缺失时按空值显示，不抛异常。

### D3：防剧透，默认开启

页面顶部提供「上帝视角」开关，默认关闭，保存在 `phoneSettings` 中。关闭时的过滤规则：

- seeds 和 actors 只显示 `visibility !== 'hidden'` 的条目；`limited` 的条目加「部分可知」标记。
- rumors 只显示 `status === 'revealed'` 的条目。
- chronicle 隐藏 `missedNote`。
- 被隐藏的条目只显示数量，例如「另有 3 条未揭示」。

### D4：刷新时机

- 进入页面时读取一次。
- 页面打开期间，监听 `CHAT_CHANGED`、`MESSAGE_RECEIVED`、`MESSAGE_UPDATED`、`MESSAGE_SWIPED`、`MESSAGE_DELETED`，200ms 防抖后重新叠加。
- 监听通过 `event-bridge.js` 的 `onEvent` 注册，退出页面时用 `registerRoutePageCleanup` 释放，避免监听泄漏。参考 `route-renderer.js:378-382` 中 settings 的写法。

## 4. 页面结构

使用已登记的 iOS 分组样式（`docs/phone-ui-variables.md:151-175`），不新增样式体系。

- 顶部摘要卡（`.phone-ios-group`）：第 N 天、时段、剧情时间、主角所在地点、本轮推演状态徽标（`.phone-ios-badge`，partial 或 failed 时显示 `.is-danger`）、上帝视角开关。
- 模块列表：每个模块一个 `.phone-ios-group`，分组标题带条目数，条目使用 `.phone-ios-row`。条目较多的模块用 `.phone-ios-details` 折叠。模块超过 3 个，不使用 `.phone-ios-seg`。
  1. 世界维度：名称、数值、趋势箭头
  2. 剧情种子：标题、状态徽标、等级
  3. 人物：名称、生死状态、所在地、当前行动
  4. 编年史：总览按天列出一句话，点开显示归档详情
  5. 传闻
  6. 引导信号
- 详情：点击条目时用 `showSettingsSheet()` 打开底部面板，显示全部字段，id 引用（actorIds、relatedIds）尽量换成名称。

## 5. 代码落点

| 文件 | 改动 |
|---|---|
| `modules/green-simulation/ledger-reader.js`（新增） | 纯函数：`readSimulationLedger(chat)` 返回 `{ ledger, archive, diagnostics }`，包含 D1 和 D2 的逻辑，不依赖 DOM |
| `modules/green-simulation/spoiler-filter.js`（新增） | 纯函数：按 D3 过滤并统计被隐藏的数量 |
| `modules/green-simulation/index.js`（新增） | App 定义常量（`__green_simulation__`）、图标、页面渲染、事件订阅 |
| `modules/phone-home/view-model.js` | 参照 `VARIABLE_MANAGER_APP` 推入图标，遵守 `hiddenTableApps` 和 `appIcons` |
| `modules/phone-core/route-renderer.js` | 新增 `route === 'green-simulation'` 分支，动态 import，注册清理函数 |
| `modules/settings-app/services/appearance-settings/icon-slots.js` | 登记系统 App 图标槽 |
| `docs/phone-ui-variables.md` | 只有新增公共类时才需要登记，预计不需要 |
| `scripts/check-green-simulation.cjs`（新增） | 契约检查，详见下节 |

## 6. 验证

- 仓库没有单测框架，沿用 `scripts/check-*.cjs` 契约脚本，由 `npm run check` 统一执行。
- `check-green-simulation.cjs` 用构造的 chat fixture 覆盖以下情况：
  - 完整账本基线
  - 帧中的 checkpoint 加 deltas 叠加，包括 upsert、remove、单例替换
  - 跨楼层叠加，后面的基线覆盖前面的
  - 只取当前 swipe，其他 swipe 的数据不混入
  - 损坏楼层被跳过并产生诊断
  - 没有数据时返回空结果
  - 防剧透过滤和隐藏计数
- 之后运行 `npm run lint`、`npm run check`、`npm run build`，确认 `dist/` 产物已更新。
- 需要人工验证：在装有 shujuku 并跑过推演的真实聊天里打开页面，与数据库自带的推演界面对比 day 和条目数。这一步我无法在本地完成。

## 7. 未核实与风险

- 编年史归档的叠加实现（`simulation-ledger-fold.ts:578` 之后）只看了类型，没有逐行读。假设它与账本一样是「基线加 deltas，records 按 key 合并」，实现前需要补读确认。
- 小手机的 `CHAT_CHANGED` 常量值是 `'chat_id_changed'`，还没有和宿主对照。
- 没有核实是否存在 `MESSAGE_SWIPED` 的现成封装，计划直接使用 `onEvent`。
- 体积：长聊天的帧可能很大，每次刷新都会全量叠加。第一版接受这个开销，如果卡顿再按楼层做增量缓存。
- 格式漂移：数据库升级可能改变 `schemaVersion` 或字段名。读取器只认 bucket `schemaVersion: 1` 和帧 `schemaVersion: 2`，遇到未知版本时页面提示「数据库格式已更新，请升级小手机」。

## 8. 待助手确认

1. App 名称和路由叫「格林推演」/ `green-simulation` 可以吗？
2. 防剧透默认开启（上帝视角默认关闭）可以吗？
3. 第一版的模块范围（第 4 节 1-6）是否需要增减？例如要不要显示待修复条目，或推演 AI 的对话记录。

### 背景

Cursor 内置了原生的月度额度组件（Glass 模式下为输入框右下角与 `Context` 并排的环形进度按钮 + 点击展开的进度条抽屉卡片；Desktop 模式下为输入框下方的状态栏 + 悬浮气泡卡片），但对企业版（Enterprise）账号存在 3 个数据层限制：

1. `usageDataService` 调用 `getCurrentPeriodUsage(new WZr)` 时未传 `teamId` 与 `includePooledUsage: true`，服务端对企业账号仅返回 `{ displayThreshold: 100 }` 空数据。
2. 服务端对企业账号下发 `enabled: false` 且 `displayThreshold: 200`，导致组件与设置项均被隐藏。
3. 企业账号的个人月度限额存放在 `spendLimitUsage.overallUsed / overallLimit`（美分）中，而原版 `applyCurrentPeriodUsageResponse` 只解析了 `planUsage`。

### 改动（最小数据层补丁，零 UI/样式侵入）

不修改任何 React 组件或 CSS 样式，仅在 `usageDataService` 单点完成：

1. 在 `performFetchSilent` 与 `performFetch` 调用 `getCurrentPeriodUsage` 时传入 `{ teamId: this.cursorAuthenticationService.getTeamId(), includePooledUsage: true }`。
2. 在 `applyCurrentPeriodUsageResponse` 入口处，若存在 `spendLimitUsage.overallLimit`，将其映射至 `planUsage`，并设置 `enabled = true`、`displayThreshold = 0`。

### 效果

完全使用 Cursor 自带原生样式：

- **Glass 模式**：输入框右下角（`Context` 圆环左侧）显示原生 `Usage` 环形进度图标，悬停显示原生 `Usage 55%` 提示，点击展开原生 `Usage · Resets <日期>` 抽屉卡片，内含 `Included  $276.61 / $500` 进度条与 `View Plan and Limits` 按钮。
- **Cursor 设置**：`Settings -> Agents -> Conversation` 中原生 `Usage Summary`（`Auto` / `Always` / `Never`）开关自动恢复可见。

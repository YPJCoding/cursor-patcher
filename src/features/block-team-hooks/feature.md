# block-team-hooks

屏蔽企业团队下发的受管 Hooks（Team Managed Hooks），阻止 Cursor 自动从服务端拉取团队钩子脚本到 `~/.cursor/managed/team_<id>/hooks/` 并在各个 Agent 生命周期事件（如 `beforeSubmitPrompt`、`beforeReadFile`、`afterShellExecution`、`postToolUse` 等）中执行上报。

## 现象与原因

当登录企业版（Enterprise）账号时，`CursorHooksService` 会在启动及后台定时轮询时执行 `_doRefreshTeamHooks()`：
1. 调用 `dashboardClient().getTeamHooks({activeOnly:!0})` 拉取团队管理员配置的全部 Hook 脚本；
2. 将脚本写入本地 `~/.cursor/managed/team_<teamId>/hooks/` 并赋予可执行权限；
3. 注册进内存 `this.teamHooks`，在每次对话、思考、读写文件、执行终端命令时自动拉起子进程将原始数据通过 `stdin` 传给脚本。

## 改动

在 `CursorHooksService._doRefreshTeamHooks()`（`glass` 与 `desktop` 各 1 处）中，将：

```js
const n=await(await this.cursorAuthenticationService.dashboardClient()).getTeamHooks({activeOnly:!0}),i=await this._getBackendOS()
```

替换为：

```js
const n={hooks:[]},i=await this._getBackendOS()
```

随后逻辑自然进入原有的空分支：

```js
if(s.length===0){
  this.logger.logInfo("No active team hooks found for OS"),
  this._recordTeamHooksLoad({teamId:t,hasHooks:!1}),
  this._settleInitialTeamRefresh();
  return
}
```

这样既不会请求服务端、不会在本地写入或执行任何团队脚本，又能正常触发 `_settleInitialTeamRefresh()` 释放 `_hooksReady` 锁，不影响用户自己的本地/项目级 Hooks。

# block-nudge-rpc

让 Cursor 在新建对话时不再请求"模型推荐(nudge)",从而避免团队策略把模型重置为 Auto
(提示 *Model reset to Auto due to team settings*)。

## 现象与原因

新建对话时,客户端调用 RPC `getNewChatNudgeParameterizedModelPicker`。服务器返回一个 `nudge`:
`nudgeId`、`targetModel`(模型 id 和参数)、`experimentName`、提示文案、展示方式(`ask` 弹窗 / `bump` 横幅 / 静默)。
团队管理员开启 Impose Auto 后,返回的目标就是 Auto。客户端据此改写模型配置并弹出提示。

## 改动

目标是 `agentClientService` 里的封装方法,**glass 和 desktop 两个文件各 1 处**:

```js
async getNewChatNudgeParameterizedModelPicker(t,e,n){
  const i=await this.backendClient.get(t);
  return W6e(i,{injectTraceHeaders:!0}).getNewChatNudgeParameterizedModelPicker(t,new j7a({...}))
}
```

在函数体开头插入 `return{};`,原函数体保留但不再执行:

```js
async getNewChatNudgeParameterizedModelPicker(t,e,n){return{};const i=await ...
```

调用方拿到 `{}`,`.nudge` 为 `undefined`。所有调用方对"nudge 为空"本来就有提前返回的分支:

- glass 的静默新对话函数:`if(!M||!M.nudgeId||!M.targetModel?.modelId||!M.variant.case)return{modelConfig:o}`
- glass / desktop 创建 composer 之后的内联块:`if(!re||!re.nudgeId||...)return`

所以不需要改调用方。

## 稳定锚点

- 方法名 `getNewChatNudgeParameterizedModelPicker`(RPC 名,不会被压缩)。
- 函数体结构:`const X=await this.backendClient.get(<第一个参数>);return Y(X,{injectTraceHeaders:!0}).getNewChatNudgeParameterizedModelPicker(`。

局部变量名每版都会变,正则用 `[\w$]+` 加反向引用,不依赖具体名字。
前瞻(`(?=...)`)要求函数体正是上面的结构,否则不匹配。命中次数必须正好 1 次。

## 不在本补丁范围内

客户端还有另外两个相关 RPC:`GetDefaultModelNudgeData` 和 `GetLastDefaultModelNudge`。
服务器会借它们下发 `shouldDefaultSwitchOnNewChat` 和 `modelsWithNoDefaultSwitch`,客户端写入本地
`aiSettings.modelDefaultSwitchOnNewChat`。当该值为真、`modelNudgesEnabled` 为真、且当前模型不在白名单时,
新对话会被切到 `default`(Auto),日志里会出现 `Model reset to default on new chat`。

如果应用补丁后仍被重置,先看日志里是否有这一行。有,就是这条机制,需要另外处理。

## 审查清单

- [ ] `check` 显示 glass 和 desktop 各命中 1 次,语法检查通过。
- [ ] 修改处是 `async getNewChatNudgeParameterizedModelPicker(...)` 的函数体开头,不是 RPC 的 schema 定义,
      也不是 `agentClientService.getNewChatNudgeParameterizedModelPicker(...)` 的调用处。
- [ ] 新建对话,确认不再出现 *Model reset to Auto*,模型和参数保持你上次选的。
- [ ] 日志目录 `~/Library/Application Support/Cursor/logs/<最新>/` 里没有
      `SyntaxError|Unexpected token|corrupt|TypeError|ReferenceError`。

## 失效情形

| 变化 | 结果 |
|---|---|
| 变量名变化 | 不受影响 |
| 方法改名 / 改成箭头函数 / 不再是 async | 命中 0 次,报错中止,不写入 |
| 函数体不再是"取 backendClient 再调用同名 RPC" | 命中 0 次,报错中止,不写入 |
| 出现多处同名实现 | 命中数不为 1,报错中止,不写入 |
| 服务端改用别的 nudge 接口 | **无声失效**:补丁仍命中,但拦的是旧路径。只能靠实际新建对话来发现 |

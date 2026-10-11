# Cursor 升级后的适配流程

补丁按"意图加不变量"定位:方法名、属性名、字符串字面量和代码结构不变,压缩后的局部变量名每版都变。
正则只依赖前者。

## 1. 先看状态

```bash
node scripts/cursor-patcher.js status
node scripts/cursor-patcher.js check
```

- 升级会覆盖被改过的文件,`status` 会显示"原版"。
- 版本不在 `src/verified-versions.json` 时,`apply` 会拒绝执行(`--force` 可跳过)。

## 2. 结果判断

| `check` 的输出 | 含义 | 动作 |
|---|---|---|
| 各文件命中 1 次,语法通过 | 锚点没变 | 第 4 步验证后加入已验证版本 |
| 命中 0 次 | 方法名或函数体结构变了 | 第 3 步 |
| 命中 2 次以上 | 出现同名实现 | 第 3 步,收紧前瞻条件 |
| 语法检查失败 | 插入位置不对 | 第 3 步 |

**不要放宽正则硬凑。** 命中 0 次是在告诉你代码意图变了,要重新读代码再改写。

## 3. 重新定位

1. 在新版 JS 里搜方法名:

   ```bash
   rg -o '.{200}getNewChatNudge[A-Za-z]*.{300}' \
     /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.glass.main.js
   ```

2. 分清三类出现位置:RPC 的 schema 定义(`{name:"GetNewChat...",I:...,O:...,kind:...}`)、
   `agentClientService` 的封装实现、各调用方。要改的是**封装实现**。
3. 如果方法改了名,按"客户端向服务器请求新对话推荐"的语义找到新名字;
   如果封装消失、调用方直接请求,就要在每个调用方里处理。
4. 修改 `src/patches/block-nudge-rpc.js` 的正则,同步 `docs/patches/block-nudge-rpc.md`,
   在 `test/` 里加一个取自新版本的代码片段,保证旧片段的测试仍然通过。
5. `npm test`,再 `check`,确认两个文件各命中 1 次。

## 4. 验证并登记

1. 完全退出 Cursor(`pgrep -lx Cursor` 应无输出)。
2. `node scripts/cursor-patcher.js apply --force`。
3. 重新启动,新建对话,确认不再出现 *Model reset to Auto*。
4. 检查日志里没有 `SyntaxError|Unexpected token|corrupt|TypeError|ReferenceError`。
5. 全部正常后,把版本号加入 `src/verified-versions.json`,重新 `node scripts/build.js`。

## 5. 出问题时

```bash
node scripts/cursor-patcher.js restore
```

还原需要与当前版本一致的备份。没有就重新安装 Cursor。

## 6. 代码签名

`/Applications/Cursor.app` 带代码签名,修改里面的文件后 `codesign --verify` 会失败。
应用补丁后如果 Cursor 无法启动,或提示应用已损坏:

```bash
codesign --verify --deep --strict /Applications/Cursor.app   # 先看现状
xattr -dr com.apple.quarantine /Applications/Cursor.app      # 去掉隔离标记(如有)
```

重新签名(`codesign --force --deep --sign - /Applications/Cursor.app`)会改变应用身份,
可能影响钥匙串授权等,只在确实打不开时使用。

## 7. 防止被自动更新覆盖

`~/Library/Application Support/Cursor/User/settings.json` 里设 `"update.mode": "none"`,手动升级前改回。

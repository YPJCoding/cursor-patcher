---
name: cursor-patcher
description: 本地修补 macOS 上的 Cursor,阻止新对话被团队策略重置为 Auto("Model reset to Auto due to team settings")。当用户提到模型被重置为 Auto、Impose Auto、model nudge、团队设置覆盖了模型选择、新对话不记住上次的模型时使用。
---

# cursor-patcher

给 `/Applications/Cursor.app` 打本地补丁,让新对话不再请求"模型推荐(nudge)",
于是模型和参数保持你上次选的,不会被团队策略改成 Auto。

当前只有一个补丁:`block-nudge-rpc`(原理见 `references/block-nudge-rpc.md`)。

## 用法

```bash
S=scripts/cursor-patcher.js            # 以本技能目录为当前目录
node $S status                         # 版本、是否已验证、文件是否已被修改(只读)
node $S check                          # 演练:内存里应用并做语法检查,不写 app
node $S apply                          # 应用(需先完全退出 Cursor)
node $S apply --force                  # 当前版本未验证时强制应用
node $S restore                        # 还原为官方原版
node $S list                           # 列出补丁
```

`check` 和 `apply` 支持 `--only <id|组,...>` 与 `--except <id|组,...>`。
`CURSOR_APP` 环境变量可指向别的 `.app` 路径(例如测试用的副本)。

## 工作方式

1. 读取 `product.json` 的版本,不在已验证列表里就拒绝(`--force` 才继续)。
2. 每次从官方原版出发:文件没有标记,它就是原版;已标记就用版本一致的备份;都不满足就报错,
   **绝不使用过期备份**。
3. 正则定位,命中次数必须正好 1 次;随后对结果做 `node --check`。
4. 任何一步失败都不写入 app。
5. 备份先落盘,补丁文件再原子写入(失败回滚),最后只改 `product.json` 里对应的 checksum 值。

## 不能省的三条

1. 应用前先跑 `check`,并确认 Cursor 已完全退出(`pgrep -lx Cursor` 无输出)。
2. 补丁命中失败时,**不要放宽正则硬凑**。按 `references/upgrade.md` 重读新版本代码,按意图改写。
3. 补丁能打上不等于有效。每次应用或升级后,必须新建一个对话,确认不再出现 *Model reset to Auto*。

## 版本升级后

Cursor 升级会覆盖被修改的文件。先 `status` 和 `check`:

- 各文件命中 1 次、语法通过:`apply --force`,验证后把版本加入已验证列表。
- 命中 0 次或多次:锚点变了,走 `references/upgrade.md`。

## 排查

- 日志:`~/Library/Application Support/Cursor/logs/<最新>/`,
  `rg -i 'SyntaxError|Unexpected token|corrupt|TypeError|ReferenceError'`。
- 提示 `installation appears to be corrupt`:`restore` 后重启,再重新 `apply`;checksums 必须在文件写完之后同步。
- 应用补丁后仍被重置到 Auto:看日志是否有 `Model reset to default on new chat`。
  有则是另一条机制(`modelDefaultSwitchOnNewChat`),不在本补丁范围,见 `references/block-nudge-rpc.md`。
- 应用无法启动或提示已损坏:见 `references/upgrade.md` 的"代码签名"一节。
- 防止被自动更新覆盖:`settings.json` 里设 `"update.mode": "none"`,手动升级前改回。

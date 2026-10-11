# Cursor 升级后的适配流程

补丁按"意图加不变量"定位:方法名、属性名、字符串字面量和代码结构不变,压缩后的局部变量名每版都变。
正则只依赖前者。每个功能分别适配、分别验证,互不影响。

## 1. 先看状态

```bash
node src/cli.js status
node src/cli.js check
```

- 升级会覆盖被改过的文件,`status` 会显示"原版"。
- 功能对当前版本不在它自己的 `src/features/<id>/verified.json` 里时,`apply` 会拒绝执行该功能(`--force` 可跳过)。

## 2. 结果判断

| `check` 的输出 | 含义 | 动作 |
|---|---|---|
| 各文件命中 1 次,语法通过 | 锚点没变 | 第 4 步验证后加入该功能的已验证版本 |
| 命中 0 次 | 方法名或函数体结构变了 | 第 3 步 |
| 命中 2 次以上 | 出现同名实现 | 第 3 步,收紧前瞻条件 |
| 语法检查失败 | 插入位置不对 | 第 3 步 |

**不要放宽正则硬凑。** 命中 0 次是在告诉你代码意图变了,要重新读代码再改写。

## 3. 重新定位

先读失配功能的 `src/features/<id>/feature.md`:里面写了目标位置、稳定锚点和失效情形。

1. 在新版 JS 里按 `feature.md` 里的锚点(方法名、属性名、字符串字面量)搜索:

   ```bash
   rg -o '.{200}<锚点>.{300}' \
     /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.glass.main.js
   ```

2. 分清定义、实现、调用方,确认要改的是 `feature.md` 里说的那一处。
3. 如果锚点改了名,按功能的**意图**找新位置;如果结构整体变了,可能要重新设计改法。
4. 修改 `src/features/<id>/feature.js` 的正则,同步 `feature.md`。
5. 用 `npm run fixture -- <id> "<起始字符串>"` 提取新版本的 fixture,放进 `fixtures/<新版本>/`。
   **保留旧版本的 fixture**,保证旧版本的测试仍然通过。
6. `npm test`,再 `check`,确认各文件命中 1 次。

## 4. 验证并登记

1. 完全退出 Cursor(`pgrep -lx Cursor` 应无输出)。
2. `node src/cli.js apply --only <id> --force`。
3. 重新启动,**实际使用**,确认功能效果(各功能的确认方法见它的 `feature.md` 审查清单)。
4. 检查日志里没有 `SyntaxError|Unexpected token|corrupt|TypeError|ReferenceError`。
5. 全部正常后,把版本号加入 `src/features/<id>/verified.json`,运行 `npm run docs`,重新 `npm run build`。

## 5. 出问题时

```bash
node src/cli.js remove <id>   # 只移除出问题的功能,其余保留
node src/cli.js restore       # 还原全部
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

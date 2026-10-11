# 架构

## 分工

**引擎(`src/engine/`)不认识任何具体功能,功能(`src/features/<id>/`)不碰任何文件系统。**

| 模块 | 职责 |
|---|---|
| `locate.js` | 定位 app,读取版本,给出目标文件路径(`glass`、`desktop`) |
| `gate.js` | 版本闸门:每个功能各自记录已验证的版本 |
| `source.js` | 判断"原版"在哪里:当前文件、还是备份 |
| `apply.js` | `h.sub`(命中计数)、`applyPatches`、`syntaxCheck` |
| `plan.js` | 集合式应用的规划:算出每个文件该带哪些功能,生成结果并检查,**不写 app** |
| `write.js` | 原子写入与多文件事务(失败回滚) |
| `checksums.js` | 同步 `product.json` 的 checksum |
| `commit.js` | `apply` / `remove` / `restore` 的实际写入 |

功能只暴露一个形状:

```js
{ id, group, summary, files: ["glass" | "desktop"], intent, apply(src, h), draft? }
```

`apply` 收到源码字符串和辅助对象 `h`,返回新的源码字符串。它不读写文件。

## 数据流

```
CLI ─▶ resolveTargets ─▶ plan ─▶ commitPlan
         │                 │          │
         │                 │          ├─ 备份(首次修改)
         │                 │          ├─ 原子写入目标文件
         │                 │          ├─ 同步 checksums
         │                 │          └─ 已还原的文件删除备份
         │                 └─ 原版 ─▶ 依次应用功能 ─▶ 命中计数 ─▶ node --check
         └─ 目标集合 = 已有 ∪ 要求 − 移除
```

`check` 走到 `plan` 为止;任何环节出错都在写入之前中止。

## 集合式应用

每个文件的目标集合 = 文件标记里已有的功能 ∪ 本次要求的功能 − 本次要移除的功能。

- **总是从原版重新生成。** 不在已修改的文件上叠加,所以结果只取决于集合,与应用顺序无关。
- `apply` 是增量的:再加一个功能不会丢掉之前的。
- `remove` 只去掉指定的;某个文件的集合变空就还原成原版并删除备份。
- 两个功能争同一处代码时,按注册表顺序靠后的那个会因为锚点已被改而命中 0 次,整体中止、零写入。
  处理办法是合并成一个功能,或调整锚点。
- 文件里已有当前程序不认识的功能 id 时,拒绝重新生成(只能 `restore`),避免静默丢失。
- 版本闸门只检查本次要添加的功能。

## 标记与备份

- 已修改的文件以一行标记开头:`/*cursor-patcher:v=<版本>;ids=<功能id,...>*/`。
- 备份是同目录的 `<文件名>.cursor-patcher.bak`,开头带同样格式的版本戳(`ids` 为空),其余是原版内容。
  还原时去掉这一行,就与原版逐字节一致。
- 备份只在首次修改时创建;之后始终以它为原版。
- 备份版本与当前版本不一致时拒绝使用。**绝不使用过期备份**,只能重新安装 Cursor。
- 临时文件是同目录的 `.<文件名>.cursor-patcher.tmp`,写完 rename 覆盖。

## checksums

- 算法:sha256,base64,去掉末尾 `=`。
- 只更新 `product.json` 里已存在的键(目前 glass 没有条目,所以只有 desktop)。
- 用文本替换那一个值,不重新序列化,其余内容逐字节不变。
- 必须在目标文件写完之后才计算,否则 Cursor 会提示 `installation appears to be corrupt`。

## 功能的发现与草稿

- `src/features/index.js` 扫描 `src/features/*/feature.js`,并附上同目录的 `verified.json`。
  新增功能不需要登记。目录名必须等于 `id`。
- `validate.js` 在加载时校验形状,出错时 CLI 给出一行说明并退出。
- 单文件打包时没有文件系统可扫,`scripts/build.js` 把 `features/index.js` 换成等价的静态列表。
- `draft: true` 的功能不参与默认的 `check` / `apply`,只在 `--only <id>` 点名时生效,且不要求 fixtures。
  脚手架生成的功能默认是草稿,避免半成品影响日常使用。

## 测试

| 测试 | 覆盖 |
|---|---|
| `test/features.test.js` | **按功能自动运行**:形状校验、有文档、每个 fixture 命中 1 次且语法有效;按功能的版本闸门 |
| `test/commit.test.js` | 在临时假 app 上测 apply / restore / 回滚 / 过期备份 |
| `test/sets.test.js` | 集合式应用:增量、顺序无关、移除、冲突、闸门 |
| `test/scaffold.test.js` | 脚手架、草稿选择规则、花括号提取 |
| `test/block-nudge-rpc.test.js` | 功能特有的失败场景 |
| `test/docs.test.js` | README 功能表与代码一致 |

所有写入类测试都在临时目录里进行,不触碰真实的 Cursor。

## 不做的事

- 不支持外部插件或运行时加载功能:功能都在仓库里,构建时打进单文件。
- 不自动重新签名应用(会改变应用身份),见 `docs/upgrade.md` 的"代码签名"。
- 不自动适配新版本:锚点失配时需要人(或智能体)按 `docs/upgrade.md` 重读代码。

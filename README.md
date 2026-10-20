# cursor-patcher

给 macOS 上的 Cursor 打**本地补丁**的小工具。每个补丁是一个自包含的"功能",可以单独添加、单独移除,
随时还原成官方原版。零运行时依赖,只需要 Node。

## 功能

<!-- features:start -->
| 功能 | 组 | 目标文件 | 已验证的 Cursor 版本 | 说明 |
|---|---|---|---|---|
| [block-nudge-rpc](src/features/block-nudge-rpc/feature.md) | nudge | glass + desktop | 3.24.12, 3.25.9 | 新对话不再请求服务器的模型推荐,避免被团队策略重置为 Auto |
| [show-usage-limit](src/features/show-usage-limit/feature.md) | usage | glass + desktop | 3.25.9 | 针对企业账号激活 Cursor 原生底部额度圆环与点击进度条卡片（零样式改动） |
<!-- features:end -->

功能表由 `npm run docs` 根据代码自动生成,不要手工编辑。每个功能的原理、锚点和失效情形见各自的 `feature.md`。

## 日常用法

```bash
node src/cli.js status                    # Cursor 版本、各功能是否已验证、文件是否已被修改(只读)
node src/cli.js list                      # 所有功能
node src/cli.js check                     # 演练:在内存里应用并做语法检查,不写 app
node src/cli.js apply                     # 应用(需先完全退出 Cursor)
node src/cli.js apply --force             # 当前版本对某功能尚未验证时强制应用
node src/cli.js apply --only <id|组,...> # 只加这些功能(在已有功能基础上增量添加)
node src/cli.js remove <id,...>           # 只移除这些功能,其余保留
node src/cli.js restore                   # 还原为官方原版
```

也可以先打包成单文件,复制到任何有 Node 的机器上使用:

```bash
npm run build                  # 产出 dist/cursor-patcher.js
node dist/cursor-patcher.js status
```

环境变量 `CURSOR_APP` 可指向别的 `.app` 路径(默认 `/Applications/Cursor.app`)。
指定它时不检查 Cursor 是否在运行,便于在副本上测试。

## 它怎么保证安全

- **总是从官方原版出发**:文件没有标记就是原版;已标记就用版本一致的备份;都不满足就报错,不使用过期备份。
- **命中次数必须正好 1 次**,否则整个流程中止,一个字节都不写。
- 生成结果先做 `node --check`,通过才写入。
- 备份先落盘,文件原子写入,中途失败会回滚。
- 写完之后才同步 `product.json` 里对应的 checksum(只改那一个值,其余逐字节不变)。
- `restore` 之后与原版逐字节一致。
- 版本闸门:功能对当前 Cursor 版本未验证时拒绝应用(`--force` 可跳过)。

## 应用补丁之后

- 补丁能打上不等于有效。每次应用或升级后,要实际使用确认效果。
- `/Applications/Cursor.app` 带代码签名,修改里面的文件后签名校验会失败。
  应用无法启动时的处理见 [docs/upgrade.md](docs/upgrade.md)。
- 建议在 `settings.json` 里设 `"update.mode": "none"`,避免自动更新覆盖补丁。
- Cursor 升级后补丁会被覆盖,按 [docs/upgrade.md](docs/upgrade.md) 重新验证。

## 开发

```bash
npm test                                   # 全部测试
npm run new:feature -- <id> --group <组>   # 生成新功能骨架(默认是草稿)
npm run fixture -- <id> "<起始字符串>"      # 从当前 Cursor 提取真实代码作为 fixture
npm run docs                               # 更新本文件的功能表
npm run build                              # 打包成单文件
```

| 文档 | 内容 |
|---|---|
| [docs/adding-a-feature.md](docs/adding-a-feature.md) | 新增一个功能的完整步骤和检查清单 |
| [docs/architecture.md](docs/architecture.md) | 引擎与功能的分工、集合式应用、标记与备份约定 |
| [docs/upgrade.md](docs/upgrade.md) | Cursor 升级后的适配流程 |

## 目录

```
src/
├── cli.js              命令分发
├── engine/             与具体功能无关的通用能力
└── features/<id>/      每个功能一个文件夹:feature.js / feature.md / verified.json / fixtures/
templates/feature/      新功能的模板
scripts/                build、new-feature、extract-fixture、update-readme
test/                   引擎测试和按功能自动运行的 fixture 测试
docs/                   架构、新增功能、升级
```

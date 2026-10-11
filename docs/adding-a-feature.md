# 新增一个功能

一个功能就是 `src/features/<id>/` 下的一个文件夹。不需要改引擎、CLI 或测试,也不需要登记。

## 1. 生成骨架

```bash
npm run new:feature -- <id> --group <组> --files glass,desktop
```

- `id`:小写字母、数字和连字符,以字母开头,例如 `block-default-switch`。
- `--files`:要改的文件,`glass` 和 `desktop` 的子集,默认两个都改。
- 生成的是**草稿**:不参与默认的 `check` / `apply`,只在 `--only <id>` 时生效。

得到:

```
src/features/<id>/
├── feature.js      # 写正则
├── feature.md      # 写原理和审查清单
├── verified.json   # { "versions": [] }
└── fixtures/
```

## 2. 找到要改的位置

- 用 `rg` 在 Cursor 的 JS 里搜方法名、属性名或字符串字面量:

  ```bash
  rg -o '.{200}<关键字>.{300}' \
    /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.glass.main.js
  ```

- 分清**定义、实现、调用方**,改的是哪一处。
- 问自己:这件事在两个文件(glass 和 desktop)里是同一处吗?结构不同就分别写。

## 3. 提取 fixture

```bash
npm run fixture -- <id> "<起始字符串>" [--wrap class]
```

- 从起始字符串开始,按花括号配对截取代码块,写到 `fixtures/<版本>/<目标>.js`。
- 起始字符串在每个文件里必须恰好出现 1 次。
- 截取的是类方法时加 `--wrap class`,保证 fixture 是合法的 JS。
- 语法检查未通过时命令会提示;字符串或正则里含大括号会让配对错位,换一个更小的起始点,或手工整理。

## 4. 写 `feature.js`

```js
module.exports = {
  id: "<id>",
  group: "<组>",
  summary: "一句话(单行),会出现在 README 的功能表里",
  files: ["glass", "desktop"],
  intent: "改什么、为什么这样改、锚点是什么",
  apply(src, h) {
    return h.sub(src, /…/g, (m, a, b) => `…`);
  },
};
```

写正则的原则:

1. **只依赖不变量**:方法名、属性名、字符串字面量、代码结构。压缩后的局部变量名每版都变,
   用 `${ID}` 匹配标识符,用反向引用保持前后一致。
2. **用前瞻校验结构**,让"形似但不是目标"的代码不匹配。
3. **`h.sub` 要求命中正好 1 次**(`{ expect: n }` 可改)。多了少了都会抛错,这是有意的安全网。
4. **失配时不要放宽正则硬凑**,要按意图重读新版本代码再改写。
5. 想清楚会不会和别的功能争同一处代码。

## 5. 测试

`apply` 写好后,把 `draft: true` 保持不动,先看:

```bash
npm test
node src/cli.js check --only <id>
```

`check` 要显示各文件命中 1 次、语法检查通过。

然后**删除 `draft: true`**,`test/features.test.js` 会自动对每个版本的每个 fixture 检查:
命中 1 次、结果有变化、语法有效。没有 fixture 时会失败,这是提醒。

建议再给功能加一个只属于它的测试(参考 `test/block-nudge-rpc.test.js`):
方法改名、函数体结构变化、出现多处匹配,这三种情形都应该报错,而不是悄悄改错。

## 6. 写 `feature.md`

按模板填满每一节:现象与原因、改动、稳定锚点、**不在本功能范围内**、审查清单、失效情形。
特别要写清**会无声失效**的情形(补丁仍命中但已经无效),这类问题只能靠实际使用发现。

## 7. 真机验证

1. 完全退出 Cursor(`pgrep -lx Cursor` 应无输出)。
2. `node src/cli.js check --only <id>`,再 `node src/cli.js apply --only <id> --force`。
3. 重新启动,**实际使用**,确认效果。
4. 日志里没有 `SyntaxError|Unexpected token|corrupt|TypeError|ReferenceError`:
   `~/Library/Application Support/Cursor/logs/<最新>/`。
5. 有问题:`node src/cli.js remove <id>`,其他功能不受影响。

## 8. 登记已验证版本并提交

```bash
# 把验证过的 Cursor 版本写进 src/features/<id>/verified.json
npm run docs      # 更新 README 的功能表
npm test
git add -A && git commit
```

## 检查清单

- [ ] `id` 等于目录名,有 `summary`、`group`、`intent`。
- [ ] 删除了 `draft: true`。
- [ ] `fixtures/<版本>/` 里每个目标文件都有真实代码片段。
- [ ] 失配场景(改名、结构变化、多处匹配)有测试。
- [ ] `feature.md` 每一节都填了,写明了无声失效的情形。
- [ ] 真机实际使用确认过效果,再写 `verified.json`。
- [ ] `npm run docs`、`npm test` 通过,每一步单独提交。

#!/usr/bin/env node
"use strict";
// 生成新功能骨架:  node scripts/new-feature.js <id> [--group <组>] [--files glass,desktop]
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = ["glass", "desktop"];

function createFeature({ id, group = "misc", files = TARGETS, root = ROOT }) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id ?? "")) {
    throw new Error(`功能 id 必须是小写字母、数字和连字符,且以字母开头: ${id}`);
  }
  for (const f of files) {
    if (!TARGETS.includes(f)) throw new Error(`未知的目标文件: ${f}(可选: ${TARGETS.join(", ")})`);
  }
  if (files.length === 0) throw new Error("至少要指定一个目标文件");
  const dir = path.join(root, "src", "features", id);
  if (fs.existsSync(dir)) throw new Error(`已存在: ${path.relative(root, dir)}`);

  const vars = {
    id,
    group,
    files: files.map((f) => JSON.stringify(f)).join(", "),
    files_text: files.join(" / "),
  };
  const render = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]);
  const tpl = path.join(root, "templates", "feature");

  fs.mkdirSync(path.join(dir, "fixtures"), { recursive: true });
  for (const name of ["feature.js", "feature.md", "verified.json"]) {
    fs.writeFileSync(path.join(dir, name), render(fs.readFileSync(path.join(tpl, name), "utf8")));
  }
  fs.writeFileSync(path.join(dir, "fixtures", ".gitkeep"), "");
  return dir;
}

function parseArgs(argv) {
  const out = { id: argv[0] };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--group") out.group = argv[++i];
    else if (argv[i] === "--files") out.files = (argv[++i] ?? "").split(",").filter(Boolean);
    else throw new Error(`未知参数: ${argv[i]}`);
  }
  return out;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const dir = createFeature(args);
    const rel = path.relative(ROOT, dir);
    console.log(`已创建 ${rel}/`);
    console.log(`  feature.js     写正则(目前是草稿,不参与默认的 check/apply)`);
    console.log(`  feature.md     写原理和审查清单`);
    console.log(`  verified.json  验证有效后再登记版本`);
    console.log(`  fixtures/      用 npm run fixture 从当前 Cursor 提取`);
    console.log(`\n下一步: npm run fixture -- ${args.id} "<锚点起始字符串>"   然后看 docs/adding-a-feature.md`);
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { createFeature };

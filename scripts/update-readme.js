#!/usr/bin/env node
"use strict";
// 用功能注册表重新生成 README.md 里的功能表(两个标记之间的内容)。
//   node scripts/update-readme.js          写入
//   node scripts/update-readme.js --check  只检查是否最新,不是则退出码 1
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const START = "<!-- features:start -->";
const END = "<!-- features:end -->";

function renderTable(features) {
  const rows = features.map((f) => {
    const versions = f.verified.versions.join(", ") || "未验证";
    const name = f.draft ? `${f.id}(草稿)` : f.id;
    return `| [${name}](src/features/${f.id}/feature.md) | ${f.group} | ${f.files.join(" + ")} | ${versions} | ${f.summary} |`;
  });
  return [
    "| 功能 | 组 | 目标文件 | 已验证的 Cursor 版本 | 说明 |",
    "|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function render(readme, features) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a === -1 || b === -1 || b < a) throw new Error(`README.md 里缺少 ${START} / ${END} 标记`);
  return readme.slice(0, a + START.length) + "\n" + renderTable(features) + "\n" + readme.slice(b);
}

function main() {
  const { features } = require("../src/features");
  const file = path.join(ROOT, "README.md");
  const current = fs.readFileSync(file, "utf8");
  const next = render(current, features);
  if (process.argv.includes("--check")) {
    if (next !== current) {
      console.error("README.md 的功能表不是最新,请运行 npm run docs");
      process.exitCode = 1;
    }
    return;
  }
  if (next !== current) fs.writeFileSync(file, next);
  console.log(next === current ? "README.md 已是最新" : "README.md 功能表已更新");
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { render, renderTable, START, END };

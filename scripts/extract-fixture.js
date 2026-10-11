#!/usr/bin/env node
"use strict";
// 从当前安装的 Cursor 里提取一段真实代码,存成功能的 fixture。
//   node scripts/extract-fixture.js <功能id> "<起始字符串>" [--wrap class|none] [--targets glass,desktop]
//
// 从起始字符串开始,找到其后的第一个 "{",按花括号配对截取到对应的 "}"。
// 起始字符串在每个目标文件里必须恰好出现 1 次,否则报错(并列出次数),避免截错位置。
// --wrap class:  用 class S{ ... } 包起来,适合截取的是类方法。默认 none,适合函数或独立语句。
const fs = require("fs");
const path = require("path");
const { locate } = require("../src/engine/locate");
const { syntaxCheck } = require("../src/engine/apply");

const ROOT = path.resolve(__dirname, "..");

function countOf(src, needle) {
  let n = 0;
  for (let i = src.indexOf(needle); i !== -1; i = src.indexOf(needle, i + needle.length)) n++;
  return n;
}

// 返回从 start 开始、到第一个 "{" 配对的 "}" 为止的代码块。
function extractBlock(src, start, { wrap = "none" } = {}) {
  const n = countOf(src, start);
  if (n !== 1) throw new Error(`起始字符串出现 ${n} 次,需要恰好 1 次`);
  const from = src.indexOf(start);
  const open = src.indexOf("{", from + start.length - (start.endsWith("{") ? 1 : 0));
  if (open === -1) throw new Error("起始字符串之后没有找到 {");
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error("花括号没有配对");
  const block = src.slice(from, end + 1);
  if (wrap === "class") return `class S{${block}}\n`;
  if (wrap === "none") return `${block}\n`;
  throw new Error(`未知的 --wrap: ${wrap}`);
}

function parseArgs(argv) {
  const out = { id: argv[0], start: argv[1], wrap: "none" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--wrap") out.wrap = argv[++i];
    else if (argv[i] === "--targets") out.targets = (argv[++i] ?? "").split(",").filter(Boolean);
    else throw new Error(`未知参数: ${argv[i]}`);
  }
  if (!out.id || !out.start) throw new Error('用法: extract-fixture <功能id> "<起始字符串>" [--wrap class|none] [--targets glass,desktop]');
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const featureFile = path.join(ROOT, "src", "features", args.id, "feature.js");
  if (!fs.existsSync(featureFile)) throw new Error(`没有这个功能: src/features/${args.id}/feature.js`);
  const feature = require(featureFile);
  const loc = locate();
  const targets = args.targets ?? feature.files;
  const dir = path.join(ROOT, "src", "features", args.id, "fixtures", loc.version);
  fs.mkdirSync(dir, { recursive: true });
  for (const t of targets) {
    if (!loc.files[t]) throw new Error(`未知的目标文件: ${t}`);
    const block = extractBlock(fs.readFileSync(loc.files[t], "utf8"), args.start, { wrap: args.wrap });
    const ok = syntaxCheck(block).ok;
    fs.writeFileSync(path.join(dir, `${t}.js`), block);
    console.log(
      `${t.padEnd(8)} ${block.length} 字符 → ${path.relative(ROOT, path.join(dir, `${t}.js`))}` +
        `${ok ? "" : "  ⚠ 语法检查未通过,请检查 --wrap 或起始字符串"}`
    );
  }
  console.log(`Cursor ${loc.version}。fixtures 已写入,运行 npm test 确认命中。`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { extractBlock };

#!/usr/bin/env node
"use strict";
const { locate } = require("./engine/locate");
const { isVerified, verifiedVersions } = require("./engine/gate");
const { inspect } = require("./engine/source");
const { patches } = require("./patches");

const HELP = `cursor-patcher

用法: cursor-patcher <命令> [选项]

命令:
  status   显示 Cursor 版本、是否已验证、各目标文件的修改状态(只读)
  list     列出可用补丁

环境变量:
  CURSOR_APP   Cursor.app 路径(默认 /Applications/Cursor.app)
`;

function cmdStatus() {
  const loc = locate();
  console.log(`Cursor     ${loc.version}  (${String(loc.commit).slice(0, 10)})`);
  console.log(`位置       ${loc.appPath}`);
  console.log(
    `版本闸门   ${isVerified(loc.version) ? "已验证" : "未验证"}` +
      `  (已验证: ${verifiedVersions.join(", ") || "无"})`
  );
  console.log("");
  for (const [name, file] of Object.entries(loc.files)) {
    const i = inspect(file);
    const state = !i.exists
      ? "文件不存在"
      : i.mark
      ? `已修改  v=${i.mark.version}  补丁=${i.mark.ids.join(",") || "无"}`
      : "原版";
    const bak = i.hasBak ? `备份 v=${i.bakVersion ?? "?"}` : "无备份";
    console.log(`${name.padEnd(8)} ${state}  |  ${bak}`);
  }
}

function cmdList() {
  if (patches.length === 0) return console.log("(暂无补丁)");
  for (const p of patches) {
    console.log(`${p.id.padEnd(20)} [${p.group}]  ${p.files.join("+")}`);
  }
}

function main(argv) {
  const cmd = argv[0];
  try {
    switch (cmd) {
      case "status": return cmdStatus();
      case "list": return cmdList();
      case undefined:
      case "-h":
      case "--help": return console.log(HELP);
      default:
        console.error(`未知命令: ${cmd}\n`);
        console.log(HELP);
        process.exitCode = 2;
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exitCode = 1;
  }
}

main(process.argv.slice(2));

#!/usr/bin/env node
"use strict";
const { locate } = require("./engine/locate");
const { isVerified, verifiedVersions } = require("./engine/gate");
const { inspect } = require("./engine/source");
const { patches } = require("./patches");
const { plan, selectPatches } = require("./engine/plan");
const { applyAll, restoreAll } = require("./engine/commit");

const HELP = `cursor-patcher

用法: cursor-patcher <命令> [选项]

命令:
  status   显示 Cursor 版本、是否已验证、各目标文件的修改状态(只读)
  list     列出可用补丁
  apply    应用补丁(需先退出 Cursor;未验证版本需 --force)
  restore  还原为官方原版
  check    演练:在临时内存里应用补丁并做语法检查,不写 app
           选项: --only <id|组,...>  --except <id|组,...>

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

function parseList(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1].split(",").filter(Boolean) : undefined;
}

function cmdCheck(argv) {
  const loc = locate();
  const list = selectPatches(patches, {
    only: parseList(argv, "--only"),
    except: parseList(argv, "--except"),
  });
  console.log(`Cursor ${loc.version}  补丁: ${list.map((p) => p.id).join(", ") || "无"}\n`);
  const results = plan(loc, list);
  let bad = 0;
  for (const r of results) {
    if (r.skipped) {
      console.log(`${r.name.padEnd(8)} 跳过(没有适用的补丁)`);
      continue;
    }
    if (r.error) {
      bad++;
      console.log(`${r.name.padEnd(8)} 失败  ${r.error}`);
      continue;
    }
    console.log(`${r.name.padEnd(8)} 通过  原版来源=${r.original.kind}  语法检查=通过`);
    for (const rep of r.report) {
      console.log(`  - ${rep.id}: 命中 ${rep.hits} 次`);
      for (const a of rep.audit) {
        console.log(`      位置 ${a.at}\n      前: ...${a.before}...\n      后: ...${a.after}...`);
      }
    }
  }
  console.log(bad ? `\n演练失败(${bad} 个文件),未写入任何内容。` : "\n演练通过,未写入任何内容。");
  if (bad) process.exitCode = 1;
}

// 指定了 CURSOR_APP(例如测试用的副本)时不检查 Cursor 是否在运行
const skipProcessCheck = () => Boolean(process.env.CURSOR_APP);

function cmdApply(argv) {
  const loc = locate();
  const list = selectPatches(patches, {
    only: parseList(argv, "--only"),
    except: parseList(argv, "--except"),
  });
  const r = applyAll(loc, list, { force: argv.includes("--force"), skipProcessCheck: skipProcessCheck() });
  if (r.forced) console.log("注意: 当前版本未验证,已按 --force 继续。");
  for (const x of r.results) {
    if (x.skipped) continue;
    console.log(`${x.name.padEnd(8)} 已写入  ${x.report.map((p) => `${p.id}×${p.hits}`).join(", ")}`);
  }
  console.log(`checksums 已更新: ${r.checksumsChanged.join(", ") || "无变化"}`);
  console.log("完成。重新启动 Cursor 后新建对话验证。");
}

function cmdRestore() {
  const r = restoreAll(locate(), { skipProcessCheck: skipProcessCheck() });
  console.log(r.restored.length ? `已还原 ${r.restored.length} 个文件` : "已经是原版,无需还原");
  console.log(`checksums 已更新: ${r.checksumsChanged.join(", ") || "无变化"}`);
}

function main(argv) {
  const cmd = argv[0];
  try {
    switch (cmd) {
      case "status": return cmdStatus();
      case "list": return cmdList();
      case "check": return cmdCheck(argv.slice(1));
      case "apply": return cmdApply(argv.slice(1));
      case "restore": return cmdRestore();
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

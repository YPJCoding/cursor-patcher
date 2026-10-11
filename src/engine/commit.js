"use strict";
// 真正写入 app:apply(应用补丁)与 restore(还原)。
const fs = require("fs");
const { execFileSync } = require("child_process");
const { inspect, makeMark, MARK_RE } = require("./source");
const { plan } = require("./plan");
const { checkGate } = require("./gate");
const { writeAll } = require("./write");
const { syncChecksums } = require("./checksums");

function cursorRunning() {
  try {
    execFileSync("pgrep", ["-x", "Cursor"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureQuit(loc, { skip }) {
  if (skip) return;
  if (cursorRunning()) throw new Error("Cursor 正在运行,请先完全退出(Cmd+Q)再执行。");
}

function applyAll(loc, patchList, { force = false, skipProcessCheck = false } = {}) {
  if (patchList.length === 0) throw new Error("没有选中任何补丁");
  const gate = checkGate(loc.version, patchList, { force });
  if (!gate.ok) throw new Error(gate.message);
  ensureQuit(loc, { skip: skipProcessCheck });

  const results = plan(loc, patchList);
  const failed = results.filter((r) => r.error);
  if (failed.length) {
    throw new Error(failed.map((r) => `${r.name}: ${r.error}`).join("\n") + "\n未写入任何内容。");
  }

  const items = [];
  for (const r of results) {
    if (r.skipped) continue;
    // 首次修改:先把原版(带版本戳)存成备份
    if (!r.info.mark) {
      const original = fs.readFileSync(r.file);
      items.push({
        file: r.info.bak,
        content: makeMark(loc.version, []) + original.toString("utf8"),
        undo: r.info.hasBak ? fs.readFileSync(r.info.bak) : "",
        isBackup: true,
      });
    }
  }
  // 备份先落盘;再写补丁文件。分两个事务,备份失败时不会动 app 文件。
  writeAll(items);
  const patched = results
    .filter((r) => !r.skipped)
    .map((r) => ({ file: r.file, content: r.patched, undo: fs.readFileSync(r.file) }));
  writeAll(patched);
  const changed = syncChecksums(loc);
  return { results, checksumsChanged: changed, forced: gate.forced };
}

function restoreAll(loc, { skipProcessCheck = false } = {}) {
  ensureQuit(loc, { skip: skipProcessCheck });
  const items = [];
  const restored = [];
  for (const [name, file] of Object.entries(loc.files)) {
    const info = inspect(file);
    if (!info.mark) continue; // 已经是原版
    if (!info.hasBak || info.bakVersion !== loc.version) {
      throw new Error(
        `${name}: 没有与当前版本 ${loc.version} 一致的备份(备份版本: ${info.bakVersion ?? "无"}),` +
          `无法还原。请重新安装 Cursor。`
      );
    }
    const original = fs.readFileSync(info.bak, "utf8").replace(MARK_RE, "");
    items.push({ file, content: original, undo: fs.readFileSync(file) });
    restored.push(info);
  }
  writeAll(items);
  const changed = syncChecksums(loc);
  for (const info of restored) fs.rmSync(info.bak, { force: true });
  return { restored: restored.map((i) => i.file), checksumsChanged: changed };
}

module.exports = { applyAll, restoreAll, cursorRunning };

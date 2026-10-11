"use strict";
// 真正写入 app:apply(应用补丁)与 restore(还原)。
const fs = require("fs");
const { execFileSync } = require("child_process");
const { inspect, makeMark, MARK_RE } = require("./source");
const { plan, resolveTargets } = require("./plan");
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

// 把规划结果写入 app:先落备份,再原子写文件,再同步 checksums;还原到原版的文件最后删除备份。
function commitPlan(loc, results) {
  const failed = results.filter((r) => r.error);
  if (failed.length) {
    throw new Error(failed.map((r) => `${r.name}: ${r.error}`).join("\n") + "\n未写入任何内容。");
  }
  const active = results.filter((r) => !r.skipped);

  // 首次修改:先把原版(带版本戳)存成备份
  const backups = [];
  for (const r of active) {
    if (r.info.mark || r.restore) continue;
    backups.push({
      file: r.info.bak,
      content: makeMark(loc.version, []) + fs.readFileSync(r.file, "utf8"),
      undo: r.info.hasBak ? fs.readFileSync(r.info.bak) : "",
    });
  }
  // 备份先落盘;再写目标文件。分两个事务,备份失败时不会动 app 文件。
  writeAll(backups);
  writeAll(active.map((r) => ({ file: r.file, content: r.patched, undo: fs.readFileSync(r.file) })));
  const checksumsChanged = syncChecksums(loc);
  for (const r of active) if (r.restore) fs.rmSync(r.info.bak, { force: true });
  return checksumsChanged;
}

// 应用:目标集合 = 已有 ∪ selected。需要 selected 对当前版本已验证,或 force。
function applyAll(loc, all, selected, { force = false, skipProcessCheck = false } = {}) {
  if (selected.length === 0) throw new Error("没有选中任何补丁");
  const gate = checkGate(loc.version, selected, { force });
  if (!gate.ok) throw new Error(gate.message);
  ensureQuit(loc, { skip: skipProcessCheck });
  const results = plan(loc, resolveTargets(loc, all, selected));
  const checksumsChanged = commitPlan(loc, results);
  return { results, checksumsChanged, forced: gate.forced };
}

// 移除:目标集合 = 已有 − remove。集合为空的文件还原成原版。
function removeFeatures(loc, all, remove, { skipProcessCheck = false } = {}) {
  if (remove.length === 0) throw new Error("没有指定要移除的功能");
  ensureQuit(loc, { skip: skipProcessCheck });
  const results = plan(loc, resolveTargets(loc, all, [], { remove }));
  const checksumsChanged = commitPlan(loc, results);
  return { results, checksumsChanged };
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

module.exports = { applyAll, removeFeatures, restoreAll, cursorRunning };

"use strict";
// 原版来源判定:文件是否已被本工具修改、备份是否可用。
//
// 约定:
//  - 已修改的文件以一行标记开头:  /*cursor-patcher:v=<版本>;ids=<补丁id,...>*/
//  - 备份文件是同目录的  <文件名>.cursor-patcher.bak ,其开头带版本戳(同一标记格式,ids 为空)
const fs = require("fs");

const MARK_RE = /^\/\*cursor-patcher:v=([^;]*);ids=([^*]*)\*\//;
const BAK_SUFFIX = ".cursor-patcher.bak";

function readHead(file, bytes = 256) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.slice(0, n).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function parseMark(head) {
  const m = MARK_RE.exec(head);
  if (!m) return null;
  return { version: m[1], ids: m[2] ? m[2].split(",").filter(Boolean) : [] };
}

function inspect(file) {
  const bak = file + BAK_SUFFIX;
  const mark = fs.existsSync(file) ? parseMark(readHead(file)) : null;
  const hasBak = fs.existsSync(bak);
  const bakVersion = hasBak ? parseMark(readHead(bak))?.version ?? null : null;
  return { file, bak, exists: fs.existsSync(file), mark, hasBak, bakVersion };
}

// 决定"原版"从哪里来。返回 { kind, path } 或 { error }。
//   kind = "current":当前文件没有标记,它本身就是原版
//   kind = "bak":     当前文件已标记,用版本一致的备份
function resolveOriginal(info, currentVersion) {
  if (!info.exists) return { error: `文件不存在: ${info.file}` };
  if (!info.mark) return { kind: "current", path: info.file };
  if (info.hasBak && info.bakVersion === currentVersion) {
    return { kind: "bak", path: info.bak };
  }
  return {
    error:
      `${info.file} 已被修改,但没有与当前版本 ${currentVersion} 一致的备份` +
      `(备份版本: ${info.bakVersion ?? "无"})。请重新安装 Cursor 后再试,不会使用过期备份。`,
  };
}

module.exports = { inspect, resolveOriginal, parseMark, BAK_SUFFIX, MARK_RE };

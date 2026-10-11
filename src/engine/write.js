"use strict";
// 原子写入:先写同目录临时文件,再 rename 覆盖。保留原文件权限。
const fs = require("fs");
const path = require("path");

function tempPath(file) {
  return path.join(path.dirname(file), `.${path.basename(file)}.cursor-patcher.tmp`);
}

// 单文件原子写入
function atomicWrite(file, content) {
  const tmp = tempPath(file);
  const mode = fs.existsSync(file) ? fs.statSync(file).mode : 0o644;
  try {
    fs.writeFileSync(tmp, content, { mode });
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// 多文件事务:先把所有内容写成临时文件,再依次 rename。
// 任何一步失败,已经 rename 的文件用 undo 里的旧内容回滚。
//   items: [{ file, content, undo }]  undo 是写入前该文件的完整内容(Buffer/string)
function writeAll(items) {
  const staged = [];
  try {
    for (const it of items) {
      const tmp = tempPath(it.file);
      const mode = fs.existsSync(it.file) ? fs.statSync(it.file).mode : 0o644;
      fs.writeFileSync(tmp, it.content, { mode });
      staged.push({ ...it, tmp });
    }
  } catch (e) {
    for (const s of staged) fs.rmSync(s.tmp, { force: true });
    throw e;
  }
  const done = [];
  try {
    for (const s of staged) {
      fs.renameSync(s.tmp, s.file);
      done.push(s);
    }
  } catch (e) {
    for (const s of done) {
      try {
        atomicWrite(s.file, s.undo);
      } catch (_) {
        /* 回滚尽力而为;.bak 仍在,可用 restore 修复 */
      }
    }
    for (const s of staged) fs.rmSync(s.tmp, { force: true });
    throw e;
  }
}

module.exports = { atomicWrite, writeAll };

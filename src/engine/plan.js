"use strict";
// 演练:对每个目标文件从"原版"出发应用补丁并做语法检查,全程不写 app。
const fs = require("fs");
const { inspect, resolveOriginal, makeMark, MARK_RE } = require("./source");
const { applyPatches, syntaxCheck } = require("./apply");

function selectPatches(all, { only, except } = {}) {
  const match = (p, key) => p.id === key || p.group === key;
  let list = all;
  if (only?.length) list = list.filter((p) => only.some((k) => match(p, k)));
  if (except?.length) list = list.filter((p) => !except.some((k) => match(p, k)));
  const known = new Set(all.flatMap((p) => [p.id, p.group]));
  for (const k of [...(only ?? []), ...(except ?? [])]) {
    if (!known.has(k)) throw new Error(`未知的补丁或组: ${k}`);
  }
  return list;
}

// 返回每个文件的结果:{ name, file, original, patched?, report?, syntax?, error? }
function plan(loc, patchList) {
  const results = [];
  for (const [name, file] of Object.entries(loc.files)) {
    const mine = patchList.filter((p) => p.files.includes(name));
    const res = { name, file, patches: mine.map((p) => p.id) };
    results.push(res);
    if (mine.length === 0) {
      res.skipped = true;
      continue;
    }
    const orig = resolveOriginal(inspect(file), loc.version);
    if (orig.error) {
      res.error = orig.error;
      continue;
    }
    res.original = orig;
    res.info = inspect(file);
    try {
      // 备份文件开头带版本戳,还原成原版内容时要去掉
      const src = fs.readFileSync(orig.path, "utf8").replace(MARK_RE, "");
      const { out, report } = applyPatches(src, mine, name);
      res.report = report;
      res.patched = makeMark(loc.version, mine.map((p) => p.id)) + out;
      res.syntax = syntaxCheck(res.patched);
      if (!res.syntax.ok) res.error = `语法检查失败:\n${res.syntax.stderr}`;
    } catch (e) {
      res.error = e.message;
    }
  }
  return results;
}

module.exports = { plan, selectPatches };

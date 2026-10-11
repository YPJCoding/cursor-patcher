"use strict";
// 集合式应用的规划层(不写 app):
//   resolveTargets  决定每个文件最终应该带哪些功能
//   plan            从原版出发为每个文件生成结果并做语法检查
//
// 语义:每个文件的目标集合 = 文件标记里已有的功能 ∪ 本次要求的功能 − 本次要移除的功能。
// 总是从原版(当前文件或备份)重新生成,所以结果只取决于集合,与应用顺序无关。
const fs = require("fs");
const { inspect, resolveOriginal, makeMark, MARK_RE } = require("./source");
const { applyPatches, syntaxCheck } = require("./apply");

function selectPatches(all, { only, except } = {}) {
  const match = (p, key) => p.id === key || p.group === key;
  // 草稿功能(draft: true)不参与默认选择,只在 --only 明确点名时才生效
  let list = only?.length ? all : all.filter((p) => !p.draft);
  if (only?.length) list = list.filter((p) => only.some((k) => match(p, k)));
  if (except?.length) list = list.filter((p) => !except.some((k) => match(p, k)));
  const known = new Set(all.flatMap((p) => [p.id, p.group]));
  for (const k of [...(only ?? []), ...(except ?? [])]) {
    if (!known.has(k)) throw new Error(`未知的补丁或组: ${k}`);
  }
  return list;
}

// 返回 { [文件短名]: 该文件最终要带的功能数组(按注册表顺序) }。
//   all:      注册表里的全部功能
//   selected: 本次要求加上的功能
//   remove:   本次要移除的功能 id
function resolveTargets(loc, all, selected, { remove = [] } = {}) {
  const byId = new Map(all.map((f) => [f.id, f]));
  for (const id of remove) {
    if (!byId.has(id)) throw new Error(`未知的功能: ${id}`);
  }
  const perFile = {};
  for (const [name, file] of Object.entries(loc.files)) {
    const info = inspect(file);
    const existing = info.mark?.ids ?? [];
    const unknown = existing.filter((id) => !byId.has(id));
    if (unknown.length) {
      throw new Error(
        `${name}: 文件里已有当前程序不认识的功能 ${unknown.join(", ")},无法按集合重新生成。` +
          `请先用能识别它们的版本执行 restore。`
      );
    }
    const set = new Set(existing);
    for (const f of selected) if (f.files.includes(name)) set.add(f.id);
    for (const id of remove) set.delete(id);
    perFile[name] = all.filter((f) => set.has(f.id));
  }
  return perFile;
}

// 返回每个文件的结果:
//   { name, file, features, skipped? , restore?, original?, patched?, report?, syntax?, error? }
//   skipped: 文件本来就是原版,也不需要任何功能
//   restore: 目标集合为空,但文件当前带标记,需要还原成原版
function plan(loc, perFile) {
  const results = [];
  for (const [name, file] of Object.entries(loc.files)) {
    const features = perFile[name] ?? [];
    const info = inspect(file);
    const res = { name, file, info, features: features.map((f) => f.id) };
    results.push(res);

    if (features.length === 0 && !info.mark) {
      res.skipped = true;
      continue;
    }
    const orig = resolveOriginal(info, loc.version);
    if (orig.error) {
      res.error = orig.error;
      continue;
    }
    res.original = orig;
    try {
      // 备份文件开头带版本戳,还原成原版内容时要去掉
      const src = fs.readFileSync(orig.path, "utf8").replace(MARK_RE, "");
      if (features.length === 0) {
        res.restore = true;
        res.patched = src;
        continue;
      }
      const { out, report } = applyPatches(src, features, name);
      res.report = report;
      res.patched = makeMark(loc.version, features.map((f) => f.id)) + out;
      res.syntax = syntaxCheck(res.patched);
      if (!res.syntax.ok) res.error = `语法检查失败:\n${res.syntax.stderr}`;
    } catch (e) {
      res.error = e.message;
    }
  }
  return results;
}

module.exports = { plan, selectPatches, resolveTargets };

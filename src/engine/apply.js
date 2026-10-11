"use strict";
// 补丁引擎:在内存里对源码应用补丁,校验命中次数,产出审计信息。
// 本模块不写 app;写入由 write.js 负责。
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// 压缩后的标识符(允许 $)
const ID = "[\\w$]+";

class PatchError extends Error {}

// 辅助:全局正则替换,要求命中次数 == expect(默认 1)。
// 不匹配或多匹配都抛错,调用方据此中止整个流程。
function makeHelpers(audit) {
  return {
    ID,
    sub(src, re, replacer, { expect = 1 } = {}) {
      if (!re.global) throw new PatchError("内部错误:补丁正则必须带 g 标志");
      let out = "";
      let last = 0;
      let count = 0;
      for (const m of src.matchAll(re)) {
        const text = replacer(...m, m.index, src);
        out += src.slice(last, m.index) + text;
        last = m.index + m[0].length;
        count++;
        audit.push({
          at: m.index,
          before: src.slice(Math.max(0, m.index - 40), m.index + m[0].length + 80),
          after: (src.slice(Math.max(0, m.index - 40), m.index) + text).slice(-(40 + text.length)),
        });
      }
      if (count !== expect) {
        throw new PatchError(`命中 ${count} 次,期望 ${expect} 次`);
      }
      return out + src.slice(last);
    },
  };
}

// 在源码上依次应用补丁。任何补丁失败都会抛出带 id 的错误。
function applyPatches(src, patchList, fileName) {
  let cur = src;
  const report = [];
  for (const p of patchList) {
    const audit = [];
    try {
      cur = p.apply(cur, makeHelpers(audit));
    } catch (e) {
      throw new PatchError(`[${p.id}] ${fileName}: ${e.message}`);
    }
    report.push({ id: p.id, file: fileName, hits: audit.length, audit });
  }
  return { out: cur, report };
}

// 对一段 JS 做语法检查(node --check),返回 { ok, stderr }。
function syntaxCheck(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-patcher-"));
  const file = path.join(dir, "check.js");
  try {
    fs.writeFileSync(file, code);
    const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    return { ok: r.status === 0, stderr: r.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { applyPatches, syntaxCheck, PatchError, ID };

"use strict";
// 同步 product.json 的 checksums。算法:sha256,base64,去掉末尾 "="。
// 只更新 product.json 里已存在的键(例如 glass 没有条目就不加)。
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { atomicWrite } = require("./write");

function checksumOf(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("base64").replace(/=+$/, "");
}

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// 只对 product.json 做文本替换(不重新序列化),保持其余内容逐字节不变,还原后也能与原文件完全一致。
function syncChecksums(loc) {
  let raw = fs.readFileSync(loc.productPath, "utf8");
  const sums = JSON.parse(raw).checksums ?? {};
  const changed = [];
  for (const file of Object.values(loc.files)) {
    // checksums 的键是相对 out/ 的路径,例如 vs/workbench/workbench.desktop.main.js
    const key = path.relative(path.join(loc.appDir, "out"), file).split(path.sep).join("/");
    if (!(key in sums)) continue;
    const next = checksumOf(file);
    if (sums[key] === next) continue;
    const re = new RegExp(`("${escapeRe(key)}"\\s*:\\s*")${escapeRe(sums[key])}(")`);
    if (!re.test(raw)) throw new Error(`product.json 里找不到 ${key} 的 checksum 条目`);
    raw = raw.replace(re, (_, a, b) => a + next + b);
    changed.push(key);
  }
  if (changed.length) atomicWrite(loc.productPath, raw);
  return changed;
}

module.exports = { checksumOf, syncChecksums };

"use strict";
// 版本闸门:只在已验证的 Cursor 版本上应用补丁。
const verified = require("../verified-versions.json");

function isVerified(version) {
  return verified.versions.includes(version);
}

function checkGate(version, { force = false } = {}) {
  if (isVerified(version)) return { ok: true, forced: false };
  if (force) return { ok: true, forced: true };
  return {
    ok: false,
    message:
      `Cursor ${version} 不在已验证列表中。` +
      `请先按 docs/upgrade.md 验证补丁锚点,再把版本加入 src/verified-versions.json;` +
      `或加 --force 强制继续。`,
  };
}

module.exports = { isVerified, checkGate, verifiedVersions: verified.versions };

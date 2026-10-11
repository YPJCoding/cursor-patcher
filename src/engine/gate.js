"use strict";
// 版本闸门:每个功能各自记录已验证的 Cursor 版本(features/<id>/verified.json)。
// 应用时只拒绝"当前版本对它还没验证过"的功能。

function isVerified(feature, version) {
  return (feature.verified?.versions ?? []).includes(version);
}

function checkGate(version, featureList, { force = false } = {}) {
  const unverified = featureList.filter((f) => !isVerified(f, version)).map((f) => f.id);
  if (unverified.length === 0) return { ok: true, forced: false, unverified };
  if (force) return { ok: true, forced: true, unverified };
  return {
    ok: false,
    unverified,
    message:
      `Cursor ${version} 对以下功能尚未验证: ${unverified.join(", ")}。\n` +
      `请先按 docs/upgrade.md 验证锚点,再把版本加入对应的 src/features/<id>/verified.json;` +
      `或加 --force 强制继续。`,
  };
}

module.exports = { isVerified, checkGate };

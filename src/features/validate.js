"use strict";
// 功能定义的形状校验。目录名必须等于 id,避免登记错位。
const TARGETS = ["glass", "desktop"];

function validate(feature, dirName) {
  const where = `features/${dirName}`;
  const must = (cond, msg) => {
    if (!cond) throw new Error(`${where}: ${msg}`);
  };
  must(feature && typeof feature === "object", "feature.js 必须导出对象");
  must(feature.id === dirName, `id(${feature.id})必须等于目录名(${dirName})`);
  must(typeof feature.group === "string" && feature.group, "缺少 group");
  must(typeof feature.intent === "string" && feature.intent, "缺少 intent");
  must(typeof feature.apply === "function", "缺少 apply(src, h)");
  must(
    Array.isArray(feature.files) && feature.files.length > 0 && feature.files.every((f) => TARGETS.includes(f)),
    `files 必须是 ${TARGETS.join("/")} 的非空数组`
  );
  must(feature.draft === undefined || typeof feature.draft === "boolean", "draft 必须是布尔值");
  const v = feature.verified;
  must(v && Array.isArray(v.versions), "缺少 verified.json 或其中没有 versions 数组");
  return feature;
}

module.exports = { validate };

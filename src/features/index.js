"use strict";
// 功能注册表:自动发现 src/features/<id>/feature.js,并附上同目录的 verified.json。
// 新增功能只需在本目录加一个文件夹,不需要在这里登记。
// 打包成单文件时没有文件系统可扫,由 scripts/build.js 生成等价的静态列表。
const fs = require("fs");
const path = require("path");
const { validate } = require("./validate");

function discover(dir = __dirname) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "feature.js")))
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const base = path.join(dir, name);
      const verifiedFile = path.join(base, "verified.json");
      const verified = fs.existsSync(verifiedFile) ? JSON.parse(fs.readFileSync(verifiedFile, "utf8")) : undefined;
      return validate({ ...require(path.join(base, "feature.js")), verified }, name);
    });
}

module.exports = { features: discover(), discover };

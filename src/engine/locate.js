"use strict";
// 定位 Cursor app,读取版本与目标文件路径。
const fs = require("fs");
const path = require("path");

const DEFAULT_APP = "/Applications/Cursor.app";

// 目标文件:短名 -> app/ 下的相对路径
const TARGETS = {
  glass: "out/vs/workbench/workbench.glass.main.js",
  desktop: "out/vs/workbench/workbench.desktop.main.js",
};

function locate(appPath = process.env.CURSOR_APP || DEFAULT_APP) {
  const appDir = path.join(appPath, "Contents", "Resources", "app");
  const productPath = path.join(appDir, "product.json");
  if (!fs.existsSync(productPath)) {
    throw new Error(`找不到 Cursor: ${productPath}(可用环境变量 CURSOR_APP 指定 .app 路径)`);
  }
  const product = JSON.parse(fs.readFileSync(productPath, "utf8"));
  const files = {};
  for (const [name, rel] of Object.entries(TARGETS)) {
    files[name] = path.join(appDir, rel);
  }
  return {
    appPath,
    appDir,
    productPath,
    product,
    version: product.version,
    commit: product.commit,
    files,
  };
}

module.exports = { locate, TARGETS };

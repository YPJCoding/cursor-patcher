"use strict";
// 补丁注册表。新增补丁:在本目录加一个文件,并在下面登记。
// 每个补丁的形状:{ id, group, files: ["glass"|"desktop"], intent, apply(src, h) }
const patches = [
  // 第 2 步加入: require("./block-nudge-rpc")
];

module.exports = { patches };

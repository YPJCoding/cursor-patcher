"use strict";
// 功能注册表。每个功能是本目录下的一个文件夹,入口是 <id>/feature.js。
// 功能的形状:{ id, group, files: ["glass"|"desktop"], intent, apply(src, h) }
const features = [require("./block-nudge-rpc/feature")];

module.exports = { features };

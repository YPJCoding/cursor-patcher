"use strict";
// block-nudge-rpc:新对话的模型推荐(nudge)RPC 直接返回空对象,不再请求服务器。
//
// 目标:agentClientService 里的封装方法
//   async getNewChatNudgeParameterizedModelPicker(t,e,n){
//     const i=await this.backendClient.get(t);
//     return X(i,{injectTraceHeaders:!0}).getNewChatNudgeParameterizedModelPicker(t,new Y({...}))
//   }
// 所有调用方都经过它;它们对"nudge 为空"本来就有提前返回的分支,所以不需要改调用方。
//
// 稳定锚点:方法名 + 函数体结构(取 backendClient 再调用同名 RPC)。
// 压缩后的局部变量名每版都会变,正则用 ID 和反向引用,不依赖具体名字。
const { ID } = require("../engine/apply");

module.exports = {
  id: "block-nudge-rpc",
  group: "nudge",
  files: ["glass", "desktop"],
  intent:
    "新对话的 nudge RPC 封装方法开头插入 return{};,调用方拿到空的 nudge 后按原有分支直接返回," +
    "不请求服务器,也不会把模型重置为 Auto。",
  apply(src, h) {
    const re = new RegExp(
      `async getNewChatNudgeParameterizedModelPicker\\((${ID}),(${ID}),(${ID})\\)\\{` +
        // 前瞻:函数体必须正是"取 backendClient,再调用同名 RPC",否则不匹配
        `(?=const (${ID})=await this\\.backendClient\\.get\\(\\1\\);` +
        `return (${ID})\\(\\4,\\{injectTraceHeaders:!0\\}\\)\\.getNewChatNudgeParameterizedModelPicker\\()`,
      "g"
    );
    return h.sub(src, re, (m) => `${m}return{};`);
  },
};

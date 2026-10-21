"use strict";
// block-team-hooks:屏蔽企业团队下发的受管 Hooks(Team Managed Hooks),不再拉取、落盘或执行。
//
// 目标:CursorHooksService._doRefreshTeamHooks()
//   const n=await(await this.cursorAuthenticationService.dashboardClient()).getTeamHooks({activeOnly:!0}),
//   i=await this._getBackendOS(),...
// 将 RPC 调用直接替换为字面量 {hooks:[]},使其自然走入 s.length===0 的空分支:
//   - 不发网络请求 getTeamHooks
//   - 不在 ~/.cursor/managed/team_<id>/hooks/ 下写入任何脚本
//   - 正常调用 _recordTeamHooksLoad({teamId,hasHooks:!1}) 与 _settleInitialTeamRefresh(),不阻塞 _hooksReady
const { ID } = require("../../engine/apply");

module.exports = {
  id: "block-team-hooks",
  group: "privacy",
  summary: "屏蔽企业团队下发的受管 Hooks，禁止自动拉取与执行团队审计/遥测脚本",
  files: ["glass", "desktop"],
  intent:
    "在 CursorHooksService._doRefreshTeamHooks 中将 getTeamHooks({activeOnly:!0}) RPC 调用替换为 {hooks:[]}，" +
    "使其走入无活跃团队 Hook 的原有分支并正常完成初始化状态结算，既不请求服务端也不落盘执行团队脚本。",
  apply(src, h) {
    const re = new RegExp(
      `(async _doRefreshTeamHooks\\(\\)\\{[\\s\\S]{1,800}?const ${ID}=)` +
        `await\\(await this\\.cursorAuthenticationService\\.dashboardClient\\(\\)\\)\\.getTeamHooks\\(\\{activeOnly:!0\\}\\)` +
        `(?=,${ID}=await this\\._getBackendOS\\(\\))`,
      "g"
    );
    return h.sub(src, re, (_, prefix) => `${prefix}{hooks:[]}`);
  },
};

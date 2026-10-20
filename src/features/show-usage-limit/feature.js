"use strict";
// show-usage-limit:针对企业版(Enterprise)账号激活 Cursor 原生额度组件(完全使用 Cursor 自带样式)。
//
// 仅在 usageDataService 数据层做最小改动(不碰任何 React 组件与 CSS 样式):
//   1. getCurrentPeriodUsage 请求补传 { teamId, includePooledUsage: true }(缺一不可,否则服务端对企业号返回空数据);
//   2. 将企业账号返回的 spendLimitUsage.overallUsed / overallLimit 映射为原生 planUsage,
//      并开启 enabled=true、displayThreshold=0。
const { ID } = require("../../engine/apply");

module.exports = {
  id: "show-usage-limit",
  group: "usage",
  summary: "针对企业账号激活 Cursor 原生底部额度圆环与点击进度条卡片（零样式改动）",
  files: ["glass", "desktop"],
  intent:
    "仅修改 usageDataService：在请求月度用量时传入 teamId 与 includePooledUsage，并将企业账号的 " +
    "overallUsed/overallLimit 映射给 planUsage、开启 enabled 与零阈值，完全复用 Cursor 原生状态栏圆环与抽屉卡片样式。",
  apply(src, h) {
    const reService = new RegExp(
      `(async performFetchSilent\\(${ID}\\)\\{[\\s\\S]{1,300}?\\.dashboardClient\\(\\)\\)\\.getCurrentPeriodUsage\\(new (${ID}))\\)` +
        `([\\s\\S]{1,600}?applyCurrentPeriodUsageResponse\\((${ID})\\)\\{)` +
        `(?=if\\(${ID}\\(${ID}\\.didReceiveCurrentPeriodUsage\\),this\\.setUsageDisplayEnabled\\(\\4\\.enabled\\))` +
        `([\\s\\S]{1,3500}?async performFetch\\(${ID}\\)\\{[\\s\\S]{1,350}?\\.dashboardClient\\(\\)\\)\\.getCurrentPeriodUsage\\(new \\2)\\)`,
      "g"
    );

    return h.sub(src, reService, (_, p1, _ReqCls, p2, arg, p3) => {
      const reqArg = `{teamId:this.cursorAuthenticationService.getTeamId(),includePooledUsage:!0}))`;
      const inject =
        `{const u=${arg}.spendLimitUsage?.overallUsed??0,l=${arg}.spendLimitUsage?.overallLimit;` +
        `if(l){${arg}.enabled=!0,${arg}.displayThreshold=0,` +
        `${arg}.planUsage=Object.assign(${arg}.planUsage??{},{totalSpend:u,includedSpend:u,bonusSpend:0,limit:l})}}`;
      return `${p1}(${reqArg}${p2}${inject}${p3}(${reqArg}`;
    });
  },
};

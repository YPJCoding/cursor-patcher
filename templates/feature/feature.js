"use strict";
// {{id}}:TODO 一句话说明这个功能做什么。
//
// 写完后:删掉 draft、补 fixtures、补 feature.md,详见 docs/adding-a-feature.md。
const { ID } = require("../../engine/apply");

module.exports = {
  id: "{{id}}",
  group: "{{group}}",
  summary: "TODO: 一句话(单行)说明这个功能做什么,会出现在 README 的功能表里",
  draft: true, // 草稿不会参与默认的 check / apply,只在 --only {{id}} 时生效。完成后删除这一行。
  files: [{{files}}],
  intent: "TODO: 用一两句话写清要改什么、为什么这样改、锚点是什么(给将来的自己和智能体看)。",
  apply(src, h) {
    // 用 h.sub(src, 正则, 替换函数) 做替换,命中次数必须正好 1 次。
    // 压缩后的局部变量名每版都会变:用 ${ID} 匹配标识符,用反向引用保持前后一致,
    // 锚点只依赖方法名、属性名、字符串字面量和代码结构。
    throw new Error("尚未实现: 在 src/features/{{id}}/feature.js 里写正则并调用 h.sub(...)");
  },
};

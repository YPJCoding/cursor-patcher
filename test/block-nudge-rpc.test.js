"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { applyPatches, syntaxCheck } = require("../src/engine/apply");
const patch = require("../src/patches/block-nudge-rpc");

// 取自 Cursor 3.24.12 的结构(变量名每版不同,这里用两组不同的名字)
const A =
  "class S{async getNewChatNudgeParameterizedModelPicker(t,e,n){const i=await this.backendClient.get(t);" +
  "return W6e(i,{injectTraceHeaders:!0}).getNewChatNudgeParameterizedModelPicker(t,new j7a({currentModel:e}))}}";
const B =
  "class S{async getNewChatNudgeParameterizedModelPicker($a,b,c){const $d=await this.backendClient.get($a);" +
  "return q$(\u0024d,{injectTraceHeaders:!0}).getNewChatNudgeParameterizedModelPicker($a,new Z({currentModel:b}))}}";

const run = (src) => applyPatches(src, [patch], "t.js");

test("inserts return{} regardless of minified names", () => {
  for (const src of [A, B]) {
    const { out, report } = run(src);
    assert.equal(report[0].hits, 1);
    assert.match(out, /\)\{return\{\};const /);
    assert.ok(syntaxCheck(out).ok);
  }
});

test("fails when the method is renamed", () => {
  assert.throws(() => run(A.replaceAll("getNewChatNudgeParameterizedModelPicker", "getNudge")), /命中 0 次/);
});

test("fails when the body structure changes", () => {
  assert.throws(() => run(A.replace("this.backendClient.get(t)", "this.other.get(t)")), /命中 0 次/);
});

test("fails when more than one implementation matches", () => {
  assert.throws(() => run(A + A), /命中 2 次/);
});

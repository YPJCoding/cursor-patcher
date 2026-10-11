"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createFeature } = require("../scripts/new-feature");
const { extractBlock } = require("../scripts/extract-fixture");
const { validate } = require("../src/features/validate");
const { selectPatches } = require("../src/engine/plan");

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cp-scaffold-"));
  fs.cpSync(path.join(__dirname, "../templates"), path.join(root, "templates"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/features"), { recursive: true });
  return root;
}

test("scaffolded feature has every file and passes validation as a draft", () => {
  const root = tempRoot();
  const dir = createFeature({ id: "demo-thing", group: "ui", files: ["glass"], root });
  for (const f of ["feature.js", "feature.md", "verified.json", "fixtures/.gitkeep"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  }
  const text = fs.readFileSync(path.join(dir, "feature.js"), "utf8");
  assert.doesNotMatch(text, /\{\{/);
  // 模板里的 require 是相对仓库的 ../../engine/apply,这里只验证形状,把依赖换成真实引擎
  const real = path.resolve(__dirname, "../src/engine/apply");
  fs.writeFileSync(path.join(dir, "feature.js"), text.replace('"../../engine/apply"', JSON.stringify(real)));
  const feature = require(path.join(dir, "feature.js"));
  const verified = JSON.parse(fs.readFileSync(path.join(dir, "verified.json"), "utf8"));
  assert.doesNotThrow(() => validate({ ...feature, verified }, "demo-thing"));
  assert.equal(feature.draft, true);
  assert.deepEqual(feature.files, ["glass"]);
  assert.equal(feature.group, "ui");
  assert.throws(() => feature.apply("x", {}), /尚未实现/);
});

test("scaffold rejects bad ids, unknown targets and existing features", () => {
  const root = tempRoot();
  for (const id of ["", "Bad", "1abc", "a_b", "a--b", "a-", undefined]) {
    assert.throws(() => createFeature({ id, root }), /id 必须是/, String(id));
  }
  assert.throws(() => createFeature({ id: "ok", files: ["nope"], root }), /未知的目标文件/);
  assert.throws(() => createFeature({ id: "ok", files: [], root }), /至少要指定/);
  createFeature({ id: "ok", root });
  assert.throws(() => createFeature({ id: "ok", root }), /已存在/);
});

test("drafts are skipped by default and only run when named", () => {
  const draft = { id: "d", group: "g", draft: true };
  const real = { id: "r", group: "g" };
  assert.deepEqual(selectPatches([draft, real], {}).map((f) => f.id), ["r"]);
  assert.deepEqual(selectPatches([draft, real], { except: ["r"] }).map((f) => f.id), []);
  assert.deepEqual(selectPatches([draft, real], { only: ["d"] }).map((f) => f.id), ["d"]);
  assert.deepEqual(selectPatches([draft, real], { only: ["g"] }).map((f) => f.id), ["d", "r"]);
});

test("extractBlock takes the brace-matched block, optionally wrapped", () => {
  const src = "a;async foo(t,e){if(t){return {x:1}}return 2}b;async bar(){}";
  assert.equal(extractBlock(src, "async foo("), "async foo(t,e){if(t){return {x:1}}return 2}\n");
  assert.equal(extractBlock(src, "async foo(", { wrap: "class" }), "class S{async foo(t,e){if(t){return {x:1}}return 2}}\n");
  assert.equal(extractBlock(src, "async bar("), "async bar(){}\n");
});

test("extractBlock refuses ambiguous or missing starts and unbalanced braces", () => {
  assert.throws(() => extractBlock("foo(){} foo(){}", "foo("), /出现 2 次/);
  assert.throws(() => extractBlock("nothing", "foo("), /出现 0 次/);
  assert.throws(() => extractBlock("foo(){ {", "foo("), /没有配对/);
  assert.throws(() => extractBlock("foo(", "foo("), /没有找到 \{/);
  assert.throws(() => extractBlock("foo(){}", "foo(", { wrap: "x" }), /未知的 --wrap/);
});

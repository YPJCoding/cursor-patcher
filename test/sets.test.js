"use strict";
// 集合式应用:多个功能可以先后添加、单独移除,且结果只取决于集合,与顺序无关。
// 用人为构造的、锚点互不重叠的功能测试,不触碰真实的 Cursor。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { locate } = require("../src/engine/locate");
const { applyAll, removeFeatures, restoreAll } = require("../src/engine/commit");
const { plan, resolveTargets } = require("../src/engine/plan");
const { inspect } = require("../src/engine/source");

const swap = (id, from, to, files = ["glass", "desktop"]) => ({
  id,
  group: "t",
  files,
  intent: id,
  verified: { versions: [] },
  apply: (src, h) => h.sub(src, new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), () => to),
});
const A = swap("a", "var a=1;", "var a=10;");
const B = swap("b", "var b=2;", "var b=20;");
const C = swap("c", "var c=3;", "var c=30;", ["desktop"]); // 只改 desktop
const CLASH = swap("clash", "var a=1;", "var a=99;"); // 与 A 争同一处
const ALL = [A, B, C];
const opts = { force: true, skipProcessCheck: true };

function fakeApp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cp-set-"));
  const app = path.join(root, "Cursor.app");
  const dir = path.join(app, "Contents/Resources/app/out/vs/workbench");
  fs.mkdirSync(dir, { recursive: true });
  const body = "var a=1;var b=2;var c=3;\n";
  fs.writeFileSync(path.join(dir, "workbench.glass.main.js"), body);
  fs.writeFileSync(path.join(dir, "workbench.desktop.main.js"), body);
  fs.writeFileSync(
    path.join(app, "Contents/Resources/app/product.json"),
    '{\n\t"version": "1.2.3",\n\t"commit": "abc",\n\t"checksums": {}\n}\n'
  );
  const loc = locate(app);
  const text = (n) => fs.readFileSync(loc.files[n], "utf8").replace(/^\/\*cursor-patcher[^*]*\*\//, "");
  const ids = (n) => inspect(loc.files[n]).mark?.ids ?? [];
  return { loc, text, ids, body };
}

test("features are added incrementally and earlier ones stay", () => {
  const t = fakeApp();
  applyAll(t.loc, ALL, [A], opts);
  assert.equal(t.text("glass"), "var a=10;var b=2;var c=3;\n");
  applyAll(t.loc, ALL, [B], opts);
  assert.equal(t.text("glass"), "var a=10;var b=20;var c=3;\n");
  assert.deepEqual(t.ids("glass"), ["a", "b"]);
  applyAll(t.loc, ALL, [C], opts);
  assert.equal(t.text("desktop"), "var a=10;var b=20;var c=30;\n");
  assert.equal(t.text("glass"), "var a=10;var b=20;var c=3;\n"); // C 不适用于 glass
});

test("the result depends only on the set, not on the order", () => {
  const x = fakeApp();
  applyAll(x.loc, ALL, [A], opts);
  applyAll(x.loc, ALL, [B], opts);
  const y = fakeApp();
  applyAll(y.loc, ALL, [B], opts);
  applyAll(y.loc, ALL, [A], opts);
  const z = fakeApp();
  applyAll(z.loc, ALL, [A, B], opts);
  for (const n of ["glass", "desktop"]) {
    assert.equal(x.text(n), y.text(n));
    assert.equal(x.text(n), z.text(n));
    assert.deepEqual(x.ids(n), y.ids(n));
  }
});

test("remove drops one feature and keeps the others", () => {
  const t = fakeApp();
  applyAll(t.loc, ALL, ALL, opts);
  removeFeatures(t.loc, ALL, ["a"], { skipProcessCheck: true });
  assert.equal(t.text("glass"), "var a=1;var b=20;var c=3;\n");
  assert.deepEqual(t.ids("glass"), ["b"]);
  assert.deepEqual(t.ids("desktop"), ["b", "c"]);
});

test("removing the last feature of a file restores it and deletes its backup", () => {
  const t = fakeApp();
  applyAll(t.loc, ALL, [A, C], opts);
  removeFeatures(t.loc, ALL, ["a"], { skipProcessCheck: true });
  // glass 只带 a:还原成原版,备份删除
  assert.equal(fs.readFileSync(t.loc.files.glass, "utf8"), t.body);
  assert.equal(fs.existsSync(t.loc.files.glass + ".cursor-patcher.bak"), false);
  // desktop 还带 c:仍是已修改
  assert.deepEqual(t.ids("desktop"), ["c"]);
  assert.equal(fs.existsSync(t.loc.files.desktop + ".cursor-patcher.bak"), true);
  removeFeatures(t.loc, ALL, ["c"], { skipProcessCheck: true });
  assert.equal(fs.readFileSync(t.loc.files.desktop, "utf8"), t.body);
});

test("restore after several features is byte-identical", () => {
  const t = fakeApp();
  applyAll(t.loc, ALL, [A], opts);
  applyAll(t.loc, ALL, [B, C], opts);
  restoreAll(t.loc, { skipProcessCheck: true });
  for (const n of ["glass", "desktop"]) assert.equal(fs.readFileSync(t.loc.files[n], "utf8"), t.body);
});

test("two features fighting over the same code fail loudly and write nothing", () => {
  const t = fakeApp();
  applyAll(t.loc, [A, CLASH], [A], opts);
  const before = fs.readFileSync(t.loc.files.glass, "utf8");
  assert.throws(() => applyAll(t.loc, [A, CLASH], [CLASH], opts), /命中 0 次/);
  assert.equal(fs.readFileSync(t.loc.files.glass, "utf8"), before);
});

test("removing an unknown feature, or one the program does not know, is rejected", () => {
  const t = fakeApp();
  assert.throws(() => removeFeatures(t.loc, ALL, ["nope"], { skipProcessCheck: true }), /未知的功能/);
  applyAll(t.loc, ALL, [A], opts);
  // 以后用一个不含 a 的程序版本去操作:文件里的 a 无法重新生成
  assert.throws(() => resolveTargets(t.loc, [B], [B]), /不认识的功能 a/);
});

test("the gate only blocks the features being added", () => {
  const t = fakeApp();
  const verifiedA = { ...A, verified: { versions: ["1.2.3"] } };
  const unverifiedB = { ...B, verified: { versions: [] } };
  const all = [verifiedA, unverifiedB];
  assert.doesNotThrow(() => applyAll(t.loc, all, [verifiedA], { skipProcessCheck: true }));
  assert.throws(() => applyAll(t.loc, all, [unverifiedB], { skipProcessCheck: true }), /尚未验证: b/);
  // 已经应用的 a 不会因为再添加 b 而重新要求验证
  assert.doesNotThrow(() => applyAll(t.loc, all, [unverifiedB], opts));
});

test("check (plan) reports the resulting set without writing", () => {
  const t = fakeApp();
  applyAll(t.loc, ALL, [A], opts);
  const before = fs.readFileSync(t.loc.files.glass, "utf8");
  const res = plan(t.loc, resolveTargets(t.loc, ALL, [B]));
  assert.deepEqual(res.find((r) => r.name === "glass").features, ["a", "b"]);
  assert.equal(fs.readFileSync(t.loc.files.glass, "utf8"), before);
});

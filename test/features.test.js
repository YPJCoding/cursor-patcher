"use strict";
// 对每个功能自动运行:
//   1. 功能定义的形状校验
//   2. fixtures/<版本>/<目标>.js 里的真实代码片段:必须命中 1 次且语法有效
// 新增功能不需要改这个文件,只要放好 fixtures 即可。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { features, discover } = require("../src/features");
const { validate } = require("../src/features/validate");
const { applyPatches, syntaxCheck } = require("../src/engine/apply");
const { checkGate, isVerified } = require("../src/engine/gate");

const FEATURES_DIR = path.join(__dirname, "../src/features");

test("registry discovers every feature folder", () => {
  const dirs = fs
    .readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(FEATURES_DIR, d.name, "feature.js")))
    .map((d) => d.name)
    .sort();
  assert.deepEqual(features.map((f) => f.id), dirs);
  assert.ok(features.length >= 1);
  assert.deepEqual(discover().map((f) => f.id), dirs);
});

test("every feature has its documentation", () => {
  for (const f of features) {
    assert.ok(fs.existsSync(path.join(FEATURES_DIR, f.id, "feature.md")), `${f.id}: 缺少 feature.md`);
  }
});

test("validate rejects malformed features", () => {
  const ok = { id: "a", group: "g", intent: "i", files: ["glass"], apply() {}, verified: { versions: [] } };
  assert.doesNotThrow(() => validate(ok, "a"));
  assert.throws(() => validate({ ...ok, id: "b" }, "a"), /必须等于目录名/);
  assert.throws(() => validate({ ...ok, files: ["nope"] }, "a"), /files/);
  assert.throws(() => validate({ ...ok, files: [] }, "a"), /files/);
  assert.throws(() => validate({ ...ok, verified: undefined }, "a"), /verified/);
  assert.throws(() => validate({ ...ok, apply: undefined }, "a"), /apply/);
});

for (const f of features) {
  const fixtureRoot = path.join(FEATURES_DIR, f.id, "fixtures");
  const versions = fs.existsSync(fixtureRoot) ? fs.readdirSync(fixtureRoot) : [];

  test(`${f.id}: has at least one fixture version`, () => {
    assert.ok(versions.length > 0, `${f.id}: fixtures/ 下没有任何版本目录`);
  });

  for (const version of versions) {
    for (const target of f.files) {
      test(`${f.id}: fixture ${version}/${target} matches exactly once and stays valid JS`, () => {
        const file = path.join(fixtureRoot, version, `${target}.js`);
        assert.ok(fs.existsSync(file), `缺少 fixture: ${file}`);
        const { out, report } = applyPatches(fs.readFileSync(file, "utf8"), [f], target);
        assert.equal(report[0].hits, 1);
        assert.notEqual(out, fs.readFileSync(file, "utf8"));
        assert.ok(syntaxCheck(out).ok);
      });
    }
  }
}

test("gate is decided per feature", () => {
  const a = { id: "a", verified: { versions: ["1.0.0"] } };
  const b = { id: "b", verified: { versions: ["2.0.0"] } };
  assert.equal(isVerified(a, "1.0.0"), true);
  assert.equal(isVerified(b, "1.0.0"), false);
  assert.deepEqual(checkGate("1.0.0", [a]), { ok: true, forced: false, unverified: [] });
  const r = checkGate("1.0.0", [a, b]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unverified, ["b"]);
  assert.match(r.message, /b/);
  assert.doesNotMatch(r.message, /a,/);
  const forced = checkGate("1.0.0", [a, b], { force: true });
  assert.equal(forced.ok, true);
  assert.equal(forced.forced, true);
});

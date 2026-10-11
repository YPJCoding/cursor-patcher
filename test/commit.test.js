"use strict";
// 在临时假 app 上测试 apply / restore / 回滚,不触碰真实的 Cursor。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { locate } = require("../src/engine/locate");
const { applyAll, restoreAll } = require("../src/engine/commit");
const { writeAll } = require("../src/engine/write");
const { checksumOf } = require("../src/engine/checksums");
const { features: patches } = require("../src/features");

const SNIPPET = (n) =>
  `var x${n}=1;class S{async getNewChatNudgeParameterizedModelPicker(t,e,n){const i=await this.backendClient.get(t);` +
  `return W(i,{injectTraceHeaders:!0}).getNewChatNudgeParameterizedModelPicker(t,new J({currentModel:e}))}}\n`;

function fakeApp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cp-test-"));
  const app = path.join(root, "Cursor.app");
  const dir = path.join(app, "Contents/Resources/app/out/vs/workbench");
  fs.mkdirSync(dir, { recursive: true });
  const glass = path.join(dir, "workbench.glass.main.js");
  const desktop = path.join(dir, "workbench.desktop.main.js");
  fs.writeFileSync(glass, SNIPPET(1));
  fs.writeFileSync(desktop, SNIPPET(2));
  const key = "vs/workbench/workbench.desktop.main.js";
  const product = `{\n\t"version": "1.2.3",\n\t"commit": "abc",\n\t"checksums": {\n\t\t"${key}": "${checksumOf(desktop)}"\n\t},\n\t"arr": ["a", "b"]\n}\n`;
  fs.writeFileSync(path.join(app, "Contents/Resources/app/product.json"), product);
  return { app, glass, desktop, productPath: path.join(app, "Contents/Resources/app/product.json"), product, key };
}

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const opts = { force: true, skipProcessCheck: true };

test("apply then restore is byte-identical, product.json only changes the checksum", () => {
  const t = fakeApp();
  const loc = locate(t.app);
  const before = [sha(t.glass), sha(t.desktop)];

  applyAll(loc, patches, patches, opts);
  assert.match(fs.readFileSync(t.glass, "utf8"), /^\/\*cursor-patcher:v=1\.2\.3;ids=block-nudge-rpc\*\//);
  const product = JSON.parse(fs.readFileSync(t.productPath, "utf8"));
  assert.equal(product.checksums[t.key], checksumOf(t.desktop));
  assert.equal(fs.readFileSync(t.productPath, "utf8").replace(product.checksums[t.key], "X"),
               t.product.replace(JSON.parse(t.product).checksums[t.key], "X"));

  restoreAll(loc, { skipProcessCheck: true });
  assert.deepEqual([sha(t.glass), sha(t.desktop)], before);
  assert.equal(fs.readFileSync(t.productPath, "utf8"), t.product);
  assert.equal(fs.existsSync(t.glass + ".cursor-patcher.bak"), false);
});

test("re-applying starts from the backup, not from the patched file", () => {
  const t = fakeApp();
  const loc = locate(t.app);
  applyAll(loc, patches, patches, opts);
  const once = sha(t.glass);
  applyAll(loc, patches, patches, opts);
  assert.equal(sha(t.glass), once);
});

test("a patch mismatch writes nothing", () => {
  const t = fakeApp();
  fs.writeFileSync(t.desktop, "var nothing=1;\n");
  const loc = locate(t.app);
  const before = [sha(t.glass), sha(t.desktop), fs.readFileSync(t.productPath, "utf8")];
  assert.throws(() => applyAll(loc, patches, patches, opts), /命中 0 次/);
  assert.deepEqual([sha(t.glass), sha(t.desktop), fs.readFileSync(t.productPath, "utf8")], before);
  assert.equal(fs.existsSync(t.glass + ".cursor-patcher.bak"), false);
});

test("refuses an unverified version without --force", () => {
  const t = fakeApp();
  assert.throws(() => applyAll(locate(t.app), patches, patches, { skipProcessCheck: true }), /未验证|不在已验证/);
});

test("refuses to use a backup from another version", () => {
  const t = fakeApp();
  applyAll(locate(t.app), patches, patches, opts);
  fs.writeFileSync(t.productPath, fs.readFileSync(t.productPath, "utf8").replace("1.2.3", "9.9.9"));
  assert.throws(() => applyAll(locate(t.app), patches, patches, opts), /没有与当前版本/);
  assert.throws(() => restoreAll(locate(t.app), { skipProcessCheck: true }), /没有与当前版本/);
});

test("writeAll rolls back already-renamed files when a later rename fails", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-wa-"));
  const a = path.join(dir, "a.txt");
  const b = path.join(dir, "b", "b.txt"); // 目录不存在 -> 暂存阶段就会失败
  fs.writeFileSync(a, "old-a");
  assert.throws(() => writeAll([
    { file: a, content: "new-a", undo: "old-a" },
    { file: b, content: "new-b", undo: "" },
  ]));
  assert.equal(fs.readFileSync(a, "utf8"), "old-a");
  assert.equal(fs.readdirSync(dir).filter((n) => n.includes("cursor-patcher.tmp")).length, 0);
});

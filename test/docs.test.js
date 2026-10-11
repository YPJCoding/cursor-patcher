"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { render } = require("../scripts/update-readme");
const { features } = require("../src/features");

test("README feature table is in sync with the registry (run `npm run docs`)", () => {
  const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  assert.equal(render(readme, features), readme);
  for (const f of features) assert.ok(readme.includes(`src/features/${f.id}/feature.md`), f.id);
});

test("render needs both markers", () => {
  assert.throws(() => render("no markers", features), /标记/);
});

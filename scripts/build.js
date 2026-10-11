#!/usr/bin/env node
"use strict";
// 零依赖打包:把 src/ 下的 CommonJS 模块和 JSON 内联成单个可执行文件。
//   node scripts/build.js        产出 dist/cursor-patcher.js
const fs = require("fs");
const path = require("path");
const { builtinModules } = require("module");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const ENTRY = path.join(src, "cli.js");
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const modules = new Map(); // 绝对路径 -> { id, code, json }

function resolveFile(from, req) {
  const base = path.resolve(path.dirname(from), req);
  for (const c of [base, base + ".js", base + ".json", path.join(base, "index.js")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  throw new Error(`无法解析 require("${req}") (来自 ${from})`);
}

// 单文件产物里没有文件系统可扫,所以把 features/index.js 的自动发现换成等价的静态列表。
const FEATURES_INDEX = path.join(src, "features", "index.js");
function featureRegistryCode() {
  const dir = path.join(src, "features");
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "feature.js")))
    .map((d) => d.name)
    .sort();
  const validateId = collect(path.join(dir, "validate.js"));
  const rows = names.map((n) => {
    const f = collect(path.join(dir, n, "feature.js"));
    const vFile = path.join(dir, n, "verified.json");
    const v = fs.existsSync(vFile) ? `__req(${collect(vFile)})` : "undefined";
    return `[${JSON.stringify(n)}, __req(${f}), ${v}]`;
  });
  return (
    `const validate = __req(${validateId}).validate;\n` +
    `const rows = [${rows.join(", ")}];\n` +
    `module.exports = { features: rows.map(([n, f, v]) => validate({ ...f, verified: v }, n)) };`
  );
}

function collect(file) {
  if (modules.has(file)) return modules.get(file).id;
  const id = modules.size;
  const entry = { id, file, deps: {} };
  modules.set(file, entry);
  if (file.endsWith(".json")) {
    entry.json = fs.readFileSync(file, "utf8");
    return id;
  }
  if (file === FEATURES_INDEX) {
    entry.code = featureRegistryCode();
    return id;
  }
  let code = fs.readFileSync(file, "utf8").replace(/^#!.*\n/, "");
  code = code.replace(/\brequire\((["'])([^"']+)\1\)/g, (m, q, req) => {
    if (builtins.has(req)) return m;
    if (!req.startsWith(".")) throw new Error(`不支持的第三方依赖: ${req} (${file})`);
    const depId = collect(resolveFile(file, req));
    return `__req(${depId})`;
  });
  entry.code = code;
  return id;
}

function bundle() {
  const entryId = collect(ENTRY);
  const parts = [...modules.values()].map((m) => {
    const rel = path.relative(root, m.file);
    const body = m.json !== undefined ? `module.exports = ${m.json};` : m.code;
    return `/* ${rel} */\n${m.id}: function (module, exports, require) {\n${body}\n}`;
  });
  return (
    `#!/usr/bin/env node\n"use strict";\n` +
    `// 由 scripts/build.js 生成,请勿手工编辑。\n` +
    `const __defs = {\n${parts.join(",\n")}\n};\n` +
    `const __cache = {};\n` +
    `function __req(id) {\n` +
    `  if (__cache[id]) return __cache[id].exports;\n` +
    `  const m = (__cache[id] = { exports: {} });\n` +
    `  __defs[id](m, m.exports, require);\n` +
    `  return m.exports;\n}\n` +
    `__req(${entryId});\n`
  );
}

function main() {
  fs.rmSync(dist, { recursive: true, force: true });
  const out = path.join(dist, "cursor-patcher.js");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(out, bundle(), { mode: 0o755 });

  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`dist/cursor-patcher.js  ${kb} KB  (${modules.size} 个模块)`);
}

main();

// gen-mods.js —— 扫描 mods/ 生成 app/mods-data.subl（构建期"启动扫描"）
//
// 约定：mods/<modid>/{mod.json, entities.json, logic/*.subl}
// 产物：app/mods-data.subl —— fun MODS_JSON(): Str = "[{...}]" fun MODS_COUNT(): Nat = N
// 顶栏底栏面板的一切文案都经此链路来自模组 JSON；本体不含具体内容。
// 用法：node scripts/gen-mods.js  （build.ps1 在 compile 前调用本脚本）
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.resolve(__dirname, "..");
const MODS_DIR = path.join(R, "mods");
const OUT = path.join(R, "app", "mods-data.subl");

function fail(msg) { console.log("MODS-SCAN FAIL " + msg); process.exit(1); }
if (!fs.existsSync(MODS_DIR)) fail("mods/ 目录不存在");

const ids = fs.readdirSync(MODS_DIR, { withFileTypes: true })
    .filter(function (e) { return e.isDirectory(); })
    .map(function (e) { return e.name; })
    .sort();
if (ids.length === 0) fail("mods/ 下无可发现模组（需至少一个 <modid>/ 子目录）");

const mods = [];
ids.forEach(function (id) {
    const dir = path.join(MODS_DIR, id);
    const modP = path.join(dir, "mod.json");
    const entP = path.join(dir, "entities.json");
    if (!fs.existsSync(modP)) fail(id + "/mod.json 缺失");
    if (!fs.existsSync(entP)) fail(id + "/entities.json 缺失");
    var mod, ent;
    try { mod = JSON.parse(fs.readFileSync(modP, "utf8")); }
    catch (e) { fail(id + "/mod.json 解析失败 " + String(e.message).slice(0, 80)); }
    try { ent = JSON.parse(fs.readFileSync(entP, "utf8")); }
    catch (e) { fail(id + "/entities.json 解析失败 " + String(e.message).slice(0, 80)); }
    if (mod.id !== id) fail(id + "/mod.json 的 id 与目录名不一致（" + mod.id + "）");
    var logic = [];
    var ldir = path.join(dir, "logic");
    if (fs.existsSync(ldir)) {
        logic = fs.readdirSync(ldir).filter(function (f) { return f.endsWith(".subl"); }).sort();
    }
    mods.push({
        id: mod.id, name: mod.name || mod.id, version: mod.version || 1,
        deps: mod.deps || [], logic: logic, mod: mod, entities: ent
    });
});

// 校验关键字段（缺失给出可定位错误，避免运行期空链路）
mods.forEach(function (m) {
    var p = m.mod.player || {};
    var t = m.mod.time || {};
    var miss = [];
    if (!p.country) miss.push("player.country");
    if (!p.faction) miss.push("player.faction");
    if (!t.startYear) miss.push("time.startYear");
    if (!t.startMonth) miss.push("time.startMonth");
    if (miss.length) fail(m.id + "/mod.json 缺字段 " + miss.join(","));
});

var json = JSON.stringify(mods);
var esc = json.split("\\").join("\\\\").split('"').join('\\"').split("\n").join("\\n");
var out = [
    "// mods-data.subl —— mods/ 扫描产物（scripts/gen-mods.js 生成，勿手改）",
    "// 顶栏底栏面板数据均来自此处；本体只是模组加载器，不含具体内容。",
    "// 生成时间：" + new Date().toISOString(),
    "fun MODS_JSON(): Str = \"" + esc + "\"",
    "fun MODS_COUNT(): Nat = " + mods.length,
    ""
].join("\n");
fs.writeFileSync(OUT, out);
console.log("MODS-SCAN " + mods.length + " mod(s): " + mods.map(function (m) {
    return m.id + " (" + m.name + ", logic=" + m.logic.length + " file(s))";
}).join(", "));
console.log("MODS-WRITE " + OUT + " json=" + json.length + " B");

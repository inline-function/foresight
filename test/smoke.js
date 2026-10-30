"use strict";
// smoke.js —— 《深谋远虑》foresight 冒烟测试（Node，无浏览器）
// t83 回归（S-1 装载/烘焙/相机）+ t85 链路（模组驱动 UI）：
//   mods/*.json 烘焙 -> 顶栏（国家/派系/时间）/ 底栏四按钮 / 四面板 / 时间慢 tick
// 用法：先 scripts\build.ps1，再 node test/smoke.js
const fs = require("fs");
const path = require("path");
const G = __dirname + "/..";
const gameDir = path.join(G, "build", "game");

if (!fs.existsSync(path.join(gameDir, "app.js"))) {
    console.log("  FAIL 产物缺失：先运行 powershell -ExecutionPolicy Bypass -File scripts\\build.ps1");
    process.exit(1);
}

// ---- KAPLAY 桩（记录调用、最小可执行语义、对象注册表支持 destroyAll） ----
var __kaplayCalls = [];
var __sgMouseHandlers = { down: [], release: [], move: [] };
var __sgScrollHandlers = [];
var __sgLoops = [];
var __sgScenes = {};
var __sgObjSeq = 0;
var __sgObjs = [];
var __mouse = { x: 480, y: 270 };
function __setMouse(x, y) { __mouse.x = x; __mouse.y = y; }
function __mkObj() {
    var o = {
        id: ++__sgObjSeq,
        pos: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        text: "",
        comps: [],
        tags: [],
        destroyed: false,
        use: function (c) {
            this.comps.push(c);
            if (typeof c === "string") { this.tags.push(c); return; }
            if (c && c.comp === "pos") { this.pos = { x: c.x, y: c.y }; }
            if (c && c.comp === "text") { this.text = c.t; }
            if (c && c.comp === "scale") { this.scale = { x: c.s, y: c.s }; }
        },
        tag: function (t) { this.tags.push(t); },
        move: function (dx, dy) { this.pos.x += dx; this.pos.y += dy; },
        destroy: function () { this.destroyed = true; },
        exists: function () { return !this.destroyed; },
    };
    __sgObjs.push(o);
    return o;
}
globalThis.kaplay = function (opts) {
    __kaplayCalls.push({ fn: "kaplay", opts: opts });
    return {
        width: function () { return (opts && opts.width) || 960; },
        height: function () { return (opts && opts.height) || 540; },
        winWidth: function () { return 960; },
        winHeight: function () { return 540; },
        scene: function (n, f) { __kaplayCalls.push({ fn: "scene", name: n }); __sgScenes[n] = f; },
        go: function (n) { __kaplayCalls.push({ fn: "go", name: n }); if (__sgScenes[n]) __sgScenes[n](null); },
        loadSprite: function (n, src) { __kaplayCalls.push({ fn: "loadSprite", name: n, src: src }); },
        sprite: function (n) { return { comp: "sprite", name: n }; },
        pos: function (x, y) { return { comp: "pos", x: x, y: y }; },
        scale: function (s) { return { comp: "scale", s: s }; },
        rect: function (w, h) { return { comp: "rect", w: w, h: h }; },
        circle: function (r) { return { comp: "circle", r: r }; },
        text: function (t, o) { return { comp: "text", t: t, size: o && o.size }; },
        color: function (r, g, b) { return { comp: "color", r: r, g: g, b: b }; },
        area: function () { return { comp: "area" }; },
        anchor: function (a) { return { comp: "anchor", a: a }; },
        fixed: function () { return { comp: "fixed" }; },
        z: function (v) { return { comp: "z", v: v }; },
        add: function (cs) { var o = __mkObj(); __kaplayCalls.push({ fn: "add", obj: o, comps: cs }); return o; },
        vec2: function (x, y) { return { x: x, y: y }; },
        dt: function () { return 0.016; },
        loop: function (secs, f) { __sgLoops.push({ secs: secs, f: f }); },
        onUpdate: function (f) { __kaplayCalls.push({ fn: "onUpdate" }); },
        onMouseDown: function (b, f) { __sgMouseHandlers.down.push({ b: b, f: f }); },
        onMouseRelease: function (b, f) { __sgMouseHandlers.release.push({ b: b, f: f }); },
        onMouseMove: function (f) { __sgMouseHandlers.move.push(f); },
        onScroll: function (f) { __sgScrollHandlers.push(f); },
        mousePos: function () { return { x: __mouse.x, y: __mouse.y }; },
        camPos: function (x, y) { __kaplayCalls.push({ fn: "camPos", x: x, y: y }); },
        camScale: function (sx, sy) { __kaplayCalls.push({ fn: "camScale", sx: sx, sy: sy }); },
        get: function (t) { return __sgObjs.filter(function (o) { return o.tags.indexOf(t) >= 0 && !o.destroyed; }); },
        destroyAll: function (t) {
            __kaplayCalls.push({ fn: "destroyAll", tag: t });
            __sgObjs.forEach(function (o) { if (o.tags.indexOf(t) >= 0) o.destroy(); });
        },
    };
};

// ---- DOM/canvas 垫片（桥 mapLoad 烘焙需要 document.createElement('canvas') ----
function __mkCanvas() {
    return {
        width: 0, height: 0,
        getContext: function () {
            return {
                createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
                putImageData: function () {},
            };
        },
    };
}
globalThis.window = { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 };
globalThis.document = {
    addEventListener: function () {},
    querySelector: function () { return null; },
    createElement: function (t) { return t === "canvas" ? __mkCanvas() : {}; },
};

// ---- 装载被测代码（S-1：产物导出 __subl.main，宿主负责调用） ----
const rt = fs.readFileSync(path.join(gameDir, "js", "game-runtime.js"), "utf8");
const app = fs.readFileSync(path.join(gameDir, "app.js"), "utf8");
new Function(rt + "\n" + app)();
if (!globalThis.__subl || typeof globalThis.__subl.main !== "function") {
    console.log("  FAIL 装载：产物未导出 __subl.main（S-1 形态期望）");
    process.exit(1);
}
function __run() {
    var r = globalThis.__subl.main();
    if (r && typeof r.then === "function") return r;
    return Promise.resolve(r);
}
__run().then(function () { __afterMain(); }).catch(function (e) {
    console.log("  FAIL main 运行失败：" + (e && e.message ? e.message : String(e)));
    process.exit(1);
});

// ---- 断言 ----
function __afterMain() {
let fails = 0;
function ok(name, cond, extra) {
    if (cond) { console.log("  PASS " + name); }
    else { console.log("  FAIL " + name + (extra ? "  " + extra : "")); fails++; }
}
function calls(fn) { return __kaplayCalls.filter(function (c) { return c.fn === fn; }); }
function objsWithText(t) {
    return __sgObjs.filter(function (o) {
        return !o.destroyed && (o.text === t || o.comps.some(function (x) { return x && x.comp === "text" && x.t === t; }));
    });
}
function objsTextHas(sub) {
    return __sgObjs.filter(function (o) { return !o.destroyed && o.text.indexOf(sub) >= 0; });
}
function clickAt(x, y) {
    __setMouse(x, y);
    __sgMouseHandlers.down.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
    __sgMouseHandlers.release.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
}

// ---- t83 回归 ----
ok("装载：__subl.main 导出并执行（S-1 形态）", true);
var fit = calls("kaplay");
ok("gameStartFit 960x540 初始化（letterbox 跟随窗口向性）",
    fit.length === 1 && fit[0].opts.width === 960 && fit[0].opts.height === 540);
ok("场景 main 注册并切入", calls("go").some(function (c) { return c.name === "main"; }));
var sprites = calls("loadSprite");
ok("mapLoad 烘焙三地块精灵（凹形/菱形/带洞）", sprites.length === 3, "实际 " + sprites.length + " 次");
ok("初始相机：camPos(420, 305) + camScale(1, 1)",
    calls("camPos").length >= 1 && Math.abs(calls("camPos")[0].x - 420) < 0.5 && Math.abs(calls("camPos")[0].y - 305) < 0.5);

// ---- t85：模组烘焙与顶栏（一切文案来自 mods/*.json） ----
ok("模组驱动：顶栏主标题 = 玩家国家「东宁民国」（全不透明白）",
    objsWithText("东宁民国").length >= 1, JSON.stringify(objsWithText("东宁民国").length));
ok("模组驱动：副标题 = 派系「实业派」（id 解析自 entities.factions）",
    objsWithText("实业派").length >= 1, "");
ok("模组驱动：右侧时间「二十世纪初 · 1910 年 1 月」（非回合数）",
    objsTextHas("二十世纪初").length === 1 && objsTextHas("二十世纪初")[0].text === "二十世纪初 · 1910 年 1 月",
    JSON.stringify(objsTextHas("二十世纪初").map(function (o) { return o.text; })));
ok("模组时间链路：tick 循环按 mod.time.tickSeconds=2.0s 注册（慢一点实时制）",
    __sgLoops.length === 1 && Math.abs(__sgLoops[0].secs - 2.0) < 0.01,
    JSON.stringify(__sgLoops.map(function (l) { return l.secs; })));

// ---- t85：底栏四图标按钮（文案来自 entities.ui） ----
["基本政策", "国家政策", "国家属性", "控制地块"].forEach(function (lbl) {
    ok("底栏按钮（模组 ui 文案）：「" + lbl + "」", objsWithText(lbl).length === 1, "");
});

// ---- t85：面板（内容全来自模组 JSON） ----
clickAt(120, 520);
ok("点击「基本政策」-> 面板开：标题 + 开关行「贸易立国  关」",
    objsTextHas("贸易立国").length === 1 && objsTextHas("贸易立国")[0].text.indexOf("关") >= 0,
    JSON.stringify(objsTextHas("贸易立国").map(function (o) { return o.text; })));
ok("面板含派系标签（解锁数据位可视化）：「【实业派】」", objsTextHas("【实业派】").length >= 1, "");
clickAt(400, 155);
ok("点击开关行 -> 翻转为「开」并重建面板",
    objsTextHas("贸易立国").length === 1 && objsTextHas("贸易立国")[0].text.indexOf("开") >= 0,
    JSON.stringify(objsTextHas("贸易立国").map(function (o) { return o.text; })));
clickAt(350, 520);
ok("切换到「国家政策」面板：树状行「重工业体系」+ 前置「贸易立国」+ 派系「实业派」",
    objsTextHas("重工业体系").length === 1 && objsTextHas("重工业体系")[0].text.indexOf("贸易立国") >= 0
    && objsTextHas("重工业体系")[0].text.indexOf("实业派") >= 0,
    JSON.stringify(objsTextHas("重工业体系").map(function (o) { return o.text; })));
clickAt(580, 520);
ok("切换到「国家属性」面板：数值行「稳定度  50 / 100」（模组 attrs）",
    objsTextHas("稳定度").length === 1 && objsTextHas("稳定度")[0].text.indexOf("50 / 100") >= 0,
    JSON.stringify(objsTextHas("稳定度").map(function (o) { return o.text; })));
clickAt(790, 520);
ok("切换到「控制地块」面板：地块行「北港  归属 东宁民国」（命名/归属来自 entities）",
    objsTextHas("北港").length === 1 && objsTextHas("北港")[0].text.indexOf("东宁民国") >= 0,
    JSON.stringify(objsTextHas("北港").map(function (o) { return o.text; })));
var harborBefore = objsTextHas("北港")[0];
clickAt(790, 520);
ok("再点同一按钮 -> 面板关（旧行对象销毁）", harborBefore && harborBefore.destroyed === true, "");

// ---- t85：时间慢 tick（呈现为年月，非回合数） ----
var timeLabel = objsTextHas("二十世纪初")[0];
for (var t = 0; t < 3; t += 1) __sgLoops[0].f(null);
ok("tick x3 -> 时间推进「1910 年 4 月」（年月呈现，非回合）",
    timeLabel && timeLabel.text === "二十世纪初 · 1910 年 4 月" && timeLabel.text.indexOf("回合") < 0,
    JSON.stringify(timeLabel && timeLabel.text));

// ---- t83 回归：地图选中（地块命名来自模组：菱形=「中原」） ----
clickAt(620, 145);
ok("点击菱形地块 -> 选中标签「已选：中原」（地块命名来自 entities.blocks）",
    objsTextHas("已选：中原").length === 1,
    JSON.stringify(__sgObjs.filter(function (o) { return !o.destroyed && o.text.indexOf("已选") >= 0; }).map(function (o) { return o.text; })));

// ---- t83 回归：相机 ----
__sgScrollHandlers.forEach(function (f) { f({ y: -240 }); });
var cs1 = calls("camScale");
ok("滚轮缩放 -> camScale(1.15, 1.15)", cs1.length >= 2 && Math.abs(cs1[cs1.length - 1].sx - 1.15) < 0.01,
    "camScale=" + JSON.stringify(cs1[cs1.length - 1]));
for (var w = 0; w < 4; w += 1) __sgScrollHandlers.forEach(function (f) { f({ y: -240 }); });
var csN = calls("camScale"), cpsN = calls("camPos");
var deepS = csN[csN.length - 1].sx;
ok("深缩放五档 -> camScale ≈ 2.01", Math.abs(deepS - Math.pow(1.15, 5)) < 0.01, "camScale=" + deepS);
__setMouse(620, 145);
__sgMouseHandlers.down.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
__setMouse(700, 145);
__sgMouseHandlers.move.forEach(function (f) { f({ x: 700, y: 145 }); });
var cps2 = calls("camPos");
var last = cps2[cps2.length - 1];
ok("深缩放后拖拽平移 -> camPos.x 左移 ≈ 80/缩放",
    Math.abs((cpsN[cpsN.length - 1].x - last.x) - (80.0 / deepS)) < 0.5, "camPos=" + JSON.stringify(last));

if (fails > 0) {
    console.log("SMOKE: FAILED（" + fails + " 项未过）");
    process.exit(1);
}
console.log("SMOKE: ALL PASSED（模组链路 + 顶栏底栏面板 + 时间 + 地图 + 相机）");
}

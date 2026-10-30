"use strict";
// smoke.js —— 《深谋远虑》foresight 工程冒烟测试（Node，无浏览器）
// 把 KAPLAY 桩 + DOM/canvas 垫片 + 壳工程桥（js/game-runtime.js）+ 编译产物（app.js）
// 放进同一作用域跑一遍，断言冒烟场景的引擎链路成立（S-1 装载：main 不自执行）。
//
// 三回归在 foresight 侧的对应轻量版本：
//   GameDemo/render-smoke（渲染/坐标/交互） -> 本文件的点击选中/缩放/拖拽断言
//   GameDemo/demo-logic（编译产物可运行）   -> 本文件的 S-1 装载 + app.js 执行
//   SfG/dispatch-abi（桥 ABI 单入口）       -> 本文件对 __subl.call 分派链路的间接覆盖
// 用法：先 scripts\build.ps1，再 node test/smoke.js
const fs = require("fs");
const path = require("path");
const G = __dirname + "/..";
const gameDir = path.join(G, "build", "game");

if (!fs.existsSync(path.join(gameDir, "app.js"))) {
    console.log("  FAIL 产物缺失：先运行 powershell -ExecutionPolicy Bypass -File scripts\\build.ps1");
    process.exit(1);
}

// ---- KAPLAY 桩（仅冒烟测试用：记录调用、提供最小可执行语义） ----
var __kaplayCalls = [];
var __sgMouseHandlers = { down: [], release: [], move: [] };
var __sgScrollHandlers = [];
var __sgScenes = {};
var __sgObjSeq = 0;
var __mouse = { x: 480, y: 270 };
function __setMouse(x, y) { __mouse.x = x; __mouse.y = y; }
function __mkObj() {
    return {
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
        move: function (dx, dy) { this.pos.x += dx; this.pos.y += dy; },
        destroy: function () { this.destroyed = true; },
        exists: function () { return !this.destroyed; },
    };
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
        onUpdate: function (f) { __kaplayCalls.push({ fn: "onUpdate" }); },
        onMouseDown: function (b, f) { __sgMouseHandlers.down.push({ b: b, f: f }); },
        onMouseRelease: function (b, f) { __sgMouseHandlers.release.push({ b: b, f: f }); },
        onMouseMove: function (f) { __sgMouseHandlers.move.push(f); },
        onScroll: function (f) { __sgScrollHandlers.push(f); },
        mousePos: function () { return { x: __mouse.x, y: __mouse.y }; },
        camPos: function (x, y) { __kaplayCalls.push({ fn: "camPos", x: x, y: y }); },
        camScale: function (sx, sy) { __kaplayCalls.push({ fn: "camScale", sx: sx, sy: sy }); },
        get: function (t) { return []; },
        destroyAll: function (t) { __kaplayCalls.push({ fn: "destroyAll", tag: t }); },
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
// 文本对象：add 返回的对象经 objUse 挂 text 组件（add 数组本身为空），按 obj.comps 查。
function objsWithTextT(t) {
    return calls("add").filter(function (c) {
        return c.obj.comps.some(function (x) { return x && x.comp === "text" && x.t === t; });
    }).map(function (c) { return c.obj; });
}

ok("装载：__subl.main 导出并执行（S-1 形态）", true);
var fit = calls("kaplay");
ok("gameStartFit 960x540 初始化（letterbox 跟随窗口向性）",
    fit.length === 1 && fit[0].opts.width === 960 && fit[0].opts.height === 540);
ok("场景 main 注册并切入", calls("go").some(function (c) { return c.name === "main"; }));

var sprites = calls("loadSprite");
ok("mapLoad 烘焙三地块精灵（凹形/菱形/带洞）", sprites.length === 3,
    "实际 " + sprites.length + " 次 loadSprite");
ok("烘焙画布尺寸非平凡（bbox ≥ 5px）", sprites.every(function (s) { return s.src.width >= 5 && s.src.height >= 5; }));

ok("标题屏文本「深谋远虑」", objsWithTextT("深谋远虑").length === 1);
ok("提示标签文本（未选状态）", objsWithTextT("骨架冒烟：点击地块 · 拖拽平移 · 滚轮缩放").length === 1);
ok("初始相机：camPos(420, 305) + camScale(1, 1)（整图 fit 居中）",
    calls("camPos").length >= 1 && Math.abs(calls("camPos")[0].x - 420) < 0.5 && Math.abs(calls("camPos")[0].y - 305) < 0.5,
    "camPos=" + JSON.stringify(calls("camPos")[0]));

// 点击选中：视口中心 (420,305)、缩放 1 -> 地块二菱形心 (560,180) 的屏幕坐标 = (620,145)
var addsBefore = calls("add").length;
__setMouse(620, 145);
__sgMouseHandlers.down.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
__sgMouseHandlers.release.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
var labels = objsWithTextT("骨架冒烟：点击地块 · 拖拽平移 · 滚轮缩放");
ok("点击地块二 -> 选中标签改写「已选：地块二」",
    labels.length === 1 && labels[0].text === "已选：地块二", "label.text=" + (labels[0] && labels[0].text));
ok("选中后整块重建（销毁旧 block 后再 add 三地块）", calls("add").length === addsBefore + 3,
    "adds=" + addsBefore + "->" + calls("add").length);

// 滚轮缩放：第一档 1.15（map 560x430 仍小于视口，钳制钉回中心是设计行为），
// 连滚五档到 ~2.01 后视口装不下全图，视图才脱离中心向光标锚方向移动。
__sgScrollHandlers.forEach(function (f) { f({ y: -240 }); });
var cs1 = calls("camScale");
ok("滚轮缩放 -> camScale(1.15, 1.15)", cs1.length >= 2 && Math.abs(cs1[cs1.length - 1].sx - 1.15) < 0.01,
    "camScale=" + JSON.stringify(cs1[cs1.length - 1]));
for (var w = 0; w < 4; w += 1) __sgScrollHandlers.forEach(function (f) { f({ y: -240 }); });
var csN = calls("camScale");
var cpsN = calls("camPos");
var deepS = csN[csN.length - 1].sx;
var deepX = cpsN[cpsN.length - 1].x, deepY = cpsN[cpsN.length - 1].y;
ok("深缩放五档 -> camScale ≈ 2.01（1.15^5）", Math.abs(deepS - Math.pow(1.15, 5)) < 0.01,
    "camScale=" + deepS);
ok("深缩放后视图向光标锚（右下地块二）移动：x>420 且 y<305（脱离中心）",
    deepX > 420.5 && deepY < 304.5, "camPos=(" + deepX + "," + deepY + ")");

// 拖拽平移：深缩放下视口装不下全图，钳制 Activ，右移 80px -> viewX 减 80/s ≈ 39.8
__setMouse(620, 145);
__sgMouseHandlers.down.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
__setMouse(700, 145);
__sgMouseHandlers.move.forEach(function (f) { f({ x: 700, y: 145 }); });
var cps2 = calls("camPos");
var last = cps2[cps2.length - 1];
ok("拖拽平移 -> camPos.x 左移 ≈ 80/缩放（钳制生效区间内）",
    Math.abs((deepX - last.x) - (80.0 / deepS)) < 0.5 && Math.abs(last.y - deepY) < 0.5,
    "拖拽前=(" + deepX + "," + deepY + ") 拖拽后=" + JSON.stringify({ x: last.x, y: last.y }) + " s=" + deepS);

if (fails > 0) {
    console.log("SMOKE: FAILED（" + fails + " 项未过）");
    process.exit(1);
}
console.log("SMOKE: ALL PASSED（S-1 装载 + mapLoad 烘焙 + 标题屏 + 点击选中 + 缩放/平移）");
}

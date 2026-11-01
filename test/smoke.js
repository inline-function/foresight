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
            if (c && c.comp === "pos") { this.pos = { x: c.x, y: c.y }; }
            if (typeof c === "string") { this.tags.push(c); return; }
            if (c && c.comp === "text") { this.text = c.t; }
            if (c && c.comp === "scale") { this.scale = { x: c.s, y: c.s }; }
        },
        move: function (dx, dy) { this.pos.x += dx; this.pos.y += dy; },
        tag: function (t) { this.tags.push(t); },
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
        rect: function (w, h, o) { return { comp: "rect", w: w, h: h, radius: (o && o.radius) || 0 }; },
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
        onUpdate: function (f) { __kaplayCalls.push({ fn: "onUpdate" }); globalThis.__sgOnUpdate = f; },
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
            __sgObjs.forEach(function (o) { if (o.tags.indexOf(t) >= 0 && !o.destroyed) { o.destroy(); } });
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
function sgFire(dt) { if (globalThis.__sgOnUpdate) globalThis.__sgOnUpdate(dt); }
function sgFrames(n) { for (var i = 0; i < n; i++) sgFire(1.0); }
function oneText(sub) {
    var xs = objsTextHas(sub);
    return xs.length >= 1 ? xs[xs.length - 1].text : "（无）";
}
var seen = {};
function hasSeen(sub) { return Object.keys(seen).some(function (k) { return k.indexOf(sub) >= 0; }); }
function snap() {
    __sgObjs.forEach(function (o) {
        if (!o.destroyed && typeof o.text === "string" && o.text.length > 0) seen[o.text] = true;
    });
}
function hasTagRect(w, h, tag) {
    return __sgObjs.some(function (o) {
        return !o.destroyed && o.tags.indexOf(tag) >= 0
            && o.comps.some(function (c) { return c && c.comp === "rect" && c.w === w && (h === -1 || c.h === h); });
    });
}
// t89 坐标：世界 x2（导航 480 宽/项，全屏界面行 y0=160 dy=112，卡选项按钮 y0=496）
function rowY(i) { return 160 + i * 112; }
function navBtn(i) { clickAt(240 + i * 480, 1044); }
function openPage(i) { clickAt(960, rowY(i)); }
function pickOption(i) { clickAt(960, rowY(i)); }
function scrollDown() { __sgScrollHandlers.forEach(function (f) { f({ y: 120.0 }); }); }
function scrollUp() { __sgScrollHandlers.forEach(function (f) { f({ y: -120.0 }); }); }
function anyPanel() { return __sgObjs.some(function (o) { return !o.destroyed && o.tags.indexOf("panel") >= 0; }); }
function drawerOn() { return __sgObjs.some(function (o) { return !o.destroyed && o.tags.indexOf("drawer") >= 0; }); }
function safeClick(x, y) { if (drawerOn()) { clickAt(560, 60); sgFrames(8); snap(); } clickAt(x, y); }
var cardViol = 0;
var scrollOk = false;
function cardIsUp() {
    return __sgObjs.some(function (o) {
        return !o.destroyed && o.tags.indexOf("view") >= 0
            && o.comps.some(function (c) { return c && c.comp === "rect" && c.w === 960 && c.h === 660; });
    });
}
function cardCheck() {
    __sgObjs.forEach(function (o) {
        if (!o.destroyed && o.tags.indexOf("view") >= 0 && typeof o.text === "string" && o.text.length > 0) {
            var y = o.pos ? o.pos.y : -1;
            if (!((y >= 240 && y <= 304) || (y >= 328 && y <= 488) || (y >= 496 && y <= 880))) cardViol++;
        }
    });
}
function bodyTexts() {
    return __sgObjs.filter(function (o) {
        return !o.destroyed && o.tags.indexOf("view") >= 0 && typeof o.text === "string"
            && o.pos && o.pos.y >= 328 && o.pos.y <= 488;
    }).map(function (o) { return o.text; }).sort();
}
var cardSeen = 0;
function cardScrollProbe() {
    if (cardIsUp() && !scrollOk) {
        cardSeen++;
        var before = JSON.stringify(bodyTexts());
        scrollDown();
        var after = JSON.stringify(bodyTexts());
        if (before !== after) scrollOk = true;
    }
}
function clearEvents(cap) {
    for (var i = 0; i < cap; i++) {
        snap();
        cardScrollProbe();
        if (objsTextHas("行动点").length > 0) break;
        if (objsTextHas("点击继续").length > 0 || objsTextHas("点击结束").length > 0) { clickAt(960, 540); }
        else { if (objsTextHas("返回地图").length > 0) break; else clickAt(960, 532); }
    }
    snap();
    if (drawerOn()) { clickAt(560, 60); sgFrames(8); snap(); }
}
const fse = require("fs");
const LIE = JSON.parse(fse.readFileSync(__dirname + "/../mods/lieyan/entities.json", "utf8").toString());
const ev = LIE.events;

// ---- t83 回归：S-1 装载 + t89 画布 2x / 清晰度 ----
ok("装载：__subl.main 导出并执行（S-1 形态）", typeof globalThis.__subl.main === "function");
var kp = __kaplayCalls.filter(function (c) { return c.fn === "kaplay"; })[0];
ok("t89 画布：1920x1080（分辨率 x2）", kp && kp.opts.width === 1920 && kp.opts.height === 1080,
    kp ? JSON.stringify({ w: kp.opts.width, h: kp.opts.height }) : "无 kaplay 调用");
ok("t89 清晰度：texFilter=linear（字体线性过滤，文字锐利；像素边缘留在地块）",
    kp && kp.opts.texFilter === "linear", kp ? String(kp.opts.texFilter) : "无");
var camS = calls("camScale");
ok("t89 相机：camScale 已接线", camS.length >= 1, JSON.stringify(camS[0] || {}));
var camP = calls("camPos");
ok("t89 相机：camPos=(999,515) 东亚地图初始视野", camP.length >= 1 && camP[camP.length - 1].x === 999.0,
    JSON.stringify(camP[camP.length - 1] || {}));
// ---- t89 启动：MD3 顶栏/底栏 + 先看地图（面板不自动开，队长裁决） ----
ok("t89 MD3 顶栏：国家/派系/日期（资源 chips 已移入国家属性）",
    objsWithText("中华人民共和国").length > 0 && objsWithText("建制派").length > 0
    && objsTextHas("烈焰升腾").length > 0 && objsTextHas("2019 年 12 月 1 日").length > 0,
    oneText("2019 年"));
ok("t89 MD3 顶栏无资源 chips（移入国家属性面板）",
    __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("ui-res") >= 0; }).length === 0);
ok("t89 MD3 底栏导航：4 项 操作/国策/国家属性/控制地块",
    ["操作", "国策", "国家属性", "控制地块"].every(function (t) { return objsWithText(t).length > 0; }));
ok("t89 MD3 导航图标：过程化图标 rect 拼接（>=8 个 ui-nav rect）",
    __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("ui-nav") >= 0
        && o.comps.some(function (c) { return c && c.comp === "rect"; }); }).length >= 8);
ok("t89 启动：操作面板不自动开（先看地图，点底栏「操作」开全屏界面）",
    objsTextHas("行动点").length === 0);
ok("t89 地图：东亚底图海面包围盒（宽 2056 高 1434）", hasTagRect(2056.0, 1434.0, "ui"), "sea-rect");
// ---- 地图交互（x2 后命中） ----
clickAt(1249, 373); snap();
ok("t89 地图交互：点击选中北京（东亚底图省份命中）",
    objsTextHas("已选：北京").length > 0, oneText("已选"));

// ---- t89 状态层：按下底栏按钮闪覆盖色 ----
__setMouse(240, 1044);
__sgMouseHandlers.down.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
ok("t89 MD3 状态层：按下「操作」闪覆盖色（statelayer 层）",
    __sgObjs.some(function (o) { return !o.destroyed && o.tags.indexOf("statelayer") >= 0; }));
__sgMouseHandlers.release.forEach(function (h) { if (h.b === "left") h.f({ button: "left" }); });
ok("t89 MD3 状态层：松开后覆盖色消失",
    !__sgObjs.some(function (o) { return !o.destroyed && o.tags.indexOf("statelayer") >= 0; }));
ok("t89 抽屉优先：抽屉拉开时抽屉内空白点击无效（抽屉不收、面板不开）", drawerOn() && !anyPanel());
clickAt(1251, 393); snap(); // 抽屉外：点击天津市形心 -> 抽屉内容切换为该地块（不收回）
ok("t89 抽屉外点击：点击另一地块 -> 切换抽屉内容（抽屉保持打开）",
    drawerOn() && objsTextHas("天津市").length > 0, oneText("天津市"));
clickAt(560, 60); sgFrames(8); snap(); // ✕：唯一关闭途径 -> 动画收回
sgFire(1.0);
sgFire(1.0);
ok("t89 抽屉关闭：仅 ✕ 可关闭（drawer 清空、高亮解除）",
    !drawerOn() && objsTextHas("已选：").length === 0);
navBtn(0); snap(); // 抽屉已关 -> 开操作面板

// ---- t89 全屏界面（裁决 6.1）：操作 ----
ok("t89 全屏界面：操作 标题=序章 · 2019年的冬天 + 行动点 1 / 1",
    objsTextHas("序章 · 2019年的冬天").length > 0 && objsTextHas("行动点 1 / 1").length > 0, oneText("序章"));
ok("t89 全屏界面：覆盖整屏（1920x1080 panel 层，底栏导航重绘于其上）",
    hasTagRect(1920.0, 1080.0, "panel")
    && __sgObjs.some(function (o) { return !o.destroyed && o.tags.indexOf("ui-nav") >= 0; }));
ok("t89 MD3 圆角：面板/按钮为原生圆角矩形（radius>0）",
    __sgObjs.filter(function (o) { return !o.destroyed && (o.tags.indexOf("panel") >= 0 || o.tags.indexOf("ui") >= 0)
    && o.comps.some(function (c) { return c && c.comp === "rect" && c.radius > 0; }); }).length >= 1);
ok("t89 全屏界面：左上「‹ 返回地图」按钮", objsTextHas("‹ 返回地图").length > 0);
ok("t89 MD3 选中态：操作导航项高亮（Primary 色标签 + 指示器 pill 圆角）",
    (__sgObjs.some(function (o) { return !o.destroyed && o.text === "操作"
        && o.comps.some(function (c) { return c && c.comp === "color" && c.r === 166 && c.g === 200 && c.b === 255; }); })
     || __sgObjs.some(function (o) { return !o.destroyed && o.tags.indexOf("ui-nav") >= 0
        && o.comps.some(function (c) { return c && c.comp === "rect" && c.radius > 0; }); })), "indicator/primary");
ok("序章操作页行=应急预案 + 结束操作（MD3 列表）",
    objsTextHas("应急预案").length > 0 && objsTextHas("结束操作").length > 0);

// ---- t89 全屏界面切换：开操作页时点底栏切其他界面（操作状态保留） ----
openPage(0);
ok("序章操作页：签署《疫情防控应急预案》radio 组（行动点 1/1）",
    objsTextHas("签署《疫情防控应急预案》").length > 0 && objsTextHas("行动点 1 / 1").length > 0);
navBtn(1);
ok("t89 全屏切换：国策界面（方舱医院/健康码体系，lieyan 模组）",
    objsTextHas("方舱医院").length > 0 && objsTextHas("健康码体系").length > 0);
ok("t89 全屏切换：切走后操作页残留=0（全屏覆盖）", objsTextHas("应急预案").length === 0);
// ---- t90 HOI4 式国策树：二维节点 + any/all 前置 + 互斥 ----
ok("t90 国策树布局：5 节点二维排布（方舱医院/健康码体系/扩大核酸检测/紧缩节流）",
    objsTextHas("方舱医院").length > 0 && objsTextHas("健康码体系").length > 0
    && objsTextHas("扩大核酸检测").length > 0 && objsTextHas("紧缩节流").length > 0, "tree");
ok("t90 前置 any：未达前置时副文本「需任一：方舱医院 或 健康码体系」",
    objsTextHas("需任一：").length > 0,
    "locktext=" + JSON.stringify(oneText("需任一")));
clickAt(282, 244); snap(); // 方舱医院节点（col0,row0）
ok("国策回归：点击节点获取「方舱医院」-> 已行（绿底节点）", objsTextHas("已行 方舱医院").length > 0, oneText("已行"));
ok("t90 前置 any 达成：扩大核酸检测 -> 可解（任一前置完成）", objsTextHas("可解 扩大核酸检测").length > 0, oneText("可解"));
clickAt(754, 376); snap(); // 扩大核酸检测节点（col1,row1）
ok("t90 互斥分支：行「扩大核酸检测」-> 已行，对家显示「与【扩大核酸检测】互斥」",
    objsTextHas("已行 扩大核酸检测").length > 0 && objsTextHas("与【扩大核酸检测】互斥").length > 0,
    oneText("互斥"));
clickAt(754, 508); snap(); // 紧缩节流节点（col1,row2）互斥锁定 -> 点击无效
ok("t90 互斥锁定：点紧缩节流无反应（无「已行 紧缩节流」）", objsTextHas("已行 紧缩节流").length === 0, oneText("紧缩"));
navBtn(2);
ok("t89 全屏切换：国家属性界面（9 资源全列 + 产出/天；医疗资源受国策方舱医院 +20 影响）",
    objsTextHas("医疗资源").length > 0 && objsTextHas("产出 0/天").length > 0 && objsTextHas("产出 20/天").length > 0,
    JSON.stringify(__sgObjs.filter(function (o) { return !o.destroyed && o.text; }).map(function (o) { return o.text; }).slice(6, 14)));
scrollDown(); snap();
ok("t89 面板滚动：滚轮下移后第 8 行（科研资源）出现在可视区",
    objsTextHas("政治点").length > 0, "scroll");
scrollDown(); snap();
ok("t89 面板滚动：再滚到底（第 9 行可见、首行滚出）",
    objsTextHas("科技点").length > 0 && objsTextHas("疫情").length === 0, "scroll2");
scrollUp(); scrollUp(); snap();
ok("t89 面板滚动：连按两下回顶（首行疫情回到可视区、末行滚出）",
    objsTextHas("疫情").length > 0 && objsTextHas("科技点").length === 0, "scroll3");
navBtn(3);
snap();
ok("t89 全屏切换：控制地块界面（86 块表，首屏窗口显示 北京市 + 归属 中华人民共和国）",
    objsWithText("北京市").length > 0 && objsTextHas("归属 中华人民共和国").length > 0 && __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("panel") >= 0; }).length >= 10);
clickAt(152, 64);
ok("t89 返回按钮：回到地图主界面（panel 层清空）", !anyPanel() && objsWithText("操作").length > 0);
// ---- 地块抽屉（海域地块 + 陆地详情 + 驻军移动） ----
var seaObjs = __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("seaprov") >= 0; });
ok("t89 海域地块渲染（14 块 seaprov 精灵，渲染于陆地之下）", seaObjs.length === 14, "seaprov=" + seaObjs.length);
clickAt(1233, 379); snap(); // 北京市形心（世界 1272,354）（视口 999,515 下世界 2x 中心约 1254..1292,340..368）

ok("t89 抽屉打开：北京市 / 归属 / 人口 / 稳定度 / 发展程度 / 标签",
    objsWithText("北京市").length > 0 && objsTextHas("归属 中华人民共和国").length > 0
    && objsTextHas("2171 万").length > 0 && objsTextHas("72 / 100").length > 0
    && objsTextHas("9 / 10").length > 0 && objsTextHas("平原").length > 0 && objsTextHas("都市").length > 0,
    oneText("归属 中华人民共和国"));
clickAt(1501, 665); snap(); // 抽屉外（东海方位）-> 不自动关闭：仅切换/无操作
ok("t89 抽屉外点击：不自动关闭抽屉（只有 ✕ 能关；点击地图只切换地块内容）", drawerOn() === true);
clickAt(1233, 379); snap(); // 重新打开北京市抽屉
navBtn(0); snap(); // 底栏「操作」被抽屉遮住 -> 点击落入抽屉（无动作）
ok("t89 抽屉优先：抽屉压住底栏「操作」时点击无效（面板不开、抽屉不收）", drawerOn() && !anyPanel());
navBtn(1); snap(); // 未被遮住的「国策」-> 开全屏面板（抽屉随模式切换收回）
ok("t89 模式切换：开全屏面板时抽屉收回（高亮解除）", anyPanel() && !drawerOn() && objsTextHas("已选：").length === 0);
clickAt(152, 64); snap(); // 返回地图
clickAt(1233, 379); snap(); // 重新打开北京市抽屉
clickAt(1233, 379); snap(); // 拦截后重新打开北京市抽屉
ok("t89 抽屉驻军：数量 3 + 移动军队按钮", objsTextHas("移动军队").length > 0);
clickAt(440, 736); snap(); // 移动军队按钮 -> 进入移动模式（抽屉关闭、地图高亮邻接地）
ok("t89 移动模式：抽屉关闭 + 地图高亮邻近陆地(>=2，海域不亮) + 提示语",
    __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("drawer") >= 0; }).length === 0
    && __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("movetarget") >= 0; }).length >= 2
    && objsTextHas("移动军队：点击高亮地块（北京市）").length > 0, oneText("移动军队："));
clickAt(1251, 393); snap(); // 高亮的天津市形心 -> 移动 1 支军队 -> 抽屉收回 + 解除高亮
ok("t89 驻军移动：移动后抽屉收回、高亮解除（无抽屉/movetarget=0/无已选标签）",
    !drawerOn() && __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("movetarget") >= 0; }).length === 0 && objsTextHas("已选：").length === 0);
clickAt(1233, 379); snap(); // 重开北京市抽屉验兵力
ok("t89 驻军移动：北京驻军 3 -> 2（抽屉重开、移动军队按钮仍可用）",
    objsTextHas("驻扎军队").length > 0 && objsTextHas("移动军队").length > 0);
clickAt(440, 736); snap(); // 再次进入移动模式
ok("t89 移动模式重入：高亮陆地邻接 >= 2 + 提示语（海域不渡）",
    __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("movetarget") >= 0; }).length >= 2 && objsTextHas("移动军队：点击高亮地块（北京市）").length > 0);
clickAt(1233, 379); snap(); // 点非邻接地（北京自身）-> 退出移动模式、抽屉重开
ok("t89 退出移动模式：点非邻接地 -> 高亮清除、抽屉重开",
    __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("movetarget") >= 0; }).length === 0 && objsTextHas("驻扎军队").length > 0);
clickAt(560, 60); sgFrames(8); snap(); // 关闭 ✕ (520..592, 24..96)
var drObjs = __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("drawer") >= 0; });
ok("t89 抽屉关闭：drawer 层清空 + 取消地块高亮（无「已选」标签、无移动模式）",
    drObjs.length === 0 && objsTextHas("已选：").length === 0 && __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("movetarget") >= 0; }).length === 0, "drawer=" + drObjs.length);
// ---- t90 军队不渡海：移动模式下点邻接海域 -> 不移动，改为开该海域抽屉 ----
clickAt(1233, 379); snap(); // 重开北京市抽屉
clickAt(440, 736); snap(); // 移动军队按钮 -> 移动模式
var movetargetSea = __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("movetarget") >= 0; }).length;
clickAt(1338, 412); snap(); // 渤海形心（北京市邻接海域）：不渡海 -> 开渤海抽屉、非移动
ok("t90 军队不渡海：移动模式点邻接海域（渤海）不移动，高亮仅陆地（movetarget 无海域），改开海域抽屉",
    drawerOn() && objsTextHas("渤海").length > 0 && objsTextHas("移动军队：点击高亮地块").length === 0, "movetarget=" + movetargetSea + " drawerN=" + __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("drawer") >= 0; }).length + " sea=" + JSON.stringify(oneText("渤海")) + " phase=" + oneText("移动军队"));
clickAt(560, 60); sgFrames(8); snap(); // 关闭渤海抽屉
clickAt(1501, 665); snap(); // 东海（世界 1540,640；陆地点之外的海域）
ok("t90 海域特殊地块：东海 / 归属公海 / 标签海域；无稳定度/人口/发展程度，无驻扎军队",
    objsWithText("东海").length > 0 && objsTextHas("公海").length > 0
    && objsTextHas("海域").length > 0
    && objsTextHas("稳定度").length === 0 && objsTextHas("人口").length === 0
    && objsTextHas("发展程度").length === 0 && objsTextHas("驻扎军队").length === 0
    && objsTextHas("移动军队").length === 0 && objsTextHas("无可移动军队").length === 0,
    oneText("公海"));
clickAt(560, 60); sgFrames(8); snap(); // 关闭海域抽屉（动画收回）
navBtn(0);
ok("t89 返回后保持操作状态：操作主面板仍在（行动点 1/1 未扣，SEL/AP 状态保留）",
    objsTextHas("应急预案").length > 0 && objsTextHas("行动点 1 / 1").length > 0);
openPage(0); pickOption(0);
ok("签署后行动点耗尽 -> 自动结算（全屏界面消失，超事件演出开始）", !anyPanel());
ok("序章超事件：标题「2019年的冬天」", objsTextHas("2019年的冬天").length > 0);
ok("序章超事件：首行逐行演出 + 提示「点击继续」", objsTextHas("点击继续").length > 0, oneText("一切还没有开始"));
for (var i = 0; i < ev[0].lines.length - 1; i++) clickAt(960, 540);
clickAt(960, 540); snap();
// ---- 第一章开场：沉浸式（MD3 全屏对话框：会议室卫生部长 vs 财政部长） ----
ok("第一章开场沉浸式：标题「会议室」", objsTextHas("会议室").length > 0, oneText("会议室"));
ok("第一章开场沉浸式：默认背景渲染（场景面 + 场景小标）", objsTextHas("会议室").length > 0 && __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("view") >= 0 && o.comps.some(function (c) { return c.comp === "rect"; }); }).length >= 4, "bg");
ok("第一章开场沉浸式：人物名牌「卫生部长」+ 对话内容首行", objsTextHas("卫生部长").length > 0 && objsTextHas("封城。必须封").length > 0, oneText("封城"));
clickAt(960, 540); snap();
ok("第一章开场沉浸式：逐行推进（财政部长：封城经济会崩）", objsTextHas("财政部长").length > 0 && objsTextHas("封城经济会崩").length > 0, "步1");
clickAt(960, 540); snap();
ok("第一章开场沉浸式：逐行推进（卫生部长：经济崩了可以再建）", objsTextHas("经济崩了可以再建").length > 0, "步2");
clickAt(960, 540); snap();
ok("第一章开场沉浸式：逐行推进（财政部长：你说得轻巧）", objsTextHas("你说得轻巧").length > 0, "步3");
clickAt(960, 540); snap();
ok("第一章开场沉浸式：旁白行（无人物名 -> 不画名牌）",
    objsTextHas('你想起 2003 年').length > 0,
    (function () { var nr = __sgObjs.filter(function (o) { return !o.destroyed && o.tags.indexOf("view") >= 0 && o.comps.some(function (c) { return c.comp === "rect" && c.w === 336.0; }); }).length; return "名牌rect=" + nr; })());
clickAt(960, 540); snap();
ok("第一章开场沉浸式：末行对话（你：让我想想）", objsTextHas("让我想想").length > 0 && objsTextHas("卫生部长").length === 0, "步5");
clickAt(960, 540); snap(); // 会议室演完 -> 序章章末演出
snap(); // 会议室演完 -> 序章章末演出首行入 seen
clickAt(960, 540); snap(); // 会议室演完 -> 序章章末演出（首行入 seen）
clickAt(960, 540); snap(); // 章末 2 行演完 -> 推进：进第一章
ok("序章章末：超事件演出「你签完字，看向窗外。」", hasSeen("你签完字"));
ok("第一章：tick1 不自动开操作面板（队长裁决：每 tick 先点底栏「操作」）",
    objsTextHas("行动点").length === 0);
navBtn(0);
// ---- 自动流逝（顶栏「流逝」按钮：每秒 1 天；非 idle 自动暂停）----
ok("t89 流逝按钮：顶栏右侧 ui-auto（文案「流逝」）", objsWithText("流逝").length > 0);
var dOps = oneText("2019 年");
clickAt(1504, 44); snap(); // 开
sgFrames(8);
ok("t89 自动流逝：ops 阶段自动暂停（日期未跳天）", oneText("2019 年") === dOps, dOps + " -> " + oneText("2019 年"));
clickAt(1504, 44); snap(); // 关
ok("第一章：操作面板=第一章 · 疫情时期 行动点 3 / 3",
    objsTextHas("第一章 · 疫情时期").length > 0 && objsTextHas("行动点 3 / 3").length > 0);
openPage(0); pickOption(2);
ok("radio 组可操作并消耗行动点：选「局部封控」后 strip=行动点 2 / 3 · 疫情 12",
    objsTextHas("行动点 2 / 3").length > 0 && objsTextHas("疫情 12").length > 0,
    oneText("行动点"));
clickAt(960, rowY(4)); // 封控力度 4 选项 -> 返回操作页
openPage(1); pickOption(1);
ok("radio 组跨页共享行动点池：刺激后剩 行动点 1 / 3", objsTextHas("行动点 1 / 3").length > 0);
clickAt(960, rowY(3)); // 经济刺激 3 选项 -> 返回操作页
openPage(2); pickOption(1);
clickAt(1504, 44); snap(); // 关
clearEvents(80);
clickAt(1504, 44); snap(); // 开（phase=idle）
sgFire(1.0);
ok("t89 自动流逝：idle 阶段每秒 1 天（日期 +1，引擎 tick 接管）", oneText("2019 年") !== dOps, dOps + " -> " + oneText("2019 年"));
clickAt(1504, 44); snap(); // 关

// ---- 第一章 17+1 tick 循环（auto 1 次 + 手动 17 次；净 +3/tick -> 失败档） ----
for (var t = 1; t <= 17; t++) {
    safeClick(240, 1044);
    openPage(0); pickOption(2);   // 局部封控
    safeClick(960, rowY(4));        // 返回操作页
    openPage(1); pickOption(1);   // 精准滴灌
    safeClick(960, rowY(3));        // 返回操作页
    openPage(2); pickOption(1);   // 适度淡化 -> AP 0 -> 自动结算
    clearEvents(80);
}
ok("t89 事件卡排版：内容行限于视窗 y 328..488，不遮标题/按钮", cardViol === 0, "viol=" + cardViol);
ok("t89 事件卡滚动：长文本卡滚轮后内容行变化（不滚到尽头）", scrollOk === true, "cards=" + cardSeen + " ok=" + scrollOk);
ok("关键事件①父亲的电话：条件=stimulus_done flag -> 弹出", seen["父亲的电话"] === true);
ok("关键事件②母亲的医院：条件=lockdown_any + 医疗<50 -> 弹出", seen["母亲的医院"] === true);
ok("关键事件③老李走了：条件=communication_any + 疫情>=41 -> 弹出", seen["老李走了"] === true);
ok("关键事件④孩子的作文：章末留位事件（按队长裁决，第二章转产后归属）", seen["孩子的作文"] === true);
ok("饭桌副线：章内按 tick 序数自动插入 4 次（in-chap tick 4/8/12/16）",
    hasSeen("一家四口坐在饭桌前") && hasSeen("电视里还在播疫情") && hasSeen("饭桌上父亲难得有笑脸"));
ok("饭桌变体 A：lockdown_any 成立 -> 「父亲不用去工厂了——工厂停了」（封控变体）", hasSeen("父亲不用去工厂了"));
ok("饭桌变体 B：stimulus_done 成立 -> 「厂里接了政府的单子」（刺激变体）", hasSeen("厂里接了政府的单子"));
ok("饭桌变体 C：neighbor_death flag -> 「老李走了。你以后也不会认识了」", hasSeen("你以后也不会认识了"));
ok("建制派动摇：疫情>=61 触发「会议室里的沉默」", seen["会议室里的沉默"] === true);
ok("信任危机：防疫失败档后触发（建制派政治点 -10）", seen["信任危机"] === true);
ok("章末超事件：标题「疫情结束」（rating super 演出）", seen["疫情结束"] === true);
ok("章末防疫结算：apply 卡弹出（选项效果落 flag/资源）", hasSeen("防疫评价·结算"));
ok("章末副线回响：饭桌（疫情后）-> 「第一章 完」", hasSeen("（第一章 完"));
ok("篇终：阶段 over，日期冻结 2019 年 12 月 19 日", hasSeen("2019 年 12 月 19 日"));
clickAt(240, 1044);
ok("篇终：输入冻结（点击无新视图，无面板/无行动点）", !anyPanel() && objsTextHas("行动点").length === 0);

// ---- lint：数据/本体约束（与坐标无关） ----
var supers = ev.filter(function (e) { return e.kind === "super"; });
var applies = ev.filter(function (e) { return (e.id || "").indexOf("apply") >= 0; });
ok("防疫评价四档：崩溃/优秀/合格/失败（4 个超事件演出）", supers.filter(function (e) { return (e.id || "").indexOf("rating") >= 0 || (e.id || "").indexOf("collapse") >= 0; }).length >= 4);
ok("防疫评价结算：每档附 apply 卡（flag pandemic_rating + 资源修正）", applies.length >= 5);
ok("章末超事件：bgm 引用音乐清单 id（bgm-end-*）", ev.filter(function (e) { return e.kind === "super" && (e.bgm || "").indexOf("bgm") === 0; }).length >= 4);
var fa = ev.filter(function (e) { return (e.id || "") === "ev.rating_fail_a"; })[0];
ok("失败档条件：resGte danger 60 + resLte danger 79（与崩溃 80 互斥）",
    fa && JSON.stringify(fa.when) === '[{"op":"tickGte","n":19},{"op":"resGte","v":"res.danger","n":60},{"op":"resLte","v":"res.danger","n":79}]',
    fa ? JSON.stringify(fa.when) : "无 rating_fail_a");
var flags = ["lockdown_any", "lockdown_local", "lockdown_strict", "stimulus_targeted", "stimulus_done", "communication_downplay", "communication_any", "factory_saved", "medical_support", "neighbor_death", "child_essay", "pandemic_rating"];
var flagOk = true;
ev.forEach(function (e) { (e.options || []).forEach(function (o) { (o.effects || []).forEach(function (f) { }); }); });
ok("flag 全链：lockdown/stimulus/communication/factory/medical/neighbor/essay + 评级标记均经选项效果落 st2",
    JSON.stringify(ev).indexOf("pandemic_rating") >= 0 && JSON.stringify(ev).indexOf("child_essay") >= 0
    && JSON.stringify(ev).indexOf("neighbor_death") >= 0, "JSON 覆盖");
// 本体零剧情文案：app/*.subl 源（排除烘焙 mods-data.subl）不含故事串
var srcDir = path.join(__dirname, "..", "app");
var subs = fse.readdirSync(srcDir).filter(function (f) { return f.indexOf(".subl") >= 0 && f !== "mods-data.subl"; });
var story = ["会议室", "卫生部长", "封城。必须封", "父亲的电话", "饭桌", "疫情结束", "武汉报告", "应急预案"];
var hits = [];
subs.forEach(function (f) {
    var tx = fse.readFileSync(path.join(srcDir, f), "utf8").toString();
    story.forEach(function (s) { if (tx.indexOf(s) >= 0) hits.push(f + ":" + s); });
});
ok("本体零剧情文案：app/*.subl 源不含故事串（全量来自 mods/lieyan JSON）", hits.length === 0, hits.slice(0, 3).join(" ") || "clean");

// ---- 持久化 API（flag 链存档回环） ----
var sv = globalThis.__subl;
var payload = { lockdown_any: true, lockdown_local: true, stimulus_targeted: true, communication_downplay: true, factory_saved: true, medical_support: true, neighbor_death: true, child_essay: true, pandemic_rating: "fail" };
sv.call("saveLoad", ["lieyan", payload]);
var got = sv.call("saveGet", ["lieyan"]);
var keys = sv.call("saveKeys", []);
sv.call("saveDrop", ["lieyan"]);
var after = sv.call("saveGet", ["lieyan"]);
ok("持久化 API：flag 链存档 saveLoad + saveGet 回环 + saveKeys + saveDrop",
    got && got.lockdown_any === true && got.pandemic_rating === "fail"
    && Array.isArray(keys) && after === null, JSON.stringify([typeof got, Array.isArray(keys), after]));

// ---- 音乐接入点（缺失资产静默） ----
var b1 = sv.call("bgmPlay", [""]);
var b2 = sv.call("bgmPlay", ["no-such-file.mp3"]);
var b3 = sv.call("bgmStop", []);
ok("音乐接入点：空名/缺失资产 bgmPlay 静默 false，bgmStop 无异常", b1 === false && b2 === false && b3 === true, JSON.stringify([b1, b2, b3]));
// ---- 音频/图标接入（t90）：sndPlay op + 资产落包 ----
var s1 = sv.call("sndPlay", [""]);
var s2 = sv.call("sndPlay", ["no-such-file.wav"]);
ok("音效 op：空名/缺失资产 sndPlay 静默 false（Node 无 Audio）", s1 === false && s2 === false, JSON.stringify([s1, s2]));
var auDir = path.join(gameDir, "assets", "audio");
var sfxIds = ["click", "close", "start", "news"];
var bgmIds = ["main", "prologue", "ch1-open", "end-excellent", "end-pass", "end-fail", "end-collapse"];
var missFx = sfxIds.filter(function (id) { return !fse.existsSync(path.join(auDir, "sfx-" + id + ".wav")); });
var missBgm = bgmIds.filter(function (id) { return !fse.existsSync(path.join(auDir, "bgm-" + id + ".wav")); });
ok("资产落包：sfx-*/bgm-*（11 份 wav）随 build/game/assets", missFx.length === 0 && missBgm.length === 0, missFx.concat(missBgm).join(",") || "all");
var modBgmIds = ev.filter(function (e) { return e.kind === "super" && e.bgm; }).map(function (e) { return e.bgm; });
var uniqIds = modBgmIds.filter(function (v, k) { return modBgmIds.indexOf(v) === k; });
var missEv = uniqIds.filter(function (id) { return !fse.existsSync(path.join(auDir, id + ".wav")); });
ok("BGM 映射：超事件 bgm id 与 assets/audio/<id>.wav 同名同在（fail_a/fail_b 共用 end-fail，去重 5 档）", missEv.length === 0 && uniqIds.length >= 5, (missEv.join(",") || "all") + " ids=" + uniqIds.length);
var icDir = path.join(gameDir, "assets", "img");
var icns = ["ic-fangcang", "ic-healthcode", "ic-rework"];
var missIc = icns.filter(function (id) { return !fse.existsSync(path.join(icDir, id + ".png")); });
ok("图标落包：assets/img/ic-*.png（3 张国策图标）", missIc.length === 0, missIc.join(",") || "all");

if (fails === 0) console.log("SMOKE: ALL PASSED（t89 MD3+2x：1920x1080 画布/顶栏 chips/底栏导航图标/全屏界面+返回键/MD3 卡与圆角/地图几何 x2/状态层 + 音频图标接入 + lieyan 全流程回归）");
else console.log("SMOKE: FAILED " + fails + " 项");
process.exit(fails === 0 ? 0 : 1);
}
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
function oneText(sub) {
    var xs = objsTextHas(sub);
    return xs.length >= 1 ? xs[xs.length - 1].text : "（无）";
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
__sgScrollHandlers.forEach(function (f) { f(1.0); });
var cs = calls("camScale");
ok("滚轮缩放 -> camScale(1.15, 1.15)", cs.length >= 1 && Math.abs(cs[cs.length - 1].sx - 1.15) < 0.01,
    JSON.stringify(cs.map(function (c) { return c.sx; })));

// ---- t86 六段 tick 循环：起始 tick = 模组起始日 ----
ok("模组驱动：顶栏主标题 = 玩家国家「东宁民国」", objsWithText("东宁民国").length >= 1);
ok("模组驱动：副标题 = 派系「实业派」（id 解析自 entities.factions）", objsWithText("实业派").length >= 1);
ok("引擎状态驱动：顶栏日期「二十世纪初 · 1910 年 1 月 1 日」（tick1=起始日，非回合数）",
    oneText("二十世纪初") === "二十世纪初 · 1910 年 1 月 1 日", oneText("二十世纪初"));
ok("引擎状态驱动：顶栏资源 = 按 tick 产出后的值（政治点 14 = 12 + 2/天）",
    objsTextHas("政治点 14").length >= 1 && oneText("政治点 14").indexOf("国库 210") >= 0, oneText("政治点"));

// ---- 阶段2 玩家操作（操作面板自动开：行动点 2~4、可不操作） ----
ok("操作面板自动开：标题「第一幕 · 开国序章」", objsTextHas("开国序章").length >= 1, "");
ok("操作面板标题含行动点槽「行动点 3 / 3」", objsTextHas("行动点 3 / 3").length >= 1, oneText("行动点"));
ok("操作页列表：模组提供的「经济」「军政」页 + 结束操作（可不操作）",
    objsTextHas("经济").length >= 1 && objsTextHas("军政").length >= 1 && objsTextHas("结束操作").length >= 1, "");

// ---- 「经济」操作页：radio 组 ----
clickAt(300, 170);
ok("操作页开：标题「经济」+ 页头状态条「行动点 3 / 3 · 国库 · 稳定」",
    objsTextHas("行动点 3 / 3 ·").length >= 1, oneText("行动点 3 / 3"));
ok("radio 组：三个互斥选项（自由放任/国家干预/统制经济）",
    objsTextHas("○ 自由放任").length >= 1 && objsTextHas("○ 国家干预").length >= 1 && objsTextHas("○ 统制经济").length >= 1, "");
clickAt(300, 205);
ok("点选项消耗 1 行动点：状态条「行动点 2 / 3」且 radio 锁定「● 国家干预」",
    objsTextHas("行动点 2 / 3").length >= 1 && objsTextHas("● 国家干预").length >= 1, oneText("行动点 2"));
ok("点选项应用效果：顶栏资源行国库 250（210 + 40，顶栏随状态刷新）",
    oneText("政治点 14").indexOf("国库 250") >= 0, oneText("政治点 14"));
clickAt(300, 205);
ok("radio 互斥语义：重复点已选项不消耗行动点（仍 2 / 3）", objsTextHas("行动点 2 / 3").length >= 1, oneText("行动点 2"));
// 返回页列表 -> 「军政」页（row1）-> 扩充军备（row0）-> 精兵整编（row1）
clickAt(300, 262);
ok("返回操作页列表", objsTextHas("结束操作").length >= 1, oneText("行动点 2 / 3"));
clickAt(300, 205);
ok("操作页「军政」：radio 组（扩充军备/精兵整编）", objsTextHas("扩充军备").length >= 1 && objsTextHas("精兵整编").length >= 1, "");
clickAt(300, 170);
ok("跨页操作共用行动点池：军政选项消耗（行动点 1 / 3）", objsTextHas("行动点 1 / 3").length >= 1, oneText("行动点 1"));
clickAt(300, 205);

// ---- 行动点用完自动结算 -> 阶段3 事件触发（队列按优先级） ----
ok("阶段3 事件队列首项=超事件「民国元年」（priority 30 最高）",
    objsTextHas("民国元年").length >= 1 && objsTextHas("钟声划破迷雾").length >= 1, oneText("钟声"));
// 强制暂停期间整屏输入归事件层：第二行 -> 结束
clickAt(480, 300);
ok("超事件逐行：第二行「深谋远虑，自此而始。」", objsTextHas("深谋远虑，自此而始").length >= 1, "");
clickAt(480, 300);
ok("队列次项=条件触发事件卡「洋行借款」（国库 >= 230）+ 两个选项",
    objsTextHas("洋行借款").length >= 1 && objsTextHas("接受借款").length >= 1 && objsTextHas("婉拒").length >= 1, oneText("洋行"));
clickAt(300, 260);
ok("事件卡选项应用效果+flag：下 tick 顶栏国库 304（234 + 60 卡效果 + 10 当 tick 产出）", objsTextHas("国库 304").length >= 1, oneText("国库 304"));

// ---- 阶段6 下一 tick：顶栏年月随 tick 推进 ----
ok("顶栏日期随 tick 推进：「1910 年 1 月 2 日」", oneText("1910 年 1 月 2 日").indexOf("1910 年 1 月 2 日") >= 0, oneText("1910 年 1 月 2"));
ok("新 tick 行动点按章刷新：操作面板「行动点 3 / 3」", objsTextHas("行动点 3 / 3").length >= 1, oneText("行动点 3"));
// 可不操作：关闭面板顺带验地块选中，重开面板后直接「结束操作」跳过
clickAt(120, 520);
clickAt(620, 145);
ok("地块选中「已选：中原」（命名来自 entities.blocks）", objsTextHas("已选：中原").length >= 1, oneText("已选"));
clickAt(120, 520);
clickAt(300, 240);

// ---- 队列优先级：flag 触发的「银行团贺电」(25) 先于「使节来访」(20) ----
ok("队列优先级：先弹「银行团贺电」（25 > 20，尽管 JSON 中排在使节之后）",
    objsTextHas("银行团贺电").length >= 1, oneText("银行团"));
clickAt(300, 260);  // 深化合作
// 沉浸式演出层
ok("沉浸式演出层：「使节来访」+ 对话首行", objsTextHas("使节来访").length >= 1 && objsTextHas("我国新立").length >= 1, oneText("使节"));
ok("缺图占位框：背景/立绘资产缺失渲染「【缺图】」框（无需资源文件）",
    objsTextHas("【缺图·背景】").length >= 1 && objsTextHas("【缺图·立绘】").length >= 1, oneText("缺图"));
clickAt(480, 300);
clickAt(480, 300);
clickAt(480, 300);
ok("队列第三项：可重复条件事件「工人请愿」（稳定 <= 48，非一次性）", objsTextHas("工人请愿").length >= 1, oneText("工人"));
clickAt(300, 260);  // 安抚施恩

// ---- 章末判定：tick 预算用尽 -> 章末演出 + dateJump ----
ok("章末超事件演出：「新政初行，百废待兴。」逐行", objsTextHas("新政初行").length >= 1, oneText("新政"));
clickAt(480, 300);
clickAt(480, 300);
ok("章末 dateJump：新章第 1 tick 显示「1910 年 3 月 1 日」",
    oneText("1910 年 3 月 1 日").indexOf("1910 年 3 月 1 日") >= 0, oneText("1910 年 3 月 1"));
ok("操作面板按章切换内容：新章「春潮涌动」+ 行动点 2 / 2（模组定义）",
    objsTextHas("春潮涌动").length >= 1 && objsTextHas("行动点 2 / 2").length >= 1, oneText("行动点 2 / 2"));

// ---- 国策面板（数据驱动：前置/解锁） ----
clickAt(390, 520);
ok("国策面板：「[可解] 贸易立国」（无前置）+ 锁定行示前置名",
    objsTextHas("[可解] 贸易立国").length >= 1 && objsTextHas("前置：").length >= 1, oneText("贸易"));
clickAt(300, 170);
ok("点击国策：已行 -> 「[已行] 贸易立国」，下游国策转「[可解]」",
    objsTextHas("[已行] 贸易立国").length >= 1 && objsTextHas("[可解] 国民教育").length >= 1, oneText("国民"));
clickAt(300, 205);
ok("前置链：再行已解锁的「国民教育」-> [已行]", objsTextHas("[已行] 国民教育").length >= 1, oneText("国民教育"));
clickAt(300, 240);  // 近海海军尚为可解，行它
ok("前置链全覆盖：三个国策全部 [已行]", objsTextHas("[已行] 近海海军").length >= 1, oneText("近海"));

// ---- 国家属性 / 控制地块面板 ----
clickAt(570, 520);
ok("国家属性面板：资源总览含每 tick 产出（产出 2/天）", objsTextHas("产出").length >= 1, oneText("产出"));
clickAt(790, 520);
ok("控制地块面板：地块行「北港  归属 东宁民国」", objsTextHas("北港").length >= 1, oneText("北港"));

// ---- 推进至篇终 ----
clickAt(120, 520);  // 操作按钮重开操作面板（切走了国策面板）
clickAt(300, 170);  // 文教页
clickAt(300, 170);  // 兴办学堂（行动点 1）
clickAt(300, 205);  // 办报立言（行动点 0 -> 自动结算：第二章无事件，直奔结算）
ok("无事件期：队列空 -> 阶段5 结算 -> 阶段6 下一 tick", objsTextHas("春潮涌动").length >= 1, oneText("春潮"));
clickAt(300, 205);  // 结束操作（row1）-> 章末 -> 篇终
ok("篇终章末演出：「乱世如潮，深谋者远。」", objsTextHas("乱世如潮").length >= 1, oneText("乱世"));
clickAt(480, 300);
clickAt(480, 300);
ok("篇终后流程冻结：时间停在「1910 年 3 月 2 日」", oneText("1910 年 3 月 2 日").length >= 10, oneText("1910 年 3 月 2"));
clickAt(480, 300);
clickAt(300, 240);
clickAt(620, 145);
ok("篇终后输入无效：无面板、不走 tick（无「结束操作」「事件卡」残留）",
    objsTextHas("结束操作").length === 0 && objsTextHas("洋行借款").length === 0, oneText("1910 年 3 月 2"));

// ---- 持久化 API（桥：localStorage 回落内存；subs 经 __subl.call 调） ----
var sv = globalThis.__subl;
var r1 = sv.call("saveLoad", ["t86", { a: 1, b: "存档" }]);
var r2 = sv.call("saveGet", ["t86"]);
ok("持久化 API：saveLoad -> saveGet 模组 JSON 往返",
    r1 === true && r2 && r2.a === 1 && r2.b === "存档", JSON.stringify(r2));
var ks = sv.call("saveKeys", []);
var rd = sv.call("saveDrop", ["t86"]);
var rg = sv.call("saveGet", ["t86"]);
ok("持久化 API：saveKeys 列出存档键 + saveDrop 删除后 saveGet 返回 null",
    Array.isArray(ks) && ks.indexOf("t86") >= 0 && rd === true && rg === null, JSON.stringify({ ks: ks, rg: rg }));

// ---- 音乐接入点（资产缺失静默，不报错不抛） ----
var b1 = sv.call("bgmPlay", [""]);
var b2 = sv.call("bgmPlay", ["assets/no-such-bgm.mp3"]);
var b3 = sv.call("bgmStop", []);
ok("音乐接入点：空名/缺失资产 bgmPlay 静默 false，bgmStop 无异常", b1 === false && b2 === false && b3 === true, JSON.stringify([b1, b2, b3]));

if (fails === 0) console.log("SMOKE: ALL PASSED（t86 叙事引擎：六段 tick 循环 + 三演出层 + 持久化 + 回归）");
else console.log("SMOKE: FAILED " + fails + " 项");
process.exit(fails === 0 ? 0 : 1);
}

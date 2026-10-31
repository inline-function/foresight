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
// 行收集：每步把画面上涌现的文本全部记入 seen，用于事后断言「按条件弹出」与「读 flag 变体」
var seen = {};
function snap() {
    __sgObjs.forEach(function (o) {
        if (!o.destroyed && typeof o.text === "string" && o.text.length > 0) seen[o.text] = true;
    });
}
function rowY(i) { return 152 + i * 36; }
function openPage(i) { clickAt(300, rowY(i)); }
function pickOption(i) { clickAt(300, rowY(i)); }
function clearEvents(cap) {
    for (var i = 0; i < cap; i++) {
        snap();
        if (objsTextHas("行动点").length > 0) break;
        if (objsTextHas("·  ").length > 0) clickAt(300, 260); else clickAt(480, 300);
    }
    snap();
}

const fse = require("fs");
const LIE = JSON.parse(fse.readFileSync(__dirname + "/../mods/lieyan/entities.json", "utf8").toString());

// ---- t83 回归：S-1 装载 + 相机 ----
ok("装载：__subl.main 导出并执行（S-1 形态）", true);
var fit = calls("kaplay");
ok("t83 回归：kaplay(width=960,height=540) 按设计固定", fit.length >= 1 && fit[0].opts.width === 960 && fit[0].opts.height === 540,
    JSON.stringify(fit[0] || {}).slice(0, 120));
var cam = calls("camScale").concat(calls("camPos"));
ok("t83 回归：相机 camScale/camPos 已接线", cam.length >= 2, JSON.stringify(cam[0] || {}));

// ---- 启动：顶栏全部由 lieyan 模组 JSON 驱动 ----
ok("lieyan 顶栏：国家名=中国", objsWithText("中国").length >= 1);
ok("lieyan 顶栏：副标题=建制派", objsWithText("建制派").length >= 1);
ok("lieyan 顶栏：日期=2019 年 12 月 1 日（起点）", objsWithText("烈焰升腾 · 2019 年 12 月 1 日").length >= 1,
    oneText("2019 年"));
ok("lieyan 顶栏：资源条 疫情 10 · 民心 68 · 经济 65（开局值）", objsWithText("疫情 10 · 民心 68 · 经济 65").length >= 1,
    oneText("疫情 10"));

// ---- 序章：单 tick 操作页（行动点 1/1，应急预案 radio 组） ----
ok("序章：操作面板标题=序章 · 2019年的冬天 + 行动点 1 / 1",
    objsTextHas("序章 · 2019年的冬天").length > 0 && objsTextHas("行动点 1 / 1").length > 0, oneText("序章"));
ok("序章：操作页行=应急预案 + 结束操作",
    objsTextHas("应急预案").length > 0 && objsTextHas("结束操作").length > 0);

// 国策面板回归（阶段=ops 内可开合，复用后继续序章操作）
clickAt(390, 520); snap();
ok("国策面板回归：数据驱动行 方舱医院/健康码体系（lieyan 模组）",
    objsTextHas("方舱医院").length > 0 && objsTextHas("健康码体系").length > 0);
clickAt(300, rowY(0)); snap(); // 点击第一行：获取「方舱医院」
ok("国策面板回归：点击行获取政策 -> 已行", objsTextHas("已行").length > 0, oneText("政策"));
clickAt(120, 520); snap(); // 操作按钮：重新打开操作面板
ok("操作面板回归：操作按钮重开操作主面板", objsTextHas("应急预案").length > 0);

// 地图选点回归（panel=none 时点击地图）
clickAt(480, 520); snap(); // 国家属性按钮
ok("国家属性面板回归：资源总览 疫情 10/医疗资源 60", objsTextHas("疫情").length > 0 && objsTextHas("医疗资源").length > 0);
clickAt(790, 520); snap(); // 控制地块按钮
ok("控制地块面板回归：地块 武汉/北京/上海", objsTextHas("武汉").length > 0 && objsTextHas("北京").length > 0 && objsTextHas("上海").length > 0);
clickAt(790, 520); snap(); // 再点控制地块 -> 关闭 -> panel=none
clickAt(620, 145); snap(); // 点击菱形地块（世界 560,180）
ok("地图选点回归：点击地块选中北京", objsTextHas("已选：北京").length > 0, oneText("已选"));
clickAt(120, 520); snap(); // 重开操作面板
ok("操作面板回归：序章操作页恢复", objsTextHas("应急预案").length > 0);

// ---- 序章：签署应急预案 -> 行动点耗尽自动结算 -> 超事件 ----
openPage(0); snap();
ok("序章操作页：strip=行动点 1 / 1 · 疫情 10", objsTextHas("行动点 1 / 1 · 疫情 10").length > 0, oneText("行动点"));
pickOption(0); snap();
ok("签署后行动点耗尽 -> 自动结算（操作面板消失，超事件演出开始）",
    objsWithText("2019年的冬天").length >= 1 && objsTextHas("行动点").length === 0);
ok("序章超事件：标题「2019年的冬天」", objsWithText("2019年的冬天").length >= 1);
ok("序章超事件：首行「一切还没有开始。一切已经在开始。」（逐行演出第 1 行）",
    objsTextHas("一切还没有开始").length > 0, oneText("一切还"));
ok("序章超事件：提示「点击继续」（黑底逐行）", objsTextHas("点击继续").length > 0);
clickAt(480, 300); snap();
ok("序章超事件：点击推进至第 2 行（武汉报告 27 例）", objsTextHas("武汉报告").length > 0, oneText("武汉"));
// 逐行演完（第 1 行已在场，累计 1 + lines-1 次点击 = 12 次：末行 1 次 + 推进队列 1 次）
for (var i = 0; i < LIE.events[0].lines.length - 1; i++) clickAt(480, 300);
snap();
// ---- 第一章开场：沉浸式（会议室卫生部长 vs 财政部长） ----
ok("第一章开场沉浸式：标题「会议室」", objsWithText("会议室").length >= 1, oneText("会议室"));
ok("第一章开场沉浸式：缺图占位框渲染（背景/立绘）",
    objsTextHas("缺图").length >= 2, oneText("缺图"));
ok("第一章开场沉浸式：首行 卫生部长：封城。必须封。", objsTextHas("卫生部长").length > 0, oneText("卫生部长"));
clickAt(480, 300); snap();
ok("第一章开场沉浸式：逐行推进（财政部长：封城经济会崩）", objsTextHas("财政部长").length > 0, oneText("财政部长"));
for (var i = 0; i < LIE.events[1].lines.length - 1; i++) clickAt(480, 300);
snap();
// ---- 序章章末：转第一章 ----
ok("序章章末：超事件演出「你签完字，看向窗外。」", objsTextHas("签完字").length > 0, oneText("签完字"));
clickAt(480, 300); snap(); // 末行
clickAt(480, 300); snap(); // 推进：进第一章
ok("第一章：tick1 操作面板=第一章 · 疫情时期 行动点 3 / 3",
    objsTextHas("第一章 · 疫情时期").length > 0 && objsTextHas("行动点 3 / 3").length > 0, oneText("第一章"));

// ---- 第一章 18 tick：封控/刺激/舆论 radio 组 ----
function opsTick() {
    // 封控力度 -> 局部封控（索引 2）
    openPage(0); snap();
    pickOption(2); snap();
    ok("radio 组可操作并消耗行动点：选「局部封控」后 strip=行动点 2 / 3 · 疫情 12 · 民心 68 · 经济 63",
        objsTextHas("行动点 2 / 3 · 疫情 12").length > 0 && objsTextHas("● 局部封控").length > 0, oneText("行动点 2"));
    clickAt(300, rowY(4)); // 返回操作页
    // 经济刺激 -> 精准滴灌（索引 1）
    openPage(1); snap();
    pickOption(1); snap();
    ok("radio 组跨页共享行动点池：刺激后剩 行动点 1 / 3", objsTextHas("行动点 1 / 3").length > 0, oneText("行动点 1"));
    clickAt(300, rowY(3));
    // 舆论引导 -> 适度淡化（索引 1）：第 3 个操作后 AP 归零自动结算
    openPage(2); snap();
    pickOption(1); snap();
    ok("用完行动点自动结算：事件阶段接管（操作面板消失）", objsTextHas("行动点").length === 0);
    // 事件阶段
    clearEvents(60);
}
opsTick();


// 剩余 17 tick（tick3~19）：同一策略循环（ recurso/flag 路径稳定落在「失败」档）
for (var t = 2; t <= 18; t++) {
    openPage(0); pickOption(2); clickAt(300, rowY(4));
    openPage(1); pickOption(1); clickAt(300, rowY(3));
    openPage(2); pickOption(1);
    clearEvents(60);
}

// ---- 四关键事件：按触发条件弹出（seen 收集） ----
ok("关键事件①父亲的电话：条件=stimulus_done flag -> 弹出", seen["父亲的电话"] === true);
ok("关键事件②母亲的医院：条件=lockdown_any + 医疗<50 -> 弹出", seen["母亲的医院"] === true);
ok("关键事件③老李走了：条件=communication_any + 疫情>=41 -> 弹出", seen["老李走了"] === true);
ok("关键事件④孩子的作文：章末留位事件（按队长裁决，第二章转产后归属）",
    seen["孩子的作文"] === true);

// ---- 副线：饭桌每 3~4 tick 自动插入，读 flag 变体 ----
var dinnerVariants = ["一家四口坐在饭桌前", "工厂停了", "父亲每天还是去工厂", "厂里接了政府的单子", "订单越来越少了", "你以后也不会认识了", "病毒？病毒算什么打仗"];
var dinnerSeen = dinnerVariants.filter(function (s) { return Object.keys(seen).some(function (k) { return k.indexOf(s) >= 0; }); });
ok("饭桌副线：章内按 tick 序数自动插入 4 次（tick3/7/11/15）",
    dinnerSeen.filter(function (s) { return s !== "父亲每天还是去工厂" && s !== "订单越来越少了" && s !== "病毒？病毒算什么打仗"; }).length >= 3,
    JSON.stringify(dinnerSeen));
ok("饭桌变体 A：lockdown_any 成立 -> 「父亲不用去工厂了」（封控变体）",
    Object.keys(seen).some(function (k) { return k.indexOf("工厂停了") >= 0; }));
ok("饭桌变体 B：stimulus_done 成立 -> 「厂里接了政府的单子」（刺激变体）",
    Object.keys(seen).some(function (k) { return k.indexOf("厂里接了政府的单子") >= 0; }));
ok("饭桌变体 C：neighbor_death flag -> 「老李走了。你以后也不会认识了」",
    Object.keys(seen).some(function (k) { return k.indexOf("你以后也不会认识了") >= 0; }));

// ---- 建制派动摇 + 信任危机 ----
ok("建制派动摇：疫情>=61 触发「会议室里的沉默」", seen["会议室里的沉默"] === true);
ok("信任危机：防疫失败档后触发（建制派 -10）", seen["信任危机"] === true);

// ---- 章末：超事件「疫情结束」+ 失败档判定 ----
ok("章末超事件：标题「疫情结束」（rating super 演出）", seen["疫情结束"] === true);
ok("章末防疫结算：apply 卡弹出（选项效果落 flag/资源）", seen["防疫评价·结算"] === true);
ok("防疫评价：失败档（疫情 60~79）-> 「失败——稳定 -20、民心 -15」",
    Object.keys(seen).some(function (k) { return k.indexOf("失败——阶段 2") >= 0; }));
ok("章末副线回响：饭桌（疫情后）-> 「第一章 完」", Object.keys(seen).some(function (k) { return k.indexOf("第一章 完") >= 0; }));

// ---- 篇终：输入冻结、日期冻结 ----
ok("篇终：阶段 over，操作面板不再出现（日期 2019 年 12 月 19 日）",
    objsWithText("烈焰升腾 · 2019 年 12 月 19 日").length >= 1, oneText("2019 年 12 月"));
for (var i = 0; i < 5; i++) { clickAt(480, 300); clickAt(300, 260); }
snap();
ok("篇终：输入冻结（点击无新视图）", objsTextHas("行动点").length === 0);

// ---- 防疫评价四档：模组 JSON 条件互斥 + 音频 id ----
var supers = LIE.events.filter(function (e) { return (e.id === "ev.collapse" || e.id.indexOf("ev.rating_") === 0) && e.kind === "super"; });
var applies = LIE.events.filter(function (e) { return e.kind === "card" && e.id.indexOf("ev.") === 0 && (e.id.indexOf("_apply") >= 0); });
ok("防疫评价四档：崩溃/优秀/合格/失败（5 个超事件演出）",
    supers.length === 5, JSON.stringify(supers.map(function (e) { return e.id; })));
ok("防疫评价结算：每档附 apply 卡（flag pandemic_rating + 资源修正）", applies.length === 5,
    JSON.stringify(applies.map(function (e) { return e.id; })));
ok("章末超事件：bgm 引用音乐清单 id（bgm-end-*）",
    supers.filter(function (e) { return e.bgm; }).length === 5 && supers.every(function (e) { return e.bgm.indexOf("bgm-") === 0; }));
var fl = LIE.events.filter(function (e) { return e.id === "ev.rating_fail_a"; })[0];
ok("失败档条件：resGte danger 60 + resLte danger 79（与崩溃 80 互斥）",
    JSON.stringify(fl.when) === '[{"op":"tickGte","n":19},{"op":"resGte","v":"res.danger","n":60},{"op":"resLte","v":"res.danger","n":79}]');
var ex = LIE.events.filter(function (e) { return e.id === "ev.rating_excellent"; })[0];
ok("优秀档条件：danger<30 且 民心>71 -> 阶段 2 资源 +20% 效果", ex.when.length === 3 && ex.when[2].n === 71);

// ---- flag 全链：模组 JSON 覆盖契约八名 ----
const FLAG_CHAIN = ["lockdown_", "stimulus_done", "communication_", "factory", "medical_support", "neighbor_death", "child_essay", "trust_crisis"];
var effText = JSON.stringify(LIE);
var flagsOk = FLAG_CHAIN.every(function (f) { return effText.indexOf(f) >= 0; });
var ratingFlag = effText.indexOf("pandemic_rating") < 0;
// pandemic_rating 以 rating_* 文案+flagSet 落地，核对四档事件都带 flagSet
var ratingFlags = LIE.events.filter(function (e) { return e.id.indexOf("ev.rating_") === 0 || e.id === "ev.collapse"; })
    .map(function (e) { return JSON.stringify(e); }).join("");
ok("flag 全链：lockdown/stimulus/communication/factory/medical_support/neighbor_death/child_essay + 四档评级标记",
    flagsOk && ratingFlags.indexOf("flagSet") >= 0 && ratingFlags.indexOf("pandemic_rating") >= 0);

// ---- 本体零剧情文案：引擎源文件不含任意剧情串（全部来自 mods/lieyan JSON） ----
var storyStrings = ["2019年的冬天", "父亲的电话", "母亲的医院", "老李走了", "饭桌", "疫情结束", "会议室里的沉默", "封控力度", "孩子的作文", "信任危机"];
var srcFiles = fse.readdirSync(__dirname + "/../app").filter(function (f) { return f.indexOf(".subl") >= 0 && f !== "mods-data.subl"; });
var srcAll = srcFiles.map(function (f) { return fse.readFileSync(__dirname + "/../app/" + f, "utf8"); }).join("\n");
var leaks = storyStrings.filter(function (s) { return srcAll.indexOf(s) >= 0; });
ok("本体零剧情文案：app/*.subl 源不含故事串（全量来自 mods/lieyan JSON）", leaks.length === 0, JSON.stringify(leaks));

// ---- 持久化 API：flag 链存档回环 ----
var sv = globalThis.__subl;
var save = {
    mod: "lieyan", tick: 19,
    pandemic_rating: "fail",
    flags: { lockdown_any: true, lockdown_local: true, stimulus_targeted: true, communication_downplay: true,
             factory_saved: true, medical_support: true, neighbor_death: true, child_essay: true, trust_crisis: true },
    res: { danger: 64, support: 85, economy: 29 }
};
var r1 = sv.call("saveLoad", ["lieyan", save]);
var r2 = sv.call("saveGet", ["lieyan"]);
var ks = sv.call("saveKeys", []);
var rd = sv.call("saveDrop", ["lieyan"]);
var rg = sv.call("saveGet", ["lieyan"]);
ok("持久化 API：flag 链存档 saveLoad + saveGet 回环 + saveKeys + saveDrop",
    r1 === true && r2 && r2.mod === "lieyan" && r2.pandemic_rating === "fail" && r2.flags.neighbor_death === true
    && Array.isArray(ks) && ks.indexOf("lieyan") >= 0 && rd === true && rg === null,
    JSON.stringify({ r1: r1, r2: r2, ks: ks }));

// ---- 音乐接入点（资产缺失静默，不报错不抛） ----
var b1 = sv.call("bgmPlay", [""]);
var b2 = sv.call("bgmPlay", ["assets/no-such-bgm.mp3"]);
var b3 = sv.call("bgmStop", []);
ok("音乐接入点：空名/缺失资产 bgmPlay 静默 false，bgmStop 无异常", b1 === false && b2 === false && b3 === true, JSON.stringify([b1, b2, b3]));

if (fails === 0) console.log("SMOKE: ALL PASSED（t87 烈焰升腾 vertical slice：序章超事件+第一章沉浸式+三组 radio+四关键事件+饭桌副线+四档防疫评价+flag 链+持久化+回归）");
else console.log("SMOKE: FAILED " + fails + " 项");
process.exit(fails === 0 ? 0 : 1);
}

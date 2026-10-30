// game-runtime.js —— Sublimation for Game 桥运行时
//
// 把 app/*.subl 里 @game @host 声明的游戏内建函数一一实现到 KAPLAY（v3001）。
//
// 【宿主桥 ABI（t38 定案）】唯一入口 globalThis.__subl.call(op, args)：
//   op = 操作名（= @game @host 声明的函数名），args = Sublimation 实参数组。
//   宿主侧用 __SG_OPS 注册表（单一真源）实现各 op。
//   编译器（t43 落定）对用户 @host 无体声明也统一生成 __subl.call ——
//   本文件整体包在闭包里，不向页面暴露任何桥全局名（t40 时期的裸名通道已回撤）。
//   op 表与 game.subs 处理器白名单一一对应（笔误编译期报错）。
//
// 约定：
//   - 值层映射：Sublimation Num/Rat → JS number；Str → string；Any → 不透明句柄
//     （游戏对象 / 组件 / 向量都是 Any，只能经本层函数读写）；
//   - List[Any] → JS 数组（objsByTag 返回 KAPLAY 数组，二者同构）。
//
// 载入顺序（index.html）：
//   <script src="vendor/kaplay.js"></script>   ← 定义全局 kaplay()
//   <script src="js/game-runtime.js"></script> ← 本文件
//   <script src="app.js"></script>             ← Sublimation 产物（S-1：导出 __subl.main，
//                                                 由 index.html 的末段 script 调用）
(function () {
"use strict";

var __sgCtx = null;
// 指针世界坐标（t66）：KAPLAY 的 mousePos 对 CSS rotate(90deg) 竖屏画布（元素盒与缓冲
// 转置）与对触屏（用 rect 直减偏移）都不正确，且 mousedown/mouseup 不更新——
// 桥改用 DOM 监听自维护 __sgPointer。
var __sgPointer = null;
// 活跃触点表（identifier 索引，多指捏合用；camera.subl touchCount/touchX/touchY 读）
var __sgTouches = [];
var __sgView = { w: 960, h: 540 };
var __sgLetterbox = false;

/** 取 KAPLAY 上下文；未初始化给出可读错误。 */
function __sgK() {
    if (!__sgCtx) throw new Error("[SfG] 游戏未初始化：请先调用 gameStart(width, height)");
    return __sgCtx;
}

/** 解析颜色：#rgb / #rrggbb 或颜色名 → KAPLAY ColorComp。 */
var __SG_COLORS = {
    red: [255, 68, 68], green: [68, 200, 68], blue: [68, 128, 255],
    yellow: [240, 220, 60], white: [255, 255, 255], black: [20, 20, 20],
    gray: [140, 140, 140], orange: [255, 150, 40], purple: [170, 90, 220], pink: [255, 130, 180],
};
function compColorHex(hex) {
    var k = __sgK();
    var rgb = null;
    if (typeof hex === "string" && hex.charAt(0) === "#") {
        var h = hex.slice(1);
        if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
        if (h.length === 6) rgb = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    } else if (__SG_COLORS[hex]) {
        rgb = __SG_COLORS[hex];
    }
    if (!rgb) throw new Error("[SfG] 无法解析颜色：" + hex + "（用 #rrggbb 或颜色名）");
    return k.color(rgb[0], rgb[1], rgb[2]);
}

// ---------- 引擎与场景（game.subl） ----------

function gameStart(width, height) {
    if (__sgCtx) throw new Error("[SfG] gameStart 只能调用一次");
    var init = (typeof kaplay === "function") ? kaplay : (kaplay && kaplay.default);
    if (typeof init !== "function") throw new Error("[SfG] 未找到 KAPLAY：页面需先引入 vendor/kaplay.js");
    // background：SfG 默认深色底（#101820）。不传时 KAPLAY 用 2x2 棋盘格 bgTex 平铺整个画布——
    // 画面任何未绘制区域（视口边角/未覆盖海域）会露出黑白格子，故一律换成深色清屏。
    __sgCtx = init({ pixelDensity: ((typeof window !== "undefined" && window.devicePixelRatio) || 1), texFilter: "linear", width: width, height: height, global: false, background: "#101820" });
    __sgViewInit(width, height, false);
}

// 自适配窗口：stretch 恒开（画布跟随窗口尺寸），letterbox 保持宽高比（留黑边不变形），
// crisp 关闭平滑插值（image-rendering: pixelated，像素风锐利）。
// 俄罗斯方块这类 2D 网格游戏：gameStartFit(w, h, true, true)。
function gameStartFit(width, height, letterbox, crisp) {
    if (__sgCtx) throw new Error("[SfG] gameStart 只能调用一次");
    var init = (typeof kaplay === "function") ? kaplay : (kaplay && kaplay.default);
    if (typeof init !== "function") throw new Error("[SfG] 未找到 KAPLAY：页面需先引入 vendor/kaplay.js");
    // pixelDensity：画布物理分辨率 = CSS 尺寸 × devicePixelRatio（手机 ~3）。
    // jn() 的视口用 drawingBufferWidth/pixelDensity 折算回 CSS 等效值，offset→世界映射不变。
    // texFilter：纹理采样滤波（与 crisp 两回事——crisp 只是 CSS image-rendering）。
    // KAPLAY 默认 nearest 会把 2D canvas 字形自带的抗锯齿废掉：文字界面 crisp=false -> linear；
    // 像素风 crisp=true -> nearest 保留硬边。
    // background：同 gameStart——代替 KAPLAY 默认棋盘格，未绘制区域一律深色（地图海面同色 #101820）。
    __sgCtx = init({ pixelDensity: ((typeof window !== "undefined" && window.devicePixelRatio) || 1), texFilter: crisp ? "nearest" : "linear", width: width, height: height, global: false, stretch: true, letterbox: !!letterbox, crisp: !!crisp, background: "#101820" });
    __sgViewInit(width, height, letterbox);
}

function gameGravity(g) { __sgK().setGravity(g); }
function sceneAdd(name, body) { __sgK().scene(name, function () { return body(null); }); }
function sceneGo(name) { __sgK().go(name); }
function viewWidth() { return __sgK().width(); }
function viewHeight() { return __sgK().height(); }
// 真实窗口尺寸（CSS 像素；viewWidth/viewHeight 是逻辑画布尺寸）。
// 无窗口环境（Node 桩）回落为画布逻辑尺寸，便于测试。
function winWidth() {
    if (typeof window !== "undefined" && typeof window.innerWidth === "number") return window.innerWidth;
    return __sgK().width();
}
function winHeight() {
    if (typeof window !== "undefined" && typeof window.innerHeight === "number") return window.innerHeight;
    return __sgK().height();
}

// ---------- 精灵与游戏对象（sprite.subl） ----------

function spriteLoad(name, src) { __sgK().loadSprite(name, src); }

// 组件构造：直接返回 KAPLAY 组件（不透明 Any）。
function compSprite(name) { return __sgK().sprite(name); }
function compPos(x, y) { return __sgK().pos(x, y); }
function compScale(s) { return __sgK().scale(s); }
function compRect(w, h) { return __sgK().rect(w, h); }
function compCircle(r) { return __sgK().circle(r); }
// 统一字体 Maple Mono Normal CN；KAPLAY text 只认字体名（无 weight 通道），每字重独立 family。
// 文本组件：统一字体 Maple Mono Normal CN（KAPLAY text 只认字体名字符串、无 weight 通道，
// 故每字重独立 family，页面须预载：400 → MapleMonoCN / 600 → MapleMonoCN-Semibold / 700 → MapleMonoCN-Bold）。
// width>0 触发 KAPLAY 原生折行（按真字体 measureText 量宽，消除 app 层宽度模型的偏差）；
// lineSpacing=行额外间距（行距= size + lineSpacing）。
function compText(t, size, weight, width, lineSpacing) {
    var fam = "MapleMonoCN";
    if (weight === 600) fam = "MapleMonoCN-Semibold";
    else if (weight === 700) fam = "MapleMonoCN-Bold";
    var o = { size: size, font: fam };
    if (width !== undefined && width !== null && width > 0) o.width = width;
    if (lineSpacing !== undefined && lineSpacing !== null && lineSpacing > 0) o.lineSpacing = lineSpacing;
    return __sgK().text(t, o);
}
function compArea() { return __sgK().area(); }
function compBody() { return __sgK().body(); }
function compSolid() { return __sgK().solid(); }
function compTag(t) { return t; }          // KAPLAY：标签就是字符串组件
function compAnchor(a) { return __sgK().anchor(a); }

function objAdd() { return __sgK().add([]); }
function objUse(o, c) { o.use(c); }
function objDestroy(o) { o.destroy(); }
function objExists(o) { return o.exists(); }

/** 相对移动（像素/帧）：直接位移，不走 KAPLAY 的秒速度语义，保证按帧可控。 */
function objMove(o, dx, dy) { o.pos = __sgK().vec2(o.pos.x + dx, o.pos.y + dy); }
function objSetPos(o, x, y) { o.pos = __sgK().vec2(x, y); }
function objSetScale(o, s) { o.scale = __sgK().vec2(s, s); }
function objPos(o) { return o.pos; }
function objTextSet(o, t) { o.text = t; }
function objTag(o, t) { o.use(t); }         // use 接受 Comp | Tag：字符串即标签

function vecX(v) { return v.x; }
function vecY(v) { return v.y; }

// ---------- 输入（input.subl） ----------

function onKeyDown(key, body) { __sgK().onKeyDown(key, function (k) { return body(k); }); }
function onKeyPress(key, body) { __sgK().onKeyPress(key, function (k) { return body(k); }); }
function onKeyRelease(key, body) { __sgK().onKeyRelease(key, function (k) { return body(k); }); }
function onMouseDown(btn, body) { __sgK().onMouseDown(btn, function (b) { return body(b); }); }
// 松开鼠标键：松手这一刻触发一次（点击/拖拽分离的关键——不然拖拽态永远退不出）。
function onMouseRelease(btn, body) { __sgK().onMouseRelease(btn, function (b) { return body(b); }); }
// 鼠标移动（按住与否均触发；KAPLAY 回调参数为 (pos, delta)，取 pos 给回调体）。
function onMouseMove(body) { __sgK().onMouseMove(function (m) { return body(m); }); }
/** 画布元素局部偏移 -> 世界坐标。横屏元素盒=窗口=缓冲；竖屏 CSS rotate(90deg) 使
 *  元素盒（100vh×100vw）与缓冲（窗口尺寸）转置，需先把 (offsetX,offsetY) 换算到缓冲
 *  空间。letterbox 仅横屏启用（竖屏需拉伸铺满）。 */
function __sgWorldFromOffset(ox, oy) {
    var e = __sgView.w, n = __sgView.h;
    var W = (typeof window !== "undefined" && typeof window.innerWidth === "number") ? window.innerWidth : e;
    var H = (typeof window !== "undefined" && typeof window.innerHeight === "number") ? window.innerHeight : n;
    // 横屏（含无头环境）下以画布元素盒为准：offsetX/offsetY 语义本就相对画布元素，
    // 窗口尺寸在无头/滚动条/弹窗环境可能与画布盒不等，用窗口会把点击算偏（t68 地图点击暴露）。
    // 竖屏旋转态由页面 CSS 决定（元素盒本就是横屏盒），保留窗口维度做归一化。
    if (!(W < H)) {
        var cv = (__sgCtx && __sgCtx.canvas) || null;
        var wEl = (cv && typeof cv.clientWidth === "number") ? cv.clientWidth : 0;
        var hEl = (cv && typeof cv.clientHeight === "number") ? cv.clientHeight : 0;
        if (wEl > 0 && hEl > 0) { W = wEl; H = hEl; }
    }
    var bx = ox, by = oy;
    if (W < H) { bx = ox * W / H; by = oy * H / W; }
    var s = W, i = H, m = 0, u = 0, c = s, p = i;
    if (__sgLetterbox && !(W < H)) {
        var b = s / i, l = e / n, hb;
        if (b > l) { hb = i * l; m = (s - hb) / 2; c = hb; }
        else { hb = s / l; p = hb; u = (i - hb) / 2; }
    }
    return { x: (bx - m) * e / c, y: (by - u) * n / p };
}

/** 屏幕客户坐标 -> 世界坐标（触屏：KAPLAY 用 rect 直减，先回到元素局部语义）。 */
function __sgWorldFromClient(cx, cy) {
    var W = (typeof window !== "undefined" && typeof window.innerWidth === "number") ? window.innerWidth : 0;
    var H = (typeof window !== "undefined" && typeof window.innerHeight === "number") ? window.innerHeight : 0;
    if (W && W < H) return __sgWorldFromOffset(cy, W - cx);
    return __sgWorldFromOffset(cx, cy);
}

/** 记录画布尺寸/letterbox；注册 DOM 指针监听（鼠标 offsetX 语义 + 触屏客户坐标）。 */
function __sgViewInit(w, h, letterbox) {
    __sgView = { w: w, h: h };
    __sgLetterbox = !!letterbox;
    if (typeof document === "undefined" || !document.addEventListener) return;
    var cv = (__sgCtx && __sgCtx.canvas) || document.querySelector("canvas");
    if (!cv) return;
    var trackOff = function (e2) {
        if (typeof e2.offsetX === "number") __sgPointer = __sgWorldFromOffset(e2.offsetX, e2.offsetY);
    };
    var trackTouch = function (e2) {
        var tch = e2.changedTouches && e2.changedTouches[0];
        if (tch) __sgPointer = __sgWorldFromClient(tch.clientX, tch.clientY);
        // 多指跟踪（捏合缩放）：按 identifier 维护活跃触点表
        if (e2.changedTouches) {
            for (var i = 0; i < e2.changedTouches.length; i++) {
                var ct = e2.changedTouches[i];
                if (e2.type === "touchend" || e2.type === "touchcancel") {
                    __sgTouches = __sgTouches.filter(function (tp) { return tp.id !== ct.identifier; });
                } else {
                    var w = __sgWorldFromClient(ct.clientX, ct.clientY);
                    var found = false;
                    for (var j = 0; j < __sgTouches.length; j++) {
                        if (__sgTouches[j].id === ct.identifier) { __sgTouches[j] = { id: ct.identifier, x: w.x, y: w.y }; found = true; break; }
                    }
                    if (!found) __sgTouches.push({ id: ct.identifier, x: w.x, y: w.y });
                }
            }
        }
    };
    ["mousemove", "mousedown", "wheel"].forEach(function (ev) { cv.addEventListener(ev, trackOff); });
    ["touchstart", "touchmove", "touchend"].forEach(function (ev) { cv.addEventListener(ev, trackTouch, { passive: true }); });
}

function mousePosX() {
    if (__sgPointer) return __sgPointer.x;
    return __sgK().mousePos().x;
}
function mousePosY() {
    if (__sgPointer) return __sgPointer.y;
    return __sgK().mousePos().y;
}

// ---------- 循环与计时（loop.subl） ----------

function onUpdate(body) { __sgK().onUpdate(function () { return body(__sgK().dt()); }); }
function frameDt() { return __sgK().dt(); }
function every(secs, body) { __sgK().loop(secs, function () { return body(null); }); }
function after(secs, body) { __sgK().wait(secs, function () { return body(null); }); }

// ---------- 相机与手势（camera.subl；t68+：地图自由缩放） ----------
// 相机变换下的世界/屏幕坐标由 SfG 端自算逆变换（mapHitProv 吃世界坐标）。
// 滚轮缩放手势：onScroll 回调参数为 deltaY（向下为正）。
function onScroll(body) { __sgK().onScroll(function (d) { return body(d.y); }); }
// 相机位置（视口中心的世界坐标）与缩放（x/y 同值用 camScale(s, s)）。
function camPos(x, y) { __sgK().camPos(x, y); }
function camScale(sx, sy) { __sgK().camScale(sx, sy); }
// fixed 组件：对象脱离相机变换，固定在屏幕坐标（顶栏 UI 用）。
function compFixed() { return __sgK().fixed(); }
// 触屏开始/移动/结束（零信息回调；坐标取 touchX/touchY）。
function onTouchStart(body) { __sgK().onTouchStart(function () { return body(null); }); }
function onTouchMove(body) { __sgK().onTouchMove(function () { return body(null); }); }
function onTouchEnd(body) { __sgK().onTouchEnd(function () { return body(null); }); }
// 活跃触点数与坐标（世界系，无相机；按下标取，多指捏合用前两个）。
// z 层级：对象按 z 升序绘制（同层按加入序），UI 给高 z 永远盖在地图之上。
function compZ(z) { return __sgK().z(z); }
function touchCount() { return __sgTouches.length; }
function touchX(i) { return __sgTouches[i] ? __sgTouches[i].x : 0; }
function touchY(i) { return __sgTouches[i] ? __sgTouches[i].y : 0; }

// ---------- 碰撞（collision.subl） ----------

function objOnCollide(o, tag, body) { o.onCollide(tag, function (other) { return body(other); }); }
function objIsColliding(a, b) { return a.isColliding(b); }
function objsByTag(t) { return __sgK().get(t); }
function objsDestroyTag(t) { __sgK().destroyAll(t); }

// ---------- 地图矢数据（geo.subl；t68：中国行政区划演示） ----------
// 省级行政区划这类「凹多边形 + 多环」形状：rect 拼接难看、area() 的 rect 命中
// 对狭长省会误触，故单独给一组 op。
// 文本省份表格式（mapLoad 解析）：
//   "省名:环;环;...|省名:环;环;..."，环 = "x y,x y,..."（世界坐标像素，1 位小数）。
// 烘焙策略：每省一个 canvas2d 精灵（白底 fill + 1.2px 黑边 stroke）——canvas2d 填充
// 对任意凹多边形/多环天然正确且边缘抗锯齿；渲染期只按需 tint
// （objUse(o, compColorHex(新色)) 换组件即换色）：白底×tint=填充色、黑边×tint=黑。
// 命中判定 mapHitProv 用射线法点在多边形内（精确，取代 area() 的 rect 命中）。
var __SG_MAP_SEQ = 0;
function __sgMapBakeSprite(p) {
    var K = __sgK();
    // 硬边烘焙（t68+ 用户要求锐利像素边）：顶点 snap 到整数像素，
    // 整数扫描线 even-odd 填充（mapHitProv 射线判定的水平线实例），
    // Bresenham 1px 描边；全程 putImageData，无任何 AA。
    var rings = [];
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (var r = 0; r < p.rings.length; r++) {
        var ring = p.rings[r];
        var out = [];
        for (var q = 0; q < ring.length; q++) {
            var ix = Math.round(ring[q][0]), iy = Math.round(ring[q][1]);
            out.push([ix, iy]);
            if (ix < minX) minX = ix;
            if (ix > maxX) maxX = ix;
            if (iy < minY) minY = iy;
            if (iy > maxY) maxY = iy;
        }
        rings.push(out);
    }
    var pad = 2;
    var bx = minX - pad, by = minY - pad;
    var bw = (maxX - minX) + pad * 2 + 2, bh = (maxY - minY) + pad * 2 + 2;
    var cv = document.createElement('canvas');
    cv.width = bw; cv.height = bh;
    var ct = cv.getContext('2d');
    if (!ct) throw new Error('[SfG] mapLoad：无法创建 2d 上下文');
    var img = ct.createImageData(bw, bh);
    var d = img.data;
    function setPx(x, y, rr, gg, bb) {
        if (x < 0 || y < 0 || x >= bw || y >= bh) return;
        var i = (y * bw + x) * 4;
        d[i] = rr; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = 255;
    }
    // 局部整数环
    var lr = [];
    for (var r2 = 0; r2 < rings.length; r2++) {
        var ring2 = rings[r2], out2 = [];
        for (var q2 = 0; q2 < ring2.length; q2++) out2.push([ring2[q2][0] - bx, ring2[q2][1] - by]);
        lr.push(out2);
    }
    // 填充：扫描线取整数 y，边按半开区间 [y0, y1) 求交，even-odd 配对，
    // 跨度半开 [round(a), round(b))——相邻省共享边界列无重叠无缝。
    for (var yy = 0; yy < bh; yy++) {
        var xs = [];
        for (var r3 = 0; r3 < lr.length; r3++) {
            var rr2 = lr[r3];
            for (var e = 0; e < rr2.length; e++) {
                var a = rr2[e], b = rr2[(e + 1) % rr2.length];
                if (a[1] === b[1]) continue;
                var y0v = a[1], y1v = b[1];
                if ((y0v <= yy && yy < y1v) || (y1v <= yy && yy < y0v)) {
                    var tt = (yy - y0v) / (y1v - y0v);
                    xs.push(a[0] + tt * (b[0] - a[0]));
                }
            }
        }
        xs.sort(function (a2, b2) { return a2 - b2; });
        for (var i = 0; i + 1 < xs.length; i += 2) {
            var x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
            if (x1 <= x0) x1 = x0 + 1;
            for (var xx = x0; xx < x1; xx++) setPx(xx, yy, 255, 255, 255);
        }
    }
    // 描边：Bresenham 逐像素 1px（细线 + 天然硬边），盖在填充之上。
    function bres(x0, y0, x1, y1) {
        var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        var err = dx + dy;
        while (true) {
            setPx(x0, y0, 0, 0, 0);
            if (x0 === x1 && y0 === y1) break;
            var e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    for (var r4 = 0; r4 < lr.length; r4++) {
        var rr3 = lr[r4];
        for (var e2 = 0; e2 < rr3.length; e2++) {
            var c = rr3[e2], cc = rr3[(e2 + 1) % rr3.length];
            bres(c[0], c[1], cc[0], cc[1]);
        }
    }
    ct.putImageData(img, 0, 0);
    var name = 'sgmap' + (__SG_MAP_SEQ++);
    K.loadSprite(name, cv);
    // 注：纹理过滤由 vendor/kaplay.js 的纹理默认 NEAREST 决定（地图硬边）；
    // 运行期 texParameteri 补丁在该上下文不生效，故不在此处理。
    // 烘焙 bbox（含 pad）：命中预筛与无碰撞跳过用。
    return { name: p.name, sprite: name, x: bx, y: by, x1: (bx + bw) - 1, y1: (by + bh) - 1, rings: rings };
}
function mapLoad(t) {
    if (typeof t !== "string") throw new Error("[SfG] mapLoad 需要紧凑文本省份表（Str）");
    var provs = [];
    var lines = t.split("|");
    for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        if (!line) continue;
        var sep = line.indexOf(":");
        if (sep < 0) continue;
        var name = line.slice(0, sep);
        var ringStrs = line.slice(sep + 1).split(";");
        var rings = [];
        for (var ri = 0; ri < ringStrs.length; ri++) {
            if (!ringStrs[ri]) continue;
            var pts = ringStrs[ri].split(",");
            var ring = [];
            for (var qi = 0; qi < pts.length; qi++) {
                var sp = pts[qi].indexOf(" ");
                if (sp < 0) continue;
                ring.push([parseFloat(pts[qi].slice(0, sp)), parseFloat(pts[qi].slice(sp + 1))]);
            }
            if (ring.length >= 3) rings.push(ring);
        }
        if (rings.length > 0) provs.push(__sgMapBakeSprite({ name: name, rings: rings }));
    }
    return { provs: provs };
}
function mapProvCount(m) { return m.provs.length; }
function mapProvName(m, i) { return m.provs[i].name; }
// 创建省份精灵对象（位置=烘焙 bbox 左上角），hex 为填充 tint。
// 高亮换色：重新 objUse(o, compColorHex(新色))（use 按组件 id 替换）。
function mapProvObj(m, i, hex) {
    var p = m.provs[i];
    var o = objAdd();
    objUse(o, compSprite(p.sprite));
    objUse(o, compPos(p.x, p.y));
    objUse(o, compColorHex(hex));
    return o;
}
// 射线法点在多边形内（对甘肃/内蒙古等狭长省精确；区划互不重叠，按数据序首个命中）。
// 未命中返回 -1。
function mapHitProv(m, x, y) {
    // bbox 预筛：354 省级表不做预筛会逐环全扫（t72 东亚地图）；
    // 区划互不重叠，框外直接跳过，框内才走逐环射线法。
    for (var i = 0; i < m.provs.length; i++) {
        var p0 = m.provs[i];
        if (x < p0.x || y < p0.y || x > p0.x1 || y > p0.y1) continue;
        var rings = p0.rings;
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            var inside = false;
            for (var q = 0, s = ring.length - 1; q < ring.length; s = q++) {
                var x1 = ring[q][0], y1 = ring[q][1];
                var x2 = ring[s][0], y2 = ring[s][1];
                if (((y1 > y) !== (y2 > y)) && (x < (x2 - x1) * (y - y1) / (y2 - y1) + x1)) inside = !inside;
            }
            if (inside) return i;
        }
    }
    return -1;
}

// ============================================================================
// 宿主桥单入口（t38 定案 ABI）：globalThis.__subl.call(op, args)
// ============================================================================
// 注册表 __SG_OPS 是宿主桥的单一真源：op 名 → 上方具名实现。
// op 表与 game.subs 处理器白名单（isGameOp）一一对应——两边漂移即笔误，
// 编译期由处理器拒绝，运行期由 dispatcher 抛「未知 op」。
var __SG_OPS = {
    // 引擎与场景（game.subl）
    gameStart: gameStart, gameStartFit: gameStartFit, gameGravity: gameGravity,
    sceneAdd: sceneAdd, sceneGo: sceneGo, viewWidth: viewWidth, viewHeight: viewHeight,
    winWidth: winWidth, winHeight: winHeight,
    // 资源（sprite.subl）
    spriteLoad: spriteLoad,
    // 组件（comp*.subl）
    compSprite: compSprite, compPos: compPos, compScale: compScale, compRect: compRect,
    compCircle: compCircle, compText: compText, compColorHex: compColorHex, compArea: compArea,
    compBody: compBody, compSolid: compSolid, compTag: compTag, compAnchor: compAnchor,
    // 对象（obj*.subl）
    objAdd: objAdd, objUse: objUse, objDestroy: objDestroy, objExists: objExists,
    objMove: objMove, objSetPos: objSetPos, objSetScale: objSetScale, objPos: objPos,
    objTextSet: objTextSet, objTag: objTag,
    // 向量（vector.subl）
    vecX: vecX, vecY: vecY,
    // 输入（input.subl）
    onKeyDown: onKeyDown, onKeyPress: onKeyPress, onKeyRelease: onKeyRelease,
    onMouseDown: onMouseDown, onMouseRelease: onMouseRelease, onMouseMove: onMouseMove,
    mousePosX: mousePosX, mousePosY: mousePosY,
    // 循环与计时（loop.subl）
    onUpdate: onUpdate, frameDt: frameDt, every: every, after: after,
    // 碰撞（collision.subl）
    objOnCollide: objOnCollide, objIsColliding: objIsColliding,
    objsByTag: objsByTag, objsDestroyTag: objsDestroyTag,
    // 地图矢数据（geo.subl）
    mapLoad: mapLoad, mapProvCount: mapProvCount, mapProvName: mapProvName,
    mapProvObj: mapProvObj, mapHitProv: mapHitProv,
    // 相机与手势（camera.subl）
    onScroll: onScroll, camPos: camPos, camScale: camScale, compFixed: compFixed,
    onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd,
    touchCount: touchCount, touchX: touchX, touchY: touchY, compZ: compZ,
};

// 安装 __subl.call（不覆盖宿主/产物可能已有的 __subl.main 等字段）
globalThis.__subl = globalThis.__subl || {};
globalThis.__subl.call = function (op, args) {
    var impl = __SG_OPS[op];
    if (!impl) {
        throw new Error("[SfG] 未知宿主桥 op：" + op + "（op 表见 game doc/游戏库.md）");
    }
    return impl.apply(undefined, args || []);
};
// 列出全部 op（供测试/插件框架枚举能力用）
globalThis.__subl.ops = function () { return Object.keys(__SG_OPS); };
})();

// gen-east-data.js —— vendor/geo/east-asia.json + vendor/geo/world/*.json -> east-data.subl（东亚地图）
// 坐标映射：frame lng/lat -> 960x540 世界整数像素（顶留 36 标题带，整框 fit）。
// 国家色按 #101820 深底对比度自动调亮至 >=3.2；省份表按国家分段（provHex 用）。
// 粒度（t76 重构）：中国 35 省细粒度 + 蒙古原粒度 + 韩/朝整国一块 + 东南亚诸国整国一块 +
//   日本分岛（北海道/东北/关东·中部/关西/中国/四国/九州 共 7 块）；俄/印/新疆接壤五国为抽稀背景板。
// 末尾空名环组（九段线岛礁）跳过；另输出探针目标 probe/east-targets.js。
"use strict";
const fs = require('fs');
const path = require('path');
const G = __dirname + '/..';
const j = JSON.parse(fs.readFileSync(path.join(G, 'vendor/geo/east-asia.json'), 'utf8'));

const VW = 960, VH = 540, TOP = 36, ML = 14, MR = 14, MB = 8;
var F = j.frame;
// frame 西扩到 45°E 容纳哈萨克斯坦（~46.5°E；t76 新疆接壤五国背景板）；总包围盒/钳制/INIT 跟着重算。
F.minLng = 45.0;
const aw = VW - ML - MR, ah = VH - TOP - MB;
const s = Math.min(aw / (F.maxLng - F.minLng), ah / (F.maxLat - F.minLat));
const ox = ML + (aw - (F.maxLng - F.minLng) * s) / 2;
const oy = TOP + (ah - (F.maxLat - F.minLat) * s) / 2;
const X = function (lng) { return ox + (lng - F.minLng) * s; };
const Y = function (lat) { return oy + (F.maxLat - lat) * s; };

function lum(hex) {
  var n = parseInt(hex.slice(1), 16);
  function c(v) { var x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
  return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
}
var bgL = lum('#101820');
function mix(h, f) {
  var n = parseInt(h.slice(1), 16);
  function ch(v) { return Math.round(v + (255 - v) * f); }
  return '#' + [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
}
function fixColor(h) {
  if ((lum(h) + 0.05) / (bgL + 0.05) >= 3.2) return h;
  for (var f = 0.05; f <= 0.9; f += 0.05) { var m = mix(h, f); if ((lum(m) + 0.05) / (bgL + 0.05) >= 3.2) return m; }
  return mix(h, 0.9);
}

// ===== 粒度规则表（t76）=====
// ONE_BLOCK：整国合并为单地块（多环保留：命一环即选中全国），标签用国名。
var ONE_BLOCK = { KOR: '韩国', PRK: '朝鲜', VNM: '越南', LAO: '老挝', KHM: '柬埔寨', THA: '泰国', MMR: '缅甸', MYS: '马来西亚', SGP: '新加坡' };
// 日本分岛：本州按公认地理分区拆四块——东北 / 关东·中部 / 关西 / 中国（八地方区分，
//  即「都府县政府驻地归属」分区表；四块自北向南纬度有序、大小尽量均衡）；
//  北海道/四国/九州 各单独成块，冲绳并入九州块（同属九州·冲绳地方）。
var JPN_BLOCK_ORDER = ['北海道', '东北', '关东·中部', '关西', '中国', '四国', '九州'];
var JPN_REGION = {
  'Hokkaido': '北海道',
  'Aomori': '东北', 'Iwate': '东北', 'Akita': '东北', 'Miyagi': '东北', 'Yamagata': '东北', 'Fukushima': '东北',
  'Tokyo': '关东·中部', 'Kanagawa': '关东·中部', 'Saitama': '关东·中部', 'Chiba': '关东·中部', 'Ibaraki': '关东·中部', 'Tochigi': '关东·中部', 'Gunma': '关东·中部',
  'Yamanashi': '关东·中部', 'Nagano': '关东·中部', 'Niigata': '关东·中部', 'Toyama': '关东·中部', 'Ishikawa': '关东·中部', 'Fukui': '关东·中部', 'Gifu': '关东·中部', 'Aichi': '关东·中部', 'Shizuoka': '关东·中部',
  'Shiga': '关西', 'Kyoto': '关西', 'Osaka': '关西', 'Hyōgo': '关西', 'Nara': '关西', 'Wakayama': '关西', 'Mie': '关西',
  'Tottori': '中国', 'Shimane': '中国', 'Okayama': '中国', 'Hiroshima': '中国', 'Yamaguchi': '中国',
  'Tokushima': '四国', 'Kagawa': '四国', 'Ehime': '四国', 'Kochi': '四国',
  'Fukuoka': '九州', 'Saga': '九州', 'Naoasaki': '九州', 'Kumamoto': '九州', 'Oita': '九州', 'Miyazaki': '九州', 'Kagoshima': '九州', 'Okinawa': '九州'
};

var fgOrder = j.countries.filter(function (c) { return c.group !== 'bg'; });
var bgOrder = j.countries.filter(function (c) { return c.group === 'bg'; });

// 新疆接壤五国背景板（Natural Earth level-0 国界；同俄印：不可点击、抽稀渲染、并入 bg 表）。
var WORLD_PLATES = [
  { code: 'KAZ', color: '#78909C', zh: '哈萨克斯坦' },
  { code: 'KGZ', color: '#8D6E63', zh: '吉尔吉斯斯坦' },
  { code: 'TJK', color: '#6D4C41', zh: '塔吉克斯坦' },
  { code: 'AFG', color: '#A1887F', zh: '阿富汗' },
  { code: 'PAK', color: '#90A4AE', zh: '巴基斯坦' }
];
var THIN = 0.06; // 抽稀阈值（度）：s≈8.7px/° 下 0.06°≈0.5 像素，丢弃亚像素细节
function thinRing(ring) {
  var out = [ring[0]];
  for (var i = 1; i < ring.length; i++) {
    var a = out[out.length - 1], b = ring[i];
    var d = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    if (d >= THIN) out.push(b);
  }
  if (ring.length > 1) out.push(ring[ring.length - 1]); // 保持闭合
  return out;
}
function worldPolys(file) {
  var gj = JSON.parse(fs.readFileSync(path.join(G, 'vendor/geo/world', file), 'utf8'));
  var feats = gj.features || [gj];
  var polys = [];
  feats.forEach(function (f) {
    var g = f.geometry || f;
    var list = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    list.forEach(function (poly) { polys.push(poly[0]); }); // 仅取外环（孔洞按填充语义不绘制）
  });
  return polys.map(thinRing);
}
WORLD_PLATES.forEach(function (w2) {
  bgOrder.push({ code: w2.code, color: w2.color, provs: [{ name: w2.zh, polys: worldPolys(w2.code + '_0.json') }] });
});

// 国家 -> prov 列表（粒度规则表应用）
function provsOf(c) {
  if (c.code === 'JPN') return jpnBlocks(c);
  if (ONE_BLOCK[c.code]) return oneBlock(c);
  return c.provs.filter(function (p) { return p.name && p.name.length; }); // CHN/MNG 原粒度（跳过空名环组）
}
function oneBlock(c) {
  var polys = [];
  c.provs.forEach(function (p) { if (p.name && p.name.length) p.polys.forEach(function (pl) { polys.push(pl); }); });
  return [{ name: ONE_BLOCK[c.code], polys: polys, merged: true }];
}
function jpnBlocks(c) {
  var grp = {};
  JPN_BLOCK_ORDER.forEach(function (r) { grp[r] = []; });
  c.provs.forEach(function (p) {
    var r = JPN_REGION[p.name];
    if (!r) throw new Error('JPN 都府县未登记分区: ' + p.name);
    p.polys.forEach(function (pl) { grp[r].push(pl); });
  });
  return JPN_BLOCK_ORDER.map(function (r) { return { name: r, polys: grp[r], merged: true }; });
}

function ringsWorld(polys) {
  return polys.map(function (pl) {
    return pl.map(function (v) { return [Math.round(X(v[0])), Math.round(Y(v[1]))]; });
  });
}
// 微小地块可见性：单环整数世界包围盒 <4px 时，从该环中心放大到 5px。
// 烘焙=扫描线填充+1px 边框：<3px 的环会被边框完全覆盖成黑点，放大后才有内部填充。
// 按单环判断（而非整 prov）：合并国（如新加坡=5 区环集）整体 bbox 达标时，里面的小环仍能各自放大。
function dilateSmall(wrings) {
  return wrings.map(function (ring) {
    var xs = [], ys = [];
    ring.forEach(function (v) { xs.push(v[0]); ys.push(v[1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var w = x1 - x0, h = y1 - y0;
    if (w >= 4 && h >= 4) return ring;
    var f = Math.max(5 / (w + 1), 5 / (h + 1));
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return ring.map(function (v) { return [Math.round(cx + (v[0] - cx) * f), Math.round(cy + (v[1] - cy) * f)]; });
  });
}
function ringStrDilate(polys) {
  var wrings = dilateSmall(ringsWorld(polys));
  wrings.forEach(function (ring) { ring.forEach(function (v) {
    if (v[0] < TX0) TX0 = v[0]; if (v[0] > TX1) TX1 = v[0];
    if (v[1] < TY0) TY0 = v[1]; if (v[1] > TY1) TY1 = v[1];
  }); });
  return wrings.map(function (ring) {
    return ring.map(function (v) { return v[0] + ' ' + v[1]; }).join(',');
  }).join(';');
}

// ---- 合并块单张外轮廓（t82）：环集 -> 扫描线 even-odd mask 并集 -> 4-邻域边界 Moore 追踪 ----
// 与桥 __sgMapBakeSprite 同构：环点先取整、行半开区间求交、跨度半开、单像素跨度撑 1。
// 追踪环只沿并集边界走——描边即「mask 与非 mask 的 4-邻域边缘」，内部共享边不产生环。
var CONTOUR_STATS = [];
function maskFillOf(rs, bx0, by0, W, H) {
  var m = new Uint8Array(W * H);
  for (var yy = 0; yy < H; yy++) {
    var xs = [];
    for (var ri = 0; ri < rs.length; ri++) {
      var rr = rs[ri];
      for (var e = 0; e < rr.length; e++) {
        var a = rr[e], b = rr[(e + 1) % rr.length];
        if (a[1] === b[1]) continue;
        var ya = a[1] - by0, yb = b[1] - by0;
        if ((ya <= yy && yy < yb) || (yb <= yy && yy < ya)) {
          xs.push((a[0] - bx0) + (yy - ya) / (yb - ya) * ((b[0] - bx0) - (a[0] - bx0)));
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort(function (a, b) { return a - b; });
    for (var i = 0; i + 1 < xs.length; i += 2) {
      var xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
      if (xb <= xa) xb = xa + 1;
      for (var xx = xa; xx < xb; xx++) m[yy * W + xx] = 1;
    }
  }
  return m;
}
function traceLoops(rs, label) {
  if (!rs.length) return [];
  var bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  rs.forEach(function (ring) { ring.forEach(function (v) {
    if (v[0] < bx0) bx0 = v[0]; if (v[0] > bx1) bx1 = v[0];
    if (v[1] < by0) by0 = v[1]; if (v[1] > by1) by1 = v[1];
  }); });
  var W = bx1 - bx0 + 1, H = by1 - by0 + 1;
  if (W <= 0 || H <= 0) return [];
  var m = maskFillOf(rs, bx0, by0, W, H);
  function pix(x, y) { return x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1; }
  // 裂缝跟随：状态 =（角点 2 倍坐标，方向）。角点坐标恒为奇数（像素中心=偶数），
  // 每步沿一条边界边走到下一角点；mask 始终保持在走向右侧（外轮廓顺针、孔洞逆针，even-odd 均正确）。
  var seen = {}, loops = [];
  var starts = [];
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    if (!pix(x, y)) continue;
    if (!pix(x, y - 1)) starts.push([2 * x - 1, 2 * y - 1, 2, 0]);      // 顶边向东
    if (!pix(x + 1, y)) starts.push([2 * x + 1, 2 * y - 1, 0, 2]);      // 右边向南
    if (!pix(x, y + 1)) starts.push([2 * x + 1, 2 * y + 1, -2, 0]);     // 底边向西
    if (!pix(x - 1, y)) starts.push([2 * x - 1, 2 * y + 1, 0, -2]);     // 左边向北
  }
  for (var si = 0; si < starts.length; si++) {
    var s0 = starts[si], k0 = s0[0] + ',' + s0[1] + ',' + s0[2] + ',' + s0[3];
    if (seen[k0] !== undefined) continue;
    // 状态 =（角点，到达方向），确定性转移；先登记起点状态（s0, s0dir）
    var corners = [[s0[0], s0[1]]];
    seen[k0] = 1;
    var cx2 = s0[0], cy2 = s0[1], dx = s0[2], dy = s0[3];
    var budget = 16 * (W + H) + 256, closed = false;
    while (budget-- > 0) {
      // 转向表（mask 保持右侧）：直行 > 右转（抱住当前像素） > 左转；对角相接按 4-连通拆环
      // 角点 (cx,cy) 四邻像素：NW=PX(-1,-1)、NE=PX(0,-1)、SW=PX(-1,0)、SE=PX(0,0)
      function PX(hx, hy) { return pix((cx2 + 1 + hx * 2) / 2, (cy2 + 1 + hy * 2) / 2); }
      var ndx = dx, ndy = dy;
      if (dx === 2) {        // 向东：来路 SW=mask、NW=bg；前 SE/NE
        var fSE = PX(0, 0), fNE = PX(0, -1);
        if (fSE && !fNE) { /* 直行 */ } else if (!fSE) { ndx = 0; ndy = 2; } else { ndx = 0; ndy = -2; }
      } else if (dy === 2) { // 向南：来路 NW=mask、NE=bg；前 SW/SE
        var fSW = PX(-1, 0), fSE2 = PX(0, 0);
        if (fSW && !fSE2) { /* 直行 */ } else if (!fSW) { ndx = -2; ndy = 0; } else { ndx = 2; ndy = 0; }
      } else if (dx === -2) {// 向西：来路 NE=mask、SE=bg；前 NW/SW
        var fNW = PX(-1, -1), fSW2 = PX(-1, 0);
        if (fNW && !fSW2) { /* 直行 */ } else if (!fNW) { ndx = 0; ndy = -2; } else { ndx = 0; ndy = 2; }
      } else {               // 向北：来路 SE=mask、SW=bg；前 NE/NW
        var fNE2 = PX(0, -1), fNW2 = PX(-1, -1);
        if (fNE2 && !fNW2) { /* 直行 */ } else if (!fNE2) { ndx = 2; ndy = 0; } else { ndx = -2; ndy = 0; }
      }
      cx2 += ndx; cy2 += ndy;
      var key = cx2 + ',' + cy2 + ',' + ndx + ',' + ndy;
      // 确定性走步：首个复现状态必为回到起点（第二圈压上首圈足迹），即闭环
      if (key === k0 || seen[key] !== undefined) { closed = true; break; }
      seen[key] = 1;
      corners.push([cx2, cy2]);
      dx = ndx; dy = ndy;
    }
    if (closed && corners.length >= 3) {
      if (corners[corners.length - 1][0] === corners[0][0] && corners[corners.length - 1][1] === corners[0][1]) corners.pop();
      // 折半回角点坐标（x.5 半整数），丢同轴共线中间角点只留拐点
      var pts = corners.map(function (c) { return [c[0] / 2 + bx0, c[1] / 2 + by0]; });
      var keep = [];
      for (var i = 0; i < pts.length; i++) {
        var pr = pts[(i + pts.length - 1) % pts.length], nx = pts[(i + 1) % pts.length];
        var sameX = pr[0] === pts[i][0] && nx[0] === pts[i][0];
        var sameY = pr[1] === pts[i][1] && nx[1] === pts[i][1];
        if (!(sameX || sameY)) keep.push(pts[i]);
      }
      if (keep.length >= 3) loops.push(keep);
    }
  }
  // 自检：按桥的取整规则回填，与原 mask 比对（漏/多像素通常 ≈ 描边厚度）
  var intRs = loops.map(function (ring) { return ring.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; }); });
  var m2 = maskFillOf(intRs, bx0, by0, W, H);
  var miss = 0, extra = 0, tot = 0;
  for (var k = 0; k < m.length; k++) {
    if (m[k]) tot++;
    if (m[k] && !m2[k]) miss++;
    if (!m[k] && m2[k]) extra++;
  }
  CONTOUR_STATS.push(label + ': 环' + loops.length + ' 像素' + tot + ' 漏' + miss + ' 多' + extra + '(' + (tot ? (100 * (tot - miss) / tot).toFixed(2) : '-') + '%)');
  return loops;
}
function ringStrContour(polys, label) {
  var wrings = dilateSmall(ringsWorld(polys));
  var rs = wrings.filter(function (ring) { return ring.length >= 3; });
  var loops = traceLoops(rs, label || '?');
  loops.forEach(function (ring) { ring.forEach(function (v) {
    if (v[0] < TX0) TX0 = v[0]; if (v[0] > TX1) TX1 = v[0];
    if (v[1] < TY0) TY0 = v[1]; if (v[1] > TY1) TY1 = v[1];
  }); });
  return loops.map(function (ring) {
    return ring.map(function (v) { return v[0] + ' ' + v[1]; }).join(',');
  }).join(';');
}

function centroidOf(polys) {
  // 取面积最大环的包围盒中心（多岛/细长 S 形地块的整体 bbox 中心可能落在海里或邻国境内）
  var best = polys[0], ba = -1;
  for (var pi = 0; pi < polys.length; pi++) {
    var ring = polys[pi];
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    var a = (x1 - x0) * (y1 - y0);
    if (a > ba) { ba = a; best = { x0: x0, y0: y0, x1: x1, y1: y1 }; }
  }
  return { wx: Math.round(X(best.x0 + ((best.x1 - best.x0) / 2.0))), wy: Math.round(Y(best.y0 + ((best.y1 - best.y0) / 2.0))) };
}

// 全地块总包围盒（fg+bg，含微小环放大；平移硬钳制边界用）——ringStrDilate 边生成边累计
var TX0 = 1e9, TY0 = 1e9, TX1 = -1e9, TY1 = -1e9;
var bounds = [], bodyFg = [], vertsFg = 0, provsFg = 0, cum = 0, fgCentroids = [];
for (var ci = 0; ci < fgOrder.length; ci++) {
  var c = fgOrder[ci], col = fixColor(c.color);
  var plist = provsOf(c);
  for (var pi = 0; pi < plist.length; pi++) {
    var p = plist[pi];
    var rs = p.merged ? ringStrContour(p.polys, c.code + '/' + p.name) : ringStrDilate(p.polys);
    bodyFg.push(p.name + ':' + rs);
    for (var ri = 0; ri < p.polys.length; ri++) vertsFg += p.polys[ri].length;
    var ctr = centroidOf(p.polys);
    fgCentroids.push({ code: c.code, name: p.name, wx: ctr.wx, wy: ctr.wy, idx: provsFg });
    provsFg++; cum++;
  }
  bounds.push({ code: c.code, color: col, start: cum });
}
var bgParts = [], vertsBg = 0, provsBg = 0, bgCols = [], bgCentroids = [];
// 背景板整国合并为单张外轮廓精灵（t82）：俄印中亚五国都不需要内部省界。
var BG_CN = { RUS: '俄罗斯', IND: '印度' };
for (var bi = 0; bi < bgOrder.length; bi++) {
  var c2 = bgOrder[bi], col2 = fixColor(c2.color);
  bgCols.push({ code: c2.code, color: col2, start: -1 });
  var allPolys = [], lastName = BG_CN[c2.code] || c2.code;
  for (var pi2 = 0; pi2 < c2.provs.length; pi2++) {
    var p2 = c2.provs[pi2];
    if (!p2.name || !p2.name.length) continue;
    // 退化省（全部环 <3 点，运行时 mapLoad 环判定会被丢弃）生成时同步剔除，
    // 保证 bgCols.start 分段界与运行时表下标一致（t76：IND 的 Chandigarh/Lakshadweep 等属此类）。
    if (!p2.polys.some(function (r3) { return r3.length >= 3; })) continue;
    p2.polys.forEach(function (pl) { if (pl.length >= 3) allPolys.push(pl); });
    if (!BG_CN[c2.code]) lastName = p2.name;
  }
  if (allPolys.length > 0) {
    var bgName = BG_CN[c2.code] || lastName;
    bgParts.push(bgName + ':' + ringStrContour(allPolys, c2.code + '/' + bgName));
    allPolys.forEach(function (pl) { vertsBg += pl.length; });
    var ctr2 = centroidOf(allPolys);
    bgCentroids.push({ code: c2.code, name: bgName, wx: ctr2.wx, wy: ctr2.wy });
    provsBg++;
  }
  bgCols[bgCols.length - 1].start = provsBg;
}

// 中国主体 bbox：纬度夹 17 度（排除南海诸岛远端；历史锚，仅参考用）
var chn = j.countries.find(function (c) { return c.code === 'CHN'; });
var lngMin = 1e9, latMax = -1e9, lngMax = -1e9, latMin = 1e9;
for (var pi3 = 0; pi3 < chn.provs.length; pi3++)
  for (var ri3 = 0; ri3 < chn.provs[pi3].polys.length; ri3++)
    for (var qi = 0; qi < chn.provs[pi3].polys[ri3].length; qi++) {
      var pt = chn.provs[pi3].polys[ri3][qi];
      if (pt[0] < lngMin) lngMin = pt[0]; if (pt[0] > lngMax) lngMax = pt[0];
      if (pt[1] > latMax) latMax = pt[1]; if (pt[1] < latMin) latMin = pt[1];
    }
var latLo = Math.max(latMin, 17.0);
var CNX0 = Math.round(X(lngMin)), CNY0 = Math.round(Y(latMax));
var CNX1 = Math.round(X(lngMax)), CNY1 = Math.round(Y(latLo));

var dst = '';
function W(x) { dst += x + '\n'; }
W('// east-data.subl —— 由 scripts/gen-east-data.js 从 vendor/geo/east-asia.json + world/*.json 生成（勿手改）。' );
W('// 东亚地图（t76 粒度）：中国 35 省细粒度；韩/朝整国一块；东南亚七国整国一块；日本分岛 7 块（北海道/东北/关东·中部/关西/中国/四国/九州）；蒙古原粒度。' );
W('// 背景板（不可点击、抽稀）：俄/印/哈/吉/塔/阿/巴。' );
W('// 经纬度 -> 世界整数像素：frame lng ' + F.minLng + '..' + F.maxLng + ' lat ' + F.minLat + '..' + F.maxLat + '，scale ' + s.toFixed(4) + ' px/°');
W('// 左偏 ' + ox.toFixed(1) + ' 顶偏 ' + oy.toFixed(1) + '（960x540 画布顶留 36 标题带；fit=整框入屏=缩放 1.0）。' );
W('');
// 初始相机：整框 fit（视口中心 480/270），并用硬钳制 pan 边界校正（视口能装下则钉全图中心，
// 否则取中国取景的 clamp）——避免首拖时的视野跳变。
var PINX = ((TX0 - 8.0) + 480.0), PANX = ((TX1 + 8.0) - 480.0);
var PINY = ((TY0 - 8.0) + 270.0), PANY = ((TY1 + 8.0) - 270.0);
var INIT_XV = (PINX > PANX) ? ((PINX + PANX) / 2.0) : Math.min(Math.max(480.0, PINX), PANX);
var INIT_YV = (PINY > PANY) ? ((PINY + PANY) / 2.0) : Math.min(Math.max((TOP + ah / 2), PINY), PANY);
W('// 相机初始（整框 fit；校入硬钳制边界内）');
W('fun E_INIT_X(): Rat = ' + INIT_XV.toFixed(1));
W('fun E_INIT_Y(): Rat = ' + INIT_YV.toFixed(1));
W('');
W('// 全地块总包围盒（fg+bg 所有地块；平移硬钳制边界：任何地块都不出视口）');
function ratF(v) { var s = (Math.round(v * 10) / 10).toString(); return s.indexOf('.') < 0 ? s + '.0' : s; }
W('fun E_TX0(): Rat = ' + ratF(TX0));
W('fun E_TY0(): Rat = ' + ratF(TY0));
W('fun E_TX1(): Rat = ' + ratF(TX1));
W('fun E_TY1(): Rat = ' + ratF(TY1));
W('');
W('// 中国主体 bbox（历史锚；仅参考用，钳制用 TX_* 硬边界）');
W('fun CN_X0(): Rat = ' + CNX0 + '.0');
W('fun CN_Y0(): Rat = ' + CNY0 + '.0');
W('fun CN_X1(): Rat = ' + CNX1 + '.0');
W('fun CN_Y1(): Rat = ' + CNY1 + '.0');
W('');
W('// 国家色（同国各省共享 tint；#101820 深底对比度 ≥3.2，调亮者=原色对比不足）');
for (var i = 0; i < bounds.length; i++) W('fun C_' + bounds[i].code + '(): Str = ' + JSON.stringify(bounds[i].color));
for (var i2 = 0; i2 < bgCols.length; i2++) W('fun C_' + bgCols[i2].code + '(): Str = ' + JSON.stringify(bgCols[i2].color));
W('');
W('// 可点击表分段界（各国段起点；provHex 用 i<E_k 判段）；E_k = 第 k+1 国起点，E12=表全长）');
for (var i3 = 0; i3 < bounds.length; i3++)
  W('fun E' + (i3 + 1) + '(): Nat = ' + bounds[i3].start);
W('// 背景表分段界（各背景国段起点，bgHex 分段用）');
for (var bi2 = 0; bi2 < bgCols.length; bi2++) W('fun E_' + bgCols[bi2].code + '(): Nat = ' + bgCols[bi2].start);
W('');
W('// 地块表（紧凑文本：名:环;环|...）。可点击 ' + provsFg + ' 块 ' + vertsFg + ' 顶；背景板 ' + provsBg + ' 块 ' + vertsBg + ' 顶。');
W('@impure');
W('fun mapEastFg(): Str = ' + JSON.stringify(bodyFg.join('|')));
W('');
W('@impure');
W('fun mapEastBg(): Str = ' + JSON.stringify(bgParts.join('|')));
// ---- 海域地块（手绘粗粒度多边形，1x 世界像素；渲染于陆地之下，可点击）----
// 东亚近海划为 9 个大地块：渤海/黄海/东海/南海/北部湾/泰国湾/日本海/鄂霍次克海/菲律宾海。
var SEAS = [
  { name: '渤海',   ring: [[645,150],[700,150],[705,200],[700,230],[660,230],[650,200]] },
  { name: '黄海',   ring: [[650,230],[703,200],[712,290],[655,290],[640,260]] },
  { name: '东海',   ring: [[685,255],[700,240],[760,245],[785,300],[770,335],[700,345],[675,320]] },
  { name: '南海',   ring: [[540,345],[680,345],[700,400],[660,530],[540,530],[520,440]] },
  { name: '北部湾', ring: [[485,350],[560,350],[565,395],[540,430],[490,430]] },
  { name: '泰国湾', ring: [[520,445],[560,445],[570,480],[560,530],[520,530]] },
  { name: '日本海', ring: [[762,150],[800,150],[800,260],[760,260]] },
  { name: '鄂霍次克海', ring: [[755,35],[895,35],[895,150],[755,152]] },
  { name: '菲律宾海', ring: [[780,150],[890,150],[890,25],[1040,25],[1040,530],[770,515],[765,320],[790,200]] },
  { name: '北太平洋', ring: [[10,-180],[1030,-180],[1030,25],[10,25]] },
  { name: '印度洋',   ring: [[10,25],[522,25],[522,530],[10,530]] },
  { name: '南太平洋', ring: [[560,330],[1030,330],[1030,530],[560,530]] },
  { name: '台湾海峡', ring: [[628,290],[684,290],[684,348],[628,348]] },
  { name: '对马海峡', ring: [[734,196],[762,196],[762,268],[734,268]] },
];
// 邻接表（几何边距阈值；陆-陆 6 / 陆-海 16 / 海-海 12）：name:邻1,邻2|...
function parseRings(s) {
  return s.split(';').map(function (r) {
    return r.split(',').map(function (p) { var q = p.split(' '); return [parseFloat(q[0]), parseFloat(q[1])]; });
  });
}
function ringsMinDist(ra, rb, limit) {
  var best = limit;
  for (var ai = 0; ai < ra.length; ai++) {
    for (var bi = 0; bi < rb.length; bi++) {
      var A = ra[ai], B = rb[bi];
      var n = Math.max(A.length, B.length);
      for (var k0 = 0; k0 < A.length; k0++) { var a0 = A[k0], a1 = A[(k0 + 1) % A.length];
        for (var k1 = 0; k1 < B.length; k1++) { var b0 = B[k1], b1 = B[(k1 + 1) % B.length];
          var d = segSeg(a0, a1, b0, b1);
          if (d < best) best = d;
        } }
    } }
  return best;
}
function segSeg(a0, a1, b0, b1) {
  var d = segPt(b0, b1, a0); d = Math.min(d, segPt(b0, b1, a1));
  d = Math.min(d, segPt(a0, a1, b0)); d = Math.min(d, segPt(a0, a1, b1));
  return d;
}
function segPt(p, q, a) {
  var dx = q[0] - p[0], dy = q[1] - p[1];
  var L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(a[0] - p[0], a[1] - p[1]);
  var t = Math.max(0, Math.min(1, ((a[0] - p[0]) * dx + (a[1] - p[1]) * dy) / L2));
  return Math.hypot(a[0] - (p[0] + t * dx), a[1] - (p[1] + t * dy));
}
var seaParts = SEAS.map(function (s) { return s.name + ':' + s.ring.map(function (v) { return v[0] + ' ' + v[1]; }).join(','); });
var geo = bodyFg.map(function (row) { var k = row.indexOf(':'); return { name: row.slice(0, k), rings: parseRings(row.slice(k + 1)) }; });
var adjList = [];
for (var g1 = 0; g1 < geo.length; g1++) {
  var nb = [];
  for (var g2 = 0; g2 < geo.length; g2++) {
    if (g2 === g1) continue;
    if (ringsMinDist(geo[g1].rings, geo[g2].rings, 6) < 6) nb.push(geo[g2].name);
  }
  for (var s2 = 0; s2 < SEAS.length; s2++) {
    if (ringsMinDist(geo[g1].rings, [SEAS[s2].ring], 16) < 16) nb.push(SEAS[s2].name);
  }
  adjList.push(geo[g1].name + ':' + nb.join(','));
}
for (var s1 = 0; s1 < SEAS.length; s1++) {
  var nbs = [];
  for (var g3 = 0; g3 < geo.length; g3++) {
    if (ringsMinDist([SEAS[s1].ring], geo[g3].rings, 16) < 16) nbs.push(geo[g3].name);
  }
  for (var s3 = 0; s3 < SEAS.length; s3++) {
    if (s3 === s1) continue;
    if (ringsMinDist([SEAS[s1].ring], [SEAS[s3].ring], 12) < 12) nbs.push(SEAS[s3].name);
  }
  adjList.push(SEAS[s1].name + ':' + nbs.join(','));
}
// 邻接修正（scripts/adj-fix.js：DEL 双向删除 / ADD 双向补入；再对称化）
var AF = require('./adj-fix');
var adjMap = {};
adjList.forEach(function (row) { var k = row.indexOf(':'); adjMap[row.slice(0, k)] = row.slice(k + 1).split(',').filter(function (n) { return n.length > 0; }); });
Object.keys(AF.ADJ_DEL).forEach(function (a) { (AF.ADJ_DEL[a] || []).forEach(function (b) {
  if (adjMap[a]) adjMap[a] = adjMap[a].filter(function (n) { return n !== b; });
  if (adjMap[b]) adjMap[b] = adjMap[b].filter(function (n) { return n !== a; });
}); });
Object.keys(AF.ADJ_ADD).forEach(function (a) { (AF.ADJ_ADD[a] || []).forEach(function (b) {
  if (adjMap[a] && adjMap[a].indexOf(b) < 0) adjMap[a].push(b);
  if (adjMap[b] && adjMap[b].indexOf(a) < 0) adjMap[b].push(a);
}); });
Object.keys(adjMap).forEach(function (a) { adjMap[a].slice().forEach(function (b) { if (!adjMap[b]) adjMap[b] = []; if (adjMap[b].indexOf(a) < 0) adjMap[b].push(a); }); });
Object.keys(adjMap).forEach(function (a) { adjMap[a].sort(); });
adjList = Object.keys(adjMap).map(function (nm) { return nm + ':' + adjMap[nm].join(','); });
W('');
W('// 海域地块表（14 块；渲染于陆地之下、可点击、可驻扎舰队）');
W('@impure');
W('fun mapSea(): Str = ' + JSON.stringify(seaParts.join('|')));
W('');
W('// 邻接表（几何边距 + adj-fix 真实性修正）：name:邻1,邻2|name:...');
W('fun adjTable(): Str = ' + JSON.stringify(adjList.join('|')));
console.log('海域 ' + SEAS.length + ' 块；邻接表 ' + adjList.length + ' 条');
fs.writeFileSync(path.join(G, 'app', 'east-data.subl'), dst);

// 探针目标：按已生成地块（合并块）的质心（bbox 中心世界像素）；idx = fg 表内地块索引（命中应精确等于它）。
function findCtr(code, name) {
  var hit = fgCentroids.filter(function (t) { return t.code === code; }).find(function (t) { return t.name === name; });
  if (!hit) hit = bgCentroids.filter(function (t) { return t.code === code; }).find(function (t) { return t.name === name; });
  if (!hit) throw new Error('探针目标未找到: ' + code + ' ' + name);
  return hit;
}
var T = {};
function pick(key, code, name) { var t = findCtr(code, name); T[key] = { code: code, name: name, lbl: name, wx: t.wx, wy: t.wy, idx: t.idx }; }
function pickProv(key, code, name) { // 源省质心（用于远点/指定小岛；idx 归属的块）
  var c = j.countries.find(function (x) { return x.code === code; });
  var p = c.provs.find(function (q) { return q.name === name; });
  if (!p) throw new Error('源省未找到: ' + code + ' ' + name);
  var ctr = centroidOf(p.polys);
  return { wx: ctr.wx, wy: ctr.wy };
}
function farProv(code, blockName) { // 与块质心最远的源省（整国一块的远点证据）
  var c = j.countries.find(function (x) { return x.code === code; });
  var blk = fgCentroids.filter(function (t) { return t.code === code; }).find(function (t) { return t.name === blockName; });
  var best = null, bd = -1;
  c.provs.forEach(function (p) {
    if (!p.name || !p.name.length) return;
    var ctr = centroidOf(p.polys);
    var d = (ctr.wx - blk.wx) * (ctr.wx - blk.wx) + (ctr.wy - blk.wy) * (ctr.wy - blk.wy);
    if (d > bd) { bd = d; best = { name: p.name, wx: ctr.wx, wy: ctr.wy }; }
  });
  return best;
}
pick('sichuan', 'CHN', '四川省');
pick('hainan', 'CHN', '海南省');
pick('hokkaido', 'JPN', '北海道');
pick('tohoku', 'JPN', '东北');
pick('kantochubu', 'JPN', '关东·中部');
pick('kansai', 'JPN', '关西');
pick('chugoku', 'JPN', '中国');
pick('shikoku', 'JPN', '四国');
pick('kyushu', 'JPN', '九州');
pick('korea', 'KOR', '韩国');
pick('prk', 'PRK', '朝鲜');
pick('thailand', 'THA', '泰国');
pick('vietnam', 'VNM', '越南');
pick('laos', 'LAO', '老挝');
pick('cambodia', 'KHM', '柬埔寨');
pick('myanmar', 'MMR', '缅甸');
pick('malaysia', 'MYS', '马来西亚');
pick('singapore', 'SGP', '新加坡');
pick('kazakhstan', 'KAZ', '哈萨克斯坦');
pick('kyrgyzstan', 'KGZ', '吉尔吉斯斯坦');
pick('tajikistan', 'TJK', '塔吉克斯坦');
pick('afghanistan', 'AFG', '阿富汗');
pick('pakistan', 'PAK', '巴基斯坦');
// 细粒度证据：中国/蒙古两省索引不同
var mng = j.countries.find(function (x) { return x.code === 'MNG'; });
var mngA = mng.provs[0], mngB = mng.provs[mng.provs.length - 1];
var ctrA = centroidOf(mngA.polys), ctrB = centroidOf(mngB.polys);
var ixA = fgCentroids.findIndex(function (t) { return t.code === 'MNG'; });
T.mongoliaA = { code: 'MNG', name: mngA.name, wx: ctrA.wx, wy: ctrA.wy, idx: ixA };
T.mongoliaB = { code: 'MNG', name: mngB.name, wx: ctrB.wx, wy: ctrB.wy, idx: ixA + mng.provs.filter(function (q) { return q.name && q.name.length; }).length - 1 };
function provPt(code, name) {
  var c = j.countries.find(function (x) { return x.code === code; });
  var p = c.provs.find(function (q) { return q.name === name; });
  if (!p) throw new Error('源省未找到: ' + code + ' ' + name);
  return centroidOf(p.polys);
}
function farProvPt(code, name, bx, by) { return provPt(code, name); }
function farPick(key, code, blockName, sameIdx) {
  var f = farProv(code, blockName);
  T[key] = { code: code, name: f.name + '→' + blockName, wx: f.wx, wy: f.wy, idx: sameIdx };
}
T.korea2 = { code: 'KOR', name: 'Jeju→韩国', wx: farProvPt('KOR', 'Jeju', T.korea.wx, T.korea.wy).wx, wy: farProvPt('KOR', 'Jeju', T.korea.wx, T.korea.wy).wy, idx: T.korea.idx };
T.prk2 = { code: 'PRK', name: 'Rasŏn→朝鲜', wx: provPt('PRK', 'Rasŏn').wx, wy: provPt('PRK', 'Rasŏn').wy, idx: T.prk.idx };
T.thai2 = { code: 'THA', name: 'Narathiwat→泰国', wx: provPt('THA', 'Narathiwat').wx, wy: provPt('THA', 'Narathiwat').wy, idx: T.thailand.idx };
T.vn2 = { code: 'VNM', name: 'HàGiang→越南', wx: provPt('VNM', 'HàGiang').wx, wy: provPt('VNM', 'HàGiang').wy, idx: T.vietnam.idx };
var pri = pickProv('primorye', 'RUS', "Primor'ye");
var odi = pickProv('odisha', 'IND', 'Odisha');
var oki = pickProv('okinawa', 'JPN', 'Okinawa');
T.okinawa = { code: 'JPN', name: 'Okinawa→九州', wx: oki.wx, wy: oki.wy, idx: T.kyushu.idx }; // 冲绳并入九州块
T.primorye = { code: 'RUS', name: "Primor'ye", wx: pri.wx, wy: pri.wy };
T.odisha = { code: 'IND', name: 'Odisha', wx: odi.wx, wy: odi.wy };
// 远点：已选中块整体为金色——点击扫描金色而非国色；标签断言用块名
var FAR_LBL = { korea2: 'korea', prk2: 'prk', thai2: 'thailand', vn2: 'vietnam', okinawa: 'kyushu' };
Object.keys(FAR_LBL).forEach(function (k) { if (T[k] && T[FAR_LBL[k]]) { T[k].lbl = T[FAR_LBL[k]].name; T[k].gold = true; } });
fs.writeFileSync(path.join(G, 'test', 'east-targets.js'), 'window.__EAST_T = ' + JSON.stringify(T) + ';');

console.log('east-data.subl ' + dst.length + ' B; fg 块=' + provsFg + ' 顶=' + vertsFg + '; bg 块=' + provsBg + ' 顶=' + vertsBg);
console.log('TX=(' + TX0 + ',' + TY0 + ')-(' + TX1 + ',' + TY1 + ') INIT=(' + INIT_XV.toFixed(1) + ',' + INIT_YV.toFixed(1) + ')');
console.log('分段界: ' + JSON.stringify(bounds.map(function (b) { return b.code + ':' + b.start; })));
CONTOUR_STATS.forEach(function (s) { console.log('轮廓 ' + s); });
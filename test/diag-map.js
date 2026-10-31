// 加载 app.js 并用桥诊断
const path = 'F:/SublimationProject/foresight/build/game/app.js';
globalThis.window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1 };
globalThis.document = { fonts: { load: () => Promise.resolve() } };
const __sgObjs = [];
let __sgK = null;
const kaplayCalls = [];
function __mkObj() { var o = { exists: () => true, destroyed: false, comps: [], tags: [], use: function (c) { this.comps.push(c); }, destroy: function () { this.destroyed = true; }, on: function () {} }; __sgObjs.push(o); return o; }
const K = {
  width: 960, height: 540,
  vec2: (x, y) => ({ x, y }),
  rect: (w, h, o) => ({ comp: 'rect', w, h, radius: (o && o.radius) || 0 }),
  circle: r => ({ comp: 'circle', r }),
  text: (t, o) => ({ comp: 'text', text: t, size: o && o.size }),
  color: (r, g, b) => ({ comp: 'color', r, g, b }),
  anchor: a => ({ comp: 'anchor', a }),
  fixed: () => ({ comp: 'fixed' }),
  z: zz => ({ comp: 'z', z: zz }),
  sprite: s => ({ comp: 'sprite', name: s }),
  add: function (cs) { var o = __mkObj(); (cs || []).forEach(c => o.use(c)); return o; },
  get: t => __sgObjs.filter(o => o.tags.indexOf(t) >= 0),
  destroy: t => __sgObjs.forEach(o => { if (o.tags.indexOf(t) >= 0) o.destroyed = true; }),
  on: () => {}, onLoad: () => {}, scene: () => {}, go: () => {},
  pos: (x, y) => ({ comp: 'pos', x, y }),
  scale: (x, y) => ({ comp: 'scale' }),
  area: () => ({ comp: 'area' }),
  camPos: (x, y) => kaplayCalls.push({ fn: 'camPos', x, y }),
  camScale: (x, y) => kaplayCalls.push({ fn: 'camScale' }),
  layers: () => {}, key: () => {}, mousePos: () => vec2,
};
function vec2(x, y) { return { x, y }; }
globalThis.__sgK = () => K;
globalThis.__subl = { call: (op, args) => { try { return ops[op].apply(null, args || []); } catch (e) { throw e; } } };
// 用 game-runtime.js 注入桥（与页面同链路）
require('F:/SublimationProject/foresight/js/game-runtime.js');
const ops = globalThis.__SG_OPS || globalThis.__subl.ops ? globalThis.__subl.ops() : null;
console.log('ops count: ' + Object.keys(globalThis.__SG_OPS || {}).length);

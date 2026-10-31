const fs = require('fs');
const path = 'F:/SublimationProject/foresight';
const bakeLog = [];
globalThis.document = {
  createElement: function (t) {
    if (t !== 'canvas') return {};
    return {
      width: 0, height: 0,
      getContext: function () {
        return {
          createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
          putImageData: function (im) {
            var n = 0;
            for (var i = 3; i < im.data.length; i += 4) if (im.data[i] > 0) n++;
            bakeLog.push(n);
          }
        };
      }
    };
  }
};
globalThis.window = { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 };
globalThis.kaplay = function (o) {
    return {
      loadSprite: function () {},
      width: 960, height: 540,
      on: function () {}, onLoad: function () {}, scene: function () {}, go: function () {},
      add: function () { return { use: function () {} }; },
      get: function () { return []; },
      camPos: function () {}, camScale: function () {},
    };
  };
  globalThis.__sgK = () => ({ loadSprite: function () {} });
const rt = fs.readFileSync(path + '/js/game-runtime.js', 'utf8');
new Function(rt)();
globalThis.__subl.call('gameStart', [960, 540]);
const subl = globalThis.__subl;
const t = fs.readFileSync(path + '/app/east-data.subl', 'utf8');
const i = t.indexOf('fun mapEastFg(): Str = "');
const fg = t.slice(i, t.indexOf('\n', i)).match(/"([^"]+)"/)[1];
function x2(tbl) {
  return tbl.split('|').map(function (row) {
    var sep = row.indexOf(':');
    return row.slice(0, sep) + ':' + row.slice(sep + 1).replace(/(-?[\d.]+)/g, function (m) { return String(2 * parseFloat(m)); });
  }).join('|');
}
const m = subl.call('mapLoad', [x2(fg)]);
console.log('prov count:', m.provs.length, 'bake entries:', bakeLog.length);
const empties = bakeLog.map((n, k) => n === 0 ? k : -1).filter(k => k >= 0);
console.log('empty sprites:', JSON.stringify(empties));
console.log('pixel counts (first 12):', JSON.stringify(bakeLog.slice(0, 12)));
console.log('pixel counts (35..71):', JSON.stringify(bakeLog.slice(35, 72)));

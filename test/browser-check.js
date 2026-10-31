// browser-check.js - foresight 浏览器侧冒烟（CDP; node test/browser-check.js）
// 打开 build/game/index.html（真实 Edge 无头），收 console/异常，像素探针验证
// 引擎驱动渲染（顶栏/地块/操作面板/超事件全屏黑底），驱动点击走一段 tick 循环，
// 存截图 test/browser-screenshot.png。Node 侧冒烟见 test/smoke.js。
// 用法: node test/browser-check.js
"use strict";
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9444;
const fs = require('fs');
const path = require('path');
const OUT_PNG = path.join(__dirname, 'browser-screenshot.png');
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
async function main() {
  const { spawn, execFileSync } = await import('child_process');
  const url = 'file:///' + path.join(__dirname, '..', 'build', 'game', 'index.html').replace(/\\\\/g, '/');
  const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', '--user-data-dir=C:\\\\Temp\\\\edge-cdp-' + Date.now(), url],
    { stdio: 'ignore', detached: true });
  let targets = null;
  for (let i = 0; i < 80 && !targets; i++) {
    await sleep(400);
    try { const res = await fetch('http://127.0.0.1:' + PORT + '/json'); const a = await res.json(); if (a.length) targets = a; } catch (e) {}
  }
  if (!targets) { console.log('CDP-FAIL 未能连接 Edge 调试端口'); try { child.kill(); } catch (e2) {} process.exit(1); }
  const page = targets.find(function (t) { return t.type === 'page'; }) || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = {}; const exceptions = [];
  const send = function (method, params) { return new Promise(function (res) { var i2 = ++id; pend[i2] = res; ws.send(JSON.stringify({ id: i2, method: method, params: params || {} })); }); };
  const evaluate = function (expr) { return send('Runtime.evaluate', { expression: expr, returnByValue: true }); };
  const lines = [];
  ws.onmessage = function (ev) {
    var m; try { m = JSON.parse(ev.data); } catch (e3) { return; }
    if (m.id && pend[m.id]) { var r = pend[m.id]; delete pend[m.id]; r(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'log') {
      var txt = (m.params.args || []).map(function (a) { return a.value === undefined ? '' : a.value; }).join('');
      lines.push(String(txt));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      var d = m.params.exceptionDetails || {};
      exceptions.push(String((d.exception && d.exception.description) || d.text || '').slice(0, 200));
      lines.push('PAGE-EXCEPTION ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
    }
  };
  await new Promise(function (res) { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable');
  // 载入 + 首帧（tick1 操作面板自动开）
  var start = Date.now();
  while ((Date.now() - start) < 9000) { await sleep(1000); }
  // 画布 CSS 包围盒 + letterbox 变换（世界 960x540 居中缩放进画布）
  var rectExpr = "(function () { var cv = document.querySelector('canvas'); if (!cv) return null; var r = cv.getBoundingClientRect();" +
    "var s = Math.min(r.width / 960, r.height / 540);" +
    "return JSON.stringify({x: r.x + (r.width - 960 * s) / 2, y: r.y + (r.height - 540 * s) / 2, s: s}); })()";
  var rect = null;
  try { var rr = await evaluate(rectExpr); rect = rr && rr.result && JSON.parse(rr.result.value); } catch (e7) { rect = null; }
  if (!rect) { console.log('CDP-FAIL 无 canvas 包围盒'); try { child.kill(); } catch (e8) {} process.exit(1); }
  function pxToWin(lx, ly) { return { x: Math.round(rect.x + lx * rect.s), y: Math.round(rect.y + ly * rect.s) }; }
  async function click(lx, ly) {
    var p = pxToWin(lx, ly);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await sleep(350);
  }
  // 像素探针：逻辑画布 960x540
  var probeExpr = "(function () { var cv = document.querySelector('canvas'); if (!cv) return 'NO-CANVAS';" +
    "if (!window.__subl || typeof window.__subl.main !== 'function') return 'NO-SUBL';" +
    "var gl = cv.getContext('webgl2') || cv.getContext('webgl'); if (!gl) return 'NO-GL';" +
    "function px(lx, ly) { var s = Math.min(cv.width / 960, cv.height / 540);" +
    "  var x = Math.round(((cv.width - 960 * s) / 2) + lx * s), y = Math.round(((cv.height - 540 * s) / 2) + ly * s);" +
    "  var p = new Uint8Array(4); gl.readPixels(x, cv.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [p[0], p[1], p[2]]; }" +
    "return JSON.stringify({ topbar: px(200, 10), bottombar: px(200, 520), sea: px(200, 300), block2: px(620, 145)," +
    "  panel: px(300, 200), center: px(480, 270) }); })()";
  async function probe(tag) {
    var res = null;
    try { var r2 = await evaluate(probeExpr); res = r2 && r2.result && r2.result.value; } catch (e4) { res = 'EVAL-ERR'; }
    console.log('PROBE-' + tag + ' ' + res);
    return res;
  }
  // lieyan 模组（活动模组）：序章操作页 -> 签署应急预案（AP 1->0 自动结算）-> 序章超事件
  await probe('ops-panel');
  await click(300, 170);  // 序章操作页「应急预案」
  await click(300, 170);  // 签署《疫情防控应急预案》-> 行动点 0 -> 自动结算 -> 超事件（全屏黑底 z=50）
  var p2 = await probe('super-event');
  var blackOk = false;
  try {
    var j2 = JSON.parse(p2);
    blackOk = (j2.center[0] + j2.center[1] + j2.center[2]) < 90 && (j2.bottombar[0] + j2.bottombar[1] + j2.bottombar[2]) < 90;
  } catch (e10) {}
  console.log('CHECK-SUPER-BLACK ' + (blackOk ? 'PASS 超事件全屏黑底覆盖（顶栏底栏被遮）' : 'FAIL 中心/底栏未黑 ' + p2));
  // 序章超事件逐行（12 行 -> 推进至第一章开场沉浸式「会议室」）后截图
  for (var li = 0; li < 12; li++) await click(480, 300);
  var shot = null;
  try { var s = await send('Page.captureScreenshot', { format: 'png' }); if (s && s.data) { fs.writeFileSync(OUT_PNG, Buffer.from(s.data, 'base64')); shot = fs.statSync(OUT_PNG).size; } }
  catch (e9) {}
  console.log(lines.join('\n'));
  console.log('PAGE ' + url);
  console.log('EXCEPTIONS ' + (exceptions.length ? exceptions.join(' | ') : 'none'));
  console.log('SCREENSHOT ' + (shot ? OUT_PNG + ' ' + shot + ' B' : 'not saved'));
  console.log('CDP-STATUS DONE 行=' + lines.length);
  try { child.kill(); } catch (e5) {}
  try { execFileSync('taskkill', ['/F', '/IM', 'msedge.exe'], { stdio: 'ignore' }); } catch (e6) {}
  process.exit(0);
}
main().catch(function (e) { console.log('CDP-ERROR ' + String(e.message || e).slice(0, 300)); process.exit(1); });

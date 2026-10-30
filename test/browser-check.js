// browser-check.js - foresight 浏览器侧冒烟（CDP; node test/browser-check.js）
// 打开 build/game/index.html（真实 Edge 无头），收 console/异常，读 WebGL 像素验证
// 标题屏与地块渲染，存截图 test/browser-screenshot.png。Node 侧冒烟见 test/smoke.js。
// 用法: node test/browser-check.js [<真实毫秒预算>]
"use strict";
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9444;
const fs = require('fs');
const path = require('path');
const OUT_PNG = path.join(__dirname, 'browser-screenshot.png');
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
let done = false;
async function main() {
  const { spawn, execFileSync } = await import('child_process');
  const url = 'file:///' + path.join(__dirname, '..', 'build', 'game', 'index.html').replace(/\\/g, '/');
  const budget = parseInt(process.argv[3] || '540000', 10);
  const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', '--user-data-dir=C:\\Temp\\edge-cdp-' + Date.now(), url],
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
  const lines = [];
  ws.onmessage = function (ev) {
    var m; try { m = JSON.parse(ev.data); } catch (e3) { return; }
    if (m.id && pend[m.id]) { var r = pend[m.id]; delete pend[m.id]; r(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'log') {
      var txt = (m.params.args || []).map(function (a) { return a.value === undefined ? '' : a.value; }).join('');
      lines.push(String(txt));
      if (String(txt).indexOf('CHECK-DONE') >= 0) done = true;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      var d = m.params.exceptionDetails || {};
      exceptions.push(String((d.exception && d.exception.description) || d.text || '').slice(0, 200));
      lines.push('PAGE-EXCEPTION ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
    }
  };
  await new Promise(function (res) { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable');
  // 固定等待：载入 + 字体就绪 + 首帧（场景静态，无 DONE 标记需求）
  var start = Date.now();
  while ((Date.now() - start) < Math.min(budget, 12000)) { await sleep(1000); }
  // 像素探针：逻辑画布 960x540 上的三点取样
  var probe = "(function () { var cv = document.querySelector('canvas'); if (!cv) return 'NO-CANVAS';" +
    "if (!window.__subl || typeof window.__subl.main !== 'function') return 'NO-SUBL';" +
    "var gl = cv.getContext('webgl2') || cv.getContext('webgl'); if (!gl) return 'NO-GL';" +
    "function px(lx, ly) { var x = Math.round(lx * cv.width / 960), y = Math.round(ly * cv.height / 540);" +
    "  var p = new Uint8Array(4); gl.readPixels(x, cv.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [p[0], p[1], p[2]]; }" +
    "return JSON.stringify({ topbar: px(200, 10), bottombar: px(200, 520), sea: px(200, 300), block2: px(620, 145) }); })()";
  var probeRes = null;
  try { var r2 = await send('Runtime.evaluate', { expression: probe, returnByValue: true }); probeRes = r2 && r2.result && r2.result.value; }
  catch (e4) { probeRes = 'EVAL-ERR'; }
  var shot = null;
  try { var s = await send('Page.captureScreenshot', { format: 'png' }); if (s && s.data) { fs.writeFileSync(OUT_PNG, Buffer.from(s.data, 'base64')); shot = fs.statSync(OUT_PNG).size; } }
  catch (e9) {}
  console.log(lines.join('\n'));
  console.log('PAGE ' + url);
  console.log('PROBE ' + probeRes);
  console.log('EXCEPTIONS ' + (exceptions.length ? exceptions.join(' | ') : 'none'));
  console.log('SCREENSHOT ' + (shot ? OUT_PNG + ' ' + shot + ' B' : 'not saved'));
  console.log('CDP-STATUS DONE 行=' + lines.length);
  try { child.kill(); } catch (e5) {}
  try { execFileSync('taskkill', ['/F', '/IM', 'msedge.exe'], { stdio: 'ignore' }); } catch (e6) {}
  process.exit(0);
}
main().catch(function (e) { console.log('CDP-ERROR ' + String(e.message || e).slice(0, 300)); process.exit(1); });
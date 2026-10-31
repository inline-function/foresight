const { spawn } = require("child_process");
const fs = require("fs");
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9555;
const url = 'file:///' + 'F:/SublimationProject/foresight/build/game/index.html'.replace(/\\/g, '/');
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,800',
  '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', '--user-data-dir=C:\\Temp\\probe-' + Date.now(), url], { stdio: 'ignore', detached: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) {
    await sleep(400);
    try { const a = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); if (a.length) targets = a; } catch (e) {}
  }
  if (!targets) { console.log('CDP-FAIL'); process.exit(1); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await new Promise(r => ws.onopen = r);
  await sleep(3500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('F:/SublimationProject/foresight/test/initial-shot.png', Buffer.from(shot.data, 'base64'));
  console.log('SHOT saved ' + shot.data.length);
  child.kill();
  process.exit(0);
}
main().catch(e => { console.log('ERR ' + e); process.exit(1); });

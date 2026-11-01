const http = require("http");
const crypto = require("crypto");
const net = require("net");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
}

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.buf = Buffer.alloc(0); this.sock = null; }
  connect() {
    return new Promise((resolve, reject) => {
      const u = new URL(this.wsUrl);
      const key = crypto.randomBytes(16).toString("base64");
      const s = net.connect(u.port, u.hostname, () => {
        s.write("GET " + u.pathname + u.search + " HTTP/1.1\r\nHost: " + u.host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n\r\n");
      });
      this.sock = s;
      let handshook = false;
      s.on("data", d => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!handshook) {
          const i = this.buf.indexOf("\r\n\r\n");
          if (i < 0) return;
          handshook = true;
          this.buf = this.buf.slice(i + 4);
          resolve();
        }
        this.drain();
      });
      s.on("error", reject);
    });
  }
  drain() {
    while (true) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = this.buf.slice(off, off + len);
      this.buf = this.buf.slice(off + len);
      if (op === 1 || op === 2) {
        const msg = JSON.parse(payload.toString("utf8"));
        if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
      }
      if (!fin) { /* 简化：不分片 */ }
    }
  }
  send(method, params) {
    return new Promise(resolve => {
      const id = ++this.id;
      this.pending.set(id, resolve);
      const body = Buffer.from(JSON.stringify({ id, method, params: params || {} }), "utf8");
      const mask = crypto.randomBytes(4);
      const ml = body.length < 126 ? body.length : (body.length < 65536 ? 126 : 127);
      const hs = [0x81, 0x80 | ml];
      const head = Buffer.from(hs);
      let fr;
      if (ml === 126) { const e = Buffer.alloc(2); e.writeUInt16BE(body.length); fr = Buffer.concat([head, e]); }
      else if (ml === 127) { const e = Buffer.alloc(8); e.writeBigUInt64BE(BigInt(body.length)); fr = Buffer.concat([head, e]); }
      else fr = head;
      const masked = Buffer.alloc(body.length);
      for (let i = 0; i < body.length; i++) masked[i] = body[i] ^ mask[i % 4];
      this.sock.write(Buffer.concat([fr, mask, masked]));
    });
  }
}

(async () => {
  setTimeout(() => { console.log('WATCHDOG'); try { edge.kill(); } catch (e) {} process.exit(2); }, 55000);
  const { spawn } = require("child_process");
  const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + PORT, "--window-size=1920,1080", "about:blank"]);
  await new Promise(r => setTimeout(r, 3500));
  for (var wtries = 0; wtries < 60; wtries++) {
    try { await httpGet("/json/version"); break; } catch (e2) { await new Promise(r => setTimeout(r, 500)); }
  }
  console.log("EDGE-UP");
  try { console.log("VER", JSON.stringify(await httpGet("/json/version")).slice(0, 120)); } catch (e) { console.log("VERFAIL " + e.message.slice(0, 100)); }
  const targets = await httpGet("/json/list");
  const page = targets.find(t => t.type === "page");
  console.log("PAGE", page && page.url);
  const c = new CDP(page.webSocketDebuggerUrl);
  await c.connect();
  console.log("WS-OK");
  await c.send("Page.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await c.send("Page.navigate", { url: "http://localhost:8182/index.html" });
  console.log("NAV-DONE");
  await new Promise(r => setTimeout(r, 9000));
  async function shot(name, click) {
    if (click) {
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: click[0], y: click[1], button: "left", clickCount: 1 });
      await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: click[0], y: click[1], button: "left", clickCount: 1 });
      await new Promise(r => setTimeout(r, 600));
    }
    const r = await c.send("Page.captureScreenshot", { format: "png" });
    require("fs").writeFileSync(name, Buffer.from(r.result.data, "base64"));
    console.log("SHOT", name, require("fs").statSync(name).size);
  }
  await shot("F:\\SublimationProject\\foresight\\test\\shot-home14.png", null);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-drawer-open.png", [1233, 379]);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-drawer-sea.png", [1501, 665]);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-drawer-move.png", [440, 736]);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-drawer-moved.png", [1251, 393]);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-drawer-open2.png", [1233, 379]);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-auto.png", [1636, 44]);
  await shot("F:\\SublimationProject\\foresight\\test\\shot-drawer-closed.png", [560, 60]);
// 政策面板：底栏第 2 个按钮（国策），验证 ic-* 图标渲染
await shot("F:\\SublimationProject\\foresight\\test\\shot-panel-policy.png", [720, 1044]);
await shot("F:\\SublimationProject\\foresight\\test\\shot-panel-dialog.png", [[720, 1044], [246, 316]]); // 国策面板 -> 点方舱医院节点 -> 详情对话框
  edge.kill();
  process.exit(0);
})().catch(e => { console.log("ERR", e.message.slice(0, 200)); process.exit(1); });

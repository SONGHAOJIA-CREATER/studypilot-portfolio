// 通用验证截图：node shot2.js <url> <outDir> [scrollSteps]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL_ = process.argv[2];
const outDir = process.argv[3] || '.';
const PORT = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let msgId = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = e => {
      let m; try { m = JSON.parse(e.data ?? e); } catch { return; }
      if (m.id === id) { ws.removeEventListener('message', onMsg);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--window-size=1280,900',
    `--remote-debugging-port=${PORT}`, '--user-data-dir=' + path.join(process.env.TEMP, 'sp-shot2-profile'),
    'about:blank'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {}
      await sleep(250);
    }
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    await send(ws, 'Page.enable');
    await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send(ws, 'Page.navigate', { url: URL_ });
    await sleep(3500);
    const errs = await send(ws, 'Runtime.evaluate', { expression: 'window.__errs ? JSON.stringify(window.__errs) : "none"' });
    const total = await send(ws, 'Runtime.evaluate', { expression: 'document.body.scrollHeight' });
    const H = total.result.value, steps = Math.ceil(H / 900);
    console.log('pageHeight', H, 'steps', steps);
    for (let i = 0; i < steps; i++) {
      await send(ws, 'Runtime.evaluate', { expression: `window.scrollTo(0, ${i * 900})` });
      await sleep(900);
      const shot = await send(ws, 'Page.captureScreenshot', { format: 'jpeg', quality: 72 });
      fs.writeFileSync(path.join(outDir, `v_${String(i).padStart(2, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
    }
    console.log('done');
    ws.close();
  } finally { edge.kill('SIGKILL'); }
})().catch(e => { console.error(e); process.exit(1); });

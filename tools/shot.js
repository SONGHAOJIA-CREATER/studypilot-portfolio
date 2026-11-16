// Headless Edge CDP screenshot tool: capture each SPA view of StudyPilot
// Usage: node shot.js <outDir>
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8020/app/';
const PORT = 9333;
const outDir = process.argv[2] || '.';

const views = ['today', 'plan', 'sources', 'reflection', 'evidence', 'settings'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitDebugger() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('debugger not ready');
}

let msgId = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = e => {
      let m;
      try { m = JSON.parse(e.data ?? e); } catch { return; }
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--window-size=1280,1600',
    `--remote-debugging-port=${PORT}`, '--user-data-dir=' + path.join(process.env.TEMP, 'sp-shot-profile'),
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitDebugger();
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    await send(ws, 'Page.enable');
    await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 1600, deviceScaleFactor: 1, mobile: false });
    await send(ws, 'Page.navigate', { url: BASE });
    await sleep(3500); // wait for backend data

    for (const v of views) {
      if (v !== 'today') {
        await send(ws, 'Runtime.evaluate', { expression: `document.querySelector('[data-nav="${v}"]').click()` });
        await sleep(1200);
      }
      await send(ws, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
      await sleep(300);
      const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `${v}.png`), Buffer.from(shot.data, 'base64'));
      console.log('saved', v);
    }
    ws.close();
  } finally {
    edge.kill('SIGKILL');
  }
})().catch(e => { console.error(e); process.exit(1); });

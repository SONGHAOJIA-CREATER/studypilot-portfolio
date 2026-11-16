// 极简静态服务器：支持 npm run dev -- --port <PORT> 或 PORT 环境变量
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
let port = Number(process.env.PORT) || 7100;
for (let i = 0; i < argv.length; i++) {
  if ((argv[i] === '--port' || argv[i] === '-p') && argv[i + 1]) port = Number(argv[i + 1]);
  else if (/^\d+$/.test(argv[i])) port = Number(argv[i]);
}
const hostArg = argv.indexOf('--host');
const host = hostArg >= 0 && argv[hostArg + 1] ? argv[hostArg + 1] : '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const root = __dirname;
http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, host, () => console.log(`StudyPilot 展示页运行中: http://${host}:${port}/`));

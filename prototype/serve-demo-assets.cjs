// PROTOTYPE — throwaway。仅为截图对比：把 hogee-demo-assets 挂到 :5302。
// 用法：node serve-demo-assets.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'hogee-demo-assets');
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};
http
  .createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (p.endsWith(path.sep) || p.endsWith('/')) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) {
        res.writeHead(404);
        res.end('404');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  })
  .listen(5302, () => console.log('demo-assets on :5302'));

// Relais LOCAL pour l'aperçu web de l'app mobile (http://localhost:8082) — lancé par `npm run preview`.
// Le serveur de production refuse (à juste titre) les pages web d'une autre
// origine (CORS). Ce relais n'écoute que sur 127.0.0.1 (inaccessible depuis
// le réseau), transmet chaque requête telle quelle à l'API de production et
// ajoute les en-têtes CORS pour la seule origine de l'aperçu.
const http = require('http');
const https = require('https');

const TARGET = 'shoneya-2ig5.onrender.com';
const ORIGIN = 'http://localhost:8082';
const PORT = 3002;

http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'content-type,authorization,x-client-platform,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '600',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  const headers = { ...req.headers, host: TARGET };
  delete headers.origin; delete headers.referer; delete headers.cookie;   // pas de cookies : l'app mobile n'utilise que le Bearer
  const up = https.request({ host: TARGET, path: req.url, method: req.method, headers }, (r) => {
    const h = { ...r.headers, ...cors };
    delete h['set-cookie'];
    res.writeHead(r.statusCode || 502, h);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ message: 'Relais : ' + e.message })); });
  req.pipe(up);
}).listen(PORT, '127.0.0.1', () => console.log(`Relais aperçu prêt : http://localhost:${PORT} → https://${TARGET}`));

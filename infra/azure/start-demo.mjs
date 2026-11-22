import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import next from 'next';
import { createApp } from '../../backend/src/app.mjs';
import { openStore } from '../../backend/src/store.mjs';

const port = Number(process.env.PORT || 3000);
const hostname = process.env.WEBSITE_HOSTNAME;
const origin = hostname ? `https://${hostname}` : `http://127.0.0.1:${port}`;
const frontend = next({
  dev: false,
  dir: fileURLToPath(new URL('../../frontend/', import.meta.url)),
  port,
});
const handlePage = frontend.getRequestHandler();
await frontend.prepare();

const store = openStore(':memory:');
const api = createApp(store, { origin });
const server = createServer((request, response) => {
  const path = request.url.split('?')[0];
  if (path === '/api' || path.startsWith('/api/')) {
    api(request, response);
    return;
  }
  void handlePage(request, response).catch((error) => {
    console.error(error);
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(500).end('Error interno');
  });
});
server.listen(port, '0.0.0.0');

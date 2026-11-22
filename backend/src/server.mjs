import { createApp } from './app.mjs';
import { openStore } from './store.mjs';

const store = openStore(process.env.DATABASE_FILE || '.data/mercaorden.sqlite');
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = createApp(store, { origin: process.env.APP_ORIGIN }).listen(port, host, () => {
  console.log(`MercaOrden API escucha en http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => store.close()));
}

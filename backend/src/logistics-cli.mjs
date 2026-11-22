import { openStore } from './store.mjs';
import { parseWindow } from './logistics-time.mjs';

const [action, ...args] = process.argv.slice(2);
const window = action === '--ventana' ? parseWindow(args) : undefined;
if (!window) {
  console.error('Uso: npm run logistics -- --ventana B-01 AAAA-MM-DD HH:mm HH:mm load|unload cupos');
  process.exit(1);
}

const store = openStore(process.env.DATABASE_FILE || '.data/mercaorden.sqlite');
try {
  const result = store.addLogisticsWindow(window);
  if (result) console.log('Ventana registrada: ' + result.id);
  else {
    console.error('La bahía ya tiene una ventana que coincide con ese horario.');
    process.exitCode = 1;
  }
} finally {
  store.close();
}

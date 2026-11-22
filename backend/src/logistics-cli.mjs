import { openStore } from './store.mjs';
import { parseWindow } from './logistics-time.mjs';

const [action, ...args] = process.argv.slice(2);
const window = action === '--ventana' ? parseWindow(args) : undefined;
const agent = action === '--agente' && args.length === 1 ? args[0].trim().toLowerCase() : '';
if (!window && !agent) {
  console.error('Uso: npm run logistics -- --ventana B-01 AAAA-MM-DD HH:mm HH:mm load|unload cupos');
  console.error('     npm run logistics -- --agente correo-de-la-cuenta');
  process.exit(1);
}

const store = openStore(process.env.DATABASE_FILE || '.data/mercaorden.sqlite');
try {
  const result = window ? store.addLogisticsWindow(window) : store.grantLogisticsAgent(agent);
  if (result) console.log(window ? 'Ventana registrada: ' + result.id : 'Cuenta habilitada como agente de acceso.');
  else {
    console.error(window ? 'La bahía ya tiene una ventana que coincide con ese horario.' : 'La cuenta aún no está registrada.');
    process.exitCode = 1;
  }
} finally {
  store.close();
}

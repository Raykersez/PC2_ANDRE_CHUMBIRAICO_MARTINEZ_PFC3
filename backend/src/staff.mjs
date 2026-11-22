import { openStore } from './store.mjs';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run staff -- correo-de-la-cuenta');
  process.exit(1);
}

const store = openStore(process.env.DATABASE_FILE || '.data/mercaorden.sqlite');
try {
  if (store.promoteStaff(email)) console.log('Cuenta autorizada para consultar expedientes.');
  else {
    console.error('La cuenta aún no está registrada.');
    process.exitCode = 1;
  }
} finally {
  store.close();
}

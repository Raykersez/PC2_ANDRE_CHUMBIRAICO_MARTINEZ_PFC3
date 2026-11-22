import { categories, openStore, stallCodePattern } from './store.mjs';

const [action, ...args] = process.argv.slice(2);
const [value, rawLocation, category] = args;
const stall = { code: value?.trim().toUpperCase(), location: rawLocation?.trim(), category };
const validStall = action === '--puesto' && args.length === 3 && stallCodePattern.test(stall.code ?? '')
  && stall.location?.length >= 1 && stall.location.length <= 120 && categories.includes(category);
const adminEmail = action === '--administrador' && args.length === 1 ? value.trim().toLowerCase() : '';
const certifierEmail = action === '--certificador' && args.length === 1 ? value.trim().toLowerCase() : '';
const controllerEmail = action === '--control-estibaje' && args.length === 1 ? value.trim().toLowerCase() : '';
const evaluatorEmail = action && !action.startsWith('--') && !args.length ? action.trim().toLowerCase() : '';
if (!validStall && !adminEmail && !certifierEmail && !controllerEmail && !evaluatorEmail) {
  console.error('Uso: npm run staff -- correo | --administrador correo | --certificador correo | --control-estibaje correo | --puesto código "ubicación" "rubro"');
  console.error('Rubros: ' + categories.join(', '));
  process.exit(1);
}

const store = openStore(process.env.DATABASE_FILE || '.data/mercaorden.sqlite');
try {
  if (validStall && store.addStall(stall)) console.log('Puesto incorporado al catálogo.');
  else if (adminEmail && store.grantMarketAdmin(adminEmail)) console.log('Cuenta habilitada como administradora del mercado.');
  else if (certifierEmail && store.grantStevedoreRole(certifierEmail, 'certifier')) console.log('Cuenta habilitada como certificadora municipal.');
  else if (controllerEmail && store.grantStevedoreRole(controllerEmail, 'controller')) console.log('Cuenta habilitada para el control de credenciales.');
  else if (evaluatorEmail && store.promoteStaff(evaluatorEmail)) console.log('Cuenta autorizada para consultar expedientes.');
  else {
    console.error(validStall ? 'Ya existe un puesto con ese código.' : 'La cuenta aún no está registrada.');
    process.exitCode = 1;
  }
} finally {
  store.close();
}

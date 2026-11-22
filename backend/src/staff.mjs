import { categories, openStore, stallCodePattern } from './store.mjs';
import { parseTariffCommand } from './tariffs.mjs';
import { wastePointPattern } from './waste-store.mjs';

const [action, ...args] = process.argv.slice(2);
const [value, rawLocation, category] = args;
const stall = { code: value?.trim().toUpperCase(), location: rawLocation?.trim(), category };
const validStall = action === '--puesto' && args.length === 3 && stallCodePattern.test(stall.code ?? '')
  && stall.location?.length >= 1 && stall.location.length <= 120 && categories.includes(category);
const adminEmail = action === '--administrador' && args.length === 1 ? value.trim().toLowerCase() : '';
const certifierEmail = action === '--certificador' && args.length === 1 ? value.trim().toLowerCase() : '';
const controllerEmail = action === '--control-estibaje' && args.length === 1 ? value.trim().toLowerCase() : '';
const coordinatorEmail = action === '--coordinar-estibaje' && args.length === 1 ? value.trim().toLowerCase() : '';
const inspectorEmail = action === '--inspector-sanitario' && args.length === 1 ? value.trim().toLowerCase() : '';
const wasteEmail = action === '--encargado-residuos' && args.length === 1 ? value.trim().toLowerCase() : '';
const wastePoint = value?.trim().toUpperCase();
const wasteZone = rawLocation?.trim();
const validWastePoint = action === '--punto-acopio' && args.length === 3 && wastePointPattern.test(wastePoint ?? '')
  && wasteZone?.length >= 1 && wasteZone.length <= 120 && ['activo', 'inactivo'].includes(category);
const evaluatorEmail = action && !action.startsWith('--') && !args.length ? action.trim().toLowerCase() : '';
const tariff = parseTariffCommand(action, args);
if (!validStall && !adminEmail && !certifierEmail && !controllerEmail && !coordinatorEmail && !inspectorEmail && !evaluatorEmail
  && !tariff && !wasteEmail && !validWastePoint) {
  console.error('Uso: npm run staff -- correo | --administrador correo | --certificador correo | --control-estibaje correo | --puesto código "ubicación" "rubro"');
  console.error('Rubros: ' + categories.join(', '));
  console.error('Coordinación: --coordinar-estibaje correo');
  console.error('Fiscalización: --inspector-sanitario correo');
  console.error('Residuos: --encargado-residuos correo | --punto-acopio código "zona" activo|inactivo');
  console.error('Tarifario: --servicio código "nombre" | --tarifa código monto-en-céntimos "unidad" desde [hasta]');
  process.exit(1);
}

const store = openStore(process.env.DATABASE_FILE || '.data/mercaorden.sqlite');
try {
  if (tariff) {
    const saved = tariff.type === 'service' ? store.addStevedoreService(tariff) : store.addStevedoreTariff(tariff);
    if (saved) console.log(tariff.type === 'service' ? 'Servicio incorporado al catálogo.' : 'Versión de tarifa publicada.');
    else {
      console.error(tariff.type === 'service' ? 'Ya existe un servicio con ese código.' :
        'El servicio no existe o ya hay una tarifa publicada con esa fecha de inicio.');
      process.exitCode = 1;
    }
  } else if (validWastePoint) {
    store.setWastePoint(wastePoint, wasteZone, category === 'activo');
    console.log('Punto de acopio actualizado.');
  } else if (validStall && store.addStall(stall)) console.log('Puesto incorporado al catálogo.');
  else if (adminEmail && store.grantMarketAdmin(adminEmail)) console.log('Cuenta habilitada como administradora del mercado.');
  else if (certifierEmail && store.grantStevedoreRole(certifierEmail, 'certifier')) console.log('Cuenta habilitada como certificadora municipal.');
  else if (controllerEmail && store.grantStevedoreRole(controllerEmail, 'controller')) console.log('Cuenta habilitada para el control de credenciales.');
  else if (coordinatorEmail && store.grantStevedoreRole(coordinatorEmail, 'coordinator')) console.log('Cuenta habilitada para coordinar el estibaje.');
  else if (inspectorEmail && store.grantSanitaryRole(inspectorEmail, 'inspector')) console.log('Cuenta habilitada para inspección sanitaria.');
  else if (wasteEmail && store.grantSanitaryRole(wasteEmail, 'waste-recorder')) console.log('Cuenta habilitada para registrar acopio.');
  else if (evaluatorEmail && store.promoteStaff(evaluatorEmail)) console.log('Cuenta autorizada para consultar expedientes.');
  else {
    console.error(validStall ? 'Ya existe un puesto con ese código.' : 'La cuenta aún no está registrada.');
    process.exitCode = 1;
  }
} finally {
  store.close();
}

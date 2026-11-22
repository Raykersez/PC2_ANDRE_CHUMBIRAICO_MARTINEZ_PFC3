# Evidencia de CLP-6

Desde la raíz, ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/decisions.test.mjs) usa SQLite en memoria y cuentas sintéticas. Verifica aprobación, observación, validación, privacidad del expediente, rechazo de otro rol y conservación de la primera decisión incluso con dos peticiones concurrentes.

## Revisión en navegador

1. Ejecuta npm run dev:api y npm run dev:web. Crea dos cuentas sintéticas como titular y evaluador.
2. Desde la raíz, ejecuta npm run staff -- evaluador@example.invalid para habilitar el rol. Abre el portal con esa cuenta.
3. Envía dos solicitudes sintéticas desde la cuenta titular. Desde la cuenta evaluadora, consulta cada código. Aprueba una tras confirmar los requisitos y observa la otra indicando que falta el sustento comercial.
4. Abre ambas en Mis solicitudes como titular. Comprueba el estado, la fecha de resolución y el motivo en la observada.
5. Abre un expediente pendiente en dos pestañas con la cuenta evaluadora. Guarda una decisión en la primera y envía otra en la segunda. Comprueba el aviso, pulsa Recargar estado y confirma que aparece la primera decisión.

La comprobación interactiva queda pendiente. Los casos de API se ejecutan en CI con npm test.

Resultado local: documentación válida, 9 pruebas aprobadas y compilación de Next.js con chequeo de TypeScript correcto.

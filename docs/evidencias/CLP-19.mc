# Evidencia de CLP-19

Desde la raíz ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/operations.test.mjs) usa cuentas y puestos sintéticos. Incluye cantidad positiva, cero y negativa, unidad ausente o desconocida, validación de fecha y producto, reenvíos simultáneos y aislamiento entre dos puestos.

## Revisión en navegador

1. Inicia la API y el frontend. Prepara dos cuentas de comerciantes y dos puestos siguiendo la [evidencia de CLP-7](CLP-7.mc).
2. Ingresa como uno de los comerciantes. En Operaciones registra una fecha, el producto Manzanas de prueba y 12.5 kg. Verifica la confirmación y el historial de tu puesto.
3. Envía otra operación con cantidad cero y sin unidad. Comprueba los mensajes junto a los campos y que se conservan la fecha y el producto.
4. Recarga la página y confirma que el registro se conserva. Abre otra sesión con el segundo comerciante y comprueba que su historial es independiente.

Queda pendiente la revisión interactiva.

Resultado local sobre EP-01 actualizado: documentación válida, 12 pruebas aprobadas y compilación de Next.js con chequeo de TypeScript correcto.

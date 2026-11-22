# Evidencia de CLP-8

Ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/stevedores.test.mjs) usa una base SQLite en memoria, documentos generados en el test y dos cuentas sintéticas. Comprueba formato y tamaño inválidos, reenvíos concurrentes, acceso a adjuntos y aislamiento entre cuentas.

Para revisar en navegador, inicia la API y el frontend, abre /estibadores y usa una cuenta example.invalid. Envía documentos sintéticos, comprueba el número y el estado, y repite el envío con el mismo documento usando puntuación. La revisión interactiva queda pendiente.

Resultado local: documentación válida, 13 pruebas aprobadas y compilación de Next.js con TypeScript correcta.

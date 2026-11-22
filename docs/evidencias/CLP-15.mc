# Evidencia de CLP-15

Ejecuta npm test, npm run build y node scripts/check-docs.mjs. La [prueba de EP-04](../../backend/test/sanitary.test.mjs) cubre criterios completos e incompletos, permisos, versión, historial y reenvíos concurrentes con SQLite en memoria.

En una base de pruebas registra un puesto sintético y una cuenta example.invalid. Ejecuta npm run staff -- --inspector-sanitario inspector@example.invalid. Abre /sanidad en móvil, responde parcialmente y envía para ver los errores. Recarga la pestaña, completa el borrador y verifica el resultado en el historial. Revisión interactiva y artefacto remoto pendientes.

Resultado local: 26 pruebas aprobadas, compilación correcta y documentación válida.

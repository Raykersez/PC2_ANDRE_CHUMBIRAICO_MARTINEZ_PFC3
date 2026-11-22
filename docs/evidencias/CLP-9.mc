# Evidencia de CLP-9

Ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/stevedores.test.mjs) verifica autorización, motivo, revisión única y visibilidad de la referencia solo para certificadores.

Para revisar en navegador, registra una cuenta sintética y habilítala con npm run staff -- --certificador certificador@example.invalid. En /estibadores, abre un expediente sintético por su código. Verifica uno tras confirmar los documentos y observa otro con un motivo. Repite desde el titular y comprueba que ve el resultado y el motivo aplicable. Usa referencias ficticias. La revisión interactiva queda pendiente.

Resultado local: documentación válida, 14 pruebas aprobadas y compilación de Next.js correcta.

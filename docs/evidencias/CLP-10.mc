# Evidencia de CLP-10

Ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/stevedores.test.mjs) usa cuentas sintéticas, SQLite en memoria y un reloj controlado. Comprueba emisión concurrente, rechazo de un expediente observado, generación del PNG, consulta pública mínima y credenciales vencidas y revocadas.

Para revisar en navegador, habilita una cuenta sintética con npm run staff -- --control-estibaje control@example.invalid. En /estibadores, busca un expediente verificado y emite la credencial. Escanea el QR o abre su enlace, comprueba su estado y vuelve a consultar después de revocarlo. Para escanear desde otro dispositivo, APP_ORIGIN debe ser una URL alcanzable desde ese dispositivo. La revisión interactiva y la ejecución remota de CodeQL quedan pendientes.

Resultado local: documentación válida, 15 pruebas aprobadas y compilación de Next.js correcta.

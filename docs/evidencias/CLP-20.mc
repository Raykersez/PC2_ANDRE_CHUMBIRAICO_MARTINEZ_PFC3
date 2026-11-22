# Evidencia de CLP-20

Ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/tariffs.test.mjs) usa SQLite en memoria, montos ficticios y un reloj controlado. Verifica el segundo anterior a medianoche en Lima, el instante de cambio, el vencimiento, un servicio sin tarifa y la conservación de la versión histórica.

Para comprobar en navegador, usa una base de pruebas. Ejecuta npm run staff -- --servicio CARGA "Carga sintética". Después ejecuta npm run staff -- --tarifa CARGA 850 "tonelada" 2026-11-21, usando una fecha de inicio anterior o igual al día de la prueba. Abre /estibadores/tarifario y verifica S/ 8.50 por tonelada. Añade otro servicio sintético sin tarifa, selecciónalo y comprueba el aviso. La revisión interactiva y la ejecución remota de la revisión de dependencias quedan pendientes.

Resultado local: documentación válida, 16 pruebas aprobadas y compilación de Next.js correcta.

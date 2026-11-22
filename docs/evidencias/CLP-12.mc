# Evidencia de CLP-12

Ejecuta node scripts/check-docs.mjs, npm test y npm run build. La [prueba de integración](../../backend/test/logistics.test.mjs) usa horarios sintéticos, SQLite en memoria y un reloj fijo. Comprueba filtros, respuesta vacía y el límite de inicio en Lima.

En una base de pruebas registra una ventana futura con npm run logistics -- --ventana B-01 2099-11-21 10:00 11:00 load 1. Abre /vehiculos, elige esa fecha y Carga. Comprueba la bahía, el horario y el cupo. Busca otra fecha para verificar el aviso. La revisión interactiva queda pendiente.

Resultado local: 14 pruebas aprobadas, compilación correcta y documentación válida.

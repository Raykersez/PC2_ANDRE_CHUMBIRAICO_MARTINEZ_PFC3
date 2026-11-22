# Evidencia de CLP-14

La [prueba automatizada](../../backend/test/logistics.test.mjs) usa SQLite en memoria, placas y cuentas sintéticas y un reloj controlado. Comprueba autorización, placa distinta, llegada temprana, límite del fin, revalidación y confirmaciones simultáneas que conservan una única hora.

Para verificar en navegador, reserva un turno sintético siguiendo [CLP-13](CLP-13.mc). Habilita una segunda cuenta con npm run logistics -- --agente agente@example.invalid. Dentro del horario, abre Control de ingreso, verifica código y placa, y confirma. Comprueba la bahía y la hora. Repite la confirmación y verifica que conserva el ingreso original. La revisión interactiva queda pendiente.

Resultado local: 16 pruebas aprobadas, compilación correcta y documentación válida.

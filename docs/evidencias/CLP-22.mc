# Evidencia de CLP-22

La [prueba automatizada](../../backend/test/logistics.test.mjs) usa SQLite en memoria, cuentas sintéticas y reloj controlado. Comprueba rechazo si falta ingreso, si la salida es anterior al ingreso o si ya se cerró el turno. Valida la permanencia de dos minutos completos, la aceptación de marcas iguales y la conservación de la primera salida en peticiones simultáneas.

Para comprobar en navegador, sigue [CLP-14](CLP-14.mc) y registra el ingreso de un vehículo de prueba. Selecciona Confirmar salida y revisa el estado Cerrado, las dos horas y la permanencia. Vuelve a verificar el mismo código y comprueba que el turno muestra las marcas originales. La revisión interactiva queda pendiente.

Resultado local: 18 pruebas aprobadas, compilación correcta y documentación válida.

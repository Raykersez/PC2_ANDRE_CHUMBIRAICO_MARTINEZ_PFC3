# Evidencia de CLP-21

La [prueba automatizada](../../backend/test/logistics.test.mjs) usa SQLite en memoria, un turno sintético con un cupo, dos cuentas de transporte y un agente. Verifica titularidad, reenvíos simultáneos, liberación de un único cupo, conservación del historial y rechazo de cancelaciones al comenzar la ventana o con ingreso registrado.

Para comprobar en navegador, reserva un turno futuro siguiendo [CLP-13](CLP-13.mc). Cancélalo desde Mis turnos, verifica el estado Cancelado y vuelve a consultar la misma fecha. Comprueba que aparece un cupo para otra cuenta. La revisión interactiva queda pendiente.

Resultado local: 17 pruebas aprobadas, compilación correcta y documentación válida.

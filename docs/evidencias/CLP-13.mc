# Evidencia de CLP-13

La [prueba automatizada](../../backend/test/logistics.test.mjs) usa dos cuentas y un único cupo. Confirma una respuesta 201 y otra 409 con peticiones simultáneas. Comprueba placa inválida, coincidencia horaria entre bahías para la misma placa, privacidad de Mis turnos y exclusión de una ventana llena.

Para comprobar en navegador, crea una ventana de un cupo siguiendo [CLP-12](CLP-12.mc). Accede con una cuenta de prueba, elige la ventana e ingresa ABC-123. Comprueba el código y que el horario deja de figurar como disponible. La revisión interactiva queda pendiente.

Resultado local: 15 pruebas aprobadas, compilación correcta y documentación válida.

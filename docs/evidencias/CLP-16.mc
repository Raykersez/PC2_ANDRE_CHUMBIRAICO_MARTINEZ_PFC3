# Evidencia de CLP-16

La [prueba automatizada](../../backend/test/sanitary.test.mjs) usa SQLite en memoria, dos comercios, un inspector y una imagen sintética. Comprueba el rechazo de plazo anticipado, criterio conforme y formato falso. El inspector y titular descargan la evidencia y una cuenta ajena recibe 404 aunque conozca el identificador.

En /sanidad abre una inspección no conforme de prueba. Registra el motivo y la acción correctiva. Prueba primero un plazo anterior y luego uno válido conservando los campos. Accede con el titular y con otra cuenta para comparar lo que ven. Revisión interactiva pendiente.

Resultado local: 27 pruebas aprobadas, compilación correcta y documentación válida.

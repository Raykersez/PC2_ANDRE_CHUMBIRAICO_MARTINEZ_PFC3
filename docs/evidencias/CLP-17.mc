# Evidencia de CLP-17

La [prueba de EP-04](../../backend/test/sanitary.test.mjs) usa SQLite en memoria y registros sintéticos. Comprueba peso cero, negativo, inválido, fuera de la representación segura y menor que un gramo. También verifica el mínimo válido, el punto inactivo, los permisos y el reenvío concurrente.

En una base de pruebas ejecuta npm run staff -- --punto-acopio AC-01 "Descarga Norte sintética" activo y habilita una cuenta con npm run staff -- --encargado-residuos residuos@example.invalid. Abre /sanidad, intenta guardar un peso cero y después registra 1.234 kg. Comprueba punto, zona, hora y responsable. Revisión interactiva pendiente.

Resultado local: 29 pruebas aprobadas, compilación correcta y documentación válida.

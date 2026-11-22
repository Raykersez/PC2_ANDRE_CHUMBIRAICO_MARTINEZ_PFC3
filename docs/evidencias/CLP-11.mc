# Evidencia de CLP-11

Ejecuta node scripts/check-docs.mjs, npm test y npm run build desde la raíz. La [prueba de integración](../../backend/test/service-assignments.test.mjs) usa SQLite en memoria, un reloj controlado, montos ficticios y cuentas sintéticas. Comprueba que un tercero no lee solicitudes ajenas, que un rol sin permiso no asigna, que solo una de dos asignaciones simultáneas superpuestas se confirma, que se aceptan franjas contiguas y que la revocación o el vencimiento impiden confirmar. También comprueba la conservación del primer monto y el rechazo si la versión del tarifario cambia.

## Revisión interactiva

1. Usa una base de pruebas y registra un servicio y una tarifa siguiendo [CLP-20](CLP-20.mc). Prepara un estibador verificado con credencial activa siguiendo [CLP-9](CLP-9.mc) y [CLP-10](CLP-10.mc).
2. Habilita una cuenta sintética con npm run staff -- --coordinar-estibaje coordinador@example.invalid.
3. Como comerciante, abre /estibadores/servicios y registra dos solicitudes con el mismo servicio y franjas futuras superpuestas.
4. Como coordinador, consulta el monto y el estibador, confirma una solicitud y verifica que conserva el responsable, monto y versión. Comprueba que el mismo estibador ya no aparece como disponible para la segunda.
5. Publica una versión de prueba con un monto distinto y verifica que el historial sigue mostrando la tarifa de la primera asignación.

La revisión interactiva queda pendiente.

Resultado local: 23 pruebas aprobadas, compilación y chequeo de TypeScript correctos, y enlaces de documentación verificados.

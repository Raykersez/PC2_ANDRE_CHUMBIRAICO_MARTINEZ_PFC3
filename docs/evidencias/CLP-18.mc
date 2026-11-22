# Evidencia de CLP-18

Ejecuta node scripts/check-docs.mjs, npm test y npm run build desde la raíz. La [prueba de integración](../../backend/test/assignments.test.mjs) usa dos cuentas sintéticas de comerciantes. Comprueba que el titular ve el código y la ubicación de su puesto o el motivo de su observación. La otra cuenta recibe 404 aunque conozca los códigos y una consulta sin sesión recibe 401.

## Revisión en navegador

1. Sigue la [preparación de CLP-7](CLP-7.mc) con cuentas y puestos sintéticos. Registra también un segundo expediente y obsérvalo siguiendo [CLP-6](CLP-6.mc).
2. Como titular, abre Mis solicitudes y elige el expediente observado. Verifica Observada y el motivo de subsanación.
3. Abre el expediente aprobado. Cuando se confirme la asignación, pulsa Recargar estado y comprueba el código y la ubicación del puesto.
4. En otra sesión de comerciante, verifica que Mis solicitudes solo contiene expedientes de la cuenta activa.

Queda pendiente la revisión interactiva.

Resultado local: documentación válida, 11 pruebas aprobadas y compilación de Next.js con chequeo de TypeScript correcto.

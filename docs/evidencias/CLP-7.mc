# Evidencia de CLP-7

Ejecuta node scripts/check-docs.mjs, npm test y npm run build desde la raíz. La [prueba de integración](../../backend/test/assignments.test.mjs) usa SQLite en memoria, cuentas sintéticas y un último puesto compatible. Comprueba una respuesta 201 y una respuesta 409 entre dos asignaciones simultáneas y confirma que el puesto deja de figurar entre los disponibles. También cubre rol, rubro, aprobación y duplicados por comerciante.

## Revisión en navegador

1. Inicia npm run dev:api y npm run dev:web. Registra cuentas sintéticas para comerciante, evaluador y administrador.
2. Ejecuta npm run staff -- evaluador@example.invalid y npm run staff -- --administrador admin@example.invalid. Carga un puesto con npm run staff -- --puesto P-01 "Pabellón de prueba" "Frutas".
3. Presenta un expediente sintético de Frutas y apruébalo como evaluador. Como administrador, abre el expediente por código, selecciona P-01 y confirma.
4. Recarga el expediente y comprueba que muestra P-01, su ubicación y la fecha de asignación. Comprueba que el puesto deja de aparecer para otro expediente aprobado del mismo rubro.

La revisión interactiva queda pendiente.

Resultado local: documentación válida, 10 pruebas aprobadas y compilación de Next.js con chequeo de TypeScript correcto.

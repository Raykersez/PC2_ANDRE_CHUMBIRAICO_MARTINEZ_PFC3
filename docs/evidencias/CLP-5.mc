# Evidencia CLP-5 · Validación local

| Dato | Resultado |
| --- | --- |
| Fecha | 21/11/2026, America/Lima |
| Entorno | Windows, Node.js v26.3.0, npm 11.3.0 |
| Rama | `CLP-5-hu-01-registrar-solicitud-de-empadronamiento` |
| Fuente | Copia de trabajo sobre `a468f29`, con implementación local |
| `npm test` | Código 0. Siete pruebas pasaron, correspondientes a la prueba principal y seis subpruebas. |
| `npm run build` | Código 0. Next.js compiló, verificó tipos y generó las rutas estáticas. |
| `node scripts/check-docs.mjs` | Código 0 con la documentación del proyecto. En un repositorio temporal se verificó el rechazo de un cambio de producto sin ficha, la aceptación al añadir la ficha y el rechazo de un enlace roto. |

## Prueba en navegador

1. Abrí el portal local en Next.js con una API y una base SQLite de prueba. Creé una cuenta sintética.
2. Registré el DNI sintético `90000099`, rubro Frutas y dos adjuntos PNG de prueba. El portal mostró el código `MO-282EE8FD2593F3AE` y el estado **Pendiente de revisión**.
3. Volví al formulario y envié `9000-0099` con los mismos adjuntos. El portal informó que ya había una solicitud activa y mostró el código original.

Los resultados de GitHub Actions, Gitleaks y el merge se registrarán con evidencia del PR.

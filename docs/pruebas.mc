# Pruebas

`npm test` ejecuta la suite de integración de [CLP-5](../backend/test/applications.test.mjs) con el runner de Node.js, una API local y datos sintéticos. `npm run build` verifica la compilación y el chequeo de tipos del frontend.

| Caso automatizado | Resultado esperado |
| --- | --- |
| Solicitud válida | Código único, estado pendiente y expediente consultable |
| Documento equivalente con distinto formato | Conservación del expediente original |
| Dos envíos simultáneos | Un solo expediente activo |
| Acceso a adjuntos | Titular y personal autorizado pueden leer ambos adjuntos |
| Adjuntos ausentes, inválidos o mayores a 2 MB | Rechazo de la solicitud |
| Sesión o rol inválidos | Rechazo de operaciones protegidas |

## Validación en navegador

Se verificaron en el portal local el alta con dos archivos sintéticos, la confirmación del expediente y el reenvío con la misma identificación en otro formato. La revisión manual específica con teclado y en una pantalla móvil queda pendiente.

[Evidencia local de CLP-5](evidencias/CLP-5.mc)

La [prueba de contacto](../backend/test/contact.test.mjs) verifica rechazo de un origen ajeno, validación de campos, límite de envíos y persistencia del mensaje aceptado bajo la referencia devuelta por la API. [Evidencia local de CLP-25](evidencias/CLP-25.mc)

La [prueba de CLP-6](../backend/test/decisions.test.mjs) cubre decisiones de personal autorizado, observaciones visibles para el titular y envíos simultáneos.

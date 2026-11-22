# CLP-19 · HU-05: Registrar operaciones comerciales básicas

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-19) · [Evidencia reproducible](../../evidencias/CLP-19.mc)

| Criterio | Implementación |
| --- | --- |
| Registrar fecha, producto, cantidad y unidad para un puesto vigente. | Operaciones en el portal permite guardar y consultar el historial del puesto. Al guardar se confirma el registro y aparece en el historial. |
| Cantidad cero o unidad ausente. | La API devuelve errores de campo. El portal indica qué corregir y conserva los datos. El catálogo de unidades incluye kg, t, unidad, caja y saco. |
| Restringir operaciones al propio puesto. | GET y POST /api/operations usan la cuenta de la sesión para determinar su asignación. El cliente no selecciona el puesto de destino. |
| Evitar duplicados por reenvío. | La clave única por asignación y envío hace que un reintento con los mismos datos devuelva la operación original. Reutilizar la clave con datos distintos devuelve 409. |

La asignación proviene de CLP-7. Integración a EP-01 y a main pendiente.

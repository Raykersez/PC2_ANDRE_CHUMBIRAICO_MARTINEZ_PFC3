# CLP-7 · HU-03: Asignar un puesto formal

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-7) · [Evidencia reproducible](../../evidencias/CLP-7.mc)

- El administrador del mercado busca por código un expediente aprobado y elige un puesto libre compatible con su rubro.
- Al confirmar, el expediente administrativo muestra el código, la ubicación y la fecha de asignación en horario de Lima.
- La asignación se registra en SQLite mediante una transacción. La fila de asignación determina la ocupación del puesto y las restricciones únicas impiden duplicados por puesto, cuenta y documento normalizado.
- Si otro administrador ocupa el puesto primero, la segunda solicitud recibe 409 y puede actualizar la lista. Si el comerciante ya tiene un puesto, la segunda asignación también recibe 409.
- El comando staff permite habilitar cuentas administradoras y cargar el inventario real. El administrador puede asignar puestos y el evaluador conserva la resolución de solicitudes.

GET /api/applications/:code/stalls lista puestos libres compatibles. POST /api/applications/:code/assignment confirma la asignación y devuelve 201.

La vista del puesto para el titular corresponde a CLP-18. Integración a EP-01 y a main pendiente.

[PR #4 hacia EP-01](https://github.com/Raykersez/PC2_ANDRE_CHUMBIRAICO_MARTINEZ_PFC3/pull/4).

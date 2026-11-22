# CLP-18 · HU-04: Consultar el estado de formalización

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-18) · [Evidencia reproducible](../../evidencias/CLP-18.mc)

| Criterio | Implementación |
| --- | --- |
| El titular ve una observación y qué debe subsanar. | En Mis solicitudes abre Mi expediente. El encabezado muestra Observada y el detalle incluye el motivo registrado por el evaluador. |
| El titular ve su puesto vigente. | El expediente aprobado muestra el código y la ubicación del puesto, además de la fecha de asignación. Mientras se espera una asignación, el portal indica el siguiente paso. |
| Conocer el código no concede acceso. | GET /api/applications/:code verifica la sesión y la titularidad antes de leer el motivo o el puesto. Un segundo comerciante recibe 404 y una consulta sin sesión recibe 401. |

Mi expediente permite recargar el estado para consultar una decisión o asignación reciente. La consulta forma parte del portal de empadronamiento.

Integración a EP-01 y a main pendiente.

[PR #5 hacia EP-01](https://github.com/Raykersez/PC2_ANDRE_CHUMBIRAICO_MARTINEZ_PFC3/pull/5).

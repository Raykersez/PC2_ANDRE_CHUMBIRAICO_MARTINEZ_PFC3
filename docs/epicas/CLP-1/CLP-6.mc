# CLP-6 · HU-02: Resolver solicitudes de formalización

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-6) · [Evidencia reproducible](../../evidencias/CLP-6.mc)

| Criterio | Implementación |
| --- | --- |
| Aprobar una solicitud pendiente tras revisar los requisitos. | El evaluador abre el expediente por código, revisa los adjuntos, confirma que cumplen los requisitos y registra la aprobación. |
| Observar una solicitud y comunicar qué debe corregirse. | Se exige un motivo. El titular lo ve en Mis solicitudes al abrir el expediente. |
| Restringir la resolución al evaluador. | El rol existente staff corresponde al evaluador municipal. Un comerciante recibe 403 incluso para un expediente propio. |
| Conservar la primera decisión. | Los cambios de estado y la bitácora se escriben en una transacción. Una segunda decisión recibe 409 y el portal pide recargar el estado. |

POST /api/applications/:code/decision registra el resultado, el motivo cuando corresponde, el ID de la cuenta evaluadora y la fecha UTC. La consulta del expediente muestra la fecha en horario de Lima y reserva el ID de la cuenta al personal autorizado.

## Integración

Rama propia de CLP-6 con destino a EP-01. Integración pendiente.

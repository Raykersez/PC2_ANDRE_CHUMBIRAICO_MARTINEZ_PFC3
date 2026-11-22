# CLP-11 · HU-10: Asignar servicios de estibaje con tarifa trazable

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-11) · [Evidencia reproducible](../../evidencias/CLP-11.mc)

| Criterio | Implementación |
| --- | --- |
| Solicitud registrada, tarifa vigente y estibador disponible y habilitado. | El comerciante registra el servicio y la franja en /estibadores/servicios. El coordinador consulta candidatos y confirma la asignación con la versión de tarifa que revisó. |
| Guardar estibador, franja, monto, versión y responsable. | La solicitud conserva la franja. SQLite registra el expediente del estibador, el monto en céntimos, la unidad, la versión, el responsable y la fecha de confirmación. |
| Rechazar pérdida de habilitación o superposición. | La transacción comprueba que el expediente esté verificado, que la credencial esté activa y que la franja no se superponga. Permite franjas contiguas. |
| Preservar la tarifa acordada y restringir el acceso. | El historial lee el monto guardado. El comerciante solo ve sus solicitudes y el permiso de coordinación se valida en el servidor. |

La tarifa se determina al confirmar según la fecha de Lima. Si la versión cambió desde la consulta, el coordinador debe revisar la nueva tarifa antes de confirmar. La credencial debe estar activa en el momento de confirmar. Las horas ingresadas se interpretan en Lima.

El operador registra cuentas coordinadoras mediante npm run staff -- --coordinar-estibaje correo. La verificación y emisión se mantienen en los permisos de certificación y control de EP-02.

Integración a main y CI remoto pendientes.

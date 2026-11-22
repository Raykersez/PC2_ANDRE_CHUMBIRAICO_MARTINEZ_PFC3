# CLP-12 · HU-11: Consultar ventanas de carga y descarga

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-12) · [Evidencia](../../evidencias/CLP-12.mc)

La ruta pública /vehiculos consulta ventanas por fecha y tipo de operación. Muestra horario de Lima, bahía y cupos. Si no hay ventanas, el campo de fecha sigue disponible para una nueva consulta. La consulta excluye ventanas que ya empezaron. CLP-13 descuenta los turnos registrados y vuelve a validar cupos al reservar.

El operador carga la programación con npm run logistics -- --ventana código fecha inicio fin load|unload cupos. La misma bahía admite ventanas consecutivas y rechaza superposiciones. La aplicación no precarga horarios de producción.

Integración a main y CI remoto pendientes.

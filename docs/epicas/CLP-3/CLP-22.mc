# CLP-22 · HU-15: Cerrar el turno con la salida del vehículo

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-22) · [Evidencia](../../evidencias/CLP-22.mc)

El agente verifica código y placa y confirma la salida de un turno con ingreso. La consulta muestra turno Cerrado, hora de ingreso, hora de salida y permanencia en minutos completos. Las marcas son del servidor y se presentan en hora de Lima. La salida puede registrarse después de finalizar la ventana.

La transacción valida el ingreso, el orden de las marcas y que no haya una salida previa. La primera salida se conserva. Un turno sin ingreso o ya cerrado devuelve 409 con un mensaje que permite identificar el estado.

Integración a main y CI remoto pendientes.

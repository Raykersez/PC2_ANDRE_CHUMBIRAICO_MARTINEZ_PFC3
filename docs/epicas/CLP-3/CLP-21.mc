# CLP-21 · HU-14: Cancelar un turno y liberar el cupo

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-21) · [Evidencia](../../evidencias/CLP-21.mc)

Mis turnos permite al titular confirmar la cancelación antes del inicio, siempre que el turno no tenga ingreso. El servidor verifica identidad, titularidad y hora dentro de la transacción. Una segunda cuenta recibe 404 y un turno iniciado o ingresado recibe 409.

El historial conserva el turno y la marca de cancelación. La disponibilidad excluye inmediatamente los turnos cancelados del conteo. Los reenvíos devuelven la misma cancelación y el código queda inhabilitado para el ingreso.

Integración a main y CI remoto pendientes.

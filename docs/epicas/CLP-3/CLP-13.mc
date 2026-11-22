# CLP-13 · HU-12: Reservar turno para un vehículo

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-13) · [Evidencia](../../evidencias/CLP-13.mc)

El transportista accede a su cuenta en /vehiculos, elige una ventana e ingresa una placa como ABC-123. La API normaliza la placa y devuelve un código TV con placa, fecha, horario de Lima, bahía y operación. Mis turnos lista únicamente los turnos de la cuenta autenticada.

SQLite verifica cupos, inicio de ventana y coincidencias de placa dentro de una transacción inmediata. La disponibilidad se calcula a partir de los turnos guardados. Si se ocupa el último cupo antes de confirmar, el portal actualiza las ventanas para elegir otro horario.

Integración a main y CI remoto pendientes.

# CLP-14 · HU-13: Controlar el ingreso vehicular

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-14) · [Evidencia](../../evidencias/CLP-14.mc)

El agente autorizado verifica el código y la placa en /vehiculos. El ingreso exige una coincidencia y una hora dentro de la ventana. El inicio es inclusivo y el fin exclusivo. Confirmar vuelve a verificar los datos y registra la hora del servidor, la cuenta del agente y la bahía del turno. Repetir la confirmación devuelve el ingreso original.

El operador habilita cuentas con npm run logistics -- --agente correo. Los transportistas sin ese permiso no pueden consultar ni registrar ingresos por este flujo.

Integración a main y CI remoto pendientes.

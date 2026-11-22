# CLP-16 · HU-17: Registrar hallazgo sanitario y plazo de corrección

[Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-16) · [Evidencia](../../evidencias/CLP-16.mc)

El inspector abre un hallazgo desde un criterio no conforme. Se guarda el detalle, la acción correctiva, el plazo, el vínculo a la inspección y un adjunto opcional. El formulario conserva los datos cuando el plazo es anterior a la inspección. El titular del puesto ve el hallazgo abierto y puede descargar su evidencia.

La API verifica el permiso de inspección o la titularidad del puesto al consultar archivos. Las evidencias se guardan en SQLite sin nombres originales. Los binarios quedan fuera de los logs de aplicación y de los artefactos de pruebas.

CI remoto e integración a main pendientes.
